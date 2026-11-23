// Camp companions who talk (D32, Story_Review #2): at camp only, never in fights. Who sits at the
// fire, and which of their one-time scenes (src/content/dialogue/fire.ink) is ready to play.
import { questDone } from './journal';
import type { GameState } from './save';

export interface Companion {
  id: string;
  name: string;
  /** Whether they've joined the camp. */
  joined: (g: GameState) => boolean;
  /** A line for when they have nothing new to say. */
  idle: string;
}

const f = (g: GameState, name: string) => !!g.flags[name];
const started = (g: GameState, quest: string) => !!g.quests[quest];

/** Who can join, and when [inferred: the join points are my picks from the story beats]. */
export const COMPANIONS: Companion[] = [
  {
    id: 'wix',
    name: 'Wix',
    joined: (g) => f(g, 'wix_companion'),
    idle: 'Wix is counting his pies. It is going badly.',
  },
  {
    id: 'edric',
    name: 'Edric Hale',
    joined: (g) => f(g, 'edric_errand_done'),
    idle: 'Edric is re-tying the knots on his message satchel.',
  },
  {
    id: 'tamsin',
    name: 'Tamsin',
    joined: (g) => f(g, 'tamsin_home'),
    idle: 'Tamsin is sorting herbs into little paper twists.',
  },
  {
    id: 'ulric',
    name: 'Brother Ulric',
    joined: (g) => f(g, 'ulric_spared') && f(g, 'act1_complete'),
    idle: 'Ulric sits facing the dark, the way old miners do.',
  },
  {
    id: 'kell',
    name: 'Captain Kell',
    joined: (g) => g.act >= 3 && (f(g, 'kell_respect') || f(g, 'kell_owes')),
    idle: 'Kell is writing in a little book. It is a long book.',
  },
  {
    id: 'ida',
    name: 'Ser Ida Marrow',
    joined: (g) => f(g, 'ida_ally'),
    idle: 'Ser Ida watches the fire from just outside its light.',
  },
];

export interface FireScene {
  /** Also the Ink knot in fire.ink, and the flag fire:<id> once played. */
  id: string;
  companion: string;
  ready: (g: GameState) => boolean;
}

/** In order: the first ready, unplayed scene for a companion is the one they bring up. */
export const FIRE_SCENES: FireScene[] = [
  { id: 'wix_1', companion: 'wix', ready: () => true },
  { id: 'wix_2', companion: 'wix', ready: (g) => g.act >= 3 },
  { id: 'edric_1', companion: 'edric', ready: () => true },
  { id: 'edric_2', companion: 'edric', ready: (g) => f(g, 'act3_evacuation') },
  { id: 'tamsin_1', companion: 'tamsin', ready: () => true },
  { id: 'tamsin_2', companion: 'tamsin', ready: (g) => f(g, 'marrowmere_done') },
  { id: 'ulric_1', companion: 'ulric', ready: () => true },
  {
    id: 'ulric_2',
    companion: 'ulric',
    ready: (g) =>
      started(g, 'ulric-name') &&
      !questDone(g, 'ulric-name') &&
      (f(g, 'hadric_named') || f(g, 'harl_named_hadric')),
  },
  { id: 'kell_1', companion: 'kell', ready: () => true },
  {
    id: 'kell_2',
    companion: 'kell',
    ready: (g) =>
      started(g, 'kell-sergeant') &&
      !questDone(g, 'kell-sergeant') &&
      g.finds?.['reeds-sergeant'] === 'done',
  },
  { id: 'ida_1', companion: 'ida', ready: () => true },
];

/** Companions at the fire now (living ones only, and not after the story has ended). */
export const campCompanions = (g: GameState): Companion[] =>
  g.flags['ending'] ? [] : COMPANIONS.filter((c) => c.joined(g));

/** The scene this companion wants to have, if any. */
export const fireSceneFor = (g: GameState, companionId: string): FireScene | null =>
  FIRE_SCENES.find((s) => s.companion === companionId && !g.flags[`fire:${s.id}`] && s.ready(g)) ??
  null;
