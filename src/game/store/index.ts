import { create } from 'zustand';
import type { GameStore } from './shared';
import { sessionSlice } from './session';
import { combatSlice } from './combat';
import { storySlice } from './story';
import { townSlice } from './town';
import { partySlice } from './party';
import { restSlice } from './rest';

export { homeScreen, PARTY_SIZE, type CampScene, type Screen } from './shared';

/**
 * The game store (Zustand). Its actions live in feature slices next to this file:
 * session, combat, story, town, party and rest.
 */
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
  travelLog: [],
  pendingArrival: null,
  backToCamp: false,
  campScene: 'wild',
  campLog: [],
  shortRest: null,
  resume: null,
  afterDialogue: null,
  sheetHeroId: null,
  hunt: null,
  scouted: null,
  pendingNight: [],

  ...sessionSlice(set, get),
  ...combatSlice(set, get),
  ...storySlice(set, get),
  ...townSlice(set, get),
  ...partySlice(set, get),
  ...restSlice(set, get),
}));
