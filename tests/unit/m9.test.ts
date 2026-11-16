// Milestone M9: level 6 features, the finale's combat rules, the speech, and the epilogue.
import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  attackOptions,
  getEncounter,
  readyParty,
  startCombat,
} from '../../src/game/combat';
import { Conversation } from '../../src/game/dialogue';
import { epilogueSlides } from '../../src/game/epilogue';
import type { Hero } from '../../src/game/hero';
import type { GameState } from '../../src/game/save';
import { ScriptedRng, SeededRng } from '../../src/rules';
import { arrange, easyTarget, fight, L, party, texts, withSeed } from './combat/arrange';
import { hero } from './combat/helpers';
import { buildHero, corinDraft } from '../../src/game/hero';
import { combatSave } from '../../src/game/combat/core';

const P6 = (lead: Hero) => party(lead, 6);

describe('level 6 class features (PHB)', () => {
  it('Aura of Protection: allies within 10 ft add the paladin Cha to saves', () => {
    const near = arrange(
      fight('f17-furnace-halls', P6(L('paladin', 'Pell', 6))),
      { pell: { x: 3, y: 4 }, thorn: { x: 4, y: 4 } },
      'pell',
    );
    const far = arrange(near, { pell: { x: 1, y: 3 }, thorn: { x: 8, y: 4 } }, 'pell');
    const save = (s: typeof near) => {
      const ctx = { s: structuredClone(s), rng: new SeededRng(7) };
      return combatSave(ctx, ctx.s.combatants['thorn']!, 'dex', 30).total;
    };
    const cha = Math.max(1, Math.floor((near.combatants['pell']!.creature.abilities.cha - 10) / 2));
    expect(save(near) - save(far)).toBe(cha);
  });
  it('Potent Cantrip: a cantrip save that succeeds still deals half damage (wizard 6)', () => {
    const w = L('wizard', 'Ivo', 6);
    const s = arrange(
      fight('f17-furnace-halls', P6({ ...w, cantrips: [...w.cantrips, 'acid-splash'] })),
      {},
      'ivo',
    );
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'cast', spellId: 'acid-splash', slotLevel: 0, targetIds: ['armor-a'] },
        ).state,
      (x) => /SUCCESS/.test(texts(x)) && /halved/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/halved/);
  });
  it('Ki-Empowered Strikes: unarmed strikes count as magical (monk 6)', () => {
    const s = fight('f17-furnace-halls', P6(L('monk', 'Kai', 6)));
    expect(attackOptions(s.combatants['kai']!).find((o) => o.unarmed)!.magical).toBe(true);
  });
  it('Wholeness of Body heals 3 × monk level, once per long rest (monk 6)', () => {
    const s = arrange(fight('f17-furnace-halls', P6(L('monk', 'Kai', 6))), {}, 'kai');
    s.combatants['kai']!.creature = { ...s.combatants['kai']!.creature, hp: 1 };
    const out = act(s, { type: 'feature', id: 'wholeness-of-body' }).state;
    expect(out.combatants['kai']!.creature.hp).toBe(19);
  });
  it("Mindless Rage: a raging berserker can't be frightened (barbarian 6)", async () => {
    const { giveCondition } = await import('../../src/game/combat/leaves');
    let s = arrange(fight('f17-furnace-halls', P6(L('barbarian', 'Bryn', 6))), {}, 'bryn');
    s = act(s, { type: 'feature', id: 'rage' }).state;
    const ctx = { s: structuredClone(s), rng: new SeededRng(1) };
    giveCondition(
      ctx,
      ctx.s.combatants['armor-a']!,
      ctx.s.combatants['bryn']!,
      'frightened',
      undefined,
    );
    expect(ctx.s.combatants['bryn']!.creature.conditions.some((c) => c.id === 'frightened')).toBe(
      false,
    );
  });
});

