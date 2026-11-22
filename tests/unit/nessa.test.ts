// D33 / Story_Bible §9b: Nessa Thorne's own story. [Nessa] options and her contract with the Auditor.
import { describe, expect, it } from 'vitest';
import { Conversation, matches, tagLabel } from '../../src/game/dialogue';
import { epilogueSlides } from '../../src/game/epilogue';
import { buildHero, originDraft } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const nessa = () =>
  buildHero({ ...originDraft('nessa'), classSkills: ['arcana', 'deception'] }, 'nessa');

function game(flags: GameState['flags'] = {}, withNessa = true, act: 1 | 2 | 3 = 2): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party: [
      withNessa ? nessa() : hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    act,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags: {
      act1_complete: true,
      edric_tended: true,
      has_letter: true,
      strangers_gone: true,
      ...flags,
    },
    quests: { 'lantern-night': { status: 'done', steps: [] } },
    notes: [],
    ink: {},
    clock: 9000,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
  };
}
const hi = () => new ScriptedRng(Array(40).fill(20));
const lo = () => new ScriptedRng(Array(40).fill(1));
const said = (c: Conversation) => c.lines.map((l) => l.text).join(' ');
const find = (c: Conversation, re: RegExp) => c.choices.find((x) => re.test(x.text));
const pick = (c: Conversation, re: RegExp) => {
  const ch = find(c, re);
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};

describe('origin heroes in dialogue (D33)', () => {
  it('has("nessa") matches only Nessa, and her options are labelled [Nessa]', () => {
    const n = nessa();
    expect(matches(n, 'nessa')).toBe(true);
    expect(matches(n, 'corin')).toBe(false);
    expect(matches(hero('fighter', 'Mira'), 'nessa')).toBe(false);
    expect(tagLabel('nessa')).toBe('Nessa');
    expect(tagLabel('corin')).toBe('Corin');
  });
});

describe("Nessa Thorne's story", () => {
  it('the hooded woman in the tavern knows a contract when she sees one', () => {
    expect(
      find(new Conversation('tavern', game({}, false), hi()).start('hooded'), /signed contract/),
    ).toBeUndefined();
    const c = new Conversation('tavern', game(), hi()).start('hooded');
    const opt = find(c, /signed contract/)!;
    expect(opt.as).toEqual({ label: 'Nessa', heroName: 'Nessa' });
    c.choose(opt.index);
    expect(said(c)).toContain('Read every line of it, notary');
    expect(c.game.flags['nessa_met_maelis']).toBe(true);
  });

  it("at the bridge, Nessa certifies Kell's back pay and crosses without a roll", () => {
    let c = new Conversation('bridge', game(), lo()).start('arrive.greet');
    c = pick(c, /Make our case/);
    expect(c.choices.length).toBeLessThanOrEqual(5);
    expect(find(c, /mayor's writ/)).toBeUndefined();
    c = pick(c, /back pay is in my book/);
    expect(c.lastCheck).toBeNull();
    expect(c.game.flags['kell_respect']).toBe(true);
    expect(c.game.flags['nessa_certified_pay']).toBe(true);
  });

  it("in Ashford Hall, Nessa reads Tarrow's books (Investigation) and exposes him", () => {
    const c = pick(new Conversation('ashford', game(), hi()).start('hall'), /books don't balance/);
    expect(c.lastCheck?.heroName).toBe('Nessa');
    expect(c.game.flags['tarrow_exposed']).toBe(true);
    expect(c.fight).toBeNull();
  });

  it('if Nessa misreads the books, Tarrow calls the guard (fails forward)', () => {
    const c = pick(new Conversation('ashford', game(), lo()).start('hall'), /books don't balance/);
    expect(c.fight?.encounterId).toBe('f12-betrayal');
  });

  it("Nessa takes Tarrow's sworn statement: a confession and the Truth, no roll", () => {
    const c = pick(
      new Conversation('ashford', game(), lo()).start('hall.cornered'),
      /Guild notary/,
    );
    expect(c.lastCheck).toBeNull();
    expect(c.game.flags['tarrow_confessed']).toBe(true);
    expect(c.game.flags['nessa_notarized']).toBe(true);
    expect(c.game.flags['truth_collapse']).toBe(true);
  });

  it('Mother Sallow reads the contract as her price and finds clause nine', () => {
    const c = pick(
      pick(
        new Conversation('sallow', game({ found_sallow: true }), hi()).start('arrive'),
        /about the crown/,
      ),
      /paper it's written on/,
    );
    expect(c.game.flags['nessa_clause']).toBe(true);
    expect(c.game.flags['truth_crown']).toBe(true);
    expect(c.game.flags['sallow_memory']).toBeFalsy();
  });

  it('the Auditor calls on Nessa at Ashfall Pass, then Maelis is on the ridge', () => {
    const none = pick(
      new Conversation('pass', game({}, false, 3), hi()).start('arrive'),
      /Pay the toll/,
    );
    expect(none.game.flags['auditor_met']).toBeFalsy();

    let c = pick(new Conversation('pass', game({}, true, 3), hi()).start('arrive'), /Pay the toll/);
    expect(c.speaker).toBe('auditor');
    expect(c.game.flags['auditor_met']).toBe(true);
    c = pick(c, /Read the contract again/);
    expect(c.lastCheck?.heroName).toBe('Nessa');
    expect(c.game.flags['nessa_clause']).toBe(true);
    c = pick(c, /aren't for sale/);
    expect(c.speaker).toBe('maelis');
    c = pick(c, /made a bargain too/);
    expect(c.game.flags['maelis_doubt']).toBe(true);
  });

  it('at the Kiln, with clause nine, Nessa can trade Cindrath for her soul', () => {
    let c = new Conversation('kiln', game({ nessa_clause: true }, true, 3), hi()).start(
      'arrive.lit_end',
    );
    expect(c.speaker).toBe('auditor');
    c = pick(c, /Take the dragon/);
    expect(c.game.flags['nessa_free']).toBe(true);
    expect(c.game.flags['nessa_bound']).toBeFalsy();
    expect(c.game.flags['ending']).toBe('lamp-lit');
    expect(c.travel).toBe('epilogue');
    const titles = epilogueSlides(c.game).map((s) => s.title);
    expect(titles).toContain('Nessa Thorne');
  });

  it('she can refuse the trade; her contract stands', () => {
    let c = new Conversation('kiln', game({ nessa_clause: true }, true, 3), hi()).start(
      'arrive.snuffed_end',
    );
    c = pick(c, /Nothing goes to the Hells/);
    expect(c.game.flags['nessa_refused_trade']).toBe(true);
    expect(c.game.flags['nessa_bound']).toBe(true);
    expect(c.game.flags['ending']).toBe('lamp-snuffed');
  });

  it('without clause nine (or without Nessa) the Kiln ends as before', () => {
    const a = new Conversation('kiln', game({}, true, 3), hi()).start('arrive.lit_end');
    expect(a.travel).toBe('epilogue');
    expect(a.game.flags['nessa_bound']).toBe(true);
    const b = new Conversation('kiln', game({ nessa_clause: true }, false, 3), hi()).start(
      'arrive.lit_end',
    );
    expect(b.travel).toBe('epilogue');
    expect(b.game.flags['nessa_bound']).toBeFalsy();
  });
});
