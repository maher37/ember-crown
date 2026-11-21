import type { DifficultyId } from '../../data/schemas/difficulty';
import type { Encounter } from '../../data/schemas/encounter';
import { getMonster, monsterToCreature } from '../creatures';
import { hasSubclass, type Hero } from '../hero';
import { hasItem, hasSpecial } from '../items';
import {
  abilityCheck,
  abilityModifier,
  deathSave,
  effectiveSpeed,
  hasCondition,
  isDying,
  isIncapacitated,
  removeCondition,
  stabilize,
  rollD20,
  describeTotal,
  type RandomSource,
  roll,
} from '../../rules';
import { attackOptions, makeAttack, type AttackOption } from './attacks';
import {
  active,
  addEffect,
  classLevel,
  combatSave,
  get,
  hasEffect,
  heroOf,
  produce,
  removeEffect,
  say,
  sayAll,
  spendSlot,
  type Ctx,
  dealDamage,
  isSub,
} from './core';
import { conscious, distanceFeet, moveCost, parseMap } from './grid';
import { enterSquare, startOfTurnZones, zoneSlows } from './zones';
import { giveCondition } from './leaves';
import type { CombatState, Combatant, Pos, TurnState } from './types';

export const freshTurn = (movement: number): TurnState => ({
  actionUsed: false,
  bonusUsed: false,
  movement,
  disengaged: false,
  attacked: false,
  lightWeaponUsed: null,
  sneakAttackUsed: false,
  extraActions: 0,
  bonusSpellCast: false,
  attacksLeft: 0,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Token labels: "Goblin A" → "GA", "Wolf" → "Wf". */
export function enemyShort(name: string): string {
  const m = /^(\w)\w*\s+([A-Z0-9])$/.exec(name);
  if (m) return `${m[1]}${m[2]}`;
  return name.length > 1 ? `${name[0]}${name[name.length - 1]}` : name;
}

export interface StartOptions {
  encounter: Encounter;
  party: Hero[];
  difficulty: DifficultyId;
  rngState: number;
  /** Starting squares for each hero, by hero id (from the Prepare step). */
  formation?: Record<string, Pos>;
  /** Heroes who cast Mage Armor before the fight (spends a 1st-level slot). */
  mageArmor?: string[];
  /** The party's consumables (potions). */
  inventory?: Record<string, number>;
  /** Story flags the fight can read. */
  flags?: Record<string, boolean | number | string>;
}

/** Set up a fight: place everyone, roll initiative (and surprise), and start the first turn. */
export function startCombat(o: StartOptions): CombatState {
  const e = o.encounter;
  const base: CombatState = {
    encounterId: e.id,
    name: e.name,
    difficulty: o.difficulty,
    map: { ...parseMap(e.map.width, e.map.height, e.map.terrain), style: e.map.style },
    round: 1,
    order: [],
    turnIndex: 0,
    combatants: {},
    log: [],
    rngState: o.rngState,
    zones: [],
    outcome: null,
    xpPerPc: e.xpPerPc,
    prompt: null,
    plan: null,
    nonlethal: !!e.nonlethal,
    defeatContinues: !!e.defeatContinues,
    parley: e.parley ?? null,
    parleyTried: [],
    inventory: { ...(o.inventory ?? {}) },
    flags: { ...(o.flags ?? {}) },
  };
  return produce(base, (ctx) => {
    const { s } = ctx;
    const used = new Set<string>();
    o.party.forEach((h, i) => {
      let short = h.name[0]!.toUpperCase();
      if (used.has(short)) short = initials(h.name).padEnd(2, String(i + 1));
      used.add(short);
      const pos = o.formation?.[h.id] ?? { x: e.partyStart[i]![0], y: e.partyStart[i]![1] };
      s.combatants[h.id] = makeCombatant(
        h.id,
        h.name,
        short,
        'party',
        pos,
        structuredClone(h),
        h.speed,
      );
    });
    for (const en of e.enemies.filter((x) => x.difficulties.includes(o.difficulty))) {
      const m = getMonster(en.monster);
      const c = makeCombatant(
        en.id,
        en.name,
        enemyShort(en.name),
        'enemy',
        { x: en.pos[0], y: en.pos[1] },
        monsterToCreature(m, en.id, en.name),
        // Creatures that only fly or hover (wraiths, specters) use their flying speed [inferred:
        // the grid has no height, so flying is walking that ignores nothing]. Objects and the
        // ember-wraith (Bound to the Circle) don't move.
        m.traits.some((t) => t.id === 'object' || t.id === 'bound-to-the-circle')
          ? 0
          : m.speed.walk || m.speed.fly || 0,
      );
      c.monsterId = m.id;
      if (m.spellcasting?.slots) c.monsterSlots = { ...m.spellcasting.slots };
      const rechargeable = m.actions.filter((a) => a.recharge && 'roll' in a.recharge);
      if (rechargeable.length)
        c.recharge = Object.fromEntries(rechargeable.map((a) => [a.id, true]));
      c.tactic = en.tactic;
      s.combatants[en.id] = c;
    }
    // Allies who join the fight (Ser Ida at the Crowning), controlled by the player.
    for (const al of e.allies ?? []) {
      if (al.ifFlag && !o.flags?.[al.ifFlag]) continue;
      const m = getMonster(al.monster);
      const c = makeCombatant(
        al.id,
        al.name,
        enemyShort(al.name),
        'party',
        { x: al.pos[0], y: al.pos[1] },
        monsterToCreature(m, al.id, al.name),
        m.speed.walk || m.speed.fly || 0,
      );
      c.monsterId = m.id;
      s.combatants[al.id] = c;
    }
    // Shield of the Morninglord: resistance to fire while you hold it. Story_Bible §9: Corin's
    // ember bargain can also make him resist fire.
    for (const c of Object.values(s.combatants)) {
      const h = heroOf(c);
      // Story_Review #1: the kindled gifts. Fire resistance for every marked hero, and the
      // warmth that keeps them standing (temporary HP equal to their level at the start of a fight).
      if (h && o.flags?.['kindled_resist'])
        c.effects.push({
          id: 'resist-fire-kindled',
          name: 'Kindled: fire resistance',
          sourceId: c.id,
          tag: 'resistance',
          data: { type: 'fire' },
        });
      if (h && o.flags?.['kindled_vigor'] && !h.dead && h.hp > 0)
        c.creature = { ...c.creature, tempHp: Math.max(c.creature.tempHp, h.level) };
      if (h && h.origin === 'corin' && o.flags?.['ember_resist'])
        c.effects.push({
          id: 'resist-fire-ember',
          name: 'Ember bargain',
          sourceId: c.id,
          tag: 'resistance',
          data: { type: 'fire' },
        });
      if (h && hasSpecial(h, 'resistance-while-held'))
        c.effects.push({
          id: 'resist-fire-shield',
          name: 'Shield of the Morninglord',
          sourceId: c.id,
          tag: 'resistance',
          data: { type: 'fire' },
        });
    }
    // Mage Armor before the fight: free for warlocks with Armor of Shadows, a slot for others.
    for (const c of Object.values(s.combatants)) {
      const h = heroOf(c);
      if (!h || h.equipment.armor) continue;
      const shadows = h.invocations.includes('armor-of-shadows');
      if (shadows || o.mageArmor?.includes(h.id)) {
        if (!shadows) spendSlot(c, 1);
        c.effects.push({ id: 'mage-armor', name: 'Mage Armor', sourceId: c.id, tag: 'mage-armor' });
      }
    }
    say(s, 'head', e.code === 'F2' ? 'Goblins burst from the treeline!' : `${e.name} begins!`);
    rollInitiative(ctx);
    if (e.surprise) rollSurprise(ctx);
    beginTurnLoop(ctx);
  });
}

export function makeCombatant(
  id: string,
  name: string,
  short: string,
  side: Combatant['side'],
  pos: Pos,
  creature: Combatant['creature'],
  speed: number,
): Combatant {
  return {
    id,
    name,
    short,
    side,
    pos,
    initiative: 0,
    dex: creature.abilities.dex,
    creature,
    speed,
    reactionUsed: false,
    surprised: false,
    gone: false,
    effects: [],
    turn: freshTurn(speed),
  };
}

// PHB: Initiative. A Dexterity check; ties go to the higher Dexterity, then the party [inferred].
function rollInitiative(ctx: Ctx): void {
  const { s, rng } = ctx;
  const parts: string[] = [];
  for (const c of Object.values(s.combatants).filter((x) => !isObject(x))) {
    let mod = abilityModifier(c.creature.abilities.dex);
    const h = heroOf(c);
    // PHB: Bard, Jack of All Trades (half proficiency on ability checks, initiative included).
    if (h && h.classId === 'bard' && h.level >= 2) mod += Math.floor(h.proficiencyBonus / 2);
    // DMG: Sentinel Shield (Kell's Shield). Advantage on initiative.
    const r = rollD20(h && hasSpecial(h, 'initiative-advantage') ? 'advantage' : 'normal', rng);
    c.initiative = r.natural + mod;
    parts.push(`${c.name} ${describeTotal(r, mod)}`);
  }
  s.order = Object.values(s.combatants)
    .filter((c) => !isObject(c))
    .sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || (a.side === 'party' ? -1 : 1))
    .map((c) => c.id);
  say(s, 'info', `Initiative: ${parts.join('; ')}`);
  say(
    s,
    'info',
    `Turn order: ${s.order.map((id) => `${get(s, id).name} ${get(s, id).initiative}`).join(', ')}`,
  );
}

/**
 * PHB: Surprise. Hidden attackers roll Stealth; a creature that notices none of them (passive
 * Perception below every Stealth total) is surprised: no move, action or reaction on its first turn.
 */
export function rollSurprise(ctx: Ctx): void {
  const { s, rng } = ctx;
  const sneaks = Object.values(s.combatants).filter((c) => c.side === 'enemy');
  const totals = sneaks.map(
    (c) =>
      abilityCheck(c.creature, 'dex', 0, rng, {
        label: 'Stealth',
        bonuses: [
          { label: 'skill', value: stealthBonus(c) - abilityModifier(c.creature.abilities.dex) },
        ],
      }).total,
  );
  const lowest = Math.min(...totals);
  for (const c of Object.values(s.combatants).filter((x) => x.side === 'party')) {
    const passive = passivePerception(c);
    if (passive < lowest) {
      c.surprised = true;
      c.reactionUsed = true;
      say(s, 'foe', `${c.name} is surprised (passive Perception ${passive} vs Stealth ${lowest})`);
    }
  }
}

export function stealthBonus(c: Combatant): number {
  const h = heroOf(c);
  const dex = abilityModifier(c.creature.abilities.dex);
  if (h)
    return (
      dex +
      (h.expertise.includes('stealth') ? 2 : h.skills.includes('stealth') ? 1 : 0) *
        h.proficiencyBonus
    );
  return c.monsterId ? (getMonster(c.monsterId).skills.stealth ?? dex) : dex;
}

export function passivePerception(c: Combatant): number {
  const h = heroOf(c);
  const wis = abilityModifier(c.creature.abilities.wis);
  if (h)
    return (
      10 +
      wis +
      (h.expertise.includes('perception') ? 2 : h.skills.includes('perception') ? 1 : 0) *
        h.proficiencyBonus
    );
  return 10 + (c.monsterId ? (getMonster(c.monsterId).skills.perception ?? wis) : wis);
}

/** Speed this turn: conditions, exhaustion, Ray of Frost and similar. */
export function speedNow(c: Combatant): number {
  // PHB: Vengeance, Abjure Enemy: the frightened creature's speed is 0.
  if (hasEffect(c, 'rooted') && hasCondition(c.creature, 'frightened')) return 0;
  let base = c.wildShape ? getMonster(c.wildShape.monsterId).speed.walk : c.speed;
  // PHB: Fly gives a 60-ft flying speed.
  if (hasEffect(c, 'flying')) base = Math.max(base, 60);
  const slowed = c.effects.reduce(
    (n, e) => n + (e.tag === 'speed' ? Number(e.data?.feet ?? 0) : 0),
    0,
  );
  let speed = Math.max(0, effectiveSpeed(c.creature, base) + slowed);
  // PHB: Haste doubles speed; Slow halves it.
  if (hasEffect(c, 'hasted')) speed *= 2;
  if (hasEffect(c, 'slowed')) speed = Math.floor(speed / 10) * 5;
  return speed;
}

/** End effects that run out at this moment. */
function expire(ctx: Ctx, turnOf: string, when: 'start' | 'end'): void {
  const { s } = ctx;
  for (const c of Object.values(s.combatants)) {
    for (const e of [...c.effects]) {
      if (
        e.expires &&
        e.expires.turnOf === turnOf &&
        e.expires.when === when &&
        s.round >= e.expires.round
      ) {
        removeEffect(c, e);
        if (e.tag === 'condition') say(s, 'dmg', `${c.name} is no longer ${e.data?.condition}`);
        else if (e.tag !== 'speed') say(s, 'info', `${e.name} on ${c.name} ends`);
      }
    }
  }
}

/**
 * Start the active creature's turn. Returns false if it can't act and its turn should pass
 * (dead, down, surprised, held).
 */
function beginTurn(ctx: Ctx): boolean {
  const { s, rng } = ctx;
  const c = active(s);
  c.reactionUsed = c.surprised ? true : false;
  expire(ctx, c.id, 'start');
  c.turn = freshTurn(speedNow(c));
  if (c.gone || c.creature.dead) return false;
  const who = c.side === 'party' ? 'you' : 'foe';
  // DMG: Periapt of Wound Closure (Lysa's Locket). While dying, you stabilize at the start of your turn.
  const wearer = heroOf(c);
  if (isDying(c.creature) && wearer && hasSpecial(wearer, 'auto-stabilize')) {
    c.creature = stabilize(c.creature);
    say(
      s,
      'you',
      `${c.name}'s ${hasItem(wearer, 'lysas-locket') ? 'locket' : 'periapt'} glows: ${c.name} is stable`,
    );
    return false;
  }
  if (isDying(c.creature)) {
    const r = deathSave(c.creature, rng);
    c.creature = r.creature;
    sayAll(s, r.log, c);
    if (r.outcome !== 'revived') return false;
    c.turn = freshTurn(speedNow(c));
  }
  if (c.creature.hp === 0) return false;
  // MM: Recharge X–6. Roll a d6 at the start of the monster's turn; on X or higher the ability is back.
  if (c.monsterId && c.recharge) {
    for (const a of getMonster(c.monsterId).actions)
      if (a.recharge && 'roll' in a.recharge && c.recharge[a.id] === false) {
        const d = rng.die(6);
        const back = d >= a.recharge.roll;
        c.recharge = { ...c.recharge, [a.id]: back };
        say(s, 'foe', `${c.name} ${a.name} recharge: d6 (${d}) ${back ? '→ ready!' : '→ not yet'}`);
      }
  }
  if (c.surprised) {
    say(s, who, `${c.name} is surprised and loses this turn`);
    return false;
  }
  if (c.effects.some((e) => e.tag === 'skip-turn')) {
    say(s, who, `${c.name} can't act this turn`);
    return false;
  }
  if (isIncapacitated(c.creature)) {
    say(s, who, `${c.name} is ${c.creature.conditions.map((x) => x.id).join(', ')} and can't act`);
    return false;
  }
  // Grapples end when the grappler is down or no longer next to you.
  for (const g of c.creature.conditions.filter((x) => x.id === 'grappled' && x.source)) {
    const by = s.combatants[g.source!];
    if (!by || !conscious(by) || distanceFeet(by.pos, c.pos) > 5)
      c.creature = removeCondition(c.creature, 'grappled', g.source);
  }
  c.turn = freshTurn(speedNow(c));
  // MM: Ghast, Stench. Starting a turn next to a ghast: DC 10 Con save or poisoned until your next turn.
  for (const g of Object.values(s.combatants)) {
    if (g.side === c.side || !conscious(g) || !g.monsterId) continue;
    if (!getMonster(g.monsterId).traits.some((t) => t.id === 'stench')) continue;
    if (distanceFeet(g.pos, c.pos) > 5 || c.effects.some((e) => e.tag === 'stench-immune'))
      continue;
    const r = combatSave(ctx, c, 'con', 10, { against: 'poisoned', label: 'Con (Stench)' });
    if (r.success)
      addEffect(c, {
        id: 'stench-immune',
        name: 'Used to the stench',
        sourceId: g.id,
        tag: 'stench-immune',
      });
    else giveCondition(ctx, g, c, 'poisoned', undefined);
    if (!r.success)
      addEffect(c, {
        id: `cond-poisoned-${g.id}`,
        name: 'poisoned',
        sourceId: g.id,
        tag: 'condition',
        data: { condition: 'poisoned' },
        expires: { turnOf: c.id, when: 'start', round: s.round + 1 },
      });
  }
  // PHB: Spirit Guardians, Moonbeam... starting a turn inside.
  startOfTurnZones(ctx, c);
  // PHB: Alchemist's Fire. The target takes the fire's damage at the start of each of its turns.
  for (const e of c.effects.filter((x) => x.tag === 'burning')) {
    const r = roll(String(e.data?.dice ?? '1d4'), rng);
    say(s, 'dmg', `${c.name} burns: ${r.text} fire`);
    dealDamage(ctx, c, [{ amount: r.total, type: 'fire' }], {
      attacker: s.combatants[e.sourceId],
    });
  }
  if (!conscious(c)) return false;
  // PHB: Haste. One extra (limited) action each turn. PHB: Slow. No reactions.
  if (hasEffect(c, 'hasted')) c.turn.hasteAction = true;
  if (hasEffect(c, 'slowed')) c.reactionUsed = true;
  return true;
}

/** End-of-turn saves (Hold Person, ghoul paralysis...) and effects. */
function finishTurn(ctx: Ctx): void {
  const { s } = ctx;
  const c = active(s);
  for (const e of c.effects.filter((x) => x.data?.repeatSave)) {
    if (!c.effects.includes(e)) continue;
    const r = combatSave(ctx, c, e.data!.repeatSave as never, Number(e.data!.dc ?? 10), {
      against: e.data!.condition as never,
      label: `${String(e.data!.repeatSave).replace(/^./, (x) => x.toUpperCase())} (repeat)`,
    });
    if (r.success) {
      removeEffect(c, e);
      // The rest of the same spell on this creature ends too (Slow's AC penalty, Fear's fright).
      if (e.concentration)
        for (const x of c.effects.filter(
          (y) => y.sourceId === e.sourceId && y.concentration === e.concentration,
        ))
          removeEffect(c, x);
      say(s, 'dmg', `${c.name} shakes off ${e.data!.condition ?? e.name}`);
    }
  }
  expire(ctx, c.id, 'end');
  c.surprised = false;
}

export function checkOutcome(s: CombatState): CombatState['outcome'] {
  if (s.outcome === 'parley') return 'parley';
  const up = (side: string) =>
    Object.values(s.combatants).some(
      (c) =>
        c.side === side && !isObject(c) && conscious(c) && !hasCondition(c.creature, 'unconscious'),
    );
  if (!up('enemy')) return 'victory';
  if (!up('party')) return 'defeat';
  return null;
}

/** Move to the next creature in initiative order, skipping anyone who can't act. */
export function nextTurn(ctx: Ctx): void {
  finishTurn(ctx);
  ctx.s.turnIndex += 1;
  beginTurnLoop(ctx);
}

function beginTurnLoop(ctx: Ctx): void {
  const { s } = ctx;
  for (let guard = 0; guard < 200; guard++) {
    if (s.turnIndex >= s.order.length) {
      s.turnIndex = 0;
      s.round += 1;
      say(s, 'head', `Round ${s.round}`);
    }
    s.outcome = checkOutcome(s);
    if (s.outcome) return announce(s);
    const c = active(s);
    if (!c.gone && !c.creature.dead) say(s, 'head', `${c.name}'s turn`);
    if (beginTurn(ctx)) return;
    s.outcome = checkOutcome(s);
    if (s.outcome) return announce(s);
    finishTurn(ctx);
    s.turnIndex += 1;
  }
}

/** Check for victory or defeat after anything happens (an attack can end the fight). */
export function settle(s: CombatState): void {
  if (s.outcome) return;
  s.outcome = checkOutcome(s);
  if (s.outcome) {
    s.prompt = null;
    s.plan = null;
    announce(s);
  }
}

function announce(s: CombatState): void {
  say(
    s,
    'head',
    s.outcome === 'victory'
      ? 'Victory!'
      : s.outcome === 'parley'
        ? 'The fighting stops.'
        : s.defeatContinues
          ? 'Your party is beaten…'
          : 'Your party has fallen…',
  );
}

/** The reach of a creature's best melee attack (for opportunity attacks). */
export function meleeOption(c: Combatant): AttackOption | undefined {
  return (
    attackOptions(c)
      .filter((o) => o.kind === 'melee' && !o.unarmed)
      .sort((a, b) => b.toHit - a.toHit)[0] ?? attackOptions(c).find((o) => o.kind === 'melee')
  );
}

/**
 * Walk along a path, square by square. PHB: Opportunity Attacks. Leaving a hostile creature's
 * reach (without Disengaging) lets it make one melee attack as a reaction. Enemies decide for
 * themselves (not on Easy [inferred]); a party member's reaction pauses for a prompt.
 * Returns 'paused' (prompt waiting), 'stopped' (the mover went down) or 'done'.
 */
export function moveAlong(
  ctx: Ctx,
  mover: Combatant,
  path: Pos[],
  declined: string[] = [],
): { result: 'done' | 'paused' | 'stopped'; rest: Pos[] } {
  const { s } = ctx;
  for (let i = 0; i < path.length; i++) {
    const next = path[i]!;
    if (!mover.turn.disengaged) {
      for (const h of Object.values(s.combatants)) {
        if (
          h.side === mover.side ||
          !conscious(h) ||
          isIncapacitated(h.creature) ||
          h.reactionUsed ||
          declined.includes(h.id)
        )
          continue;
        const opt = meleeOption(h);
        if (!opt) continue;
        const was = distanceFeet(h.pos, mover.pos) <= opt.reach;
        const will = distanceFeet(h.pos, next) <= opt.reach;
        if (!was || will) continue;
        if (h.side === 'party') {
          s.prompt = { kind: 'opportunity-attack', reactorId: h.id, targetId: mover.id };
          return { result: 'paused', rest: path.slice(i) };
        }
        if (s.difficulty === 'easy') continue;
        h.reactionUsed = true;
        say(s, 'foe', `${h.name} makes an opportunity attack!`);
        // PHB: Totem Warrior (Eagle). Opportunity attacks against a raging eagle have disadvantage.
        const eagle = isSub(mover, 'barbarian', 'totem-eagle', 3) && hasEffect(mover, 'rage');
        makeAttack(ctx, h, mover, opt, {
          opportunity: true,
          disadvantage: eagle ? ['Eagle totem'] : [],
        });
        if (!conscious(mover)) return { result: 'stopped', rest: [] };
      }
    }
    const prone = hasCondition(mover.creature, 'prone');
    const cost = moveCost(s, mover, next, zoneSlows) * (prone ? 2 : 1);
    if (cost > mover.turn.movement) return { result: 'done', rest: [] };
    mover.turn.movement -= cost;
    mover.pos = next;
    enterSquare(ctx, mover, next);
    if (!conscious(mover)) return { result: 'stopped', rest: [] };
  }
  return { result: 'done', rest: [] };
}

export function usesExtraAttack(c: Combatant): number {
  // PHB: Slow. A slowed creature makes only one attack.
  if (hasEffect(c, 'slowed')) return 1;
  // PHB: Extra Attack (barbarian, fighter, monk, paladin, ranger at level 5).
  const h = heroOf(c);
  if (!h) return 1;
  // PHB: Valor bard, Extra Attack (bard 6).
  if (hasSubclass(h, 'bard', 'valor', 6)) return 2;
  return ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(h.classId) && h.level >= 5
    ? 2
    : 1;
}

export { classLevel, hasEffect };
export type { RandomSource };

/** Objects (the finale's crown shards) don't take turns or count as enemies left standing. */
export const isObject = (c: Combatant) =>
  !!c.monsterId && getMonster(c.monsterId).traits.some((t) => t.id === 'object');
