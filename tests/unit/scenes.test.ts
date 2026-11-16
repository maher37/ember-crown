// Milestone M7: the Act I story scenes (Ink) walked through end to end, as the engine plays them.
import { describe, expect, it } from 'vitest';
import { Conversation, PLACE_SCENES, STORIES } from '../../src/game/dialogue';
import { buildHero, corinDraft } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

function game(withCorin = false, flags: GameState['flags'] = {}): GameState {
  const party = [
    withCorin
      ? buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin')
      : hero('fighter', 'Mira'),
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
  };
}
const hi = () => new ScriptedRng(Array(40).fill(20));
const lo = () => new ScriptedRng(Array(40).fill(1));
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const said = (c: Conversation) => c.lines.map((l) => l.text).join(' ');
/** Pretend the fight the scene started was won, and pick the story up where it said. */
const afterFight = (c: Conversation, how: 'won' | 'lost' | 'parley' = 'won', rng = hi()) => {
  const f = c.fight!;
  expect(f).toBeTruthy();
  const g = { ...c.game, flags: { ...c.game.flags, [`${how}:${f.encounterId}`]: true } };
  return new Conversation(c.storyId, g, rng).start(f.resume);
};

describe('every place on the Act I map has a scene', () => {
  it('names real stories and knots', () => {
    for (const [, sc] of Object.entries(PLACE_SCENES)) {
      expect(STORIES[sc.story]).toBeDefined();
      expect(() => new Conversation(sc.story, game(), hi()).start(sc.knot)).not.toThrow();
    }
  });
});

