// The 14 conditions and exhaustion (docs/Rules_Scope.md §2; PHB Appendix A).
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;
export type ConditionId = (typeof CONDITIONS)[number];

/**
 * A condition on a creature. `source` is the id of the creature that caused it, where that
 * matters: a charmed creature can't attack its charmer, a frightened one fears its source.
 */
export interface ConditionInstance {
  id: ConditionId;
  source?: string;
}

/** Anything the condition rules need to know about a creature. */
export interface HasConditions {
  conditions: ConditionInstance[];
  /** 0 to 6. */
  exhaustion: number;
}

export const MAX_EXHAUSTION = 6;

export function hasCondition(c: HasConditions, id: ConditionId): boolean {
  return c.conditions.some((x) => x.id === id);
}

// PHB Appendix A: paralyzed, petrified, stunned and unconscious creatures are also incapacitated.
const INCAPACITATING: ConditionId[] = [
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
];

/** Incapacitated: can't take actions or reactions. */
export function isIncapacitated(c: HasConditions): boolean {
  return INCAPACITATING.some((id) => hasCondition(c, id));
}

// PHB Appendix A: paralyzed, petrified, stunned and unconscious creatures automatically fail
// Strength and Dexterity saving throws. (Petrified is in the PHB but missing from Rules_Scope §2.)
const AUTO_FAIL_STR_DEX: ConditionId[] = ['paralyzed', 'petrified', 'stunned', 'unconscious'];

export function autoFailsStrDexSaves(c: HasConditions): boolean {
  return AUTO_FAIL_STR_DEX.some((id) => hasCondition(c, id));
}

// PHB Appendix A: attack rolls against a blinded, paralyzed, petrified, restrained, stunned or
// unconscious creature have advantage.
export const GRANTS_ADVANTAGE_TO_ATTACKERS: ConditionId[] = [
  'blinded',
  'paralyzed',
  'petrified',
  'restrained',
  'stunned',
  'unconscious',
];

// PHB Appendix A: a paralyzed or unconscious creature takes a critical hit from any attack that
// hits it from within 5 feet.
export function meleeHitsAreCritical(c: HasConditions): boolean {
  return hasCondition(c, 'paralyzed') || hasCondition(c, 'unconscious');
}

/** Ids of the creatures that frighten / charm `c`. */
export function sourcesOf(c: HasConditions, id: ConditionId): string[] {
  return c.conditions.filter((x) => x.id === id && x.source).map((x) => x.source!);
}

/**
 * Walking speed after conditions and exhaustion.
 * PHB Appendix A: grappled, restrained, paralyzed, petrified, stunned and unconscious = speed 0
 * (paralyzed/stunned "can't move"; petrified and unconscious are incapacitated and can't move).
 * Exhaustion: level 2 halves speed, level 5 reduces it to 0.
 */
export function effectiveSpeed(c: HasConditions, baseSpeed: number): number {
  const stuck: ConditionId[] = [
    'grappled',
    'restrained',
    'paralyzed',
    'petrified',
    'stunned',
    'unconscious',
  ];
  if (stuck.some((id) => hasCondition(c, id))) return 0;
  if (c.exhaustion >= 5) return 0;
  if (c.exhaustion >= 2) return Math.floor(baseSpeed / 2);
  return baseSpeed;
}

// PHB Appendix A, Exhaustion: 1 = disadvantage on ability checks; 3 = disadvantage on attack
// rolls and saving throws; 4 = hit point maximum halved; 6 = death. Effects are cumulative.
export const exhaustionDisadvantageOnChecks = (c: HasConditions) => c.exhaustion >= 1;
export const exhaustionDisadvantageOnAttacksAndSaves = (c: HasConditions) => c.exhaustion >= 3;
export const exhaustionHalvesMaxHp = (c: HasConditions) => c.exhaustion >= 4;

export function addCondition<T extends HasConditions>(c: T, cond: ConditionInstance): T {
  const exists = c.conditions.some((x) => x.id === cond.id && x.source === cond.source);
  return exists ? c : { ...c, conditions: [...c.conditions, cond] };
}

export function removeCondition<T extends HasConditions>(
  c: T,
  id: ConditionId,
  source?: string,
): T {
  return {
    ...c,
    conditions: c.conditions.filter(
      (x) => !(x.id === id && (source === undefined || x.source === source)),
    ),
  };
}
