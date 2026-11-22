// D33: Harl Deepdelve's own story (Story_Bible §9b): [Harl] choices and personal scenes.
import { describe, expect, it } from 'vitest';
import { Conversation, tagLabel } from '../../src/game/dialogue';
import { epilogueSlides } from '../../src/game/epilogue';
import { buildHero, corinDraft, originDraft } from '../../src/game/hero';
import { conditionHolds } from '../../src/game/letters';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const harl = () =>
  buildHero({ ...originDraft('harl'), classSkills: ['history', 'medicine'] }, 'harl');
const corin = () => buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin');

function game(
  flags: GameState['flags'] = {},
  opts: { harl?: boolean; corin?: boolean; act?: GameState['act'] } = {},
): GameState {
  const { harl: withHarl = true, corin: withCorin = false, act = 1 } = opts;
  const party = [
    withHarl ? harl() : hero('cleric', 'Thorn'),
    withCorin ? corin() : hero('fighter', 'Mira'),
    hero('rogue', 'Ilse'),
    hero('wizard', 'Wren'),
  ];
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party,
    act,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags,
    quests: {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
    },
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
  };
}
const hi = () => new ScriptedRng(Array(40).fill(20));
const lo = () => new ScriptedRng(Array(40).fill(1));
const find = (c: Conversation, re: RegExp) => c.choices.find((x) => re.test(x.text));
const pick = (c: Conversation, re: RegExp) => {
  const ch = find(c, re);
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const said = (c: Conversation) => c.lines.map((l) => l.text).join(' ');
const afterFight = (c: Conversation, how: 'won' | 'parley' = 'won') => {
  const f = c.fight!;
  expect(f).toBeTruthy();
  const g = { ...c.game, flags: { ...c.game.flags, [`${how}:${f.encounterId}`]: true } };
  return new Conversation(c.storyId, g, hi()).start(f.resume);
};

describe('[Harl] tags', () => {
  it('any origin hero works as a dialogue tag and an epilogue condition', () => {
    expect(tagLabel('harl')).toBe('Harl');
    expect(tagLabel('corin')).toBe('Corin');
    expect(conditionHolds(game(), 'harl')).toBe(true);
    expect(conditionHolds(game({}, { harl: false }), 'harl')).toBe(false);
  });
});

describe("Harl's opening and Brannoc", () => {
  it('the mine road, the warm rock, then Lantern Night', () => {
    const c = new Conversation('tavern', { ...game(), quests: {} }, hi()).start('intro');
    expect(said(c)).toMatch(/Harl Deepdelve comes down the mine road/);
    pick(c, /Say the names/);
    expect(said(c)).toMatch(/Father Harl/);
    expect(said(c)).toMatch(/Every lantern on the Grayflow flared red/);
    expect(c.game.flags['harl_road']).toBe(true);
  });

  it('with Corin too, both openings play: the barge first, then the mine road', () => {
    const c = new Conversation('tavern', { ...game({}, { corin: true }), quests: {} }, hi()).start(
      'intro',
    );
    expect(said(c)).toMatch(/evening barge/);
    pick(c, /Pull the hood up/);
    expect(said(c)).toMatch(/Harl Deepdelve comes down the mine road/);
    pick(c, /Go on down/);
    expect(said(c)).toMatch(/Every lantern on the Grayflow flared red/);
  });

  it("[Harl]: Brannoc trusts Moradin's priest with the letter", () => {
    const c = new Conversation('tavern', { ...game(), quests: {} }, hi()).start('brannoc');
    const ch = find(c, /Thirty years/)!;
    expect(ch.as).toEqual({ label: 'Harl', heroName: 'Harl' });
    expect(find(c, /Give us the letter/)).toBeUndefined();
    pick(c, /Thirty years/);
    expect(c.game.flags['has_letter']).toBe(true);
    expect(c.game.flags['brannoc_knows_harl']).toBe(true);
  });

  it('without Harl there are no [Harl] choices', () => {
    const c = new Conversation('tavern', { ...game({}, { harl: false }), quests: {} }, hi()).start(
      'brannoc',
    );
    expect(find(c, /Thirty years/)).toBeUndefined();
    expect(find(c, /Give us the letter/)).toBeDefined();
  });

  it('Gran Esk remembers him', () => {
    const c = new Conversation('town', game(), hi()).start('gran');
    expect(said(c)).toMatch(/Father Harl/);
    expect(c.game.flags['gran_harl']).toBe(true);
  });
});

describe('[Harl] at the Old Mine', () => {
  it('he talks the diggers down himself (he rolls)', () => {
    const c = new Conversation('mine', game(), hi()).start('arrive');
    expect(find(c, /None of this is worth dying for/)).toBeUndefined();
    pick(c, /I blessed your fathers' shifts/);
    expect(c.lastCheck?.heroName).toBe('Harl');
    expect(c.game.flags['mouth_cleared']).toBe(true);
  });

  it('he carves Hadric Varrow into the memorial gap', () => {
    const c = new Conversation('mine', game({ mouth_cleared: true }), hi()).start(
      'arrive.memorial',
    );
    expect(said(c)).toMatch(/He cut these names himself/);
    pick(c, /Carve the missing name/);
    expect(c.game.flags['harl_named_hadric']).toBe(true);
  });

  it('Ulric knows him (talking down gets easier), and Harl reconsecrates the shrine', () => {
    const flags = {
      mouth_cleared: true,
      'won:f6-deep-seam': true,
      found_halls: true,
    };
    let c = new Conversation('mine', game(flags), hi()).start('arrive');
    expect(said(c)).toMatch(/This was Moradin's shrine/);
    pick(c, /This is not Moradin's work/);
    expect(c.game.flags['knows_ulric']).toBe(true);
    pick(c, /Step down/);
    c = afterFight(c, 'parley');
    expect(c.game.flags['has_shard']).toBe(true);
    pick(c, /Reconsecrate the shrine/);
    expect(c.game.flags['harl_shrine']).toBe(true);
    expect(c.ended).toBe(true);
  });
});

describe('[Harl] in Acts II and III', () => {
  it('he stands on the Hall steps with Tarrow: the Collapse Truth, and his own confession', () => {
    const c = new Conversation('ashford', game({}, { act: 2 }), hi()).start('hall.fate');
    pick(c, /I kept quiet too/);
    expect(c.game.flags['tarrow_confessed']).toBe(true);
    expect(c.game.flags['harl_confessed']).toBe(true);
    expect(c.game.flags['truth_collapse']).toBe(true);
    expect(c.game.flags['tarrow_fate_decided']).toBe(true);
  });

  it('a failed try fails forward: Tarrow refuses, and the other choices stay', () => {
    const c = new Conversation('ashford', game({}, { act: 2 }), lo()).start('hall.fate');
    pick(c, /I kept quiet too/);
    expect(c.game.flags['tarrow_confessed']).toBeFalsy();
    expect(find(c, /Get out of Ashford/)).toBeDefined();
  });

  it('Maelis at the camp: she counted the names', () => {
    let c = new Conversation('camp', game({}, { act: 2 }), hi()).start('parley');
    pick(c, /I knew your father/);
    expect(said(c)).toMatch(/I counted/);
    expect(said(c)).toMatch(/Say it anyway/);
    c = new Conversation('camp', game({ harl_named_hadric: true }, { act: 2 }), hi()).start(
      'parley',
    );
    pick(c, /I knew your father/);
    expect(said(c)).toMatch(/the chisel/);
    expect(c.game.flags['maelis_harl']).toBe(true);
  });

  it('the Kiln: he reads the blank panel, and the carved name reaches Maelis', () => {
    let c = new Conversation('kiln', game({ seal_broken: true }, { act: 3 }), hi()).start(
      'arrive.mural',
    );
    pick(c, /masons' marks/);
    expect(said(c)).toMatch(/The cage/);
    c = new Conversation('kiln', game({ harl_named_hadric: true }, { act: 3 }), hi()).start(
      'arrive.heart',
    );
    pick(c, /Your father's name is on the mine wall/);
    expect(said(c)).toMatch(/I stood in front of it for an hour/);
  });

  it('his epilogue depends on the shrine', () => {
    const kept = epilogueSlides(game({ ending: 'lamp-lit', harl_shrine: true }));
    expect(kept.find((s) => s.title === 'Harl')?.text[0]).toMatch(/keeps Moradin's shrine/);
    const gone = epilogueSlides(game({ ending: 'lamp-lit' }));
    expect(gone.find((s) => s.title === 'Harl')?.text[0]).toMatch(/went back to the dwarf halls/);
    const none = epilogueSlides(game({ ending: 'lamp-lit' }, { harl: false }));
    expect(none.some((s) => s.title === 'Harl')).toBe(false);
  });
});