describe('the goblin warren', () => {
  it('gate fight → trade with Grisk → the miners (with their secret) → the luck-stone and Wix', () => {
    let c = new Conversation('warren', game(false, { pies_settled: true }), hi()).start('arrive');
    pick(c, /Charge the gate/);
    expect(c.fight?.encounterId).toBe('f3-warren-gate');
    c = afterFight(c);
    expect(c.game.quests['old-mine']!.steps).toContain('warren-gate');
    pick(c, /Trade our rations/);
    expect(c.game.party[0]!.xp).toBe(62); // D16: talking past F4 gives its XP
    expect(said(c)).toMatch(/hollow eight-pointed star/);
    pick(c, /Your secret's safe/);
    expect(c.game.flags['miners_rescued']).toBe(true);
    expect(c.game.party[0]!.xp).toBe(262);
    pick(c, /Find the shrine/);
    pick(c, /Steal it/);
    expect(c.game.inventory['luck-stone']).toBe(1);
    expect(c.game.flags['wix_companion']).toBe(true);
    expect(c.game.quests['wix']!.status).toBe('done');
  });

  it('sneaking past the gate gives the F3 XP too, and a failed sneak starts the fight', () => {
    const ok = pick(new Conversation('warren', game(), hi()).start('arrive'), /Sneak past/);
    expect(ok.game.party[0]!.xp).toBe(50);
    expect(ok.fight).toBeNull();
    const bad = pick(new Conversation('warren', game(), lo()).start('arrive'), /Sneak past/);
    expect(bad.fight?.encounterId).toBe('f3-warren-gate');
  });
});

describe('the Old Mine to the end of Act I', () => {
  it('mouth (talked down) → seam → halls → Ulric (talked down) → Deepdelver, the shard, and Maelis', () => {
    let c = new Conversation('mine', game(false, { knows_ulric: true }), hi()).start('arrive');
    pick(c, /None of this is worth dying for/);
    expect(c.game.flags['mouth_cleared']).toBe(true);
    pick(c, /Press on into the seam/);
    expect(c.fight?.encounterId).toBe('f6-deep-seam');
    c = afterFight(c);
    pick(c, /Read the runes/);
    expect(c.game.quests['old-mine']!.steps).toEqual(
      expect.arrayContaining(['mine-mouth', 'deep-seam', 'halls']),
    );
    pick(c, /Brannoc sent us/);
    pick(c, /Step down into the shrine/);
    expect(c.fight?.encounterId).toBe('f7-sunken-shrine');
    c = afterFight(c, 'parley');
    expect(c.game.flags['ulric_spared']).toBe(true);
    expect(c.game.inventory['deepdelver']).toBe(1);
    expect(said(c)).toMatch(/Maelis Varrow/);
    const xp = c.game.party[0]!.xp;
    pick(c, /No\. The shard stays/);
    expect(c.game.act).toBe(2);
    expect(c.game.flags['act1_complete']).toBe(true);
    expect(c.game.quests['old-mine']!.status).toBe('done');
    expect(c.game.party[0]!.xp).toBe(xp + 300);
    expect(said(c)).toMatch(/Marsh of Chelimber/);
  });

  it('killing Ulric is remembered; giving Maelis the shard is too', () => {
    const g = game(false, { mouth_cleared: true, 'won:f6-deep-seam': true, found_halls: true });
    let c = new Conversation('mine', g, hi()).start('arrive');
    pick(c, /Step down/);
    c = afterFight(c, 'won');
    expect(c.game.flags['ulric_dead']).toBe(true);
    pick(c, /Take it\. It's yours/);
    expect(c.game.flags['gave_shard']).toBe(true);
    expect(c.game.flags['has_shard']).toBe(false);
  });

  it('[Corin]: meeting Maelis is a reunion', () => {
    const g = game(true, {
      mouth_cleared: true,
      'won:f6-deep-seam': true,
      found_halls: true,
      'won:f7-sunken-shrine': true,
    });
    const c = new Conversation('mine', g, hi()).start('arrive');
    expect(said(c)).toMatch(/"Corin\." For a moment she's just his sister/);
    expect(c.choices.some((x) => x.as?.label === 'Corin')).toBe(true);
  });
});

describe("Varrow's Mill", () => {
  it('after the shadows, Lysa gives her locket and the Family Truth', () => {
    let c = new Conversation('mill', game(), hi()).start('arrive');
    pick(c, /Light a lantern/);
    expect(c.fight?.encounterId).toBe('s3-mill-shadows');
    c = afterFight(c);
    pick(c, /Who are you/);
    expect(c.game.flags['truth_family']).toBe(true);
    expect(c.game.inventory['lysas-locket']).toBe(1);
    pick(c, /We'll tell her/);
    expect(c.game.quests['mill']!.status).toBe('done');
  });
  it('[Corin]: it is his mother', () => {
    const g = { ...game(true), flags: { 'won:s3-mill-shadows': true } };
    const c = new Conversation('mill', g, hi()).start('arrive');
    expect(said(c)).toMatch(/My little ember/);
    pick(c, /Mother\. I'm sorry/);
    expect(c.game.flags['corin_lysa']).toBe(true);
  });
});

describe('the Ashwood', () => {
  it('track → wolves → the camp; letting Tamsin choose makes her an informant, and Wynn gives potions', () => {
    let c = new Conversation('ashwood', game(), hi()).start('arrive');
    pick(c, /Look for Old Wynn's granddaughter/);
    pick(c, /Stand your ground/);
    c = afterFight(c);
    pick(c, /Ask: why the Star/);
    pick(c, /It's your choice/);
    expect(c.game.flags['tamsin_informant']).toBe(true);
    expect(c.game.inventory['potion-of-healing']).toBe(3);
    expect(c.game.quests['herbalist']!.status).toBe('done');
  });
});

describe('the Steaming Cave (elite)', () => {
  it("Scald's hoard: a Cloak of Protection and two fire-resistance potions", () => {
    let c = new Conversation('cave', game(), hi()).start('arrive');
    pick(c, /Read the signs/);
    expect(c.game.party[0]!.xp).toBe(10);
    pick(c, /Go in/);
    c = afterFight(c);
    expect(c.game.inventory['cloak-of-protection']).toBe(1);
    expect(c.game.inventory['potion-of-fire-resistance']).toBe(2);
  });
});

describe('the tavern in M7', () => {
  it("cellar rats → the tunnel trap (Dex save) → the miner's journal and the Collapse Truth", () => {
    let c = new Conversation('tavern', game(), hi()).start('cellar');
    pick(c, /Open the trapdoor/);
    expect(c.fight?.encounterId).toBe('s1-cellar-rats');
    c = afterFight(c, 'won', lo());
    const hp = c.game.party[0]!.hp;
    pick(c, /Follow the tunnel/);
    expect(c.lastCheck?.success).toBe(false);
    expect(c.game.party[0]!.hp).toBeLessThan(hp);
    expect(c.game.party[0]!.hp).toBeGreaterThanOrEqual(1);
    expect(c.game.flags['truth_collapse']).toBe(true);
    expect(c.game.quests['cellar']!.status).toBe('done');
  });

  it("Corin's origin opening: the barge, then Lantern Night", () => {
    const g = { ...game(true), quests: {} };
    const c = new Conversation('tavern', g, hi()).start('intro');
    expect(said(c)).toMatch(/evening barge/);
    pick(c, /Pull the hood up/);
    expect(said(c)).toMatch(/Every lantern on the Grayflow flared red/);
  });

  it('Wix on the road: spare him, then settle the pies with Brannoc', () => {
    let c = new Conversation('road', game(), hi()).start('wix');
    pick(c, /Why are goblins raiding/);
    expect(said(c)).toMatch(/The mountain is breathing/);
    pick(c, /Spare him/);
    expect(c.game.quests['wix']!.steps).toContain('spare');
    c = new Conversation('tavern', c.game, hi()).start('brannoc');
    expect(said(c)).toMatch(/A goblin's been in my kitchen/);
    pick(c, /put the pies on our account/i);
    expect(c.game.flags['pies_settled']).toBe(true);
  });

  it('after Lantern Night Brannoc gives four healing potions once (one each), and names Ulric', () => {
    let c = new Conversation('tavern', game(), hi()).start('brannoc');
    pick(c, /supplies for the road/);
    expect(c.game.inventory['potion-of-healing']).toBe(4);
    pick(c, /old mine/);
    expect(c.game.flags['knows_ulric']).toBe(true);
    c = new Conversation('tavern', c.game, hi()).start('brannoc');
    expect(c.choices.some((x) => /supplies/.test(x.text))).toBe(false);
  });

  it('never offers more than 5 choices in any scene (Story_Bible §10)', () => {
    const done = { edric_tended: true, has_letter: true, strangers_gone: true };
    const states = [
      game(false, done),
      game(true, done),
      game(false, { ...done, pies_settled: true, knows_ulric: true }),
      game(false, { ...done, wix_spared: true }),
    ];
    for (const [story, knots] of Object.entries({
      tavern: ['brannoc', 'strangers', 'cellar', 'wynn'],
      warren: ['arrive'],
      mine: ['arrive'],
      mill: ['arrive'],
      ashwood: ['arrive'],
      cave: ['arrive'],
    }))
      for (const knot of knots)
        for (const g of states) {
          const c = new Conversation(story, g, hi()).start(knot);
          expect(c.choices.length, `${story}.${knot}`).toBeLessThanOrEqual(5);
        }
  });
});
