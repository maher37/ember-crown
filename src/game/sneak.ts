// Sneaking past or ambushing a fight (owner, Nov 22; D35): one scout of the player's choice makes
// a Stealth check against the enemies. Pure functions; the store and the Prepare screen use them.
import type { DifficultyId } from '../data/schemas/difficulty';
import type { Encounter } from '../data/schemas/encounter';
import { abilityCheck, abilityModifier, type RandomSource, type TestResult } from '../rules';
import { getMonster } from './creatures';
import { noisyArmor } from './gear';
import { skillBonus, type Hero } from './hero';
import { armor } from '../data';
import { getItem, itemMods } from './items';

/** A monster's passive Perception: 10 + its Perception skill (or Wisdom modifier). PHB: Passive Checks. */
export function monsterPassive(monsterId: string): number {
  const m = getMonster(monsterId);
  return 10 + (m.skills.perception ?? abilityModifier(m.abilities.wis));
}

/**
 * The scout's DC: the sharpest enemy's passive Perception, plus 1 for every other enemy
 * watching [inferred house rule: the owner asked that bigger fights be harder to sneak past].
 * The enemies on the chosen difficulty count, so Hard is harder to sneak past too.
 */
export function sneakDc(enc: Encounter, difficulty: DifficultyId): number {
  const foes = enc.enemies.filter((e) => e.difficulties.includes(difficulty));
  const best = Math.max(...foes.map((e) => monsterPassive(e.monster)));
  return best + Math.max(0, foes.length - 1);
}

export interface SneakOdds {
  heroId: string;
  name: string;
  /** Stealth bonus: Dex + proficiency (or expertise) + items like the Stone of Good Luck. */
  bonus: number;
  advantage: string[];
  disadvantage: string[];
}

/** How good a hero is at sneaking, with the reasons for advantage or disadvantage. */
export function sneakOdds(hero: Hero): SneakOdds {
  const advantage = (hero.equipment.magic ?? [])
    .filter((id) =>
      getItem(id).effects.some((e) => e.type === 'special' && e.id === 'stealth-advantage-quiet'),
    )
    .map((id) => getItem(id).name);
  // PHB armor table: some armor gives disadvantage on Stealth checks.
  const disadvantage = noisyArmor(hero)
    ? [armor.find((a) => a.id === hero.equipment.armor)!.name]
    : [];
  return {
    heroId: hero.id,
    name: hero.name,
    bonus: skillBonus(hero, 'stealth') + itemMods(hero).check,
    advantage,
    disadvantage,
  };
}

/** Chance (0–100) that the scout beats the DC: d20 + bonus ≥ DC, with advantage or disadvantage. */
export function sneakChance(odds: SneakOdds, dc: number): number {
  const p = Math.min(1, Math.max(0, (21 - (dc - odds.bonus)) / 20));
  const adv = odds.advantage.length > 0;
  const dis = odds.disadvantage.length > 0;
  // PHB: Advantage and Disadvantage. Both at once cancel out.
  const q = adv && !dis ? 1 - (1 - p) ** 2 : dis && !adv ? p * p : p;
  return Math.round(q * 100);
}

/** The scout's Stealth check (logged like every other roll). */
export function rollSneak(hero: Hero, dc: number, rng: RandomSource): TestResult {
  const odds = sneakOdds(hero);
  const dex = abilityModifier(hero.abilities.dex);
  return abilityCheck(hero, 'dex', dc, rng, {
    label: 'Stealth',
    advantage: odds.advantage,
    disadvantage: odds.disadvantage,
    bonuses: odds.bonus - dex ? [{ label: 'skill', value: odds.bonus - dex }] : [],
  });
}
