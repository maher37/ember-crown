import type { DifficultyId } from '../../data/schemas/difficulty';
import type { Encounter } from '../../data/schemas/encounter';
import { getMonster, monsterToCreature } from '../creatures';
import type { Hero } from '../hero';
import {
  abilityCheck,
  abilityModifier,
  deathSave,
  effectiveSpeed,
  hasCondition,
  isDying,
  isIncapacitated,
  removeCondition,
  rollD20,
  describeTotal,
  type RandomSource,
} from '../../rules';
import { attackOptions, makeAttack, type AttackOption } from './attacks';
import {
  active,
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
} from './core';
import { conscious, distanceFeet, parseMap, stepCost } from './grid';
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
}

/** Set up a fight: place everyone, roll initiative (and surprise), and start the first turn. */
export function startCombat(o: StartOptions): CombatState {
  const e = o.encounter;
  const base: CombatState = {
    encounterId: e.id,
    name: e.name,
    difficulty: o.difficulty,
    map: parseMap(e.map.width, e.map.height, e.map.terrain),
    round: 1,
    order: [],
    turnIndex: 0,
    combatants: {},
    log: [],
    rngState: o.rngState,
    outcome: null,
    xpPerPc: e.xpPerPc,
    prompt: null,
    plan: null,
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
        m.speed.walk,
      );
      c.monsterId = m.id;
      c.tactic = en.tactic;
      s.combatants[en.id] = c;
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

function makeCombatant(
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
  for (const c of Object.values(s.combatants)) {
    let mod = abilityModifier(c.creature.abilities.dex);
    const h = heroOf(c);
    // PHB: Bard, Jack of All Trades (half proficiency on ability checks, initiative included).
    if (h && h.classId === 'bard' && h.level >= 2) mod += Math.floor(h.proficiencyBonus / 2);
    const r = rollD20('normal', rng);
    c.initiative = r.natural + mod;
    parts.push(`${c.name} ${describeTotal(r, mod)}`);
  }
  s.order = Object.values(s.combatants)
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
  const base = c.wildShape ? getMonster(c.wildShape.monsterId).speed.walk : c.speed;
  const slowed = c.effects.reduce(
    (n, e) => n + (e.tag === 'speed' ? Number(e.data?.feet ?? 0) : 0),
    0,
  );
  return Math.max(0, effectiveSpeed(c.creature, base) + slowed);
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
  if (isDying(c.creature)) {
    const r = deathSave(c.creature, rng);
    c.creature = r.creature;
    sayAll(s, r.log, c);
    if (r.outcome !== 'revived') return false;
    c.turn = freshTurn(speedNow(c));
  }
  if (c.creature.hp === 0) return false;
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
  return true;
}

/** End-of-turn saves (Hold Person, ghoul paralysis...) and effects. */
function finishTurn(ctx: Ctx): void {
  const { s } = ctx;
  const c = active(s);
  for (const e of c.effects.filter((x) => x.tag === 'condition' && x.data?.repeatSave)) {
    const r = combatSave(ctx, c, e.data!.repeatSave as never, Number(e.data!.dc ?? 10), {
      against: e.data!.condition as never,
      label: `${String(e.data!.repeatSave).replace(/^./, (x) => x.toUpperCase())} (repeat)`,
    });
    if (r.success) {
      removeEffect(c, e);
      say(s, 'dmg', `${c.name} shakes off ${e.data!.condition}`);
    }
  }
  expire(ctx, c.id, 'end');
  c.surprised = false;
}

export function checkOutcome(s: CombatState): CombatState['outcome'] {
  const up = (side: string) =>
    Object.values(s.combatants).some(
      (c) => c.side === side && conscious(c) && !hasCondition(c.creature, 'unconscious'),
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
    s.outcome === 'victory' ? 'Victory! The road is clear.' : 'Your party has fallen…',
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
        makeAttack(ctx, h, mover, opt, { opportunity: true });
        if (!conscious(mover)) return { result: 'stopped', rest: [] };
      }
    }
    const prone = hasCondition(mover.creature, 'prone');
    const cost = stepCost(s.map, next) * (prone ? 2 : 1);
    if (cost > mover.turn.movement) return { result: 'done', rest: [] };
    mover.turn.movement -= cost;
    mover.pos = next;
  }
  return { result: 'done', rest: [] };
}

export function usesExtraAttack(c: Combatant): number {
  // PHB: Extra Attack (barbarian, fighter, monk, paladin, ranger at level 5).
  const h = heroOf(c);
  if (!h) return 1;
  return ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(h.classId) && h.level >= 5
    ? 2
    : 1;
}

export { classLevel, hasEffect };
export type { RandomSource };
