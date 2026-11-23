import type { DifficultyId } from '../../data/schemas/difficulty';
import type { Ability, Creature, DamageType, Skill } from '../../rules';
import type { Hero } from '../hero';

export interface Pos {
  x: number;
  y: number;
}

export type Side = 'party' | 'enemy';
export type TerrainKind = 'open' | 'road' | 'brush' | 'trees' | 'boulder';

export interface CombatMap {
  width: number;
  height: number;
  /** Look of the map: forest-road, road, tavern, cave, mill... */
  style: string;
  /** Squares inside a Darkness spell (they block sight). */
  dark?: string[];
  terrain: TerrainKind[][]; // [y][x]
}

/** A timed effect on a combatant (Bless, Shield, Dodge, Rage...). */
export interface ActiveEffect {
  id: string;
  name: string;
  /** Who created it (for concentration and "until the end of X's next turn"). */
  sourceId: string;
  /** Ends when the source's concentration on this spell ends. */
  concentration?: string;
  /** Ends at the start or end of this combatant's turn in this round (or later). */
  expires?: { turnOf: string; when: 'start' | 'end'; round: number };
  mod?: { attack?: string | number; save?: string | number; ac?: number; damage?: string | number };
  /** Named behaviors the engine checks for: 'dodge', 'rage', 'reckless', 'outlined', 'hex-target', 'hunters-mark-target', 'mage-armor', 'help', 'disadvantage-next-attack', 'advantage-next-attack-against', 'no-reactions', 'no-healing', 'sanctuary', 'agathys', 'hidden' */
  tag?: string;
  /** Extra data for the tag, e.g. the damage type of Hex. */
  data?: Record<string, string | number>;
}

export interface TurnState {
  actionUsed: boolean;
  bonusUsed: boolean;
  /** Movement left this turn, in feet. */
  movement: number;
  disengaged: boolean;
  /** An Attack action was taken this turn (for Flurry of Blows, Martial Arts, two-weapon fighting). */
  attacked: boolean;
  /** A light melee weapon was used in the Attack action (two-weapon fighting). */
  lightWeaponUsed: string | null;
  sneakAttackUsed: boolean;
  /** Extra actions from Action Surge. */
  extraActions: number;
  /** A leveled spell (not a cantrip) was cast with the bonus action this turn. */
  bonusSpellCast: boolean;
  /** A spell of 1st level or higher was cast with the action this turn. */
  actionSpellCast?: boolean;
  /** Attacks left in the current Attack action (Extra Attack gives 2 from level 5). */
  attacksLeft: number;
  /** Horde Breaker used this turn. */
  hordeUsed?: boolean;
  /** Colossus Slayer used this turn. */
  colossusUsed?: boolean;
  /** PHB: Haste. One extra limited action (one weapon attack, Dash, Disengage, Hide, Use an Object). */
  hasteAction?: boolean;
  /** The haste action is the one being used. */
  inHasteAction?: boolean;
  /** Weapon sets were switched this turn (free, once a turn). */
  swappedWeapons?: boolean;
}

export interface Combatant {
  id: string;
  name: string;
  /** Short label for the token, e.g. "GA" or "M". */
  short: string;
  side: Side;
  pos: Pos;
  initiative: number;
  dex: number;
  /** The rules-engine creature (a Hero for party members). */
  creature: Creature | Hero;
  /** Monster id for enemies. */
  monsterId?: string;
  tactic?: 'melee' | 'ranged';
  speed: number;
  reactionUsed: boolean;
  surprised: boolean;
  /** Fled or removed from the fight. */
  gone: boolean;
  effects: ActiveEffect[];
  turn: TurnState;
  /** Druid Wild Shape: the beast's HP pool sits on top of the druid's own. */
  wildShape?: { monsterId: string; hp: number; maxHp: number };
  /** Bardic Inspiration die held by this creature. */
  inspiration?: number;
  /** A spellcasting monster's remaining slots, by level. */
  monsterSlots?: Record<string, number>;
  /** Recharge abilities (a dragon's breath): true when ready. */
  recharge?: Record<string, boolean>;
  /** Conjured by a spell (Conjure Animals): gone when the caster's concentration ends. */
  summon?: { casterId: string; spellId: string };
}

export interface LogLine {
  kind: 'head' | 'you' | 'foe' | 'dmg' | 'crit' | 'info';
  text: string;
}

