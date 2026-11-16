import { Edge } from './advantage';
import { edgeReasons } from './checks';
import {
  exhaustionDisadvantageOnAttacksAndSaves,
  GRANTS_ADVANTAGE_TO_ATTACKERS,
  hasCondition,
  isIncapacitated,
  meleeHitsAreCritical,
  sourcesOf,
} from './conditions';
import type { Creature } from './creature';
import { describeTotal, rollD20, type D20Roll } from './d20';
import { parseDice, roll, type DiceRoll } from './dice';
import type { DamageType } from './damageTypes';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

// PHB: Cover. Half cover +2 AC, three-quarters +5, total cover can't be targeted directly.
export type Cover = 'none' | 'half' | 'three-quarters' | 'total';
export const COVER_AC_BONUS: Record<Exclude<Cover, 'total'>, number> = {
  none: 0,
  half: 2,
  'three-quarters': 5,
};

export interface AttackOptions {
  /** Total to-hit bonus (ability modifier + proficiency + magic). */
  attackBonus: number;
  /** A melee attack (as opposed to ranged). Matters for knockouts. */
  melee: boolean;
  /** The attacker is within 5 feet of the target. Matters for prone and auto-crits. */
  within5ft: boolean;
  /** Lowest natural roll that crits. 20 normally; 19 for a Champion (Improved Critical). */
  critRange?: number;
  cover?: Cover;
  /** Whether the source of the attacker's fear is in sight. Defaults to true. */
  fearSourceVisible?: boolean;
  advantage?: string[];
  disadvantage?: string[];
  /** Extra dice already rolled, e.g. Bless. */
  diceBonuses?: { label: string; roll: DiceRoll }[];
  /** Weapon or spell name for the log. */
  label?: string;
}

export interface AttackResult {
  /** False if the attack isn't possible at all (see `reason`). */
  allowed: boolean;
  reason?: string;
  roll?: D20Roll;
  total?: number;
  /** AC including cover. */
  targetAc: number;
  hit: boolean;
  critical: boolean;
  log: LogEntry;
}

/** Why `attacker` can't attack `target` at all, or null if it can. */
export function cannotAttackReason(
  attacker: Creature,
  target: Creature,
  cover: Cover,
): string | null {
  // PHB Appendix A: Incapacitated. Can't take actions (so no attacks).
  if (attacker.dead || isIncapacitated(attacker)) return 'incapacitated';
  // PHB Appendix A: Charmed. Can't attack the charmer.
  if (sourcesOf(attacker, 'charmed').includes(target.id)) return 'charmed by the target';
  // PHB: Cover. Total cover: can't be targeted directly.
  if (cover === 'total') return 'target has total cover';
  return null;
}

/** Roll one attack. Doesn't roll damage; call `rollDamage` on a hit. */
export function attackRoll(
  attacker: Creature,
  target: Creature,
  rng: RandomSource,
  opts: AttackOptions,
): AttackResult {
  const cover = opts.cover ?? 'none';
  const head = `${attacker.name} attacks ${target.name}${opts.label ? ` with ${opts.label}` : ''}`;
  const blocked = cannotAttackReason(attacker, target, cover);
  if (blocked) {
    return {
      allowed: false,
      reason: blocked,
      targetAc: target.ac,
      hit: false,
      critical: false,
      log: log('attack', `${head}: not possible (${blocked})`),
    };
  }

  const edge = new Edge()
    // PHB Appendix A, the attacker's own conditions:
    .dis('blinded', hasCondition(attacker, 'blinded'))
    .dis('frightened', hasCondition(attacker, 'frightened') && opts.fearSourceVisible !== false)
    .adv('invisible', hasCondition(attacker, 'invisible'))
    .dis('poisoned', hasCondition(attacker, 'poisoned'))
    .dis('prone', hasCondition(attacker, 'prone'))
    .dis('restrained', hasCondition(attacker, 'restrained'))
    .dis('exhaustion', exhaustionDisadvantageOnAttacksAndSaves(attacker))
    // PHB Appendix A, the target's conditions:
    .dis('target invisible', hasCondition(target, 'invisible'));
  for (const id of GRANTS_ADVANTAGE_TO_ATTACKERS)
    edge.adv(`target ${id}`, hasCondition(target, id));
  // PHB Appendix A: Prone. Advantage if the attacker is within 5 ft, otherwise disadvantage.
  if (hasCondition(target, 'prone')) {
    if (opts.within5ft) edge.adv('target prone');
    else edge.dis('target prone, attacker not adjacent');
  }
  for (const r of opts.advantage ?? []) edge.adv(r);
  for (const r of opts.disadvantage ?? []) edge.dis(r);

  const r = rollD20(edge.mode, rng);
  const extras = (opts.diceBonuses ?? []).map((d) => ({ label: d.label, value: d.roll.total }));
  const total = r.natural + opts.attackBonus + extras.reduce((a, e) => a + e.value, 0);
  const targetAc = target.ac + (cover === 'total' ? 0 : COVER_AC_BONUS[cover]);
  const critRange = opts.critRange ?? 20;

  // PHB: Rolling 1 or 20. A natural 1 always misses; a natural 20 always hits and is a critical
  // hit. A Champion's 19 also crits (PHB: Improved Critical), and a critical hit is a hit.
  const naturalCrit = r.natural >= critRange;
  const hit = r.natural !== 1 && (naturalCrit || total >= targetAc);
  // PHB Appendix A: Paralyzed / Unconscious. Any hit from within 5 ft is a critical hit.
  const autoCrit = hit && opts.within5ft && meleeHitsAreCritical(target);
  const critical = hit && (naturalCrit || autoCrit);

  const verdict = !hit
    ? r.natural === 1
      ? 'MISS (natural 1)'
      : 'MISS'
    : critical
      ? naturalCrit
        ? 'CRITICAL HIT'
        : 'CRITICAL HIT (helpless target)'
      : 'HIT';
  const coverText = cover !== 'none' ? ` (${cover} cover)` : '';
  const text = `${head}: ${describeTotal(r, opts.attackBonus, extras)} vs AC ${targetAc}${coverText} → ${verdict}${edgeReasons(edge)}`;
  return { allowed: true, roll: r, total, targetAc, hit, critical, log: log('attack', text) };
}

export interface DamagePart {
  /** Dice notation, e.g. "1d8+3". */
  dice: string;
  type: DamageType;
}

export interface DamageInstance {
  amount: number;
  type: DamageType;
}

export interface DamageRoll {
  instances: DamageInstance[];
  total: number;
  rolls: DiceRoll[];
  log: LogEntry;
}

/**
 * Roll damage. PHB: Critical Hits. On a crit, roll all of the attack's damage dice twice and add
 * them together; modifiers are added once.
 */
export function rollDamage(
  parts: DamagePart[],
  critical: boolean,
  rng: RandomSource,
  label = 'Damage',
): DamageRoll {
  const rolls: DiceRoll[] = [];
  const instances: DamageInstance[] = [];
  const texts: string[] = [];
  for (const part of parts) {
    const expr = parseDice(part.dice);
    const r = roll(critical ? { ...expr, count: expr.count * 2 } : expr, rng);
    rolls.push(r);
    // A negative modifier can't take damage below 0 [inferred: PHB has no explicit floor].
    const amount = Math.max(0, r.total);
    instances.push({ amount, type: part.type });
    texts.push(`${r.text} ${part.type}`);
  }
  const total = instances.reduce((a, i) => a + i.amount, 0);
  const crit = critical ? ' (critical: dice doubled)' : '';
  return { instances, total, rolls, log: log('damage', `${label}${crit}: ${texts.join(', ')}`) };
}
