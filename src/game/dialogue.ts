import { Story } from 'inkjs';
import tavernInk from '../content/dialogue/tavern.ink';
import { backgrounds, classes, npcs, species } from '../data';
import {
  abilityCheck,
  abilityModifier,
  SKILL_IDS,
  SKILLS,
  type RandomSource,
  type Skill,
} from '../rules';
import { skillBonus, type Hero } from './hero';
import { addNote, completeStep, giveAward, questDone } from './journal';
import type { GameState } from './save';

/** Every compiled Ink story, by id. Add new dialogue files here. */
export const STORIES: Record<string, string> = { tavern: tavernInk };

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

/** D11: the party member with the best bonus rolls (ties: earlier in the party). */
export function bestFor(g: GameState, skill: Skill): Hero {
  return alive(g).reduce((best, h) => (skillBonus(h, skill) > skillBonus(best, skill) ? h : best));
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
  }

  /** Start (or restart) the conversation at a knot, e.g. "brannoc". */
  start(knot: string): this {
    this.lines = [];
    this.lastCheck = null;
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
          bonus: skillBonus(who, skill),
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
      const r = abilityCheck(hero, ability, view.check.dc, this.rng, {
        label: view.check.skillName,
        bonuses: bonus ? [{ label: 'skill', value: bonus }] : [],
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
