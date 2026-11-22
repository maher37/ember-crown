// D33 / Story_Bible §9b: Vorna Kalvaar's own [Vorna] choices and story beats: Kell and her
// squad's pay, Holm's deserters, the town's fear of red scales, and the voice that calls her
// "daughter". Every check fails forward (Story_Bible §10).
import { describe, expect, it } from 'vitest';
import { Conversation, matches, tagLabel } from '../../src/game/dialogue';
import { epilogueSlides } from '../../src/game/epilogue';
import { vornaDreamDue } from '../../src/game/journal';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const vorna = () => ({ ...hero('fighter', 'Vorna Kalvaar'), origin: 'vorna' as const });

function game(flags: GameState['flags'] = {}, withVorna = true, act: GameState['act'] = 2) {
  const party = [hero('cleric', 'Thorn'), hero('rogue', 'Ilse'), hero('wizard', 'Wren')];
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    act,
    location: 'ashford',
    party: withVorna ? [vorna(), ...party] : [hero('fighter', 'Mira'), ...party],
    playSeconds: 0,
    flags,
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
    quests: {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
    },
  } satisfies GameState;
}
const roll = (n: number) => new ScriptedRng(Array(40).fill(n));
const text = (c: Conversation) => c.lines.map((l) => l.text).join(' ');
const pick = (c: Conversation, re: RegExp) => {
  const i = c.choices.findIndex((x) => re.test(x.text));
  expect(i, `no choice matching ${re}`).toBeGreaterThanOrEqual(0);
  return c.choose(i);
};

describe('Vorna Kalvaar in dialogue (D33)', () => {
  it('"vorna" matches only her, and shows as [Vorna]', () => {
    expect(matches(vorna(), 'vorna')).toBe(true);
    expect(matches(hero('fighter', 'Mira'), 'vorna')).toBe(false);
    expect(tagLabel('vorna')).toBe('Vorna');
    expect(tagLabel('corin')).toBe('Corin');
  });

  it("her choices don't appear without her", () => {
    const c = new Conversation('bridge', game({}, false), roll(10)).start('arrive');
    pick(c, /Walk up to the chain/);
    expect(c.choices.some((x) => x.as?.label === 'Vorna')).toBe(false);
  });

  it('Kell knows her, and a good word wins his promise to pay her squad', () => {
    const c = new Conversation('bridge', game(), roll(20)).start('arrive');
    pick(c, /Walk up to the chain/);
    expect(text(c)).toMatch(/Sergeant Kalvaar/);
    const ask = c.choices.find((x) => /Four families/.test(x.text))!;
    expect(ask.as).toEqual({ label: 'Vorna', heroName: 'Vorna' });
    pick(c, /Four families/);
    const word = c.choices.find((x) => /Give me your word/.test(x.text))!;
    expect(word.check?.heroName).toBe('Vorna'); // she rolls, not the party's best talker
    pick(c, /Give me your word/);
    expect(c.game.flags['vorna_kell_promise']).toBe(true);
    expect(c.game.flags['kell_rank']).toBe(true);
  });

  it('failing the talk with Kell moves the story on (fails forward)', () => {
    const c = new Conversation('bridge', game(), roll(1)).start('arrive');
    pick(c, /Walk up to the chain/);
    pick(c, /Four families/);
    pick(c, /Give me your word/);
    expect(c.game.flags['vorna_kell_promise']).toBeFalsy();
    expect(c.game.flags['vorna_kell_cold']).toBe(true);
    expect(c.choices.some((x) => /Make our case/.test(x.text))).toBe(true);
  });

  it('at the Kiln gate Kell pays her squad, promise or not', () => {
    for (const promised of [true, false]) {
      const c = new Conversation(
        'kiln',
        game({ kell_respect: true, vorna_kell_promise: promised }, true, 3),
        roll(10),
      ).start('arrive');
      expect(text(c)).toMatch(/Tamm, Bel, Orrin, Sef/);
      expect(c.game.flags['vorna_squad_paid']).toBe(true);
    }
  });

  it('Holm the deserter knows her and she can send him home', () => {
    const c = new Conversation('deserters', game({ found_deserters: true }), roll(10));
    c.start('arrive.camp');
    expect(text(c)).toMatch(/Kalvaar\?/);
    pick(c, /ask me for it/);
    expect(c.game.flags['deserters_freed']).toBe(true);
    expect(c.game.flags['vorna_freed_holm']).toBe(true);
    expect(text(c)).toMatch(/haven't forgotten the four/);
  });

  it('Mother Sallow answers her question about her blood, for free', () => {
    const c = new Conversation('sallow', game({ found_sallow: true }), roll(10)).start('arrive');
    pick(c, /calls me daughter/);
    expect(c.game.flags['vorna_truth_blood']).toBe(true);
    expect(c.game.flags['truth_crown']).toBeFalsy(); // the crown Truth still has its price
  });

  it('the dreams come once an act, in order, only with Vorna alive', () => {
    expect(vornaDreamDue(game())).toBeNull();
    expect(vornaDreamDue(game({ act1_complete: true }))).toBe(1);
    expect(vornaDreamDue(game({ act1_complete: true }, false))).toBeNull();
    expect(vornaDreamDue(game({ act1_complete: true, vorna_dream_1: true }))).toBeNull();
    const two = { act1_complete: true, vorna_dream_1: true, act2_complete: true };
    expect(vornaDreamDue(game(two))).toBe(2);
    const three = { ...two, vorna_dream_2: true, pass_cleared: true };
    expect(vornaDreamDue(game(three))).toBe(3);
    expect(vornaDreamDue(game({ ...three, vorna_dream_3: true }))).toBeNull();
    expect(vornaDreamDue(game({ act1_complete: true, ending: 'lamp-lit' }))).toBeNull();
  });

  it("knowing Sallow's answer opens a way to silence the voice", () => {
    const plain = new Conversation('camp', game(), roll(10)).start('vorna_dream_2');
    expect(plain.choices.some((x) => /father's voice/.test(x.text))).toBe(false);
    const c = new Conversation('camp', game({ vorna_truth_blood: true }), roll(10));
    pick(c.start('vorna_dream_2'), /father's voice/);
    expect(c.game.flags['vorna_defied']).toBe(true);
  });

  it('her last dream answer changes what the crown says to her at the Crowning', () => {
    const no = new Conversation('camp', game(), roll(10)).start('vorna_dream_3');
    pick(no, /sword pointed in/);
    expect(no.game.flags['vorna_refused_voice']).toBe(true);
    const yes = new Conversation('camp', game(), roll(10)).start('vorna_dream_3');
    pick(yes, /think on it/);
    expect(yes.game.flags['vorna_heeded_voice']).toBe(true);
  });

  it('the epilogue tells what became of her', () => {
    const paid = epilogueSlides(
      game({ ending: 'lamp-lit', vorna_squad_paid: true, vorna_refused_voice: true }),
    );
    const titles = paid.map((s) => s.title);
    expect(titles).toContain('Vorna Kalvaar');
    expect(paid.find((s) => s.title === 'Vorna Kalvaar')!.text[0]).toMatch(/four doors/);
    expect(paid.find((s) => s.title === 'The Voice')!.text[0]).toMatch(/never heard/);
    const unpaid = epilogueSlides(game({ ending: 'lamp-lit' }));
    expect(unpaid.find((s) => s.title === 'Vorna Kalvaar')!.text[0]).toMatch(/Waterdeep/);
    const without = epilogueSlides(game({ ending: 'lamp-lit' }, false));
    expect(without.some((s) => s.title === 'Vorna Kalvaar')).toBe(false);
  });
});
