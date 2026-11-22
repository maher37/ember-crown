// D35: sneaking in dialogue. Eavesdropping at Kell's bridge and the Kiln's great stair, and
// stealing the warden's key at the abbey. Every check fails forward (Story_Bible §10).
import { beforeEach, describe, expect, it } from 'vitest';
import { awards } from '../../src/data';
import { Conversation } from '../../src/game/dialogue';
import type { GameState } from '../../src/game/save';
import { useGame } from '../../src/game/store';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

function game(flags: GameState['flags'] = {}, act: GameState['act'] = 2): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    act,
    location: 'drowned-lantern',
    party: [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
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
  };
}
const ACT2 = { act1_complete: true, edric_tended: true, has_letter: true, strangers_gone: true };
const hi = () => new ScriptedRng(Array(40).fill(20));
const lo = () => new ScriptedRng(Array(40).fill(1));
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const texts = (c: Conversation) => c.choices.map((x) => x.text);
const xpOf = (id: string) => awards.find((a) => a.id === id)!.xp;

describe("eavesdropping under Kell's bridge (D35)", () => {
  const listen = (rng: ScriptedRng) =>
    pick(new Conversation('bridge', game(ACT2), rng).start('arrive'), /listen under the bridge/);

  it('a quiet listener learns the men are unpaid, and can talk Kell round without a roll', () => {
    let c = listen(hi());
    expect(c.game.flags['kell_overheard']).toBe(true);
    expect(c.game.party[0]!.xp).toBe(xpOf('discover-kells-men'));
    c = pick(pick(c, /Make our case/), /haven't been paid in three months/);
    expect(c.game.flags['kell_respect']).toBe(true);
    expect(c.game.flags['bridge_crossed']).toBe(true);
  });

  it('a slip fails forward: Kell just invites you up, and the usual choices remain', () => {
    const c = listen(lo());
    expect(c.game.flags['kell_overheard']).toBeFalsy();
    expect(c.lines.map((l) => l.text).join(' ')).toMatch(/Toll's gone up/);
    const caseChoices = texts(pick(c, /Make our case/));
    expect(caseChoices.some((t) => /haven't been paid/.test(t))).toBe(false);
    expect(caseChoices.some((t) => /Let us cross/.test(t))).toBe(true);
  });
});

describe("stealing the warden's key at the abbey (D35)", () => {
  const abbey = (rng: ScriptedRng) =>
    pick(
      new Conversation('abbey', game({ ...ACT2, 'won:f13-cloister': true }), rng).start('arrive'),
      /Watch the cult's warden/,
    );

  it('Stealth, then Sleight of Hand: the key opens the side door for an ambush', () => {
    let c = pick(pick(abbey(hi()), /Creep up behind him/), /Ease the bright key/);
    expect(c.game.flags['has_undercroft_key']).toBe(true);
    expect(texts(c).some((t) => /Watch the cult's warden/.test(t))).toBe(false);
    c = pick(c, /Use the warden's key/);
    expect(c.fight?.encounterId).toBe('f14-undercroft');
    expect(c.game.flags['ambush:f14-undercroft']).toBe(true);
  });

  it('a failed sneak fails forward: no key, and the main stairs are still open', () => {
    const c = pick(abbey(lo()), /Creep up behind him/);
    expect(c.game.flags['has_undercroft_key']).toBeFalsy();
    expect(texts(c).some((t) => /Go down to the undercroft/.test(t))).toBe(true);
    expect(texts(c).some((t) => /Watch the cult's warden/.test(t))).toBe(false);
  });
});

describe('the stolen key in the fight: the enemies are surprised (PHB: Surprise)', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({
      game: game({ ...ACT2, 'ambush:f14-undercroft': true }, 2),
      rngState: 5,
      combat: null,
      scouted: null,
      resume: null,
    });
  });
  it('starts the undercroft fight as an ambush', () => {
    useGame.getState().openPrepare('f14-undercroft');
    useGame.getState().startFight({ difficulty: 'medium', mageArmor: [] });
    expect(
      useGame
        .getState()
        .combat!.log.map((l) => l.text)
        .join('\n'),
    ).toMatch(/Ambush!/);
  });
});

describe('listening at the great stair in the Kiln (D35)', () => {
  const stand = (rng: ScriptedRng, flags: GameState['flags'] = {}) =>
    new Conversation('kiln', game({ 'won:f19-ember-galleries': true, ...flags }, 3), rng).start(
      'arrive.stand',
    );

  it('overhearing the zealots finds the old miners’ stair: half the last stand', () => {
    let c = pick(stand(hi()), /listen to the zealots/);
    expect(c.game.flags['stand_backway']).toBe(true);
    expect(JSON.stringify(c.game.notes)).toMatch(/talks to the fire/);
    c = pick(c, /Take the back way/);
    expect(c.fight?.encounterId).toBe('f20-last-stand-half');
  });

  it('spotted: no back way, but the stair can still be charged', () => {
    const c = pick(stand(lo()), /listen to the zealots/);
    expect(texts(c).some((t) => /back way/.test(t))).toBe(false);
    expect(texts(c).some((t) => /Charge the stair/.test(t))).toBe(true);
  });

  it('not offered when Ulric or Wix already showed you the way', () => {
    expect(texts(stand(hi(), { ulric_spared: true })).some((t) => /listen/.test(t))).toBe(false);
  });
});
