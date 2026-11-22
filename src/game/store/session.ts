import { SeededRng } from '../../rules';
import { startingPack } from '../gear';
import { giveLoadouts } from '../loadout';
import { GAME_START } from '../calendar';
import { getOrigin } from '../hero';
import { applyLevelUp } from '../levelup';
import { makeSave, writeSlot, type GameState } from '../save';
import {
  homeScreen,
  PARTY_SIZE,
  newSeed,
  type GameStore,
  type StoreSet,
  type StoreGet,
} from './shared';

/** New game, the party creator, saving and loading, level-ups and toasts. */
export const sessionSlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<
  GameStore,
  | 'goto'
  | 'goHome'
  | 'startNewGame'
  | 'withRng'
  | 'addHero'
  | 'removeHero'
  | 'beginAdventure'
  | 'saveTo'
  | 'openLevelUp'
  | 'confirmLevelUp'
  | 'toast'
  | 'clearToasts'
  | 'loadGame'
> => ({
  goto: (screen) => set({ screen }),

  goHome: () => {
    const g = get().game;
    set({ screen: homeScreen(g), resume: null });
  },

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
    if (hero.origin !== 'custom' && party.some((h) => h.origin === hero.origin))
      throw new Error(`${getOrigin(hero.origin).name} is already in the party`);
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
      party: giveLoadouts(pendingParty, {}).party.map((h) => ({ ...h, canPrepare: true })),
      act: 1,
      location: 'drowned-lantern',
      playSeconds: 0,
      flags: pendingParty.some((h) => h.origin === 'corin') ? { corinInParty: true, ember: 0 } : {},
      quests: { 'lantern-night': { status: 'active', steps: [] } },
      notes: [],
      ink: {},
      clock: GAME_START,
      lastLongRest: null,
      inventory: giveLoadouts(pendingParty, startingPack(pendingParty).items).inventory,
      gold: startingPack(pendingParty).gold,
      letters: pendingParty.some((h) => h.origin === 'corin')
        ? [{ id: 'letter-0', read: false }]
        : [],
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

  openLevelUp: (heroId) => set({ levelUpId: heroId, screen: 'levelup' }),

  confirmLevelUp: (heroId, plan) => {
    const { game } = get();
    if (!game) return;
    const party = game.party.map((h) => (h.id === heroId ? applyLevelUp(h, plan) : h));
    const h = party.find((x) => x.id === heroId)!;
    set({ game: { ...game, party }, levelUpId: null });
    get().goHome();
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
      screen: save.game.flags['ending'] ? 'epilogue' : homeScreen(save.game),
      sessionStart: Date.now(),
      combat: null,
      resume: null,
      afterDialogue: null,
      lastResult: null,
      conversation: null,
      toasts: [],
    }),
});