/** A question the player must answer before the fight goes on. */
export type Prompt =
  | {
      kind: 'opportunity-attack';
      reactorId: string;
      targetId: string;
    }
  | {
      kind: 'shield';
      reactorId: string;
      attackerId: string;
      /** The attack's total, to show "the hit would miss with Shield". */
      total: number;
    }
  | { kind: 'protection'; reactorId: string; attackerId: string; targetId: string }
  | { kind: 'hellish-rebuke'; reactorId: string; attackerId: string }
  | {
      kind: 'cutting-words';
      reactorId: string;
      attackerId: string;
      targetId: string;
      total: number;
    }
  | { kind: 'counterspell'; reactorId: string; casterId: string; spellId: string };

/** Enemy turn in progress (so it can pause for a reaction prompt and resume). */
export interface EnemyPlan {
  actorId: string;
  steps: PlanStep[];
  /** Party members who already declined an opportunity attack during this move. */
  declined: string[];
  /** Leave the map at the end of the move (a fleeing enemy). */
  flee?: boolean;
}

export type PlanStep =
  | { type: 'bonus'; what: 'disengage' | 'hide' | 'dash' }
  | { type: 'action'; what: 'dash' | 'dodge' }
  | { type: 'move'; path: Pos[] }
  | {
      type: 'cast';
      spellId: string;
      slotLevel: number;
      targetIds?: string[];
      point?: Pos;
      /** A party member was already asked about Counterspell. */
      asked?: boolean;
      countered?: boolean;
    }
  | { type: 'spirit-attack'; targetId: string }
  /** A monster's area action (Fire Breath), aimed at a square. */
  | { type: 'area-action'; actionId: string; point: Pos }
  | {
      type: 'attack';
      targetId: string;
      optionId: string;
      /** Where this attack got to before pausing for a reaction prompt. */
      phase?: 'protected' | 'rolled' | 'done';
      disadvantage?: boolean;
      roll?: { hit: boolean; critical: boolean; total: number; natural: number };
    };

export interface CombatState {
  encounterId: string;
  name: string;
  difficulty: DifficultyId;
  map: CombatMap;
  round: number;
  /** Combatant ids in initiative order. */
  order: string[];
  turnIndex: number;
  combatants: Record<string, Combatant>;
  log: LogLine[];
  rngState: number;
  /** 'parley': the enemy was talked down mid-fight (counts as a win). */
  outcome: null | 'victory' | 'defeat' | 'parley';
  /** A brawl: anyone dropped to 0 HP is knocked out, not killed (PHB: Knocking a Creature Out). */
  nonlethal: boolean;
  /** Losing this fight doesn't end the game; the story goes on. */
  defeatContinues: boolean;
  /** Talk the enemy down mid-fight (e.g. Brother Ulric). */
  parley: {
    skills: string[];
    dc: number;
    easierFlag?: string;
    easierDc?: number;
    text: string;
  } | null;
  /** Heroes who already tried to parley this fight. */
  parleyTried: string[];
  /** The party's potions and other consumables (written back after the fight). */
  inventory: Record<string, number>;
  /** The game hour the fight happens (for spells that last between fights, D34). */
  clock?: number;
  /** Story flags the fight can read (e.g. Brannoc's name helps with Ulric). */
  flags: Record<string, boolean | number | string>;
  xpPerPc: number;
  prompt: Prompt | null;
  plan: EnemyPlan | null;
  /** Spells left on the battlefield (Spirit Guardians, Moonbeam, Spike Growth...). */
  zones: Zone[];
}

/** A lasting spell area (M8). */
export interface Zone {
  id: string;
  spellId: string;
  name: string;
  casterId: string;
  side: Side;
  kind: 'damage' | 'spikes' | 'silence' | 'darkness';
  /** Fixed squares, or an aura of this many feet that follows the caster. */
  cells?: Pos[];
  aura?: number;
  /** Only the caster's enemies are affected (Spirit Guardians). */
  enemiesOnly?: boolean;
  /** Enemies move at half speed inside. */
  halfSpeed?: boolean;
  save?: { ability: Ability; dc: number; half: boolean };
  damage?: { dice: string; type: DamageType };
  /** Damage with no save at the start of a turn (Hunger of Hadar's cold). */
  startDamage?: { dice: string; type: DamageType };
  concentration?: string;
  /** Who was hit on which turn ("the first time on a turn"). */
  hitAt?: Record<string, string>;
}

export type { DamageType, Skill };
