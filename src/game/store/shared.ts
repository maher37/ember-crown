import type { StoreApi } from 'zustand';
import type { RandomSource } from '../../rules';
import type { DifficultyId } from '../../data/schemas/difficulty';
import { type CombatResult, type CombatState, type PlayerAction, type Pos } from '../combat';
import { Conversation } from '../dialogue';
import { placeMapFor } from '../placeMaps';
import { spotFinds, type OpenHow, type OpenResult } from '../finds';
import type { SlotId as GearSlot } from '../loadout';
import type { Hero } from '../hero';
import type { LevelUpPlan } from '../levelup';
import { type GameState, type SaveFile, type SlotId } from '../save';

// Types and helpers the store slices share.

/** Put the party at a place, and notice what's in plain sight or within passive Perception. */
export const arrive = (g: GameState, placeId: string): { game: GameState; messages: string[] } =>
  spotFinds({ ...g, location: placeId }, placeId);

export type Screen =
  | 'title'
  | 'creator'
  | 'party'
  | 'explore'
  | 'dialogue'
  | 'levelup'
  | 'prepare'
  | 'combat'
  | 'map'
  | 'placemap'
  | 'camp'
  | 'epilogue';
/** Where the party "is" between scenes: the tavern, a walk-around place map, or the world map. */
export function homeScreen(g: GameState | null | undefined): Screen {
  if (!g || g.location === 'drowned-lantern') return 'explore';
  return placeMapFor(g.location) ? 'placemap' : 'map';
}

export type CampScene = 'wild' | 'inn' | 'cave';
export const PARTY_SIZE = 4;

/** A scout's Stealth check before a fight (D35). */
export interface Scouted {
  encounterId: string;
  heroId: string;
  success: boolean;
  text: string;
}

export interface GameStore {
  screen: Screen;
  /** The game in progress, once the party is complete. */
  game: GameState | null;
  /** Heroes made so far in the creator. */
  pendingParty: Hero[];
  /** Seed and dice position for the game being created / played. */
  seed: number;
  rngState: number;
  /** When this play session started (for play time). */
  sessionStart: number;
  /** The fight being prepared or played. */
  encounterId: string | null;
  combat: CombatState | null;
  /** Filled in when a won fight is wrapped up. */
  lastResult: CombatResult | null;
  /** The conversation in progress (not saved; its Ink state is, in game.ink). */
  conversation: Conversation | null;
  /** Bumped after each dialogue step so screens re-render. */
  dialogueTick: number;
  /** Hero being levelled up. */
  levelUpId: string | null;
  /** Short messages for the player ("Journal updated", "+275 XP each"). */
  toasts: string[];
  /** Travel log on the world map, newest first. */
  travelLog: string[];
  /** Where the party was heading when an encounter interrupted the road. */
  pendingArrival: string | null;
  /** The fight interrupted a long rest in the wild: go back to camp afterwards. */
  backToCamp: boolean;
  campScene: CampScene;
  /** Camp messages (rest results), oldest first. */
  campLog: string[];
  /** Heroes who spent Hit Dice during the current short rest (null: no short rest running). */
  shortRest: string[] | null;
  /** The scene to pick up after the fight it started (story id and knot). */
  resume: { story: string; knot: string } | null;
  /** After this conversation, open the scene of the place the party is at. */
  afterDialogue: 'place' | null;
  /** Which hero the party screen's character sheet shows. */
  sheetHeroId: string | null;
  /** The scout's result for the fight being prepared (D35). */
  scouted: Scouted | null;
  /** The bounty whose fight is under way (its hunt step completes on a win). */
  hunt: string | null;

  buyFrom: (shopId: string, itemId: string) => string | undefined;
  sellTo: (shopId: string, itemId: string) => string | undefined;
  templeService: (serviceId: string, heroId?: string) => string | undefined;
  /** Take a notice from the Hall's board. */
  takeNotice: (questId: string) => void;
  claimNotice: (questId: string) => string | undefined;
  /** Go after a taken bounty here: its fight starts. */
  huntBounty: (questId: string) => void;
  /** Search the place the party is at (once a day); returns the log. */
  searchHere: () => string[];
  openFindAt: (findId: string, how: OpenHow) => OpenResult;
  /** Step out of the tavern into Ashford's streets, or back in. */
  enterTown: () => void;
  enterTavern: () => void;

