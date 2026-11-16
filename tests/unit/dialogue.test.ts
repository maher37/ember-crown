import { describe, expect, it } from 'vitest';
import src from '../../src/content/dialogue/tavern.ink?raw';
import { awards, quests } from '../../src/data';
import { bestFor, Conversation } from '../../src/game/dialogue';
import { buildHero, corinDraft, newDraft, skillBonus, type HeroDraft } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng, SeededRng } from '../../src/rules';

const hero = (cls: string, name: string, patch: Partial<HeroDraft> = {}) =>
  buildHero(
    {
      ...newDraft(cls),
      name,
      classSkills: (
        {
          fighter: ['athletics', 'intimidation'],
          cleric: ['medicine', 'insight'],
          rogue: ['acrobatics', 'perception', 'investigation', 'deception'],
          wizard: ['arcana', 'history'],
          sorcerer: ['arcana', 'insight'],
        } as unknown as Record<string, never[]>
      )[cls]!,
      fightingStyle: cls === 'fighter' ? 'defense' : null,
      expertise: cls === 'rogue' ? ['perception', 'stealth'] : [],
      backgroundId: cls === 'rogue' ? 'urchin' : 'folk-hero',
      ...patch,
    },
    name.toLowerCase(),
  );

function game(withCorin = false, soldier = false): GameState {
  const party = [
    withCorin
      ? buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin')
      : hero(
          'fighter',
          'Mira',
          soldier ? { backgroundId: 'soldier', classSkills: ['perception', 'survival'] } : {},
        ),
    hero('cleric', 'Thorn'),
    hero('rogue', 'Ilse'),
    hero('wizard', 'Wren'),
  ];
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party,
    act: 1,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags: {},
    quests: { 'lantern-night': { status: 'active', steps: [] } },
    notes: [],
    ink: {},
  };
}

