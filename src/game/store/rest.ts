import { roll, SeededRng } from '../../rules';
import { PLACE_SCENES } from '../dialogue';
import { formatDate } from '../calendar';
import { addNote, kindledOfferDue } from '../journal';
import { deliverLetters } from '../letters';
import { canLongRest, finishShortRest, spendDie, startShortRest, takeLongRest } from '../rest';
import { currentPlace, getPlace, roadCheck, travelHours, travelLeg } from '../travel';
import type { GameState } from '../save';
import { arrive, type GameStore, type StoreSet, type StoreGet } from './shared';

/** The world map, travel, camp and rests. */
export const restSlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<
  GameStore,
  | 'openMap'
  | 'travelTo'
  | 'openCamp'
  | 'setCampScene'
  | 'beginShortRest'
  | 'spendHitDie'
  | 'endShortRest'
  | 'longRest'
  | 'planLongRest'
  | 'interruptLongRest'
  | 'wakeEarly'
  | 'completeLongRest'
> => ({
  openMap: () => set({ screen: 'map' }),

  travelTo: (placeId) => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const from = currentPlace(game);
    const to = getPlace(placeId);
    const out = travelLeg(game, placeId, rng);
    let next: GameState = { ...game, clock: game.clock + travelHours(from, to) };
    if (out.kind === 'arrive' && out.note) next = addNote(next, out.note).game;
    const log = [...out.log];
    let spotted: string[] = [];
    if (out.kind === 'arrive') {
      const r = arrive(next, placeId);
      next = r.game;
      spotted = r.messages;
      log.push(`Arrived at ${to.name}. ${formatDate(next.clock)}.`, ...spotted);
    }
    const scene = out.kind === 'arrive' && PLACE_SCENES[placeId];
    set({
      game: next,
      rngState: rng.state,
      travelLog: [...log.reverse(), ...get().travelLog].slice(0, 30),
    });
    if (out.kind === 'encounter') {
      set({ pendingArrival: placeId, backToCamp: false });
      get().openPrepare(out.encounterId);
      return;
    }
    get().saveTo('autosave');
    if (spotted.length) get().toast(spotted);
    if (placeId === 'ashford') set({ screen: 'placemap' });
    else if (scene) get().enterPlace(placeId);
  },

  openCamp: (scene) => {
    const g = get().game;
    const inTown = !g || g.location === 'drowned-lantern' || g.location === 'ashford';
    set({
      screen: 'camp',
      campScene: scene ?? (inTown ? 'inn' : 'wild'),
      campLog: [
        inTown
          ? 'A private room at the Drowned Lantern. Brannoc has left a candle and a jug of water.'
          : 'The party makes camp. The fire is warm; the mountain, lately, is warmer.',
      ],
      shortRest: null,
    });
  },

  setCampScene: (campScene) => set({ campScene }),

  beginShortRest: () => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const r = startShortRest(game, rng);
    set({
      game: r.game,
      rngState: rng.state,
      shortRest: [],
      campLog: [...get().campLog, ...r.log, 'Spend Hit Dice to heal, then finish the rest.'],
    });
  },

  spendHitDie: (heroId) => {
    const { game, rngState, shortRest } = get();
    if (!game || !shortRest) return;
    const rng = SeededRng.fromState(rngState);
    try {
      const r = spendDie(game, heroId, rng);
      set({
        game: r.game,
        rngState: rng.state,
        shortRest: [...new Set([...shortRest, heroId])],
        campLog: [...get().campLog, ...r.log],
      });
    } catch (e) {
      set({ campLog: [...get().campLog, e instanceof Error ? e.message : String(e)] });
    }
  },

  endShortRest: () => {
    const { game, rngState, shortRest } = get();
    if (!game || !shortRest) return;
    const rng = SeededRng.fromState(rngState);
    const r = finishShortRest(game, shortRest, rng);
    set({
      game: r.game,
      rngState: rng.state,
      shortRest: null,
      campLog: [...get().campLog, ...r.log, 'The short rest is over.'],
    });
    get().saveTo('autosave');
  },

  longRest: () => {
    const plan = get().planLongRest();
    if (!plan) return;
    if (plan.encounterId) get().interruptLongRest(plan.encounterId, 0);
    else get().completeLongRest();
  },

  planLongRest: () => {
    const { game, rngState } = get();
    if (!game) return null;
    if (!canLongRest(game)) {
      set({
        campLog: [
          ...get().campLog,
          "You can't benefit from another long rest yet: once per 24 hours (PHB).",
        ],
      });
      return null;
    }
    const rng = SeededRng.fromState(rngState);
    // Encounters_and_XP.md §5b: one road check per long rest taken in the wild. If it hits, it
    // strikes at a random hour of the night (1d8) [inferred].
    const place = currentPlace(game);
    if (get().campScene !== 'inn' && place.region !== 'none') {
      const check = roadCheck(place.region, 'during the night', [], rng);
      if (check.kind === 'encounter') {
        const hour = roll('1d7', rng).total;
        set({ rngState: rng.state, pendingNight: check.log });
        return { interruptAt: hour, encounterId: check.encounterId };
      }
      set({ rngState: rng.state, campLog: [...get().campLog, ...check.log] });
    }
    return { interruptAt: null, encounterId: null };
  },

  interruptLongRest: (encounterId, hours) => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, clock: game.clock + hours },
      campLog: [
        ...get().campLog,
        ...get().pendingNight,
        `Hour ${hours} of the night: the rest is interrupted!`,
      ],
      pendingNight: [],
      backToCamp: true,
      pendingArrival: null,
    });
    get().openPrepare(encounterId);
  },

  wakeEarly: (hours) => {
    const { game } = get();
    if (!game) return;
    set({
      game: { ...game, clock: game.clock + hours },
      pendingNight: [],
      campLog: [
        ...get().campLog,
        `You wake after ${hours} hour${hours === 1 ? '' : 's'}. A long rest needs the full 8 hours (PHB), so it gives no benefit; a short rest still works.`,
      ],
    });
    get().saveTo('autosave');
  },

  completeLongRest: () => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const r = takeLongRest(game, rng);
    // Maelis_Letters.md: letter 2 comes on the first long rest on the road to the marsh.
    // PHB: clerics, druids and paladins can re-prepare spells after a long rest.
    let rested = {
      ...r.game,
      party: r.game.party.map((h) => (h.dead ? h : { ...h, canPrepare: true })),
    };
    if (rested.act === 2 && !rested.flags['act2_road'])
      rested = { ...rested, flags: { ...rested.flags, act2_road: true } };
    const d = deliverLetters(rested);
    const lines = [...r.log, `${formatDate(d.game.clock)}.`];
    if (d.delivered.length) lines.push('In the night, a lantern moth lands on your lantern…');
    set({ game: d.game, rngState: rng.state, campLog: [...get().campLog, ...lines] });
    get().saveTo('autosave');
    // Story_Bible Act II: after Marrowmere, Maelis comes to the camp in person (once).
    const g = get().game!;
    const offer = kindledOfferDue(g);
    if (g.act === 2 && g.flags['marrowmere_done'] && !g.flags['maelis_parley'])
      get().talk('parley', 'camp');
    // Story_Review #1: once an act, Cindrath offers the ember-marked party a gift in a dream.
    else if (offer) {
      set({ game: { ...g, flags: { ...g.flags, [`kindled_offer_${offer}`]: true } } });
      get().talk('kindled_dream', 'camp');
    }
    // Story_Bible §9: after the first shard, Cindrath offers Corin a dream bargain every long rest.
    else if (
      g.flags['act1_complete'] &&
      !g.flags['ending'] &&
      g.party.some((h) => h.origin === 'corin' && !h.dead)
    )
      get().talk('bargain', 'camp');
  },
});