  /** Open the story scene of a map location (the current one by default). */
  enterPlace: (placeId?: string) => void;
  /** Wear or wield an item from the pack. Returns an error, if any. */
  equipItem: (heroId: string, itemId: string) => string | undefined;
  unequipItem: (heroId: string, itemId: string) => void;
  /** Put worn armor, a shield or a weapon back in the pack. */
  unequipGear: (
    heroId: string,
    slot: { armor: true } | { shield: true } | { weapon: string },
  ) => void;
  /** Put an item from the pack in a given slot (or its natural one). Returns an error, if any. */
  equipToHeroSlot: (heroId: string, itemId: string, slot?: GearSlot) => string | undefined;
  /** Empty a slot (the item goes back in the pack). */
  clearHeroSlot: (heroId: string, slot: GearSlot) => void;
  /** Switch a hero between weapon set 1 and 2 (outside fights). */
  switchHeroWeapons: (heroId: string) => void;
  /** Brannoc's shop. Return an error, if any. */
  buyItem: (itemId: string) => string | undefined;
  sellItem: (itemId: string) => string | undefined;
  /** Clerics, druids and paladins: choose prepared spells after a long rest. */
  prepareHeroSpells: (heroId: string, spellIds: string[]) => string | undefined;
  /** Cast a healing spell, or Lay on Hands, between fights. Returns an error, if any. */
  healOutside: (
    casterId: string,
    how: { spellId: string; slotLevel: number } | 'lay-on-hands',
    targetId: string,
  ) => string | undefined;
  /** Remember the party's marching order for every fight. */
  setFormation: (order: string[]) => void;
  /** Drink a potion outside a fight. */
  drinkPotion: (heroId: string, itemId: string) => string | undefined;
  /** DMG: Pearl of Power (the Bog Pearl). Regain one spent slot of 3rd level or lower, once a day. */
  spendPearl: (heroId: string, itemId?: string) => string | undefined;
  /** DMG: Staff of Healing. Cure Wounds for 1 charge, out of combat. */
  spendStaff: (wielderId: string, targetId: string) => string | undefined;

  goto: (screen: Screen) => void;
  /** Back to wherever the party is: the tavern, or the map. */
  goHome: () => void;
  startNewGame: (seed?: number) => void;
  /** Runs `fn` with the game's seeded dice and remembers where the dice got to. */
  withRng: <T>(fn: (rng: RandomSource) => T) => T;
  addHero: (hero: Hero) => void;
  removeHero: (id: string) => void;
  beginAdventure: () => SaveFile;
  saveTo: (slot: SlotId) => SaveFile;
  loadGame: (save: SaveFile) => void;
  openPrepare: (encounterId: string) => void;
  /** Level the party for the fight, autosave, and start it. */
  startFight: (opts: {
    difficulty: DifficultyId;
    formation?: Record<string, Pos>;
    mageArmor?: string[];
  }) => void;
  /** Send one hero ahead to sneak up on the fight being prepared (D35). One try per fight. */
  scout: (heroId: string, difficulty: DifficultyId) => Scouted | null;
  /** After a successful scout: get past unseen, for the fight's XP (D35). */
  slipPast: () => void;
  combatAct: (a: PlayerAction) => string | undefined;
  combatAdvance: () => void;
  setCombatDifficulty: (d: DifficultyId) => void;
  /** After a victory: keep HP and spent resources, award XP, autosave, back to the party. */
  endFight: () => void;
  talk: (knot: string, story?: string) => void;
  choose: (index: number) => void;
  leaveDialogue: () => void;
  openLevelUp: (heroId: string) => void;
  confirmLevelUp: (heroId: string, plan: LevelUpPlan) => void;
  toast: (messages: string[]) => void;
  clearToasts: () => void;
  openMap: () => void;
  travelTo: (placeId: string) => void;
  openCamp: (scene?: CampScene) => void;
  setCampScene: (scene: CampScene) => void;
  beginShortRest: () => void;
  spendHitDie: (heroId: string) => void;
  endShortRest: () => void;
  longRest: () => void;
  /** Check the night's road encounter for a long rest; null if no rest is allowed now. */
  planLongRest: () => { interruptAt: number | null; encounterId: string | null } | null;
  /** The night's encounter strikes after `hours` asleep. */
  interruptLongRest: (encounterId: string, hours: number) => void;
  /** Stop sleeping early: time passes, no benefit. */
  wakeEarly: (hours: number) => void;
  /** All 8 hours slept: the long rest's benefits, letters and dreams. */
  completeLongRest: () => void;
  /** Road-check lines for a night that will be interrupted (shown when it happens). */
  pendingNight: string[];
  answerLetter: (id: string, replyId?: string) => void;
  /** Talk past a talk-or-fight encounter (D16: same XP). Returns the check text. */
  talkPast: () => { success: boolean; text: string } | null;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export type StoreSet = StoreApi<GameStore>['setState'];
export type StoreGet = StoreApi<GameStore>['getState'];
