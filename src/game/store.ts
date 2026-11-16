import { create } from 'zustand';
import { SeededRng, type RandomSource } from '../rules';
import type { DifficultyId } from '../data/schemas/difficulty';
import {
  act,
  advance,
  finishCombat,
  getEncounter,
  startCombat,
  type CombatResult,
  type CombatState,
  type PlayerAction,
  type Pos,
} from './combat';
import { Conversation } from './dialogue';
import type { Hero } from './hero';
import { completeStep } from './journal';
import { applyLevelUp, type LevelUpPlan } from './levelup';
import { makeSave, writeSlot, type GameState, type SaveFile, type SlotId } from './save';

export type Screen =
  'title' | 'creator' | 'party' | 'explore' | 'dialogue' | 'levelup' | 'prepare' | 'combat';
export const PARTY_SIZE = 4;

interface GameStore {
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

  goto: (screen: Screen) => void;
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
  combatAct: (a: PlayerAction) => string | undefined;
  combatAdvance: () => void;
  setCombatDifficulty: (d: DifficultyId) => void;
  /** After a victory: keep HP and spent resources, award XP, autosave, back to the party. */
  endFight: () => void;
  talk: (knot: string) => void;
  choose: (index: number) => void;
  leaveDialogue: () => void;
  openLevelUp: (heroId: string) => void;
  confirmLevelUp: (heroId: string, plan: LevelUpPlan) => void;
  toast: (messages: string[]) => void;
  clearToasts: () => void;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export const useGame = create<GameStore>()((set, get) => ({
  screen: 'title',
  game: null,
  pendingParty: [],
  seed: 0,
  rngState: 0,
  sessionStart: Date.now(),
  encounterId: null,
  combat: null,
  lastResult: null,
  conversation: null,
  dialogueTick: 0,
  levelUpId: null,
  toasts: [],

  goto: (screen) => set({ screen }),

  startNewGame: (seed = newSeed()) =>
    set({
      screen: 'creator',
      game: null,
      pendingParty: [],
      seed,
      rngState: seed,
      sessionStart: Date.now(),
    }),

  withRng: (fn) => {
    const rng = SeededRng.fromState(get().rngState);
    const out = fn(rng);
    set({ rngState: rng.state });
    return out;
  },

  addHero: (hero) => {
    const party = get().pendingParty;
    if (party.length >= PARTY_SIZE) throw new Error('The party is full');
    if (hero.origin === 'corin' && party.some((h) => h.origin === 'corin'))
      throw new Error('Corin is already in the party');
    set({ pendingParty: [...party, hero] });
  },

  removeHero: (id) => set({ pendingParty: get().pendingParty.filter((h) => h.id !== id) }),

  beginAdventure: () => {
    const { pendingParty, seed, rngState } = get();
    if (pendingParty.length !== PARTY_SIZE) throw new Error(`The party needs ${PARTY_SIZE} heroes`);
    const game: GameState = {
      id: `game-${seed.toString(36)}`,
      createdAt: new Date().toISOString(),
      seed,
      rngState,
      party: pendingParty,
      act: 1,
      location: 'drowned-lantern',
      playSeconds: 0,
      flags: pendingParty.some((h) => h.origin === 'corin') ? { corinInParty: true, ember: 0 } : {},
      quests: { 'lantern-night': { status: 'active', steps: [] } },
      notes: [],
      ink: {},
    };
    set({ game, pendingParty: [], screen: 'explore', sessionStart: Date.now(), toasts: [] });
    // Autosave at the start of the adventure (and later before every fight, M4).
    return get().saveTo('autosave');
  },

  saveTo: (slot) => {
    const { game, sessionStart, rngState } = get();
    if (!game) throw new Error('No game to save');
    const now = Date.now();
    const updated: GameState = {
      ...game,
      rngState,
      playSeconds: game.playSeconds + Math.max(0, (now - sessionStart) / 1000),
    };
    const save = makeSave(updated, new Date(now));
    writeSlot(slot, save);
    set({ game: updated, sessionStart: now });
    return save;
  },

  openPrepare: (encounterId) => set({ encounterId, screen: 'prepare', lastResult: null }),

  startFight: ({ difficulty, formation, mageArmor }) => {
    const { game, encounterId } = get();
    if (!game || !encounterId) throw new Error('No game or encounter');
    const party = game.party;
    // Autosave before every fight (docs/BUILD_ROADMAP.md, M4).
    get().saveTo('autosave');
    const combat = startCombat({
      encounter: getEncounter(encounterId),
      party,
      difficulty,
      rngState: get().rngState,
      formation,
      mageArmor,
    });
    set({ combat, screen: 'combat' });
  },

  combatAct: (a) => {
    const { combat } = get();
    if (!combat) return 'No fight in progress';
    const r = act(combat, a);
    if (!r.error) set({ combat: r.state, rngState: r.state.rngState });
    return r.error;
  },

  combatAdvance: () => {
    const { combat } = get();
    if (!combat) return;
    const next = advance(combat);
    if (next !== combat) set({ combat: next, rngState: next.rngState });
  },

  setCombatDifficulty: (difficulty) => {
    const { combat } = get();
    if (combat) set({ combat: { ...combat, difficulty } });
  },

  endFight: () => {
    const { combat, game } = get();
    if (!combat || !game || combat.outcome !== 'victory') return;
    const result = finishCombat(combat, game.party);
    let next = { ...game, party: result.party, rngState: combat.rngState };
    const messages = [`Victory! +${result.xpEach} XP each.`, ...result.notes];
    if (combat.encounterId === 'f2-road-ambush') {
      const r = completeStep(next, 'old-mine', 'road');
      next = r.game;
      messages.push(...r.messages);
    }
    set({
      game: next,
      combat: null,
      lastResult: result,
      screen: 'explore',
      rngState: combat.rngState,
      toasts: messages,
    });
    get().saveTo('autosave');
  },

  talk: (knot) => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const conversation = new Conversation('tavern', game, rng).start(knot);
    set({
      conversation,
      game: conversation.game,
      rngState: rng.state,
      screen: 'dialogue',
      dialogueTick: get().dialogueTick + 1,
    });
    if (conversation.messages.length) get().toast(conversation.messages);
  },

  choose: (index) => {
    const { conversation, rngState } = get();
    if (!conversation) return;
    const rng = SeededRng.fromState(rngState);
    // The conversation keeps the dice it was made with; give it the current position.
    conversation.rng = rng;
    conversation.choose(index);
    set({ game: conversation.game, rngState: rng.state, dialogueTick: get().dialogueTick + 1 });
    if (conversation.messages.length) get().toast(conversation.messages);
  },

  leaveDialogue: () => {
    const { conversation } = get();
    const travel = conversation?.travel;
    set({ conversation: null, screen: 'explore' });
    // Autosave after every conversation, so story progress is never lost [inferred].
    get().saveTo('autosave');
    if (travel) get().openPrepare(travel);
  },

  openLevelUp: (heroId) => set({ levelUpId: heroId, screen: 'levelup' }),

  confirmLevelUp: (heroId, plan) => {
    const { game } = get();
    if (!game) return;
    const party = game.party.map((h) => (h.id === heroId ? applyLevelUp(h, plan) : h));
    const h = party.find((x) => x.id === heroId)!;
    set({ game: { ...game, party }, levelUpId: null, screen: 'explore' });
    get().toast([`${h.name} reaches level ${h.level}!`]);
    get().saveTo('autosave');
  },

  toast: (messages) => set({ toasts: [...get().toasts, ...messages].slice(-6) }),
  clearToasts: () => set({ toasts: [] }),

  loadGame: (save) =>
    set({
      game: save.game,
      seed: save.game.seed,
      rngState: save.game.rngState,
      pendingParty: [],
      screen: 'explore',
      sessionStart: Date.now(),
      combat: null,
      lastResult: null,
      conversation: null,
      toasts: [],
    }),
}));
