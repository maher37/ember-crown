import { Story } from 'inkjs';
import ashwoodInk from '../content/dialogue/ashwood.ink';
import caveInk from '../content/dialogue/cave.ink';
import millInk from '../content/dialogue/mill.ink';
import mineInk from '../content/dialogue/mine.ink';
import roadInk from '../content/dialogue/road.ink';
import tavernInk from '../content/dialogue/tavern.ink';
import warrenInk from '../content/dialogue/warren.ink';
import abbeyInk from '../content/dialogue/abbey.ink';
import ashfordInk from '../content/dialogue/ashford.ink';
import bridgeInk from '../content/dialogue/bridge.ink';
import campInk from '../content/dialogue/camp.ink';
import desertersInk from '../content/dialogue/deserters.ink';
import marshInk from '../content/dialogue/marsh.ink';
import marrowmereInk from '../content/dialogue/marrowmere.ink';
import sallowInk from '../content/dialogue/sallow.ink';
import { backgrounds, classes, npcs, species } from '../data';
import {
  abilityCheck,
  abilityModifier,
  SKILL_IDS,
  roll,
  SKILLS,
  type Ability,
  type RandomSource,
  type Skill,
} from '../rules';
import { skillBonus, type Hero } from './hero';
import { getItem, hasItem, hasSpecial, itemMods } from './items';
import { savingThrow } from '../rules';

import { addNote, completeStep, giveAward, questDone } from './journal';
import type { GameState } from './save';

/** Every compiled Ink story, by id. Add new dialogue files here. */
export const STORIES: Record<string, string> = {
  tavern: tavernInk,
  road: roadInk,
  warren: warrenInk,
  mine: mineInk,
  mill: millInk,
  ashwood: ashwoodInk,
  cave: caveInk,
  bridge: bridgeInk,
  marsh: marshInk,
  marrowmere: marrowmereInk,
  ashford: ashfordInk,
  abbey: abbeyInk,
  sallow: sallowInk,
  deserters: desertersInk,
  camp: campInk,
};

/** The scene that opens when the party arrives at a map location (Ashford is the tavern). */
export const PLACE_SCENES: Record<string, { story: string; knot: string }> = {
  warren: { story: 'warren', knot: 'arrive' },
  'old-mine': { story: 'mine', knot: 'arrive' },
  mill: { story: 'mill', knot: 'arrive' },
  ashwood: { story: 'ashwood', knot: 'arrive' },
  'steaming-cave': { story: 'cave', knot: 'arrive' },
  'toll-bridge': { story: 'bridge', knot: 'arrive' },
  'lizardfolk-grounds': { story: 'marsh', knot: 'arrive' },
  marrowmere: { story: 'marrowmere', knot: 'arrive' },
  abbey: { story: 'abbey', knot: 'arrive' },
  sallow: { story: 'sallow', knot: 'arrive' },
  'deserters-camp': { story: 'deserters', knot: 'arrive' },
};

/** The Truths (Story_Bible §6) by id. */
export const TRUTHS: Record<string, string> = {
  collapse: 'The Collapse',
  crown: 'The Crown',
  family: 'The Family',
};

