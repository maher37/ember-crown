// Story_Bible §10: never more than 5 choices on screen, even with every premade hero and every Truth.
// The camp visit with Corin and the Crowning used to show 6 or more.
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/game/dialogue';
import { buildHero, corinDraft, originDraft } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const corin = () => buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin');
const harl = () =>
  buildHero({ ...originDraft('harl'), classSkills: ['history', 'medicine'] }, 'harl');
const vorna = () =>
  buildHero(
    {
      ...originDraft('vorna'),
      classSkills: ['acrobatics', 'perception'],
      fightingStyle: 'defense',
    },
    'vorna',
  );

function game(party: GameState['party'], flags: GameState['flags'] = {}): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party,
    act: 3,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags,
    quests: {},
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: { 'drowned-lantern': 1, 'lysas-locket': 1 },
    gold: 0,
  };
}
const hi = () => new ScriptedRng(Array(40).fill(20));
const lo = () => new ScriptedRng(Array(40).fill(1));
const texts = (c: Conversation) => c.choices.map((x) => x.text);
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${texts(c).join(' | ')}`);
  return c.choose(ch.index);
};
const truths = { truth_collapse: true, truth_crown: true, truth_family: true };
const everyone = () => [corin(), harl(), vorna(), hero('wizard', 'Wren')];
const plain = () => [
  hero('fighter', 'Mira'),
  hero('cleric', 'Thorn'),
  hero('rogue', 'Ilse'),
  hero('wizard', 'Wren'),
];

describe('the camp visit (Maelis)', () => {
  it('with Corin and both Truths: 5 choices, and the crown Truth stands in for the plain question', () => {
    for (const party of [[corin(), ...plain().slice(1)], everyone()]) {
      const c = new Conversation('camp', game(party, truths), hi()).start('parley');
      expect(c.choices.length).toBeLessThanOrEqual(5);
      expect(texts(c).some((t) => /What happens when you wear/.test(t))).toBe(false);
      expect(texts(c).some((t) => /Cindrath's prison/.test(t))).toBe(true);
    }
  });

  it('without the crown Truth, the plain question is still there', () => {
    const c = new Conversation('camp', game(plain()), hi()).start('parley');
    expect(texts(c).some((t) => /What happens when you wear/.test(t))).toBe(true);
  });
});

describe('the Crowning', () => {
  const heart = (party: GameState['party'], flags: GameState['flags'] = {}, rng = hi()) =>
    new Conversation(
      'kiln',
      game(party, { ...truths, harl_named_hadric: true, ...flags }),
      rng,
    ).start('arrive.heart');

  it('every Truth, the lantern and three premade heroes: 5 choices on every screen', () => {
    const c = heart(everyone());
    expect(c.choices.length).toBeLessThanOrEqual(5);
    pick(c, /Tell her what you've learned/);
    expect(c.choices.length).toBeLessThanOrEqual(5);
    pick(c, /Not yet/);
    pick(c, /Say something of your own/);
    expect(c.choices.length).toBeLessThanOrEqual(5);
    expect(c.choices.map((x) => x.as?.label)).toEqual(['Corin', 'Harl', 'Vorna', undefined]);
  });

  it('each line can still be said once; the menus close when nothing is left to say', () => {
    const c = heart(everyone());
    for (const re of [
      /name is clear|Ashford has said/,
      /Cindrath/,
      /mother never wanted/,
      /lantern/,
    ]) {
      const tell = c.choices.find((x) => /Tell her what you've learned/.test(x.text));
      if (!tell) break;
      c.choose(tell.index);
      const line = c.choices.find((x) => re.test(x.text));
      if (line) c.choose(line.index);
      else pick(c, /Not yet/);
    }
    for (const re of [/boy/, /mine wall/, /daughter/]) {
      pick(c, /Say something of your own/);
      pick(c, re);
    }
    expect(texts(c).some((t) => /Say something of your own/.test(t))).toBe(false);
    expect(texts(c).some((t) => /Tell her what you've learned/.test(t))).toBe(false);
    expect(texts(c)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Take it off/),
        expect.stringMatching(/Let her finish/),
      ]),
    );
  });

  it('with nothing learned and no premade hero, only the three actions show', () => {
    const c = new Conversation('kiln', { ...game(plain()), inventory: {} }, hi()).start(
      'arrive.heart',
    );
    expect(c.choices.length).toBe(3);
  });

  it('talking her down still counts the Truths (Story_Bible §6)', () => {
    const c = pick(heart(plain(), {}, lo()), /Take it off/);
    expect(c.game.flags['maelis_redeemed']).toBe(true);
  });
});
