import { act, advance, finishCombat, getEncounter, startCombat } from '../combat';
import { PLACE_SCENES } from '../dialogue';
import { useSettings } from '../settings';
import { getBounty, markHunted } from '../bounties';
import { completeStep } from '../journal';
import type { GameState } from '../save';
import { arrive, homeScreen, type GameStore, type StoreSet, type StoreGet } from './shared';

/** Preparing, playing and wrapping up fights. */
export const combatSlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<
  GameStore,
  'openPrepare' | 'startFight' | 'combatAct' | 'combatAdvance' | 'setCombatDifficulty' | 'endFight'
> => ({
  openPrepare: (encounterId) => set({ encounterId, screen: 'prepare', lastResult: null }),

  startFight: ({ difficulty, formation, mageArmor }) => {
    const { game, encounterId } = get();
    if (!game || !encounterId) throw new Error('No game or encounter');
    const enc = getEncounter(encounterId);
    const party = game.party
      .filter((h) => !(enc.excludeOrigin && h.origin === enc.excludeOrigin))
      // The chance to re-prepare spells ends when a fight starts [inferred].
      .map((h) => ({ ...h, canPrepare: false }))
      // A Hex or Hunter's Mark from the last fight, still within its hour: ready to place again.
      .map((h) =>
        h.lingering?.until !== undefined && game.clock <= h.lingering.until
          ? { ...h, concentration: h.lingering.spell, lingering: undefined }
          : { ...h, lingering: undefined },
      );
    // Autosave before every fight (docs/BUILD_ROADMAP.md, M4).
    get().saveTo('autosave');
    const combat = startCombat({
      encounter: getEncounter(encounterId),
      party,
      difficulty,
      rngState: get().rngState,
      formation,
      mageArmor,
      inventory: game.inventory,
      // Kind dice (a setting, on by default): read by the spell code.
      flags: { ...game.flags, kind_dice: useSettings.getState().kindDice },
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
    if (!combat || !game || !combat.outcome) return;
    const lost = combat.outcome === 'defeat';
    if (lost && !combat.defeatContinues) return;
    const result = finishCombat(combat, game.party);
    // Scenes read how the fight went: won:<id>, parley:<id> or lost:<id>.
    const how = lost ? 'lost' : combat.outcome === 'parley' ? 'parley' : 'won';
    let next: GameState = {
      ...game,
      // A Hex or Hunter's Mark still held lasts an hour from now (PHB).
      party: result.party.map((h) =>
        h.lingering ? { ...h, lingering: { ...h.lingering, until: game.clock + 1 } } : h,
      ),
      rngState: combat.rngState,
      inventory: result.inventory,
      flags: { ...game.flags, [`${how}:${combat.encounterId}`]: true },
    };
    const xpText = result.xpEach ? ` +${result.xpEach} XP each.` : '';
    const messages = [
      `${lost ? 'Beaten, but not finished.' : how === 'parley' ? 'The fight ends in words.' : 'Victory!'}${xpText}`,
      ...result.notes,
    ];
    let resume = get().resume;
    let after: 'place' | null = null;
    if (combat.encounterId === 'f2-road-ambush') {
      const r = completeStep(
        { ...next, flags: { ...next.flags, road_done: true } },
        'old-mine',
        'road',
      );
      next = r.game;
      messages.push(...r.messages);
      // The goblin who stayed: the last goblin begs for its life.
      if (!next.flags['wix_met']) {
        resume = { story: 'road', knot: 'wix' };
        after = 'place';
      }
    }
    // A bounty's fight won: the purse waits at the Hall.
    const hunt = get().hunt;
    if (hunt && !lost && getBounty(hunt).encounter === combat.encounterId) {
      const r = markHunted(next, hunt);
      next = r.game;
      messages.push(...r.messages);
    }
    const { pendingArrival, backToCamp } = get();
    if (pendingArrival) {
      const r = arrive(next, pendingArrival);
      next = r.game;
      messages.push(...r.messages);
    }
    if (!resume && pendingArrival && PLACE_SCENES[pendingArrival]) after = 'place';
    set({
      game: next,
      combat: null,
      lastResult: result,
      screen: backToCamp ? 'camp' : homeScreen(next),
      rngState: combat.rngState,
      toasts: messages,
      travelLog: [...messages, ...get().travelLog].slice(0, 30),
      campLog: backToCamp
        ? [...get().campLog, ...messages, 'The fight is over. You can try to rest again.']
        : get().campLog,
      pendingArrival: null,
      backToCamp: false,
      resume: null,
      hunt: null,
    });
    get().saveTo('autosave');
    if (resume) {
      get().talk(resume.knot, resume.story);
      set({ afterDialogue: after });
    } else if (after === 'place') get().enterPlace();
  },
});
