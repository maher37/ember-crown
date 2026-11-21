// Phases 2–3 (owner request, Nov 21): quest markers, Ashford's shops and notice board, exploring
// (finds, chests, traps, hidden merchants), the ember-kiss and Maelis in person.
import { describe, expect, it } from 'vitest';
import { readyParty } from '../../src/game/combat';
import {
  boardNotices,
  claimBounty,
  huntsAt,
  markHunted,
  takeBounty,
} from '../../src/game/bounties';
import { Conversation } from '../../src/game/dialogue';
import {
  bestPassive,
  findsAt,
  openFind,
  searchArea,
  seenFinds,
  spotFinds,
} from '../../src/game/finds';
import { spellNumbers, type Hero } from '../../src/game/hero';
import { kindledOfferDue } from '../../src/game/journal';
import { emptyLoadout, placeProblem } from '../../src/game/loadout';
import { questTargets } from '../../src/game/questMap';
import { makeSave, parseSave, type GameState } from '../../src/game/save';
import {
  applyService,
  buyAt,
  marketDay,
  purchasesLeft,
  sellAt,
  sellPriceAt,
  shopOpen,
  stockOf,
  getShop,
} from '../../src/game/shops';
import { GAME_START } from '../../src/game/calendar';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const LN_DONE = {
  'lantern-night': {
    status: 'done' as const,
    steps: ['talk-brannoc', 'tend-edric', 'secure-letter'],
  },
};
function game(over: Partial<GameState> = {}): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party: readyParty(
      [
        hero('fighter', 'Mira'),
        hero('cleric', 'Thorn'),
        hero('rogue', 'Ilse'),
        hero('wizard', 'Wren'),
      ],
      2,
    ),
    act: 1,
    location: 'ashford',
    playSeconds: 0,
    flags: {},
    quests: { ...LN_DONE, 'old-mine': { status: 'active', steps: [] } },
    notes: [],
    ink: {},
    clock: GAME_START,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 1000,
    ...over,
  };
}
/** A clock hour on an ordinary (non-market) day. */
const quietDay = () => {
  let c = GAME_START;
  while (marketDay(c)) c += 24;
  return c;
};
const dice = (n: number) => new ScriptedRng(Array(60).fill(n));

describe('quest markers on the world map', () => {
  it('each active quest points at the place of its next step', () => {
    const t = questTargets(game());
    expect(t['old-mine']?.[0]).toMatchObject({ questId: 'old-mine', kind: 'main' });
    expect(t['old-mine']![0]!.step).toMatch(/Ashford road/);
  });
  it('after a step, the marker moves on; places not yet open get none', () => {
    const g = game({ quests: { ...LN_DONE, 'old-mine': { status: 'active', steps: ['road'] } } });
    expect(questTargets(g)['warren']?.[0]?.questId).toBe('old-mine');
    const locked = game({
      act: 2,
      quests: { ...LN_DONE, 'hollow-star': { status: 'active', steps: ['bridge', 'marsh'] } },
    });
    // Marrowmere needs the bridge crossed (places.json requires): no marker until then.
    expect(questTargets(locked)['marrowmere']).toBeUndefined();
  });
});

