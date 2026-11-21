// Milestone M8: the Act II story scenes (Ink) walked through end to end.
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/game/dialogue';
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
    act: 2,
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

const ACT2 = { act1_complete: true, edric_tended: true, has_letter: true, strangers_gone: true };
const g2 = (flags: GameState['flags'] = {}, corin = false) => game(corin, { ...ACT2, ...flags });

describe('the toll bridge (F8)', () => {
  it('talking Kell round crosses the river with the same XP (D16) and earns his respect', () => {
    const c = pick(
      pick(new Conversation('bridge', g2(), hi()).start('arrive'), /Make our case/),
      /Let us cross/,
    );
    expect(c.game.flags['bridge_crossed']).toBe(true);
    expect(c.game.flags['kell_respect']).toBe(true);
    expect(c.game.party[0]!.xp).toBe(100 + 200);
    expect(c.game.quests['hollow-star']!.steps).toContain('bridge');
  });
  it('a failed speech can still walk away, or fight; the fight leaves Kell sour', () => {
    let c = pick(
      pick(new Conversation('bridge', g2(), lo()).start('arrive'), /Make our case/),
      /Let us cross/,
    );
    pick(c, /Fight for the crossing/);
    expect(c.fight?.encounterId).toBe('f8-toll-bridge');
    c = afterFight(c);
    expect(c.game.flags['kell_hostile']).toBe(true);
    expect(c.game.flags['bridge_crossed']).toBe(true);
  });
  it('bribing needs 50 gold', () => {
    expect(
      pick(new Conversation('bridge', g2(), hi()).start('arrive'), /Make our case/).choices.some(
        (x) => /Bribe/.test(x.text),
      ),
    ).toBe(false);
    const rich = { ...g2(), gold: 80 };
    const c = pick(
      pick(new Conversation('bridge', rich, hi()).start('arrive'), /Make our case/),
      /Bribe/,
    );
    expect(c.game.gold).toBe(30);
    expect(c.game.flags['bridge_crossed']).toBe(true);
  });
});

describe('the marsh and Marrowmere', () => {
  it('lizardfolk: plain words and a gift get you through, and point to the abbey and Mother Sallow', () => {
    const c = pick(
      new Conversation('marsh', g2({ bridge_crossed: true }), hi()).start('arrive'),
      /Offer food/,
    );
    expect(c.game.flags['knows_sallow']).toBe(true);
    expect(c.game.quests['hollow-star']!.steps).toContain('marsh');
  });
  it('Marrowmere: the village, the chapel, and the paymaster pointing to Ashford Hall', () => {
    let c = new Conversation('marrowmere', g2({ bridge_crossed: true }), hi()).start('arrive');
    pick(c, /Go in/);
    c = afterFight(c);
    expect(c.game.quests['hollow-star']!.steps).toContain('marrowmere');
    pick(c, /Climb up to the chapel/);
    expect(c.fight?.encounterId).toBe('f11-chapel');
    c = afterFight(c);
    expect(c.game.flags['marrowmere_done']).toBe(true);
    expect(c.game.flags['marrowmere_chapel_done']).toBe(true);
    expect(said(c)).toMatch(/our friend in Ashford Hall/);
  });
});

