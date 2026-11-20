// A party "player" for the balance simulator: it heals the dying, casts its best damage spell or
// cantrip, uses simple class features, and otherwise attacks or closes in. Enemies use the game's
// own AI. It plays reasonably, not brilliantly, so real players should do a little better [inferred].
import {
  act,
  active,
  advance,
  areaCells,
  attackOptions,
  distanceFeet,
  featureList,
  posKey,
  reachable,
  spellChoices,
  targeting,
  targetsFor,
  type CombatState,
  type Combatant,
  type PlayerAction,
} from '../game/combat';
import type { Spell } from '../data/schemas/spell';
import { isObject } from '../game/combat/turn';

const alive = (c: Combatant) => !c.gone && !c.creature.dead && c.creature.hp > 0;
const foes = (s: CombatState) =>
  Object.values(s.combatants).filter((c) => c.side === 'enemy' && alive(c) && !isObject(c));
const dying = (s: CombatState) =>
  Object.values(s.combatants).filter(
    (c) =>
      c.side === 'party' &&
      !c.gone &&
      !c.creature.dead &&
      c.creature.hp === 0 &&
      !c.creature.stable,
  );

/** Try an action; return the new state or null if the game refused it. */
function attempt(s: CombatState, a: PlayerAction): CombatState | null {
  const r = act(s, a);
  return r.error ? null : r.state;
}

const effectsOf = (sp: Spell) => JSON.stringify(sp.effects);
const heals = (sp: Spell) => /"type":"heal"/.test(effectsOf(sp));
const harms = (sp: Spell) => /"type":"damage"/.test(effectsOf(sp));