const choose = (c: Conversation, pattern: RegExp) => {
  const ch = c.choices.find((x) => pattern.test(x.text));
  if (!ch)
    throw new Error(`No choice matching ${pattern}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const roll = (n: number) => new ScriptedRng(Array(20).fill(n));

describe('the tavern dialogue (Ink)', () => {
  it("Brannoc's first scene matches the mockup's five choices", () => {
    const c = new Conversation('tavern', game(), roll(10)).start('brannoc');
    expect(c.speaker).toBe('brannoc');
    expect(c.lines[0]!.text).toMatch(/^"He came in off the river road/);
    expect(c.choices.map((x) => x.text)).toEqual([
      'Who was the courier, and who wants that letter?',
      'Let me see to his wounds.',
      "You knew him. What aren't you telling us?",
      "Give us the letter. We'll handle this.",
      'Back to the tavern.',
    ]);
    expect(c.game.quests['lantern-night']!.steps).toContain('talk-brannoc');
  });

  it('shows who rolls a check: the party member with the best bonus (D11)', () => {
    const g = game();
    const c = new Conversation('tavern', g, roll(10)).start('brannoc');
    const medicine = c.choices.find((x) => x.check?.skill === 'medicine')!;
    const best = bestFor(g, 'medicine');
    expect(medicine.check).toMatchObject({
      skillName: 'Medicine',
      dc: 10,
      heroName: best.name,
      bonus: skillBonus(best, 'medicine'),
    });
    expect(best.name).toBe('Thorn');
  });

  it('rolls the check with seeded dice, logs it and branches', () => {
    const c = new Conversation('tavern', game(), roll(15)).start('brannoc');
    choose(c, /see to his wounds/);
    expect(c.lastCheck!.text).toMatch(
      /^Medicine check \(Thorn\): d20 \(15\) \+ \d+ = \d+ vs DC 10 → SUCCESS$/,
    );
    expect(c.lines.map((l) => l.text).join(' ')).toContain('The old mine');
    expect(c.game.flags['edric_clue']).toBe(true);
    expect(c.game.notes.map((n) => n.text)).toContain(
      'Edric gasped that someone is digging for something in the old mine.',
    );
  });

  it('fails forward: a failed Medicine check still saves Edric (no clue yet)', () => {
    const c = new Conversation('tavern', game(), roll(1)).start('brannoc');
    choose(c, /see to his wounds/);
    expect(c.lastCheck!.success).toBe(false);
    expect(c.game.flags['edric_tended']).toBe(true);
    expect(c.game.flags['edric_clue']).toBeUndefined();
    expect(c.game.quests['lantern-night']!.steps).toContain('tend-edric');
    // Visiting Edric later gives the clue anyway.
    const later = new Conversation('tavern', c.game, roll(1)).start('edric');
    expect(later.game.flags['edric_clue']).toBe(true);
  });

  it('completing Lantern Night awards 275 XP each and starts the next quest', () => {
    let c = new Conversation('tavern', game(), roll(20)).start('brannoc');
    choose(c, /see to his wounds/);
    choose(c, /What aren't you telling us/);
    expect(c.game.quests['lantern-night']!.status).toBe('done');
    expect(c.game.party.every((h) => h.xp === 275)).toBe(true);
    expect(c.messages).toContain('+275 XP each: Lantern Night');
    expect(c.game.quests['old-mine']!.status).toBe('active');
    c = new Conversation('tavern', c.game, roll(20)).start('strangers');
    choose(c, /Leave this house/);
    expect(c.game.party.every((h) => h.xp === 300)).toBe(true);
    expect(c.game.flags['strangers_gone']).toBe(true);
  });

  it('awards the F1 XP only once', () => {
    let c = new Conversation('tavern', game(), roll(20)).start('strangers');
    choose(c, /Leave this house/);
    c = new Conversation('tavern', c.game, roll(20)).start('strangers');
    expect(c.game.party[0]!.xp).toBe(25);
    expect(c.ended).toBe(true);
  });

  it('a failed persuasion with the strangers leads to the (placeholder) brawl, still forward', () => {
    const c = new Conversation('tavern', game(), roll(1)).start('strangers');
    choose(c, /Drink up and go/);
    expect(c.lines.map((l) => l.text).join(' ')).toContain('arrives in Milestone M7');
    expect(c.game.flags['strangers_gone']).toBe(true);
  });

  it('[Corin] options appear only when Corin is in the party', () => {
    expect(
      new Conversation('tavern', game(), roll(10)).start('brannoc').choices.some((x) => x.as),
    ).toBe(false);
    const c = new Conversation('tavern', game(true), roll(10)).start('brannoc');
    const corin = c.choices.find((x) => x.as?.label === 'Corin')!;
    expect(corin.text).toBe('You know me, Brannoc.');
    c.choose(corin.index);
    expect(c.lines[0]!.text).toContain("You've your mother's eyes, Varrow boy.");
    expect(c.game.flags['has_letter']).toBe(true);
  });

  it('[Soldier] background option with the Grey Company', () => {
    const c = new Conversation('tavern', game(false, true), roll(1)).start('strangers');
    const opt = c.choices.find((x) => x.as?.label === 'Soldier')!;
    expect(opt.as!.heroName).toBe('Mira');
    c.choose(opt.index);
    expect(c.game.flags['strangers_gone']).toBe(true);
  });

  it('[Cleric] can heal Edric without a roll', () => {
    const c = new Conversation('tavern', game(), roll(1)).start('edric');
    choose(c, /prayer to the Morninglord/);
    expect(c.lastCheck).toBeNull();
    expect(c.lines[0]!.text).toMatch(/^Thorn lays a hand on the wound/);
    expect(c.game.flags['edric_clue']).toBe(true);
  });

  it('keeps the front door shut until Lantern Night is done, then offers the road', () => {
    const shut = new Conversation('tavern', game(), roll(10)).start('front_door');
    expect(shut.ended).toBe(true);
    const done = { ...game(), quests: { 'lantern-night': { status: 'done' as const, steps: [] } } };
    const open = new Conversation('tavern', done, roll(10)).start('front_door');
    choose(open, /Set out along the road/);
    expect(open.travel).toBe('f2-road-ambush');
  });

  it('remembers visits across conversations through the saved Ink state', () => {
    const c = new Conversation('tavern', game(), roll(10)).start('brannoc');
    choose(c, /Back to the tavern/);
    const again = new Conversation('tavern', c.game, roll(10)).start('brannoc');
    expect(again.lines[0]!.text).toMatch(/Still here\? Good/);
  });

  it('never offers more than 5 choices, and always a way out', () => {
    for (const knot of ['brannoc', 'edric', 'strangers', 'hooded', 'cellar']) {
      for (const g of [game(), game(true), game(false, true)]) {
        const c = new Conversation('tavern', g, new SeededRng(1)).start(knot);
        if (c.ended) continue;
        expect(c.choices.length, knot).toBeLessThanOrEqual(5);
      }
    }
  });

  it('only uses quest steps and awards that exist in the data', () => {
    for (const [, q, s] of src.matchAll(/quest_step\("([^"]+)", "([^"]+)"\)/g)) {
      const quest = quests.find((x) => x.id === q);
      expect(quest, q).toBeDefined();
      expect(
        quest!.steps.map((x) => x.id),
        `${q}/${s}`,
      ).toContain(s);
    }
    for (const [, a] of src.matchAll(/award\("([^"]+)"\)/g))
      expect(awards.map((x) => x.id)).toContain(a);
  });
});

describe('Jack of All Trades (PHB)', () => {
  it('adds half proficiency to unskilled checks for a level-2 bard', () => {
    const bard = { ...hero('wizard', 'B'), classId: 'bard', level: 2, skills: [], expertise: [] };
    expect(skillBonus(bard, 'athletics') - Math.floor((bard.abilities.str - 10) / 2)).toBe(1);
  });
});