describe("Ashford Hall (F12) and Tarrow's fate", () => {
  it('with the ledger read aloud, Voss stands down, and Tarrow confesses: the Collapse Truth', () => {
    const c = new Conversation(
      'ashford',
      g2({ marrowmere_done: true, tarrow_exposed: true }),
      hi(),
    ).start('hall');
    pick(c, /Read the ledger aloud/);
    pick(c, /Captain, it's over/);
    expect(c.game.party[0]!.xp).toBe(200 + 400);
    pick(c, /Say it in the square/);
    expect(c.game.flags['tarrow_confessed']).toBe(true);
    expect(c.game.flags['truth_collapse']).toBe(true);
    expect(c.game.flags['hall_resolved']).toBe(true);
    expect(c.game.flags['tarrow_fate_decided']).toBe(true);
  });
  it('without the ledger it comes to a fight, and Tarrow may run or die', () => {
    let c = new Conversation('ashford', g2({ marrowmere_done: true }), hi()).start('hall');
    pick(c, /We'll be going/);
    expect(c.fight?.encounterId).toBe('f12-betrayal');
    c = afterFight(c);
    pick(c, /Get out of Ashford/);
    expect(c.game.flags['tarrow_silent']).toBe(true);
  });
  it('the front door offers the Hall after Marrowmere; Brannoc confesses after Tarrow', () => {
    const c = new Conversation(
      'tavern',
      {
        ...g2({ marrowmere_done: true }),
        quests: { 'lantern-night': { status: 'done', steps: [] } },
      },
      hi(),
    ).start('front_door');
    pick(c, /Go to Ashford Hall/);
    expect(c.travel).toBe('scene:ashford.hall');
    const b = new Conversation('tavern', g2({ tarrow_fate_decided: true }), hi()).start('brannoc');
    expect(said(b)).toMatch(/I signed it too/);
    pick(b, /Why tell us now/);
    expect(b.game.flags['truth_collapse']).toBe(true);
  });
});

describe("Edric's Errand", () => {
  it('shadow → ledger → ambush: the mayor is exposed and Edric brings the boots', () => {
    let c = new Conversation('ashford', g2(), hi()).start('errand');
    pick(c, /Follow the runner/);
    pick(c, /The window/);
    expect(c.game.inventory['mayors-boots']).toBe(1);
    pick(c, /Read the ledger/);
    expect(c.game.flags['tarrow_exposed']).toBe(true);
    pick(c, /Get him out/);
    expect(c.fight?.encounterId).toBe('s8-edric-ambush');
    c = afterFight(c);
    expect(c.game.quests['edric-errand']!.status).toBe('done');
  });
});

describe('the abbey', () => {
  it('cloister → undercroft (Venna) → archives: the Crown Truth, Act II complete, Act III unlocks', () => {
    let c = new Conversation('abbey', g2({ hall_resolved: true }), hi()).start('arrive');
    pick(c, /Break into the cloister/);
    c = afterFight(c);
    pick(c, /Go down to the undercroft/);
    expect(c.fight?.encounterId).toBe('f14-undercroft');
    c = afterFight(c);
    expect(c.game.flags['has_shard2']).toBe(true);
    pick(c, /Read the archives/);
    expect(c.game.flags['truth_crown']).toBe(true);
    expect(c.game.flags['act2_complete']).toBe(true);
    expect(c.game.act).toBe(3);
    expect(c.game.quests['hollow-star']!.status).toBe('done');
  });
  it("the Fallen Paladin's Shield and the Drowned Abbot's relic", () => {
    let c = new Conversation(
      'abbey',
      g2({ hall_resolved: true, 'won:f13-cloister': true }),
      hi(),
    ).start('arrive');
    pick(c, /Search the old chapel/);
    pick(c, /flooded crypt/);
    c = afterFight(c);
    pick(c, /Restore the shield/);
    expect(c.game.inventory['shield-of-the-morninglord']).toBe(1);
    pick(c, /lower crypt/);
    pick(c, /Go down/);
    c = afterFight(c);
    pick(c, /Take the staff/);
    expect(c.game.inventory['staff-of-healing']).toBe(1);
  });
});

describe('side quests', () => {
  it("Mother Sallow's bargain: a price, the Crown Truth and the Bog Pearl", () => {
    const c = new Conversation('sallow', g2({ bridge_crossed: true }), hi()).start('arrive');
    pick(c, /Follow the path/);
    pick(c, /What do you know about the crown/);
    pick(c, /Ten years/);
    expect(c.game.flags['sallow_years']).toBe(true);
    expect(c.game.flags['truth_crown']).toBe(true);
    expect(c.game.inventory['bog-pearl']).toBe(1);
    expect(c.game.quests['sallow']!.status).toBe('done');
  });
  it("Deserters' Bounty: freeing them earns Kell's Shield; turning them in pays 300 gp", () => {
    let c = new Conversation('deserters', g2({ bounty_known: true }), hi()).start('arrive');
    pick(c, /Follow them/);
    pick(c, /We'll tell Kell we found nothing/);
    expect(c.game.inventory['kells-shield']).toBe(1);
    expect(c.game.flags['kell_owes']).toBe(true);
    c = new Conversation(
      'deserters',
      g2({ bounty_known: true, found_deserters: true }),
      hi(),
    ).start('arrive');
    pick(c, /Come quietly/);
    expect(c.game.gold).toBe(300);
  });
  it('Maelis comes to the camp; with the Crown Truth, doubt is planted', () => {
    const c = new Conversation('camp', g2({ truth_crown: true }), hi()).start('parley');
    pick(c, /The crown is Cindrath's prison/);
    expect(c.game.flags['maelis_doubt']).toBe(true);
    expect(c.game.flags['maelis_parley']).toBe(true);
  });
  it('never offers more than 5 choices in any Act II scene (Story_Bible §10)', () => {
    const states = [
      g2(),
      g2({}, true),
      g2({
        bridge_crossed: true,
        marrowmere_done: true,
        hall_resolved: true,
        'won:f13-cloister': true,
        kell_rank: true,
        gold: 99,
      }),
    ];
    for (const [story, knots] of Object.entries({
      bridge: ['arrive'],
      marsh: ['arrive'],
      marrowmere: ['arrive'],
      ashford: ['hall', 'errand'],
      abbey: ['arrive'],
      sallow: ['arrive'],
      deserters: ['arrive'],
      camp: ['parley'],
      tavern: ['brannoc', 'edric', 'front_door'],
    }))
      for (const knot of knots)
        for (const g of states) {
          const c = new Conversation(story, g, hi()).start(knot);
          expect(c.choices.length, `${story}.${knot}`).toBeLessThanOrEqual(5);
        }
  });
  it('a finished place offers only "Leave" (it never replays its story)', () => {
    const done = g2({
      act1_complete: true,
      'won:e1-scald': true,
      bridge_crossed: true,
      lizard_passed: true,
      marrowmere_done: true,
      // Maelis's one visit to the mill (Story_Review #6) has happened.
      maelis_mill_met: true,
    });
    const g = {
      ...done,
      quests: {
        ...done.quests,
        mill: { status: 'done' as const, steps: [] },
        herbalist: { status: 'done' as const, steps: [] },
        sallow: { status: 'done' as const, steps: [] },
        deserters: { status: 'done' as const, steps: [] },
      },
    };
    for (const story of [
      'mine',
      'cave',
      'mill',
      'ashwood',
      'bridge',
      'marsh',
      'marrowmere',
      'sallow',
      'deserters',
    ]) {
      const c = new Conversation(story, g, hi()).start('arrive');
      expect(
        c.choices.map((x) => x.text),
        story,
      ).toEqual([story === 'mine' ? 'Back.' : 'Leave (to the map).']);
    }
  });
});