/** Rough average of a spell's damage dice (for picking the best one). */
function avgDamage(sp: Spell): number {
  let total = 0;
  for (const m of effectsOf(sp).matchAll(/"dice":"(\d*)d(\d+)/g))
    total += Number(m[1] || 1) * ((Number(m[2]) + 1) / 2);
  return total;
}

function tryHeal(s: CombatState, me: Combatant): CombatState | null {
  const down = dying(s);
  if (!down.length) return null;
  for (const ch of spellChoices(me)) {
    if (ch.blocked || !heals(ch.spell) || ch.spell.level === 0) continue;
    const lvl = ch.levels[0];
    if (lvl === undefined) continue;
    const t = targeting(ch.spell, lvl);
    if (t.kind !== 'creatures') continue;
    for (const d of down) {
      if (distanceFeet(me.pos, d.pos) > t.rangeFeet) continue;
      const r = attempt(s, {
        type: 'cast',
        spellId: ch.spell.id,
        slotLevel: lvl,
        targetIds: [d.id],
      });
      if (r) return r;
    }
  }
  // A healer's kit, if someone dying is next to us.
  if ((s.inventory['healers-kit'] ?? 0) > 0)
    for (const d of down)
      if (distanceFeet(me.pos, d.pos) <= 5) {
        const r = attempt(s, { type: 'use-item', itemId: 'healers-kit', targetId: d.id });
        if (r) return r;
      }
  return null;
}

function tryDamageSpell(s: CombatState, me: Combatant): CombatState | null {
  const enemies = foes(s);
  if (!enemies.length) return null;
  const choices = spellChoices(me)
    .filter((c) => !c.blocked && harms(c.spell) && c.spell.castingTime !== 'reaction')
    .sort((a, b) => avgDamage(b.spell) - avgDamage(a.spell));
  for (const ch of choices) {
    // Leveled spells: highest slot available, but keep cantrips at 0.
    const lvl = ch.spell.level === 0 ? 0 : ch.levels.at(-1)!;
    const t = targeting(ch.spell, lvl);
    if (t.kind === 'creatures') {
      const inRange = enemies
        .filter((e) => distanceFeet(me.pos, e.pos) <= t.rangeFeet)
        .sort((a, b) => a.creature.hp - b.creature.hp);
      if (!inRange.length) continue;
      const ids = t.repeat
        ? Array.from({ length: t.count }, (_, i) => inRange[i % inRange.length]!.id)
        : inRange.slice(0, t.count).map((e) => e.id);
      const r = attempt(s, { type: 'cast', spellId: ch.spell.id, slotLevel: lvl, targetIds: ids });
      if (r) return r;
    } else if (t.kind === 'area') {
      // Aim at the enemy whose area catches the most foes and no friends.
      let best: { point: Combatant['pos']; hit: number } | null = null;
      for (const e of enemies) {
        if (distanceFeet(me.pos, e.pos) > Math.max(t.rangeFeet, t.size)) continue;
        const cells = areaCells({ s, rng: { die: () => 1 } } as never, me, ch.spell, e.pos);
        const keys = new Set(cells.map(posKey));
        const friends = Object.values(s.combatants).some(
          (c) => c.side === 'party' && alive(c) && keys.has(posKey(c.pos)),
        );
        if (friends) continue;
        const hit = enemies.filter((x) => keys.has(posKey(x.pos))).length;
        if (hit >= (ch.spell.level === 0 ? 1 : 2) && (!best || hit > best.hit))
          best = { point: e.pos, hit };
      }
      if (!best) continue;
      const r = attempt(s, {
        type: 'cast',
        spellId: ch.spell.id,
        slotLevel: lvl,
        point: best.point,
      });
      if (r) return r;
    }
  }
  return null;
}

function tryAttack(s: CombatState, me: Combatant): CombatState | null {
  for (const o of attackOptions(me).filter((x) => !x.unarmed)) {
    const t = targetsFor(s, me, o)[0];
    if (!t) continue;
    const r = attempt(s, { type: 'attack', targetId: t, optionId: o.id });
    if (r) return r;
  }
  return null;
}

function tryFeature(s: CombatState, me: Combatant, id: string): CombatState | null {
  const f = featureList(me, s).find((x) => x.id === id && !x.blocked);
  if (!f) return null;
  return attempt(s, { type: 'feature', id: f.id } as PlayerAction);
}

function closeIn(s: CombatState, me: Combatant): CombatState | null {
  const nearest = foes(s).sort(
    (a, b) => distanceFeet(me.pos, a.pos) - distanceFeet(me.pos, b.pos),
  )[0];
  if (!nearest) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const [k, v] of reachable(s, me, me.turn.movement)) {
    const p = v.path.at(-1);
    if (p && distanceFeet(p, nearest.pos) < bestD) {
      bestD = distanceFeet(p, nearest.pos);
      best = k;
    }
  }
  if (!best || best === posKey(me.pos)) return null;
  const [x, y] = best.split(',').map(Number);
  return attempt(s, { type: 'move', to: { x: x!, y: y! } });
}

/** Still this hero's turn, with nothing in the way? */
const mine = (s: CombatState, id: string) => !s.outcome && !s.prompt && active(s).id === id;

/** One whole party turn. */
export function simTurn(s: CombatState): CombatState {
  if (s.prompt) return act(s, { type: 'react', accept: true }).state;
  const id = active(s).id;
  let state = s;
  const step = (f: (st: CombatState, me: Combatant) => CombatState | null) => {
    if (!mine(state, id)) return false;
    const r = f(state, active(state));
    if (r) state = r;
    return !!r;
  };
  // Bonus-action openers.
  step((st, me) => tryFeature(st, me, 'rage'));
  if (active(state).creature.hp < active(state).creature.maxHp / 2)
    step((st, me) => tryFeature(st, me, 'second-wind'));
  // Main action: save a dying friend, else blast, else hit, else walk in and hit.
  const acted =
    step(tryHeal) ||
    step(tryDamageSpell) ||
    step(tryAttack) ||
    (step(closeIn) && (step(tryDamageSpell) || step(tryAttack)));
  // Fighters: Action Surge for a second round of attacks.
  if (acted && step((st, me) => tryFeature(st, me, 'action-surge'))) step(tryAttack);
  // Extra Attack: keep attacking while attacks remain.
  for (let i = 0; i < 3 && mine(state, id) && active(state).turn.attacksLeft > 0; i++)
    if (!step(tryAttack)) break;
  if (mine(state, id)) state = act(state, { type: 'end-turn' }).state;
  return state;
}

/** Play a fight to the end. */
export function simPlay(s: CombatState, maxSteps = 3000): CombatState {
  let state = s;
  for (let i = 0; i < maxSteps && !state.outcome; i++) {
    if (state.prompt) state = act(state, { type: 'react', accept: true }).state;
    else if (active(state).side === 'enemy') state = advance(state);
    else state = simTurn(state);
  }
  return state;
}
