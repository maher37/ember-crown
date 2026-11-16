import { mod, effectiveMaxHp, type Creature } from './creature';
import { roll } from './dice';
import { changeExhaustion } from './status';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

export const SHORT_REST_HOURS = 1;
export const LONG_REST_HOURS = 8;

/**
 * PHB: Short Rest. Spend Hit Dice one at a time: roll the die and add the Con modifier, regaining
 * that many HP. A die can't heal less than 0 [inferred]. A creature at 0 HP can't spend Hit Dice
 * (it's unconscious) [inferred].
 */
export function spendHitDie(
  c: Creature,
  rng: RandomSource,
): { creature: Creature; log: LogEntry[] } {
  if (c.dead || c.hp === 0) throw new Error(`${c.name} can't spend Hit Dice at 0 HP`);
  if (c.hitDice.remaining < 1) throw new Error(`${c.name} has no Hit Dice left`);
  const conMod = mod(c, 'con');
  const r = roll({ count: 1, sides: c.hitDice.die, bonus: conMod }, rng);
  const gain = Math.max(0, r.total);
  const max = effectiveMaxHp(c);
  const hp = Math.min(max, c.hp + gain);
  const remaining = c.hitDice.remaining - 1;
  return {
    creature: { ...c, hp, hitDice: { ...c.hitDice, remaining } },
    log: [
      log(
        'rest',
        `${c.name} spends a Hit Die: ${r.text} → +${hp - c.hp} HP (${hp}/${max}), ${remaining} Hit Dice left`,
      ),
    ],
  };
}

/** PHB: Long Rest. Only one long rest per 24 hours. Times are game hours since the campaign began. */
export function canLongRest(nowHour: number, lastLongRestStartHour: number | null): boolean {
  // Measured start-to-start [inferred: the PHB says "one long rest in a 24-hour period"].
  return lastLongRestStartHour === null || nowHour - lastLongRestStartHour >= 24;
}

/**
 * PHB: Long Rest. Needs at least 1 HP at the start. Restores all HP and half the creature's total
 * Hit Dice (at least 1). Rules_Scope §2: a long rest also removes 1 level of exhaustion.
 * Spell slots and class resources are restored by class data (Milestone M2).
 */
export function longRest(c: Creature): { creature: Creature; log: LogEntry[] } {
  if (c.dead || c.hp < 1) {
    return {
      creature: c,
      log: [log('rest', `${c.name} needs at least 1 HP to benefit from a long rest`)],
    };
  }
  const out: LogEntry[] = [];
  let next: Creature = c;
  if (next.exhaustion > 0) {
    const ex = changeExhaustion(next, -1);
    next = ex.creature;
    out.push(...ex.log);
  }
  const regain = Math.max(1, Math.floor(next.hitDice.total / 2));
  const remaining = Math.min(next.hitDice.total, next.hitDice.remaining + regain);
  next = {
    ...next,
    hp: effectiveMaxHp(next),
    hitDice: { ...next.hitDice, remaining },
    deathSaves: { successes: 0, failures: 0 },
  };
  out.unshift(
    log(
      'rest',
      `${c.name} finishes a long rest: ${next.hp}/${effectiveMaxHp(next)} HP, ${remaining}/${next.hitDice.total} Hit Dice`,
    ),
  );
  return { creature: next, log: out };
}
