// Turn-based grid combat (Milestone M4). Pure functions over a serializable CombatState.
export * from './types';
export { startCombat, checkOutcome, speedNow, passivePerception, enemyShort } from './turn';
export {
  act,
  featureList,
  offhandWeapons,
  targetsFor,
  hideProblem,
  type PlayerAction,
  type FeatureId,
  type FeatureInfo,
} from './actions';
export { advance } from './ai';
export { attackOptions, type AttackOption } from './attacks';
export {
  spellChoices,
  targeting,
  areaCells,
  castProblem,
  getSpell,
  combatReady,
  metamagicFits,
  METAMAGIC_NAMES,
  type Metamagic,
  type SpellChoice,
  type Targeting,
} from './spells';
export {
  reachable,
  distanceFeet,
  posKey,
  samePos,
  coverBetween,
  hasLineOfSight,
  terrainAt,
  conscious,
  isAdjacent,
} from './grid';
export { currentAc, heroOf, active } from './core';
export { zoneCells } from './zones';
export { finishCombat, readyParty, getEncounter, type CombatResult } from './finish';