describe('the finale (homebrew, Story_Bible §8)', () => {
  const lvl6 = () =>
    readyParty(
      [
        hero('fighter', 'Mira'),
        hero('cleric', 'Thorn'),
        hero('rogue', 'Ilse'),
        hero('wizard', 'Wren'),
      ],
      6,
    );
  it('crown shards take no turns, and every blow on a shard hurts Cindrath too', () => {
    const s0 = startCombat({
      encounter: getEncounter('f21-crowning-wraith'),
      party: lvl6(),
      difficulty: 'medium',
      rngState: 1,
    });
    expect(s0.order.some((id) => id.startsWith('shard'))).toBe(false);
    expect(s0.combatants['cindrath']!.speed).toBe(0);
    const s = arrange(s0, { mira: { x: 10, y: 2 } }, 'mira');
    easyTarget(s, 'shard-a');
    const hp = s.combatants['cindrath']!.creature.hp;
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'attack', targetId: 'shard-a', optionId: 'longsword' },
        ).state,
      (x) => x.combatants['cindrath']!.creature.hp < hp,
    );
    expect(texts(out)).toMatch(/The shard cracks/);
  });
  it('Cindrath dying wins the fight, even with shards left', () => {
    const s = startCombat({
      encounter: getEncounter('f21-crowning-wraith'),
      party: lvl6(),
      difficulty: 'medium',
      rngState: 1,
    });
    const t = arrange(s, { mira: { x: 11, y: 4 } }, 'mira');
    easyTarget(t, 'cindrath');
    t.combatants['cindrath']!.creature = { ...t.combatants['cindrath']!.creature, hp: 1 };
    const out = withSeed(
      (seed) =>
        act(
          { ...t, rngState: seed },
          { type: 'attack', targetId: 'cindrath', optionId: 'longsword' },
        ).state,
      (x) => x.outcome === 'victory',
    );
    expect(out.outcome).toBe('victory');
  });
  it('Ser Ida fights beside you if her oath was kept; Corin sits out the Ember Heir fight', () => {
    const withIda = startCombat({
      encounter: getEncounter('f21-crowning-wraith'),
      party: lvl6(),
      difficulty: 'medium',
      rngState: 1,
      flags: { ida_ally: true },
    });
    expect(withIda.combatants['ida-ally']!.side).toBe('party');
    const without = startCombat({
      encounter: getEncounter('f21-crowning-wraith'),
      party: lvl6(),
      difficulty: 'medium',
      rngState: 1,
    });
    expect(without.combatants['ida-ally']).toBeUndefined();
    expect(getEncounter('f21-ember-heir').excludeOrigin).toBe('corin');
  });
  it('Maelis (mage) casts Fireball where it catches two heroes, at most once on Medium', () => {
    let s = startCombat({
      encounter: getEncounter('f21-crowning-maelis'),
      party: lvl6(),
      difficulty: 'medium',
      rngState: 2,
    });
    s = arrange(
      s,
      { mira: { x: 7, y: 4 }, thorn: { x: 7, y: 5 }, maelis: { x: 13, y: 4 } },
      'maelis',
    );
    const out = advance(s);
    expect(texts(out)).toMatch(/Maelis Varrow casts Fireball/);
    const again = advance(arrange(out, {}, 'maelis'));
    expect(texts(again)).not.toMatch(/casts Fireball/);
  });
  it('Dragon Slayer adds 3d6 against Cindrath (a dragon)', async () => {
    const { equip } = await import('../../src/game/items');
    const p = lvl6();
    p[0] = equip(p[0]!, 'dragon-slayer').hero;
    const s = arrange(
      startCombat({
        encounter: getEncounter('f21-crowning-wraith'),
        party: p,
        difficulty: 'medium',
        rngState: 1,
      }),
      { mira: { x: 11, y: 4 } },
      'mira',
    );
    easyTarget(s, 'cindrath');
    const out = withSeed(
      (seed) =>
        act(
          { ...s, rngState: seed },
          { type: 'attack', targetId: 'cindrath', optionId: 'dragon-slayer' },
        ).state,
      (x) => /HIT/.test(texts(x)),
    );
    expect(texts(out)).toMatch(/3d6 \(\d, \d, \d\)/);
  });
});

function game(flags: GameState['flags'], corin = false): GameState {
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
    location: 'kings-kiln',
    playSeconds: 0,
    flags: { act1_complete: true, act2_complete: true, before_crowning: true, ...flags },
    quests: {},
    notes: [],
    ink: {},
    clock: 9000,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
  };
}
const pick = (c: Conversation, re: RegExp) => {
  const ch = c.choices.find((x) => re.test(x.text));
  if (!ch) throw new Error(`No choice ${re}: ${c.choices.map((x) => x.text).join(' | ')}`);
  return c.choose(ch.index);
};

describe('the speech (Story_Bible §6: the three Truths)', () => {
  const heart = (
    flags: GameState['flags'],
    rng = new ScriptedRng(Array(40).fill(1)),
    corin = false,
  ) => new Conversation('kiln', game(flags, corin), rng).start('arrive.heart');
  it('all three Truths always reach her', () => {
    const c = pick(
      heart({ truth_collapse: true, truth_crown: true, truth_family: true }),
      /Take it off/,
    );
    expect(c.game.flags['maelis_redeemed']).toBe(true);
  });
  it('two Truths: a Persuasion check with advantage; one Truth is not enough', () => {
    const two = pick(
      heart({ truth_collapse: true, truth_crown: true }, new ScriptedRng(Array(40).fill(20))),
      /Take it off/,
    );
    expect(two.lastCheck!.text).toMatch(/adv/);
    expect(two.game.flags['maelis_redeemed']).toBe(true);
    const one = pick(
      heart({ truth_crown: true }, new ScriptedRng(Array(40).fill(20))),
      /Take it off/,
    );
    expect(one.game.flags['maelis_redeemed']).toBeFalsy();
    expect(one.lastCheck!.text).toMatch(/not enough/);
  });
  it('Brother and Sister: Corin plus one Truth counts as two', () => {
    const c = pick(
      heart({ truth_crown: true, ember: 0 }, new ScriptedRng(Array(40).fill(20)), true),
      /Take it off/,
    );
    expect(c.lastCheck!.text).toMatch(/adv/);
  });
  it('at 3+ Trust the DC drops by 2 (Maelis_Letters.md)', () => {
    const c = pick(
      heart(
        { truth_collapse: true, truth_crown: true, maelis_trust: 3 },
        new ScriptedRng(Array(40).fill(10)),
      ),
      /Take it off/,
    );
    expect(c.lastCheck!.dc).toBe(13);
  });
});

