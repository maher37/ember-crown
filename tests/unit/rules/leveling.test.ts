import { describe, expect, it } from 'vitest';
import {
  awardXp,
  canLevelUp,
  firstLevelHp,
  fixedHpPerLevel,
  levelForXp,
  levelUp,
  MAX_LEVEL,
  ScriptedRng,
  XP_THRESHOLDS,
  xpToNextLevel,
} from '../../../src/rules';
import { makeCreature } from './helpers';

const rng = (...r: number[]) => new ScriptedRng(r);
const con14 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

// PHB: Character Advancement; docs/Encounters_and_XP.md §1.
describe('XP and levels', () => {
  it('uses the PHB thresholds up to level 6', () => {
    expect(XP_THRESHOLDS).toEqual([0, 300, 900, 2700, 6500, 14000]);
    expect(MAX_LEVEL).toBe(6);
  });

  it.each([
    [0, 1],
    [299, 1],
    [300, 2],
    [899, 2],
    [900, 3],
    [2700, 4],
    [6500, 5],
    [14000, 6],
    [99999, 6],
  ])('%i XP is level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('counts XP to the next level', () => {
    expect(xpToNextLevel(1, 120)).toBe(180);
    expect(xpToNextLevel(6, 20000)).toBeNull();
  });

  it('awards XP and says when a level-up is ready', () => {
    const out = awardXp(makeCreature({ xp: 250 }), 75);
    expect(out.creature.xp).toBe(325);
    expect(out.log.map((l) => l.text)).toEqual([
      'Hero gains 75 XP (325 total)',
      'Hero can reach level 2!',
    ]);
  });
});

// PHB: Hit Points and Hit Dice.
describe('hit points per level', () => {
  it('level 1 = the die maximum + Con', () => {
    expect(firstLevelHp(10, 2)).toBe(12);
    expect(firstLevelHp(6, -1)).toBe(5);
  });

  it('fixed value = half the die + 1', () => {
    expect([6, 8, 10, 12].map((d) => fixedHpPerLevel(d as 6 | 8 | 10 | 12))).toEqual([4, 5, 6, 7]);
  });
});

describe('levelUp', () => {
  const ready = () =>
    makeCreature({
      xp: 300,
      hp: 8,
      maxHp: 12,
      abilities: con14,
      hitDice: { die: 10, total: 1, remaining: 0 },
    });

  it('adds fixed HP + Con, a Hit Die, and keeps the damage already taken', () => {
    const out = levelUp(ready(), rng());
    expect(out.creature.level).toBe(2);
    expect(out.hpGained).toBe(8);
    expect(out.creature.maxHp).toBe(20);
    expect(out.creature.hp).toBe(16);
    expect(out.creature.hitDice).toEqual({ die: 10, total: 2, remaining: 1 });
    expect(out.log[0]!.text).toBe('Hero reaches level 2: +8 HP (fixed 6 + Con), proficiency +2');
  });

  it('can roll the hit die instead', () => {
    expect(levelUp(ready(), rng(3), 'roll').hpGained).toBe(5);
  });

  it('gains at least 1 HP even with a bad Con', () => {
    const c = makeCreature({
      xp: 300,
      abilities: { ...con14, con: 3 },
      hitDice: { die: 6, total: 1, remaining: 1 },
    });
    expect(levelUp(c, rng(1), 'roll').hpGained).toBe(1);
  });

  it('raises the proficiency bonus at level 5', () => {
    const c = makeCreature({ level: 4, xp: 6500, hitDice: { die: 8, total: 4, remaining: 4 } });
    expect(levelUp(c, rng()).creature.proficiencyBonus).toBe(3);
  });

  it('needs enough XP and stops at level 6', () => {
    expect(canLevelUp(makeCreature({ xp: 299 }))).toBe(false);
    expect(canLevelUp(makeCreature({ level: 6, xp: 99999 }))).toBe(false);
    expect(() => levelUp(makeCreature({ xp: 10 }), rng())).toThrow(/can't level up/);
  });
});
