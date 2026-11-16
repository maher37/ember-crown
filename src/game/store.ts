import { create } from 'zustand';
import { abilityCheck, abilityModifier, SeededRng, SKILLS, type RandomSource } from '../rules';
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
import { GAME_START } from './calendar';
import { formatDate } from './calendar';
import { bestFor, parseSkill } from './dialogue';
import { skillBonus } from './hero';
import { addNote, completeStep, partyXp } from './journal';
import { deliverLetters, readLetter } from './letters';
import { canLongRest, finishShortRest, spendDie, startShortRest, takeLongRest } from './rest';
import { currentPlace, getPlace, roadCheck, travelHours, travelLeg } from './travel';
import { applyLevelUp, type LevelUpPlan } from './levelup';
import { makeSave, writeSlot, type GameState, type SaveFile, type SlotId } from './save';

/** Put the party at a place (Ashford means the tavern). */
const arrive = (g: GameState, placeId: string): GameState => ({
  ...g,
  location: placeId === 'ashford' ? 'drowned-lantern' : placeId,
});

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
  | 'camp';
export type CampScene = 'wild' | 'inn' | 'cave';
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
  openMap: () => void;
  travelTo: (placeId: string) => void;
  openCamp: (scene?: CampScene) => void;
  setCampScene: (scene: CampScene) => void;
  beginShortRest: () => void;
  spendHitDie: (heroId: string) => void;
  endShortRest: () => void;
  longRest: () => void;
  answerLetter: (id: string, replyId?: string) => void;
  /** Talk past a talk-or-fight encounter (D16: same XP). Returns the check text. */
  talkPast: () => { success: boolean; text: string } | null;
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
  travelLog: [],
  pendingArrival: null,
  backToCamp: false,
  campScene: 'wild',
  campLog: [],
  shortRest: null,

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
      clock: GAME_START,
      lastLongRest: null,
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
      const r = completeStep(
        { ...next, flags: { ...next.flags, road_done: true } },
        'old-mine',
        'road',
      );
      next = r.game;
      messages.push(...r.messages);
    }
    const { pendingArrival, backToCamp } = get();
    if (pendingArrival) next = arrive(next, pendingArrival);
    set({
      game: next,
      combat: null,
      lastResult: result,
      screen: backToCamp
        ? 'camp'
        : pendingArrival && pendingArrival !== 'ashford'
          ? 'map'
          : 'explore',
      rngState: combat.rngState,
      toasts: messages,
      travelLog: [...messages, ...get().travelLog].slice(0, 30),
      campLog: backToCamp
        ? [...get().campLog, ...messages, 'The fight is over. You can try to rest again.']
        : get().campLog,
      pendingArrival: null,
      backToCamp: false,
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
    if (travel === 'map') get().openMap();
    else if (travel) get().openPrepare(travel);
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
    if (out.kind === 'arrive') {
      next = arrive(next, placeId);
      log.push(`Arrived at ${to.name}. ${formatDate(next.clock)}.`);
    }
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
    if (placeId === 'ashford') set({ screen: 'explore' });
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
    const { game, rngState } = get();
    if (!game) return;
    if (!canLongRest(game)) {
      set({
        campLog: [
          ...get().campLog,
          "You can't benefit from another long rest yet: once per 24 hours (PHB).",
        ],
      });
      return;
    }
    const rng = SeededRng.fromState(rngState);
    // Encounters_and_XP.md §5b: one road check per long rest taken in the wild.
    const place = currentPlace(game);
    if (get().campScene !== 'inn' && place.region !== 'none') {
      const check = roadCheck(place.region, 'during the night', [], rng);
      if (check.kind === 'encounter') {
        set({
          rngState: rng.state,
          campLog: [...get().campLog, ...check.log, 'The rest is interrupted!'],
          backToCamp: true,
          pendingArrival: null,
        });
        get().openPrepare(check.encounterId);
        return;
      }
      set({ campLog: [...get().campLog, ...check.log] });
    }
    const r = takeLongRest(game, rng);
    const d = deliverLetters(r.game);
    const lines = [...r.log, `${formatDate(d.game.clock)}.`];
    if (d.delivered.length) lines.push('In the night, a lantern moth lands on your lantern…');
    set({ game: d.game, rngState: rng.state, campLog: [...get().campLog, ...lines] });
    get().saveTo('autosave');
  },

  answerLetter: (id, replyId) => {
    const { game } = get();
    if (!game) return;
    set({ game: readLetter(game, id, replyId) });
    get().saveTo('autosave');
  },

  talkPast: () => {
    const { game, encounterId, rngState, pendingArrival, backToCamp } = get();
    if (!game || !encounterId) return null;
    const enc = getEncounter(encounterId);
    if (!enc.talk) return null;
    const rng = SeededRng.fromState(rngState);
    const skill = parseSkill(enc.talk.skill);
    const hero = bestFor(game, skill);
    const ability = SKILLS[skill];
    const bonus = skillBonus(hero, skill) - abilityModifier(hero.abilities[ability]);
    const label = enc.talk.skill[0]!.toUpperCase() + enc.talk.skill.slice(1);
    const r = abilityCheck(hero, ability, enc.talk.dc, rng, {
      label,
      bonuses: bonus ? [{ label: 'skill', value: bonus }] : [],
    });
    set({ rngState: rng.state });
    if (!r.success) return { success: false, text: `${r.log.text}. ${enc.talk.failure}` };
    // D16: talking past a fight is worth the same XP.
    let next = partyXp(game, enc.xpPerPc, enc.name).game;
    if (enc.talk.note) next = addNote(next, enc.talk.note).game;
    if (pendingArrival) next = arrive(next, pendingArrival);
    const messages = [
      r.log.text,
      enc.talk.success,
      `+${enc.xpPerPc} XP each: ${enc.name} (talked past)`,
    ];
    set({
      game: next,
      screen: backToCamp
        ? 'camp'
        : pendingArrival && pendingArrival !== 'ashford'
          ? 'map'
          : 'explore',
      pendingArrival: null,
      backToCamp: false,
      toasts: messages,
      travelLog: [...messages, ...get().travelLog].slice(0, 30),
      campLog: backToCamp ? [...get().campLog, ...messages] : get().campLog,
    });
    get().saveTo('autosave');
    return { success: true, text: r.log.text };
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