describe('endings and the epilogue', () => {
  const heart = (flags: GameState['flags'], corin = false) =>
    new Conversation('kiln', game(flags, corin), new ScriptedRng(Array(40).fill(20))).start(
      'arrive.heart',
    );
  const all3 = { truth_collapse: true, truth_crown: true, truth_family: true };
  it('The Lamp Lit: talked down, then Cindrath (with Maelis on your side)', () => {
    let c = pick(pick(heart(all3), /Take it off/), /Break it, Maelis/);
    expect(c.fight).toEqual({ encounterId: 'f21-crowning-wraith', resume: 'arrive.lit_end' });
    c = new Conversation(
      'kiln',
      { ...c.game, flags: { ...c.game.flags, 'won:f21-crowning-wraith': true } },
      new SeededRng(1),
    ).start('arrive.lit_end');
    expect(c.game.flags['ending']).toBe('lamp-lit');
    expect(c.travel).toBe('epilogue');
  });
  it('The Last Varrow: Corin breaks it from the inside', () => {
    const c = pick(pick(heart({ ...all3, ember: 2 }, true), /Take it off/), /from the inside/);
    expect(c.game.flags['ending']).toBe('last-varrow');
  });
  it("after defeating Maelis: break it (Lamp Snuffed), wear it (Ember Crown), or give it to Kell (Guild's Prize)", () => {
    const after = (flags: GameState['flags']) =>
      new Conversation(
        'kiln',
        game({ ...flags, 'won:f21-crowning-maelis': true }),
        new SeededRng(1),
      ).start('arrive.after_maelis');
    expect(pick(after({}), /Break the crown/).fight?.encounterId).toBe('f21-crowning-wraith');
    expect(pick(after({}), /Put it on/).game.flags['ending']).toBe('ember-crown');
    expect(after({}).choices.some((x) => /Kell/.test(x.text))).toBe(false);
    expect(pick(after({ kell_at_gate: true }), /Captain Kell/).game.flags['ending']).toBe(
      'guild-prize',
    );
  });
  it('The Ember Queen: wait, and she finishes it', () => {
    expect(pick(pick(heart({}), /Let her finish/), /Fight her/).fight?.encounterId).toBe(
      'f21-ember-queen',
    );
  });
  it('The Ember Heir: Corin at Ember 5, unless two Truths pull him back', () => {
    const lost = new Conversation('kiln', game({ ember: 5 }, true), new SeededRng(1)).start(
      'arrive.heart',
    );
    expect(lost.choices.some((x) => /Remember who you are/.test(x.text))).toBe(false);
    expect(pick(lost, /fight it/).fight?.encounterId).toBe('f21-ember-heir');
    const saved = pick(
      new Conversation(
        'kiln',
        game({ ember: 5, truth_crown: true, truth_family: true }, true),
        new SeededRng(1),
      ).start('arrive.heart'),
      /Remember who you are/,
    );
    expect(saved.game.flags['corin_pulled_back']).toBe(true);
    expect(saved.game.flags['ember']).toBe(4);
  });
  it('epilogue slides follow the flags, and end with the right letter', () => {
    const g = game({
      ending: 'lamp-lit',
      tarrow_confessed: true,
      brannoc_stays: true,
      wix_companion: true,
      ulric_spared: true,
      kell_owes: true,
    });
    const slides = epilogueSlides(g);
    expect(slides[0]!.title).toBe('The Lamp Lit');
    expect(slides.map((x) => x.title)).toEqual(
      expect.arrayContaining([
        'Ashford',
        'The Drowned Lantern',
        'Wix',
        'Brother Ulric',
        'Captain Kell',
        'Mayor Tarrow',
      ]),
    );
    expect(slides.at(-1)!.title).toBe('“Thirty-One”');
    expect(slides.at(-1)!.text[0]).toBe('They floated thirty-one this year.');
    const tyrant = epilogueSlides(game({ ending: 'ember-crown', wix_companion: true }));
    expect(tyrant).toHaveLength(1);
  });
});