const SKILL_NAMES: Record<Skill, string> = {
  acrobatics: 'Acrobatics',
  animalHandling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

export function parseSkill(text: string): Skill {
  const s = SKILL_IDS.find((k) => k.toLowerCase() === text.toLowerCase());
  if (!s) throw new Error(`Unknown skill "${text}" in dialogue`);
  return s;
}

const alive = (g: GameState) => g.party.filter((h) => !h.dead);

/** Does this hero match a dialogue tag ("corin", "class:cleric", "species:hill-dwarf", "background:soldier")? */
export function matches(h: Hero, tag: string): boolean {
  if (tag === 'corin') return h.origin === 'corin';
  const [kind, id] = tag.split(':');
  if (kind === 'class') return h.classId === id;
  if (kind === 'species') return h.speciesId === id;
  if (kind === 'background') return h.backgroundId === id;
  throw new Error(`Unknown dialogue tag "${tag}"`);
}

/** "[Corin]", "[Cleric]", "[Hill Dwarf]", "[Soldier]". */
export function tagLabel(tag: string): string {
  if (tag === 'corin') return 'Corin';
  const [kind, id] = tag.split(':');
  const list = kind === 'class' ? classes : kind === 'species' ? species : backgrounds;
  return list.find((x) => x.id === id)?.name ?? id!;
}

/** A hero's full bonus for a check: skill plus items (the Luck-Stone). */
export const checkBonus = (h: Hero, skill: Skill) => skillBonus(h, skill) + itemMods(h).check;

/** D11: the party member with the best bonus rolls (ties: earlier in the party). */
export function bestFor(g: GameState, skill: Skill): Hero {
  return alive(g).reduce((best, h) => (checkBonus(h, skill) > checkBonus(best, skill) ? h : best));
}

/** Does anyone carry or wear this item? */
export const partyHasItem = (g: GameState, id: string) =>
  (g.inventory[id] ?? 0) > 0 || g.party.some((h) => hasItem(h, id));

/** Put items in the party's pack. */
export function giveItem(
  g: GameState,
  id: string,
  qty = 1,
): { game: GameState; messages: string[] } {
  const item = getItem(id);
  return {
    game: { ...g, inventory: { ...g.inventory, [id]: (g.inventory[id] ?? 0) + qty } },
    messages: [`Received: ${item.name}${qty > 1 ? ` ×${qty}` : ''}`],
  };
}

/** A Truth for the finale (Story_Bible §6), kept as a flag. */
export function learnTruth(g: GameState, id: string): { game: GameState; messages: string[] } {
  const name = TRUTHS[id];
  if (!name) throw new Error(`Unknown Truth "${id}"`);
  if (g.flags[`truth_${id}`]) return { game: g, messages: [] };
  return {
    game: { ...g, flags: { ...g.flags, [`truth_${id}`]: true } },
    messages: [`Truth learned: ${name}`],
  };
}

export interface CheckRoll {
  skill: Skill;
  skillName: string;
  dc: number;
  heroName: string;
  success: boolean;
  /** "Medicine check (Ilse): d20 (12) + 5 = 17 vs DC 10 → SUCCESS" */
  text: string;
}

export interface ChoiceView {
  index: number;
  text: string;
  check?: { skill: Skill; skillName: string; dc: number; heroName: string; bonus: number };
  /** Character-specific option: "[Corin]" and who it is. */
  as?: { label: string; heroName: string };
  /** Encounters_and_XP §6: choices that start a fight are marked (#fight). */
  fight?: boolean;
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

/**
 * One conversation, driven by an Ink story. The game state is updated as the story calls the
 * engine's hooks (flags, quests, XP, notes); read `game` back when the conversation ends.
 */
export class Conversation {
  readonly storyId: string;
  game: GameState;
  speaker = 'tavern';
  lines: DialogueLine[] = [];
  messages: string[] = [];
  lastCheck: CheckRoll | null = null;
  travel: string | null = null;
  /** A fight the scene started, and the knot to pick the story up at afterwards. */
  fight: { encounterId: string; resume: string } | null = null;
  private story: Story;
  rng: RandomSource;
  private lastRoller: string | null = null;

  constructor(storyId: string, game: GameState, rng: RandomSource) {
    const json = STORIES[storyId];
    if (!json) throw new Error(`Unknown dialogue "${storyId}"`);
    this.storyId = storyId;
    this.game = game;
    this.rng = rng;
    this.story = new Story(json);
    if (game.ink[storyId]) this.story.state.LoadJson(game.ink[storyId]!);
    this.bind();
  }

  private bind(): void {
    const s = this.story;
    const apply = (r: { game: GameState; messages: string[] }) => {
      this.game = r.game;
      this.messages.push(...r.messages);
    };
    s.BindExternalFunction(
      'has',
      (tag: string) => alive(this.game).some((h) => matches(h, tag)),
      true,
    );
    s.BindExternalFunction('flag', (name: string) => this.game.flags[name] ?? false, true);
    s.BindExternalFunction('set_flag', (name: string, value: boolean | number | string) => {
      this.game = { ...this.game, flags: { ...this.game.flags, [name]: value } };
    });
    s.BindExternalFunction('quest_step', (q: string, step: string) =>
      apply(completeStep(this.game, q, step)),
    );
    s.BindExternalFunction('quest_done', (q: string) => questDone(this.game, q), true);
    s.BindExternalFunction('award', (id: string) => apply(giveAward(this.game, id)));
    s.BindExternalFunction('note', (text: string) => apply(addNote(this.game, text)));
    s.BindExternalFunction(
      'roller',
      () => this.lastRoller ?? alive(this.game)[0]!.name.split(' ')[0]!,
      true,
    );
    s.BindExternalFunction('leader', () => alive(this.game)[0]!.name.split(' ')[0]!, true);
    s.BindExternalFunction('travel', (where: string) => {
      this.travel = where;
    });
    s.BindExternalFunction('fight', (encounterId: string, resume: string) => {
      this.fight = { encounterId, resume };
    });
    s.BindExternalFunction('give_item', (id: string, qty: number) =>
      apply(giveItem(this.game, id, qty)),
    );
    s.BindExternalFunction('give_gold', (n: number) => {
      this.game = { ...this.game, gold: Math.max(0, (this.game.gold ?? 0) + n) };
      this.messages.push(n >= 0 ? `Received ${n} gp` : `Paid ${-n} gp`);
    });
    s.BindExternalFunction('gold', () => this.game.gold ?? 0, true);
    s.BindExternalFunction('has_item', (id: string) => partyHasItem(this.game, id), true);
    s.BindExternalFunction('truth', (id: string) => apply(learnTruth(this.game, id)));
    s.BindExternalFunction('set_act', (n: number) => {
      this.game = { ...this.game, act: n as GameState['act'] };
      this.messages.push(`Act ${['I', 'II', 'III'][n - 1]} begins.`);
    });
    s.BindExternalFunction('trap', (ability: string, dc: number, dice: string, type: string) =>
      this.trap(ability as Ability, dc, dice, type),
    );
  }

  /**
   * A trap: the party's leader makes a saving throw; on a failure they take the damage (never
   * below 1 HP outside a fight [inferred]). Returns whether the save succeeded.
   */
  private trap(ability: Ability, dc: number, dice: string, type: string): boolean {
    const h = alive(this.game)[0]!;
    const luck = itemMods(h).save;
    const save = savingThrow(h, ability, dc, this.rng, {
      bonuses: luck ? [{ label: 'items', value: luck }] : [],
    });
    this.lastRoller = h.name.split(' ')[0]!;
    const lines = [save.log.text];
    let hp = h.hp;
    if (!save.success) {
      const r = roll(dice, this.rng);
      hp = Math.max(1, h.hp - r.total);
      lines.push(`${r.text} ${type} damage`);
    }
    this.lastCheck = {
      skill: 'athletics',
      skillName: ability.toUpperCase(),
      dc,
      heroName: this.lastRoller,
      success: save.success,
      text: lines.join(' · '),
    };
    this.game = {
      ...this.game,
      party: this.game.party.map((x) => (x.id === h.id ? { ...x, hp } : x)),
    };

    return save.success;
  }

  /** Start (or restart) the conversation at a knot, e.g. "brannoc". */
  start(knot: string): this {
    this.lines = [];
    this.lastCheck = null;
    this.fight = null;
    this.travel = null;
    this.story.ChoosePathString(knot);
    this.run();
    return this;
  }

  private run(): void {
    const s = this.story;
    while (s.canContinue) {
      const text = s.Continue()?.trim() ?? '';
      for (const t of s.currentTags ?? []) if (t.startsWith('speaker:')) this.speaker = t.slice(8);
      if (text) this.lines.push({ speaker: this.speaker, text });
    }
    this.game = { ...this.game, ink: { ...this.game.ink, [this.storyId]: s.state.ToJson() } };
  }

  get ended(): boolean {
    return !this.story.canContinue && this.story.currentChoices.length === 0;
  }

  get choices(): ChoiceView[] {
    return this.story.currentChoices.map((c, index) => {
      const tags = c.tags ?? [];
      const as = tags.find((t) => t.startsWith('as:'))?.slice(3);
      const check = tags.find((t) => t.startsWith('check:'));
      const view: ChoiceView = { index, text: c.text.trim() };
      if (tags.includes('fight')) view.fight = true;
      const hero = as ? alive(this.game).find((h) => matches(h, as)) : undefined;
      if (as && hero) view.as = { label: tagLabel(as), heroName: hero.name.split(' ')[0]! };
      if (check) {
        const [, sk, dc] = check.split(':');
        const skill = parseSkill(sk!);
        const who = hero ?? bestFor(this.game, skill);
        view.check = {
          skill,
          skillName: SKILL_NAMES[skill],
          dc: Number(dc),
          heroName: who.name.split(' ')[0]!,
          bonus: checkBonus(who, skill),
        };
      }
      return view;
    });
  }

  /** Pick a choice. A skill check is rolled first (seeded), and the story learns `passed`. */
  choose(index: number): this {
    const view = this.choices[index];
    if (!view) throw new Error(`No choice ${index}`);
    this.lines = [];
    this.messages = [];
    this.lastCheck = null;
    const tags = this.story.currentChoices[index]!.tags ?? [];
    const as = tags.find((t) => t.startsWith('as:'))?.slice(3);
    if (as) this.lastRoller = view.as?.heroName ?? null;
    if (view.check) {
      const hero =
        (as && alive(this.game).find((h) => matches(h, as))) ||
        bestFor(this.game, view.check.skill);
      const ability = SKILLS[view.check.skill];
      const bonus = skillBonus(hero, view.check.skill) - abilityModifier(hero.abilities[ability]);
      const luck = itemMods(hero).check;
      // DMG: Boots of Elvenkind (Stealth) and Sentinel Shield (Perception): advantage.
      const edge =
        (view.check.skill === 'stealth' && hasSpecial(hero, 'stealth-advantage-quiet')) ||
        (view.check.skill === 'perception' && hasSpecial(hero, 'perception-advantage'));
      const r = abilityCheck(hero, ability, view.check.dc, this.rng, {
        advantage: edge ? ['magic item'] : [],
        label: view.check.skillName,
        bonuses: [
          ...(bonus ? [{ label: 'skill', value: bonus }] : []),
          ...(luck ? [{ label: 'items', value: luck }] : []),
        ],
      });
      const first = hero.name.split(' ')[0]!;
      this.lastRoller = first;
      this.lastCheck = {
        skill: view.check.skill,
        skillName: view.check.skillName,
        dc: view.check.dc,
        heroName: first,
        success: r.success,
        text: r.log.text.replace(
          `${hero.name} ${view.check.skillName} check`,
          `${view.check.skillName} check (${first})`,
        ),
      };
      this.story.variablesState['passed'] = r.success;
    }
    this.story.ChooseChoiceIndex(index);
    this.run();
    return this;
  }
}

export const npcById = (id: string) => npcs.find((n) => n.id === id);
