import { abilityModifier, type Ability, type AbilityScores } from './abilities';
import { exhaustionHalvesMaxHp, type ConditionInstance } from './conditions';
import type { Defenses } from './damageTypes';

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20;

/**
 * - `pc`: a hero. Falls unconscious at 0 HP and makes death saves.
 * - `monster`: dies at 0 HP (Rules_Scope §1, "Monsters at 0 HP").
 * - `villain`: a named villain (Maelis, Ulric, Tarrow). Falls unconscious and stable at 0 HP so
 *   the story can continue.
 */
export type CreatureKind = 'pc' | 'monster' | 'villain';

/**
 * The rules engine's view of a creature: plain, serializable data. Engine functions never change
 * a creature in place; they return a new copy, so it can live in the game store and in saves.
 */
export interface Creature {
  id: string;
  name: string;
  kind: CreatureKind;
  /** Character level for heroes; 1 for monsters (they use `proficiencyBonus` directly). */
  level: number;
  xp: number;
  proficiencyBonus: number;
  abilities: AbilityScores;
  saveProficiencies: Ability[];
  ac: number;
  maxHp: number;
  hp: number;
  tempHp: number;
  hitDice: { die: DieSize; total: number; remaining: number };
  conditions: ConditionInstance[];
  exhaustion: number;
  deathSaves: { successes: number; failures: number };
  /** At 0 HP but no longer making death saves. */
  stable: boolean;
  dead: boolean;
  defenses: Defenses;
  /** Id of the spell being concentrated on, or null. */
  concentration: string | null;
}

export const mod = (c: Creature, ability: Ability): number => abilityModifier(c.abilities[ability]);

/** Hit point maximum after exhaustion (level 4 halves it; PHB Appendix A). */
export function effectiveMaxHp(c: Creature): number {
  return exhaustionHalvesMaxHp(c) ? Math.floor(c.maxHp / 2) : c.maxHp;
}

/** At 0 HP and making death saves. */
export const isDying = (c: Creature): boolean => !c.dead && c.hp === 0 && !c.stable;
