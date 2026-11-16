export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export type AbilityScores = Record<Ability, number>;

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const ABILITY_SHORT: Record<Ability, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
};

// PHB: Ability Scores and Modifiers. Modifier = (score - 10) / 2, rounded down.
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// PHB: Character Advancement table. +2 at levels 1-4, +3 at 5-8, +4 at 9-12, ...
export function proficiencyBonus(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error(`Invalid level: ${level}`);
  return 2 + Math.floor((level - 1) / 4);
}
