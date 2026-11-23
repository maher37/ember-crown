// D32: camp companions who talk, at camp only. Who joins, which scene each brings up, and the two
// small personal quests (Ulric's gap in the stone, Kell's drowned sergeant).
import { beforeEach, describe, expect, it } from 'vitest';
import { FIRE_SCENES, campCompanions, fireSceneFor } from '../../src/game/companions';
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
const hi = () => new ScriptedRng(Array(40).fill(20));
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const fire = (g: GameState, knot: string) => new Conversation('fire', g, hi()).start(knot);
/** Play a scene, taking the first choice whenever there is one. */
const play = (g: GameState, knot: string) => {
  let c = fire(g, knot);
  for (let i = 0; i < 5 && c.choices.length; i++) c = c.choose(c.choices[0]!.index);
  return c;
};
const ids = (g: GameState) => campCompanions(g).map((c) => c.id);

describe('who sits at the fire', () => {
  it('companions join from the story, and never in fights (D32)', () => {
    expect(ids(game())).toEqual([]);
    expect(ids(game({ wix_companion: true, tamsin_home: true }))).toEqual(['wix', 'tamsin']);
    expect(ids(game({ ulric_spared: true, act1_complete: true }))).toEqual(['ulric']);
    // Kell joins in Act III, and only if he respects you or owes you.
    expect(ids(game({ kell_respect: true }, 2))).toEqual([]);
    expect(ids(game({ kell_respect: true }, 3))).toEqual(['kell']);
    expect(ids(game({ kell_hostile: true }, 3))).toEqual([]);
    expect(ids(game({ wix_companion: true, ending: 'redeemed' }))).toEqual([]);
  });

  it('each scene plays once, in order, when it is ready', () => {
    let g = game({ wix_companion: true });
    expect(fireSceneFor(g, 'wix')?.id).toBe('wix_1');
    g = play(g, 'wix_1').game;
    expect(g.flags['fire:wix_1']).toBe(true);
    expect(fireSceneFor(g, 'wix')).toBeNull(); // wix_2 waits for Act III
    expect(fireSceneFor({ ...g, act: 3 }, 'wix')?.id).toBe('wix_2');
  });

  it('every scene runs to the end and only marks itself played', () => {
    const all = game({
      wix_companion: true,
      edric_errand_done: true,
      tamsin_home: true,
      ida_ally: true,
    });
    for (const s of FIRE_SCENES) {
      const c = play(all, s.id);
      expect(c.choices, s.id).toEqual([]);
      if (s.id !== 'ulric_1' && s.id !== 'kell_1')
        expect(c.game.flags[`fire:${s.id}`], s.id).toBe(true);
    }
  });

  it('scenes react to what the party did', () => {
    const told = fire(game({ miners_told: true }), 'tamsin_1');
    expect(told.lines.map((l) => l.text).join(' ')).toMatch(/You told the miners' families/);
    const freed = fire(game({ deserters_freed: true }, 3), 'kell_1');
    expect(freed.lines.map((l) => l.text).join(' ')).toMatch(/Holm's lot made it home/);
  });
});

describe("Ulric's personal quest: the gap in the stone", () => {
  const base = { ulric_spared: true, act1_complete: true };

  it('ask at the fire, carve the name in the Old Mine, tell him: quest done with XP', () => {
    let g = pick(fire(game(base), 'ulric_1'), /Do you want us to carve it/).game;
    expect(g.quests['ulric-name']!.status).toBe('active');
    const mine = new Conversation('mine', g, hi()).start('arrive.memorial');
    g = pick(mine, /Carve Hadric Varrow's name with Ulric's chisel/).game;
    expect(g.flags['hadric_named']).toBe(true);
    expect(fireSceneFor(g, 'ulric')?.id).toBe('ulric_2');
    const xp = g.party[0]!.xp;
    g = pick(fire(g, 'ulric_2'), /Thirty-one names/).game;
    expect(g.quests['ulric-name']!.status).toBe('done');
    expect(g.party[0]!.xp).toBe(xp + 100);
  });

  it('"Not now" lets him ask again later', () => {
    const g = pick(fire(game(base), 'ulric_1'), /Not now/).game;
    expect(fireSceneFor(g, 'ulric')?.id).toBe('ulric_1');
    expect(g.quests['ulric-name']).toBeUndefined();
  });

  it('if Harl already carved it, Ulric just says thank you (the quest completes)', () => {
    const g = fire(game({ ...base, harl_named_hadric: true }), 'ulric_1').game;
    expect(g.quests['ulric-name']!.status).toBe('done');
  });
});

describe("Kell's personal quest: the drowned sergeant", () => {
  const base = { kell_respect: true };

  it('ask at the fire, open the sergeant find, bring the tag: quest done', () => {
    let g = pick(fire(game(base, 3), 'kell_1'), /We'll look for him/).game;
    expect(fireSceneFor(g, 'kell')).toBeNull();
    g = { ...g, finds: { 'reeds-sergeant': 'done' } };
    expect(fireSceneFor(g, 'kell')?.id).toBe('kell_2');
    g = pick(fire(g, 'kell_2'), /Here's his tag/).game;
    expect(g.quests['kell-sergeant']!.status).toBe('done');
  });

  it('already found him: tell Kell straight away', () => {
    const g0 = { ...game(base, 3), finds: { 'reeds-sergeant': 'done' as const } };
    const g = pick(fire(g0, 'kell_1'), /We found him/).game;
    expect(g.quests['kell-sergeant']!.status).toBe('done');
  });
});

describe('the camp screen action', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({
      game: game({ wix_companion: true }),
      screen: 'camp',
      rngState: 3,
      conversation: null,
    });
  });
  it('talking at the fire opens the scene and comes back to camp', () => {
    useGame.getState().talkAtFire('wix');
    expect(useGame.getState().screen).toBe('dialogue');
    let c = useGame.getState().conversation!;
    while (c.choices.length) {
      useGame.getState().choose(c.choices[0]!.index);
      c = useGame.getState().conversation!;
    }
    useGame.getState().leaveDialogue();
    expect(useGame.getState().screen).toBe('camp');
    expect(useGame.getState().game!.flags['fire:wix_1']).toBe(true);
  });
});
