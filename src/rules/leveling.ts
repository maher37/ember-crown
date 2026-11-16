import { proficiencyBonus } from './abilities';
import { mod, type Creature, type DieSize } from './creature';
import { roll } from './dice';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

/** The game's level cap (docs/RPG_Game_Plan.md, D16). */
export const MAX_LEVEL = 6;

// PHB: Character Advancement table (also docs/Encounters_and_XP.md §1).
// Index = level - 1: level 1 at 0 XP, level 2 at 300, ... level 6 at 14,000.
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000] as const;

/** The level a total XP earns, capped at MAX_LEVEL. */
export function levelForXp(xp: number): number {
  let level = 1;
  XP_THRESHOLDS.forEach((need, i) => {
    if (xp >= need) level = i + 1;
  });
  return level;
}

/** XP still needed for the next level, or null at the cap. */
export function xpToNextLevel(level: number, xp: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return Math.max(0, XP_THRESHOLDS[level]! - xp);
}

export const canLevelUp = (c: Creature): boolean =>
  c.level < MAX_LEVEL && levelForXp(c.xp) > c.level;

// PHB: Hit Points at 1st level = the hit die's maximum + Con modifier.
export function firstLevelHp(die: DieSize, conMod: number): number {
  return Math.max(1, die + conMod);
}

// PHB: Hit Points at higher levels. The fixed value is half the die + 1 (d6: 4, d8: 5, d10: 6, d12: 7).
export const fixedHpPerLevel = (die: DieSize): number => die / 2 + 1;

export function awardXp(c: Creature, amount: number): { creature: Creature; log: LogEntry[] } {
  const next = { ...c, xp: c.xp + amount };
  const out = [log('level', `${c.name} gains ${amount} XP (${next.xp} total)`)];
  if (canLevelUp(next)) out.push(log('level', `${c.name} can reach level ${c.level + 1}!`));
  return { creature: next, log: out };
}

/**
 * Raise a hero one level: more HP, one more Hit Die, new proficiency bonus. Class features and
 * spell slots come from class data (Milestone M2). `hpMethod` 'fixed' takes the PHB average;
 * 'roll' rolls the hit die. Each level adds at least 1 HP [inferred: common reading, not in PHB].
 */
export function levelUp(
  c: Creature,
  rng: RandomSource,
  hpMethod: 'fixed' | 'roll' = 'fixed',
): { creature: Creature; hpGained: number; log: LogEntry[] } {
  if (!canLevelUp(c)) throw new Error(`${c.name} can't level up (level ${c.level}, ${c.xp} XP)`);
  const die = c.hitDice.die;
  const base = hpMethod === 'fixed' ? fixedHpPerLevel(die) : roll(`1d${die}`, rng).total;
  const hpGained = Math.max(1, base + mod(c, 'con'));
  const level = c.level + 1;
  const creature: Creature = {
    ...c,
    level,
    proficiencyBonus: proficiencyBonus(level),
    maxHp: c.maxHp + hpGained,
    hp: c.dead ? c.hp : c.hp + hpGained,
    hitDice: { ...c.hitDice, total: c.hitDice.total + 1, remaining: c.hitDice.remaining + 1 },
  };
  const how = hpMethod === 'fixed' ? `fixed ${base}` : `d${die} roll ${base}`;
  return {
    creature,
    hpGained,
    log: [
      log(
        'level',
        `${c.name} reaches level ${level}: +${hpGained} HP (${how} + Con), proficiency +${creature.proficiencyBonus}`,
      ),
    ],
  };
}
