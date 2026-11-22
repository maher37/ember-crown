import { SeededRng } from '../../rules';
import { PLACE_SCENES } from '../dialogue';
import { placeMapFor } from '../placeMaps';
import { claimBounty, getBounty, takeBounty } from '../bounties';
import { openFind, searchArea } from '../finds';
import { buyAt, sellAt, applyService } from '../shops';
import { buy, sell } from '../gear';
import { currentPlace } from '../travel';
import { arrive, type GameStore, type StoreSet, type StoreGet } from './shared';

/** Towns and places: shops, the temple, the notice board, bounties and finds. */
export const townSlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<
  GameStore,
  | 'enterPlace'
  | 'buyFrom'
  | 'sellTo'
  | 'templeService'
  | 'takeNotice'
  | 'claimNotice'
  | 'huntBounty'
  | 'searchHere'
  | 'openFindAt'
  | 'enterTown'
  | 'enterTavern'
  | 'buyItem'
  | 'sellItem'
> => ({
  enterPlace: (placeId) => {
    const { game } = get();
    if (!game) return;
    const id = placeId ?? game.location;
    if (placeMapFor(id)) {
      set({ screen: 'placemap' });
      return;
    }
    const scene = PLACE_SCENES[id];
    if (!scene) {
      set({ screen: id === 'drowned-lantern' ? 'explore' : 'map' });
      return;
    }
    get().talk(scene.knot, scene.story);
  },

  buyFrom: (shopId, itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = buyAt(game, shopId, itemId);
    if (!r.error) set({ game: r.game });
    return r.error;
  },

  sellTo: (shopId, itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = sellAt(game, shopId, itemId);
    if (!r.error) set({ game: r.game });
    return r.error;
  },

  templeService: (serviceId, heroId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = applyService(game, serviceId, heroId);
    if (r.error) return r.error;
    set({ game: r.game });
    if (r.message) get().toast([r.message]);
    return undefined;
  },

  takeNotice: (questId) => {
    const { game } = get();
    if (!game) return;
    const r = takeBounty(game, questId);
    set({ game: r.game });
    get().toast(r.messages);
  },

  claimNotice: (questId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = claimBounty(game, questId);
    if (r.error) return r.error;
    set({ game: r.game });
    get().toast(r.messages);
    get().saveTo('autosave');
    return undefined;
  },

  huntBounty: (questId) => {
    const b = getBounty(questId);
    if (!b.encounter) return;
    set({ hunt: questId, pendingArrival: null, backToCamp: false, resume: null });
    get().openPrepare(b.encounter);
  },

  searchHere: () => {
    const { game, rngState } = get();
    if (!game) return [];
    const rng = SeededRng.fromState(rngState);
    const r = searchArea(game, currentPlace(game).id, rng);
    set({ game: r.game, rngState: rng.state });
    return r.log;
  },

  openFindAt: (findId, how) => {
    const { game, rngState } = get();
    if (!game) throw new Error('No game');
    const rng = SeededRng.fromState(rngState);
    const r = openFind(game, findId, how, rng);
    set({ game: r.game, rngState: rng.state });
    if (r.messages.length) get().toast(r.messages);
    if (r.opened) get().saveTo('autosave');
    return r;
  },

  enterTown: () => {
    const { game } = get();
    if (!game) return;
    const r = arrive(game, 'ashford');
    set({ game: r.game, screen: 'placemap' });
    if (r.messages.length) get().toast(r.messages);
  },

  enterTavern: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, location: 'drowned-lantern' }, screen: 'explore' });
  },

  buyItem: (itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = buy(game, itemId);
    if (!r.error) set({ game: r.game });
    return r.error;
  },

  sellItem: (itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    const r = sell(game, itemId);
    if (!r.error) set({ game: r.game });
    return r.error;
  },
});
