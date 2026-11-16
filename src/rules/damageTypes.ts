// PHB: Damage Types.
export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface Defenses {
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
}

export const noDefenses = (): Defenses => ({
  resistances: [],
  vulnerabilities: [],
  immunities: [],
});
