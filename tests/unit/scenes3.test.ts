// Milestone M9: the Act III scenes (Ink) walked through end to end.
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/game/dialogue';
import { buildHero, corinDraft } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

function game(flags: GameState['flags'] = {}, corin = false): GameState {
  const party = [
    corin
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
    act: 3,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags: {
      act1_complete: true,
      act2_complete: true,
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
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};
const afterFight = (c: Conversation) => {
  const f = c.fight!;
  return new Conversation(
    c.storyId,
    { ...c.game, flags: { ...c.game.flags, [`won:${f.encounterId}`]: true } },
    hi(),
  ).start(f.resume);
};

describe('Ashford in Act III', () => {
  it("ash on Ashford starts the act; the convoy, and Brannoc's choice gives the Drowned Lantern", () => {
    let c = new Conversation('tavern', game(), hi()).start('brannoc');
    expect(c.game.flags['act3_evacuation']).toBe(true);
    expect(c.game.quests['kings-kiln']!.steps).toContain('ash');
    pick(c, /The convoy/);
    expect(c.travel).toBe('scene:ashford.convoy');
    c = pick(new Conversation('ashford', c.game, hi()).start('convoy'), /Guard the carts/);
    c = afterFight(c);
    pick(c, /we'll help you hold it/);
    expect(c.game.flags['brannoc_stays']).toBe(true);
    expect(c.game.inventory['drowned-lantern']).toBe(1);
  });
});

describe('the high Greypeaks', () => {
  it('Ashfall Pass: paying the toll opens the way with the same XP (D16)', () => {
    const c = pick(new Conversation('pass', game(), hi()).start('arrive'), /Pay the toll/);
    expect(c.game.flags['pass_cleared']).toBe(true);
    expect(c.game.party[0]!.xp).toBe(225);
  });
  it('Vorrag: win the contest for Dragon Slayer, or fight him for it', () => {
    let c = pick(new Conversation('forge', game(), hi()).start('arrive'), /contest of strength/);
    expect(c.game.inventory['dragon-slayer']).toBe(1);
    c = pick(new Conversation('forge', game(), lo()).start('arrive'), /contest of strength/);
    expect(c.fight?.encounterId).toBe('e3-vorrag');
    c = afterFight(c);
    expect(c.game.inventory['dragon-slayer']).toBe(1);
  });
  it("Wix's Homecoming: the giant at the door, the clan gift and the back way", () => {
    let c = pick(
      new Conversation('caves', game({ wix_companion: true }), hi()).start('arrive'),
      /Get the giant out/,
    );
    c = afterFight(c);
    expect(c.game.flags['wix_backway']).toBe(true);
    expect(c.game.inventory['wixs-clan-gift']).toBe(1);
  });
});

describe("the King's Kiln", () => {
  it('gate (Kell holds the rear), puzzle, halls, seal; Ida stands aside for the Crown Truth', () => {
    let c = new Conversation(
      'kiln',
      game({ pass_cleared: true, kell_owes: true, truth_crown: true }),
      hi(),
    ).start('arrive');
    // Each area is a stop on the Kiln map; going back in picks up at the next one.
    const again = (x: Conversation) => new Conversation('kiln', x.game, hi()).start('arrive');
    pick(c, /Break through the gate/);
    expect(c.fight?.encounterId).toBe('f16-kiln-gate-kell');
    c = afterFight(c);
    expect(c.ended).toBe(true);
    c = again(c);
    pick(c, /Work out the dials/);
    expect(c.game.flags['gate_open']).toBe(true);
    c = again(c);
    pick(c, /Go on through the halls/);
    c = afterFight(c);
    c = again(c);
    pick(c, /Press the shard/);
    c = again(c);
    pick(c, /Cindrath is inside it/);
    expect(c.game.flags['ida_aside']).toBe(true);
    expect(c.game.party[0]!.xp).toBe(43 + 300 + 600 + 287); // fight XP comes from the fights themselves
  });
  it("Ida's oath: the ossuary gives the Family Truth, her ring, and her sword at the finale", () => {
    let c = new Conversation(
      'kiln',
      game({
        'won:f16-kiln-gate': true,
        gate_open: true,
        'won:f17-furnace-halls': true,
        seal_broken: true,
        ida_aside: true,
      }),
      hi(),
    ).start('arrive');
    pick(c, /ossuary/);
    pick(c, /Go in/);
    c = afterFight(c);
    expect(c.game.flags['truth_family']).toBe(true);
    expect(c.game.flags['ida_ally']).toBe(true);
    expect(c.game.inventory['honor-guards-ring']).toBe(1);
  });
  it('the Cold Forge quenches a weapon', () => {
    let c = new Conversation(
      'kiln',
      game({
        'won:f16-kiln-gate': true,
        gate_open: true,
        'won:f17-furnace-halls': true,
        seal_broken: true,
        ida_aside: true,
      }),
      hi(),
    ).start('arrive');
    pick(c, /Cold Forge/);
    pick(c, /Fight through/);
    c = afterFight(c);
    pick(c, /Light the forge/);
    expect(c.game.inventory['kiln-quenched-weapon']).toBe(1);
  });
  it("the Star's last stand is halved by Ulric's passage, then the Crowning is open", () => {
    const base = {
      'won:f16-kiln-gate': true,
      gate_open: true,
      'won:f17-furnace-halls': true,
      seal_broken: true,
      'won:f18-honor-guard': true,
      'won:f19-ember-galleries': true,
    };
    let c = new Conversation('kiln', game({ ...base }), hi()).start('arrive');
    pick(c, /Climb toward the heart/);
    expect(c.choices.some((x) => /back way/.test(x.text))).toBe(false);
    c = new Conversation('kiln', game({ ...base, ulric_spared: true }), hi()).start('arrive');
    pick(c, /Climb toward the heart/);
    pick(c, /back way/);
    expect(c.fight?.encounterId).toBe('f20-last-stand-half');
    c = afterFight(c);
    expect(c.game.flags['before_crowning']).toBe(true);
    c = new Conversation('kiln', c.game, hi()).start('arrive');
    expect(c.choices.some((x) => /Go down to the Crowning/.test(x.text))).toBe(true);
  });
  it("things to find: the cult cache and the smiths' mural; the galleries have their own stop", () => {
    let c = pick(
      new Conversation('kiln', game({}), hi()).start('arrive.cache'),
      /Search the crates/,
    );
    expect(c.game.inventory['potion-of-healing']).toBe(2);
    expect(c.game.gold).toBe(30);
    c = new Conversation('kiln', game({ truth_crown: true }), hi()).start('arrive.mural');
    expect(said(c)).toMatch(/crown being hammered shut/);
    c = pick(
      new Conversation('kiln', game({}), hi()).start('arrive.galleries'),
      /Cross the Ember Galleries/,
    );
    expect(c.fight?.encounterId).toBe('f19-ember-galleries');
  });
});

describe("Corin's Ember meter (Story_Bible §9)", () => {
  it('accepting a dream bargain raises Ember and grants the boon', () => {
    const c = pick(
      new Conversation('camp', game({ ember: 1 }, true), hi()).start('bargain'),
      /fire burn hotter/,
    );
    expect(c.game.flags['ember']).toBe(2);
    expect(c.game.flags['ember_fire']).toBe(true);
  });
  it('each choice says what it gives, and a gift already taken is not offered again (playtest Nov 22)', () => {
    const fresh = new Conversation('camp', game({ ember: 1 }, true), hi()).start('bargain');
    const texts = fresh.choices.map((x) => x.text).join(' | ');
    expect(texts).toMatch(/fire spells deal \+2 damage/);
    expect(texts).toMatch(/half damage from fire/);
    expect(texts).toMatch(/one used spell slot/);
    const taken = new Conversation('camp', game({ ember: 2, ember_fire: true }, true), hi()).start(
      'bargain',
    );
    expect(taken.choices.map((x) => x.text).join(' | ')).not.toMatch(/burn hotter/);
  });
  it('refusing changes nothing', () => {
    const c = pick(
      new Conversation('camp', game({ ember: 1 }, true), hi()).start('bargain'),
      /Refuse/,
    );
    expect(c.game.flags['ember']).toBe(1);
  });
});

describe('Act III choices stay readable', () => {
  it('never more than 5 choices (Story_Bible §10), and finished places only offer Leave', () => {
    const states = [
      game({ pass_cleared: true }),
      game(
        {
          pass_cleared: true,
          truth_crown: true,
          ida_aside: true,
          'won:f19-ember-galleries': true,
          ulric_spared: true,
          wix_backway: true,
        },
        true,
      ),
    ];
    for (const [story, knots] of Object.entries({
      pass: ['arrive'],
      forge: ['arrive'],
      caves: ['arrive'],
      kiln: ['arrive', 'arrive.hub', 'arrive.heart'],
      camp: ['bargain'],
    }))
      for (const knot of knots)
        for (const g of states) {
          const c = new Conversation(story, g, hi()).start(knot);
          expect(c.choices.length, `${story}.${knot}`).toBeLessThanOrEqual(5);
        }
    const done = game({ pass_cleared: true, vorrag_done: true });
    const g = {
      ...done,
      quests: { ...done.quests, 'wix-home': { status: 'done' as const, steps: [] } },
    };
    for (const story of ['pass', 'forge', 'caves']) {
      const c = new Conversation(story, g, hi()).start('arrive');
      expect(
        c.choices.map((x) => x.text),
        story,
      ).toEqual(['Leave (to the map).']);
    }
  });
});
