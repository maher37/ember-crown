import { create } from 'zustand';
import {
  abilityCheck,
  abilityModifier,
  roll,
  SeededRng,
  SKILLS,
  type RandomSource,
} from '../rules';
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
import { Conversation, PLACE_SCENES } from './dialogue';
import { placeMapFor } from './placeMaps';
import {
  buy,
  equipToSlot,
  isMagicItem,
  sell,
  startingPack,
  switchWeapons,
  unequipGear,
  unequipSlot,
} from './gear';
import { prepareProblem, prepareSpells } from './spellPrep';
import { giveLoadouts, type SlotId as GearSlot } from './loadout';
import { getItem } from './items';
import { castHealing, layOnHands } from './healing';
import { withFormation } from './formation';
import type { Hero } from './hero';
import { GAME_START } from './calendar';
import { formatDate } from './calendar';
import { bestFor, parseSkill } from './dialogue';
import { skillBonus, spellNumbers } from './hero';
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
  /** The scene to pick up after the fight it started (story id and knot). */
  resume: { story: string; knot: string } | null;
  /** After this conversation, open the scene of the place the party is at. */
  afterDialogue: 'place' | null;
  /** Which hero the party screen's character sheet shows. */
  sheetHeroId: string | null;

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
  spendPearl: (heroId: string) => string | undefined;
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
  resume: null,
  afterDialogue: null,
  sheetHeroId: null,
  pendingNight: [],

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
      flags: game.flags,
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
    const { pendingArrival, backToCamp } = get();
    if (pendingArrival) next = arrive(next, pendingArrival);
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
    });
    get().saveTo('autosave');
    if (resume) {
      get().talk(resume.knot, resume.story);
      set({ afterDialogue: after });
    } else if (after === 'place') get().enterPlace();
  },

  talk: (knot, story = 'tavern') => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const conversation = new Conversation(story, game, rng).start(knot);
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
    const { conversation, game, afterDialogue } = get();
    const travel = conversation?.travel;
    const fight = conversation?.fight;
    set({
      conversation: null,
      afterDialogue: null,
      screen: homeScreen(game),
    });
    // Autosave after every conversation, so story progress is never lost [inferred].
    get().saveTo('autosave');
    if (fight && conversation) {
      set({ resume: { story: conversation.storyId, knot: fight.resume } });
      get().openPrepare(fight.encounterId);
    } else if (travel === 'epilogue') set({ screen: 'epilogue' });
    else if (travel === 'map') get().openMap();
    else if (travel?.startsWith('scene:')) {
      // Another story's scene, e.g. "scene:ashford.hall" (the tavern's front door → Ashford Hall).
      const [story, ...rest] = travel.slice(6).split('.');
      get().talk(rest.join('.'), story);
    } else if (travel) get().openPrepare(travel);
    else if (afterDialogue === 'place') get().enterPlace();
  },

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
      set({ screen: id === 'drowned-lantern' || id === 'ashford' ? 'explore' : 'map' });
      return;
    }
    get().talk(scene.knot, scene.story);
  },

  equipItem: (heroId, itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    if ((game.inventory[itemId] ?? 0) < 1) return 'That item is not in the pack.';
    return get().equipToHeroSlot(heroId, itemId);
  },

  unequipItem: (heroId, itemId) => {
    const { game } = get();
    if (!game) return;
    const hero = game.party.find((h) => h.id === heroId);
    const lo = hero?.equipment.loadout;
    const slot = lo
      ? (Object.keys(lo) as (keyof typeof lo)[]).find((k) => k !== 'active' && lo[k] === itemId)
      : undefined;
    if (slot && slot !== 'active') get().clearHeroSlot(heroId, slot);
    else if (hero)
      // An older hero without slots: take it off the magic list.
      set({
        game: {
          ...game,
          party: game.party.map((h) =>
            h.id === heroId
              ? {
                  ...h,
                  equipment: {
                    ...h.equipment,
                    magic: h.equipment.magic.filter((x) => x !== itemId),
                  },
                }
              : h,
          ),
          inventory: { ...game.inventory, [itemId]: (game.inventory[itemId] ?? 0) + 1 },
        },
      });
  },

  unequipGear: (heroId, slot) => {
    const { game } = get();
    if (game) set({ game: unequipGear(game, heroId, slot) });
  },

  equipToHeroSlot: (heroId, itemId, slot) => {
    const { game, shortRest } = get();
    if (!game) return 'No game';
    if (isMagicItem(itemId)) {
      const item = getItem(itemId);
      // Items.md: attuning happens during a short rest.
      if (item.attunement && !shortRest)
        return `Attuning to ${item.name} takes a short rest (Camp → Short rest).`;
    }
    const r = equipToSlot(game, heroId, itemId, slot);
    if (!r.error) {
      set({ game: r.game });
      if (r.note) get().toast([r.note]);
    }
    return r.error;
  },

  clearHeroSlot: (heroId, slot) => {
    const { game } = get();
    if (game) set({ game: unequipSlot(game, heroId, slot) });
  },

  switchHeroWeapons: (heroId) => {
    const { game } = get();
    if (game) set({ game: switchWeapons(game, heroId) });
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

  prepareHeroSpells: (heroId, spellIds) => {
    const { game } = get();
    if (!game) return 'No game';
    const hero = game.party.find((h) => h.id === heroId);
    if (!hero) return 'No such hero';
    const problem = prepareProblem(hero, spellIds);
    if (problem) return problem;
    set({
      game: {
        ...game,
        party: game.party.map((h) => (h.id === heroId ? prepareSpells(h, spellIds) : h)),
      },
    });
    return undefined;
  },

  spendPearl: (heroId) => {
    const { game } = get();
    if (!game) return 'No game';
    if (game.flags['pearl_used']) return 'The pearl is dull until tomorrow (after a long rest).';
    const h = game.party.find((x) => x.id === heroId)!;
    const lvl = [3, 2, 1].find((l) => (h.slotsUsed[l - 1] ?? 0) > 0);
    if (!lvl) return `${h.name} has no spent spell slot of 3rd level or lower.`;
    const slotsUsed = h.slotsUsed.map((n, i) => (i === lvl - 1 ? n - 1 : n));
    set({
      game: {
        ...game,
        flags: { ...game.flags, pearl_used: true },
        party: game.party.map((x) => (x.id === heroId ? { ...x, slotsUsed } : x)),
      },
    });
    get().toast([`The Bog Pearl glows: ${h.name} regains a level-${lvl} spell slot.`]);
    return undefined;
  },

  spendStaff: (wielderId, targetId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    const charges = Number(game.flags['staff_charges'] ?? 10);
    if (charges < 1) return 'The staff has no charges left (it recovers some at dawn).';
    const w = game.party.find((x) => x.id === wielderId)!;
    const t = game.party.find((x) => x.id === targetId)!;
    if (t.dead) return `${t.name} is beyond Cure Wounds.`;
    if (t.hp >= t.maxHp) return `${t.name} is already at full health.`;
    const mod = spellNumbers(w)?.mod ?? 0;
    const rng = SeededRng.fromState(rngState);
    const r = roll('1d8', rng);
    const hp = Math.min(t.maxHp, t.hp + r.total + mod);
    set({
      rngState: rng.state,
      game: {
        ...game,
        flags: { ...game.flags, staff_charges: charges - 1 },
        party: game.party.map((x) => (x.id === targetId ? { ...x, hp } : x)),
      },
    });
    get().toast([
      `Staff of Healing (Cure Wounds): ${r.text} + ${mod} → ${t.name} ${hp}/${t.maxHp} HP · ${charges - 1} charges left`,
    ]);
    return undefined;
  },

  healOutside: (casterId, how, targetId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    const rng = SeededRng.fromState(rngState);
    const r =
      how === 'lay-on-hands'
        ? layOnHands(game, casterId, targetId)
        : castHealing(game, casterId, how.spellId, how.slotLevel, targetId, rng);
    if ('error' in r) return r.error;
    set({ game: r.game, rngState: rng.state });
    get().toast(r.log);
    return undefined;
  },

  setFormation: (order) => {
    const { game } = get();
    if (game) set({ game: withFormation(game, order) });
  },

  drinkPotion: (heroId, itemId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    if ((game.inventory[itemId] ?? 0) < 1) return 'None left.';
    if (!isMagicItem(itemId)) return 'That isn\u2019t something to drink.';
    const item = getItem(itemId);
    const heal = item.effects.find((e) => e.type === 'heal');
    if (!heal || heal.type !== 'heal') return `${item.name} only matters in a fight.`;
    const hero = game.party.find((h) => h.id === heroId)!;
    if (hero.dead) return `${hero.name} is beyond a potion's help.`;
    if (hero.hp >= hero.maxHp) return `${hero.name} is already at full health.`;
    const rng = SeededRng.fromState(rngState);
    const r = roll(heal.dice, rng);
    const hp = Math.min(hero.maxHp, hero.hp + r.total);
    set({
      rngState: rng.state,
      game: {
        ...game,
        party: game.party.map((h) => (h.id === heroId ? { ...h, hp } : h)),
        inventory: { ...game.inventory, [itemId]: game.inventory[itemId]! - 1 },
      },
    });
    get().toast([`${hero.name} drinks ${item.name}: ${r.text} → ${hp}/${hero.maxHp} HP`]);
    return undefined;
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
    if (placeId === 'ashford') set({ screen: 'explore' });
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
    if (g.act === 2 && g.flags['marrowmere_done'] && !g.flags['maelis_parley'])
      get().talk('parley', 'camp');
    // Story_Bible §9: after the first shard, Cindrath offers Corin a dream bargain every long rest.
    else if (
      g.flags['act1_complete'] &&
      !g.flags['ending'] &&
      g.party.some((h) => h.origin === 'corin' && !h.dead)
    )
      get().talk('bargain', 'camp');
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
      screen: backToCamp ? 'camp' : homeScreen(next),
      pendingArrival: null,
      backToCamp: false,
      toasts: messages,
      travelLog: [...messages, ...get().travelLog].slice(0, 30),
      campLog: backToCamp ? [...get().campLog, ...messages] : get().campLog,
    });
    get().saveTo('autosave');
    if (!backToCamp && pendingArrival && PLACE_SCENES[pendingArrival]) get().enterPlace();
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
      screen: save.game.flags['ending'] ? 'epilogue' : homeScreen(save.game),
      sessionStart: Date.now(),
      combat: null,
      resume: null,
      afterDialogue: null,
      lastResult: null,
      conversation: null,
      toasts: [],
    }),
}));