describe("Ashford's shops", () => {
  it('each keeper sells their own trade: the smith has steel, Brannoc has rope', () => {
    const g = game();
    expect(stockOf(g, 'smithy')).toEqual(
      expect.arrayContaining(['longsword', 'chain-mail', 'shield']),
    );
    expect(stockOf(g, 'smithy')).not.toContain('rope');
    expect(stockOf(g, 'brannoc')).toEqual(expect.arrayContaining(['rope', 'potion-of-healing']));
    expect(stockOf(g, 'brannoc')).not.toContain('longsword');
  });
  it('magic turns up as the story goes (+1 weapons from Act II)', () => {
    expect(stockOf(game(), 'smithy')).not.toContain('longsword-plus-1');
    expect(stockOf(game({ act: 2 }), 'smithy')).toContain('longsword-plus-1');
    expect(stockOf(game(), 'curios')).toContain('wand-of-the-war-mage-1');
    expect(stockOf(game(), 'curios')).not.toContain('ring-of-protection');
  });
  it('buying spends gold; selling pays half (PHB: Selling Treasure), only to a keeper who wants it', () => {
    let g = buyAt(game(), 'smithy', 'longsword').game;
    expect(g.gold).toBe(1000 - 15);
    expect(sellPriceAt('smithy', 'longsword')).toBe(7.5);
    expect(sellPriceAt('curios', 'longsword')).toBeNull();
    expect(sellAt(g, 'curios', 'longsword').error).toMatch(/won't buy/);
    g = sellAt(g, 'smithy', 'longsword').game;
    expect(g.gold).toBe(1000 - 15 + 7.5);
    // Story treasures never sell.
    expect(sellPriceAt('curios', 'lysas-locket')).toBeNull();
  });
  it("Odo's wagon comes on market days, with three things, and sells two a visit", () => {
    expect(shopOpen(game({ clock: quietDay() }), getShop('wagon'))).toBe(false);
    expect(stockOf(game({ clock: quietDay() }), 'wagon')).toEqual([]);
    const g = game(); // the game starts on the Feast of the Moon: a festival, so a market day
    expect(marketDay(g.clock)).not.toBeNull();
    const stock = stockOf(g, 'wagon');
    expect(stock).toHaveLength(3);
    expect(stockOf(g, 'wagon')).toEqual(stock); // the same all visit
    let next = buyAt(g, 'wagon', stock[0]!).game;
    next = buyAt(next, 'wagon', stock[1]!).game;
    expect(purchasesLeft(next, 'wagon')).toBe(0);
    expect(buyAt(next, 'wagon', stock[2]!).error).toMatch(/won't sell you any more this visit/);
  });
  it('a hidden merchant sells one thing, ever', () => {
    const g = buyAt(game(), 'nib', 'boots-of-elvenkind').game;
    expect(buyAt(g, 'nib', 'periapt-of-wound-closure').error).toMatch(/won't sell you any more/);
  });
  it('the Dawn Shrine heals the wounded for 10 gp each, and raises the dead (1,000 gp)', () => {
    const g0 = game();
    const hurt = {
      ...g0,
      party: g0.party.map((h, i) =>
        i === 0 ? { ...h, hp: 1 } : i === 1 ? ({ ...h, hp: 0, dead: true } as Hero) : h,
      ),
    };
    const healed = applyService(hurt, 'heal-party');
    expect(healed.game.party[0]!.hp).toBe(healed.game.party[0]!.maxHp);
    expect(healed.game.gold).toBe(1000 - 10);
    expect(healed.game.party[1]!.dead).toBe(true); // prayers don't raise the dead
    const raised = applyService(hurt, 'raise-dead', hurt.party[1]!.id);
    expect(raised.game.party[1]).toMatchObject({ dead: false, hp: 1 });
    expect(raised.game.gold).toBe(0);
    expect(applyService({ ...hurt, gold: 5 }, 'raise-dead', hurt.party[1]!.id).error).toMatch(
      /1000 gp/,
    );
  });
  it('a Wand of the War Mage +1 adds to spell attacks, and only a spellcaster can attune (DMG)', () => {
    const w = hero('wizard', 'Wren');
    const base = spellNumbers(w)!.attack;
    const armed = { ...w, equipment: { ...w.equipment, magic: ['wand-of-the-war-mage-1'] } };
    expect(spellNumbers(armed)!.attack).toBe(base + 1);
    expect(
      placeProblem(hero('fighter', 'Mira'), emptyLoadout(), 'trinket1', 'wand-of-the-war-mage-1'),
    ).toMatch(/needs a spellcaster/);
    expect(placeProblem(w, emptyLoadout(), 'trinket1', 'wand-of-the-war-mage-1')).toBeNull();
  });
  it('a save with silver in the purse loads (gold can be fractional)', () => {
    const save = makeSave({ ...game(), gold: 59.9 });
    const r = parseSave(JSON.stringify(save));
    expect(r.ok).toBe(true);
  });
});

describe('the notice board at Ashford Hall', () => {
  it("posts this act's bounties after Lantern Night; taking one starts its quest and marks the map", () => {
    const g = game();
    const notices = boardNotices(g).map((n) => n.bounty.quest);
    expect(notices).toEqual(
      expect.arrayContaining(['bounty-stirges', 'bounty-bandits', 'bounty-griffon']),
    );
    expect(notices).not.toContain('bounty-spiders');
    const r = takeBounty(g, 'bounty-stirges');
    expect(r.game.quests['bounty-stirges']?.status).toBe('active');
    expect(questTargets(r.game)['mill']?.[0]?.questId).toBe('bounty-stirges');
    expect(huntsAt(r.game, 'mill').map((b) => b.encounter)).toEqual(['road-stirges']);
  });
  it('a won hunt pays out at the Hall: gold, and the quest XP', () => {
    let g = takeBounty(game(), 'bounty-bandits').game;
    expect(claimBounty(g, 'bounty-bandits').error).toMatch(/Nothing to collect/);
    g = markHunted(g, 'bounty-bandits').game;
    expect(questTargets(g)['ashford']?.some((t) => t.questId === 'bounty-bandits')).toBe(true);
    const xp = g.party[0]!.xp;
    const paid = claimBounty(g, 'bounty-bandits');
    expect(paid.game.gold).toBe(1050);
    expect(paid.game.quests['bounty-bandits']?.status).toBe('done');
    expect(paid.game.party[0]!.xp).toBe(xp + 75);
  });
  it("the Deserters' notice opens the existing side quest (same flag Brannoc sets)", () => {
    const g = game({ act: 2, flags: { act1_complete: true } });
    const r = takeBounty(g, 'deserters');
    expect(r.game.flags['bounty_known']).toBe(true);
    expect(r.game.quests['deserters']?.status).toBe('active');
  });
});

describe('exploring: finds, searching, chests (PHB: passive Perception, searching, traps)', () => {
  it('on arrival, the best passive Perception in the party notices what it beats', () => {
    const g = game({ location: 'ashwood' });
    const best = bestPassive(g)!;
    const r = spotFinds(g, 'ashwood');
    const expected = findsAt(g, 'ashwood').filter((f) => f.dc === null || f.dc <= best.score);
    expect(Object.keys(r.game.finds ?? {}).sort()).toEqual(expected.map((f) => f.id).sort());
    expect(spotFinds(r.game, 'ashwood').messages).toEqual([]); // nothing noticed twice
  });
  it('searching rolls Perception once (logged), takes an hour, and only once a day', () => {
    const g = game({ location: 'ashwood' });
    const r = searchArea(g, 'ashwood', dice(20));
    expect(r.log[0]).toMatch(/^Perception check \(\w+\): d20 \(20\) \+ \d+ = \d+$/);
    expect(seenFinds(r.game, 'ashwood').length).toBe(findsAt(g, 'ashwood').length);
    expect(r.game.clock).toBe(g.clock + 1);
    expect(searchArea(r.game, 'ashwood', dice(20)).log[0]).toMatch(/already searched/);
  });
  it('a buried satchel starts a quest; its clue opens a strongbox at the mill', () => {
    let g = game({ location: 'ashwood' });
    expect(findsAt(g, 'mill').some((f) => f.id === 'mill-millstone')).toBe(false);
    const r = openFind(g, 'ashwood-satchel', 'open', dice(10));
    g = r.game;
    expect(g.gold).toBe(1012);
    expect(g.quests['smugglers-cache']?.steps).toContain('note');
    expect(questTargets(g)['mill']?.some((t) => t.questId === 'smugglers-cache')).toBe(true);
    expect(findsAt(g, 'mill').some((f) => f.id === 'mill-millstone')).toBe(true);
  });
  it("locks: thieves' tools (Sleight of Hand) or force (Athletics); a failed force still opens it, an hour later", () => {
    const g = game({
      location: 'mill',
      flags: { smuggler_note: true, 'find_trap:mill-millstone': true },
    });
    expect(openFind(g, 'mill-millstone', 'pick', dice(20)).log.join(' ')).toMatch(
      /need thieves' tools/,
    );
    const forced = openFind(g, 'mill-millstone', 'force', dice(1));
    expect(forced.log[0]).toMatch(/Athletics check/);
    expect(forced.log.join(' ')).toMatch(/an hour of levering/);
    expect(forced.game.clock).toBe(g.clock + 1);
    expect(forced.opened).toBe(true);
    expect(forced.game.inventory['potion-of-healing']).toBe(2);
    expect(forced.game.quests['smugglers-cache']?.status).toBe('done');
  });
  it('an unseen trap goes off on the opener: a save, damage, never below 1 HP outside a fight', () => {
    const g0 = game({
      location: 'mill',
      flags: { smuggler_note: true },
      inventory: { 'thieves-tools': 1 },
    });
    const g = { ...g0, party: g0.party.map((h, i) => (i === 0 ? { ...h, hp: 2 } : h)) };
    const r = openFind(g, 'mill-millstone', 'pick', dice(1));
    expect(r.log[0]).toMatch(/Investigation check/);
    expect(r.log.join('\n')).toMatch(/A poisoned needle in the lock!/);
    expect(r.game.party[0]!.hp).toBe(1);
  });
  it("a spotted trap is disarmed with thieves' tools", () => {
    const g = game({
      location: 'mill',
      flags: { smuggler_note: true },
      inventory: { 'thieves-tools': 1 },
    });
    const r = openFind(g, 'mill-millstone', 'pick', dice(20));
    expect(r.log.join('\n')).toMatch(/spots a poisoned needle[\s\S]*Disarmed\./);
    expect(r.opened).toBe(true);
  });
  it('a hidden merchant opens their shop', () => {
    const r = openFind(game({ location: 'ashwood' }), 'ashwood-nib', 'open', dice(10));
    expect(r.shop).toBe('nib');
  });
});

describe('the ember-kiss (Story_Review #1)', () => {
  it('Cindrath offers a gift once an act, after the mine, the abbey and the pass', () => {
    expect(kindledOfferDue(game())).toBeNull();
    expect(kindledOfferDue(game({ flags: { act1_complete: true } }))).toBe(1);
    expect(
      kindledOfferDue(game({ flags: { act1_complete: true, kindled_offer_1: true } })),
    ).toBeNull();
    expect(
      kindledOfferDue(
        game({ flags: { act1_complete: true, kindled_offer_1: true, act2_complete: true } }),
      ),
    ).toBe(2);
  });
  it('taking a gift deepens the mark; refusing leaves it', () => {
    const g = game({ flags: { act1_complete: true, ember_marked: true } });
    const c = new Conversation('camp', g, dice(10)).start('kindled_dream');
    const i = c.choices.findIndex((x) => /let fire not burn us/.test(x.text));
    c.choose(i);
    expect(c.game.flags['kindled_resist']).toBe(true);
    expect(c.game.flags['kindled']).toBe(1);
    const refuse = new Conversation('camp', g, dice(10)).start('kindled_dream');
    refuse.choose(refuse.choices.findIndex((x) => /Refuse/.test(x.text)));
    expect(refuse.game.flags['kindled'] ?? 0).toBe(0);
  });
  it('the first step out after Lantern Night marks everyone', () => {
    const c = new Conversation('tavern', game({ location: 'drowned-lantern' }), dice(10)).start(
      'front_door',
    );
    expect(c.game.flags['ember_marked']).toBe(true);
    expect(c.lines.map((l) => l.text).join(' ')).toMatch(/ember-kiss/);
  });
});

describe('the town remembers (Story_Review #3) and Maelis in person (#6)', () => {
  it("the crier's news changes with what you did", () => {
    const say = (flags: GameState['flags']) =>
      new Conversation('town', game({ flags }), dice(10))
        .start('crier')
        .lines.map((l) => l.text)
        .join(' ');
    expect(say({})).toMatch(/lanterns on the river burn red/);
    expect(say({ 'won:f1-tavern-brawl': true })).toMatch(/Brawl at the Drowned Lantern/);
    expect(say({ act1_complete: true, ulric_spared: true })).toMatch(/Brother Ulric alive/);
    expect(say({ tarrow_confessed: true })).toMatch(/Hadric Varrow was innocent/);
  });
  it('Maelis waits at the mill after Act I, and on the ridge above Ashfall Pass', () => {
    const mill = new Conversation(
      'mill',
      game({
        flags: { act1_complete: true, ulric_spared: true },
        quests: { ...LN_DONE, mill: { status: 'done', steps: ['investigate', 'shadows', 'rest'] } },
      }),
      dice(10),
    ).start('arrive');
    expect(mill.game.flags['maelis_mill_met']).toBe(true);
    expect(mill.lines.map((l) => l.text).join(' ')).toMatch(/Ulric writes to me/);
    const pass = new Conversation('pass', game({ act: 3 }), dice(10)).start('arrive');
    pass.choose(pass.choices.findIndex((x) => /Pay the toll/.test(x.text)));
    expect(pass.game.flags['maelis_pass_met']).toBe(true);
    expect(pass.lines.map((l) => l.text).join(' ')).toMatch(/I wanted to see you before the Kiln/);
  });
});

describe('the kindled gifts in a fight (Story_Review #1)', () => {
  it('fire resistance and starting temporary HP for every hero', async () => {
    const { fight, party, L } = await import('./combat/arrange');
    const s = fight('f2-road-ambush', party(L('fighter', 'Mira', 2), 2), 1, {
      flags: { kindled_resist: true, kindled_vigor: true },
    });
    const mira = s.combatants['mira']!;
    expect(mira.effects.some((e) => e.tag === 'resistance' && e.data?.type === 'fire')).toBe(true);
    expect(mira.creature.tempHp).toBe(2);
  });
  it('a weapon hit adds 1d4 fire, once a turn', async () => {
    const { arrange, fight, party, L, texts, easyTarget } = await import('./combat/arrange');
    const { act } = await import('../../src/game/combat');
    let s = arrange(
      fight('f2-road-ambush', party(L('fighter', 'Mira', 5), 5), 1, {
        flags: { kindled_strike: true },
      }),
      { mira: { x: 6, y: 4 }, 'goblin-a': { x: 7, y: 4 } },
      'mira',
    );
    easyTarget(s, 'goblin-a');
    s.combatants['goblin-a']!.creature = {
      ...s.combatants['goblin-a']!.creature,
      hp: 99,
      maxHp: 99,
    };
    s = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).state;
    s = act(s, { type: 'attack', targetId: 'goblin-a', optionId: 'longsword' }).state;
    expect(texts(s).match(/ember-mark flares/g)?.length).toBe(1);
  });
});
