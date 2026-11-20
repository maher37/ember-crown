// Equipment: the catalog and shop, wearing gear, proficiency, heavy armor, spell preparation,
// gear in fights, and story choices that need gear.
import { describe, expect, it } from 'vitest';
import { gear, startingSupplies } from '../../src/data';
import { act } from '../../src/game/combat';
import { Conversation } from '../../src/game/dialogue';
import {
  buy,
  equipGear,
  equipProblem,
  formatCoins,
  lookupItem,
  sell,
  sellPrice,
  SHOP_STOCK,
  startingPack,
  unequipGear,
} from '../../src/game/gear';
import { heroSpeed } from '../../src/game/levelup';
import type { GameState } from '../../src/game/save';
import { prepareProblem, prepareSpells, spellChange } from '../../src/game/spellPrep';
import { spellRules } from '../../src/game/levelup';
import { getSpecies } from '../../src/game/hero';
import { ScriptedRng } from '../../src/rules';
import { arrange, fight, L, party, texts } from './combat/arrange';
import { hero } from './combat/helpers';

const game = (patch: Partial<GameState> = {}): GameState => ({
  id: 'g',
  createdAt: 'x',
  seed: 1,
  rngState: 1,
  party: [
    hero('fighter', 'Mira'),
    hero('cleric', 'Thorn'),
    hero('rogue', 'Ilse'),
    hero('wizard', 'Wren'),
  ],
  act: 1,
  location: 'drowned-lantern',
  playSeconds: 0,
  flags: {},
  quests: {},
  notes: [],
  ink: {},
  clock: 7972,
  lastLongRest: null,
  letters: [],
  inventory: {},
  gold: 100,
  ...patch,
});

describe('the catalog and the shop (PHB prices; sell at half, PHB: Selling Treasure)', () => {
  it('knows armor, weapons, gear and magic items by id', () => {
    expect(lookupItem('chain-mail')!.type).toBe('armor');
    expect(lookupItem('shield')!.type).toBe('shield');
    expect(lookupItem('longsword')!.type).toBe('weapon');
    expect(lookupItem('rope')!.type).toBe('gear');
    expect(lookupItem('deepdelver')!.type).toBe('magic');
    expect(lookupItem('nope')).toBeNull();
  });
  it('shows prices as coins', () => {
    expect(formatCoins(0.1)).toBe('1 sp');
    expect(formatCoins(2.5)).toBe('2 gp 5 sp');
    expect(formatCoins(0.01)).toBe('1 cp');
  });
  it('buying costs gold; you need enough', () => {
    const r = buy(game(), 'chain-mail');
    expect(r.game.gold).toBe(25);
    expect(r.game.inventory['chain-mail']).toBe(1);
    expect(buy(game({ gold: 10 }), 'chain-mail').error).toMatch(/Not enough gold/);
    expect(buy(game(), 'deepdelver').error).toMatch(/Not for sale/);
  });
  it('selling pays half; story items are not for sale', () => {
    expect(sellPrice('chain-mail')).toBe(37.5);
    expect(sellPrice('potion-of-healing')).toBe(25);
    expect(sellPrice('lysas-locket')).toBeNull();
    const r = sell(game({ inventory: { rope: 1 } }), 'rope');
    expect(r.game.gold).toBe(100.5);
    expect(r.game.inventory['rope']).toBe(0);
  });
  it('the shop stocks every piece of gear, armor and weapon', () => {
    for (const g of gear) expect(SHOP_STOCK).toContain(g.id);
    expect(SHOP_STOCK).toContain('plate');
    expect(SHOP_STOCK).toContain('longbow');
  });
  it('a new party starts with rope, torches, a healer’s kit, thieves’ tools for a rogue, and 15 gp each', () => {
    const p = startingPack(game().party);
    expect(p.items).toMatchObject({ ...startingSupplies.items, 'thieves-tools': 1 });
    expect(p.gold).toBe(60);
    expect(startingPack([hero('wizard', 'W')]).items['thieves-tools']).toBeUndefined();
  });
});

describe('wearing and wielding (PHB class proficiencies)', () => {
  it('armor swaps with what was worn; AC follows', () => {
    const g = game({ inventory: { plate: 1 } });
    const before = g.party[0]!;
    const r = equipGear(g, before.id, 'plate');
    expect(r.error).toBeUndefined();
    const after = r.game.party[0]!;
    expect(after.equipment.armor).toBe('plate');
    expect(after.ac).toBe(
      18 + (before.equipment.shield ? 2 : 0) + (before.fightingStyle === 'defense' ? 1 : 0),
    );
    expect(r.game.inventory[before.equipment.armor!]).toBe(1);
    expect(r.game.inventory['plate']).toBe(0);
  });
  it('only armor and weapons the class is trained in', () => {
    const g = game();
    const wizard = g.party[3]!;
    expect(equipProblem(wizard, 'chain-mail')).toMatch(/isn't trained in heavy armor/);
    expect(equipProblem(wizard, 'longsword')).toMatch(/isn't trained with the longsword/);
    expect(equipProblem(wizard, 'dagger')).toBeNull();
    // Rogues: rapiers by name (PHB: "hand crossbows, longswords, rapiers, shortswords").
    expect(equipProblem(g.party[2]!, 'rapier')).toBeNull();
  });
  it('taking things off puts them back in the pack', () => {
    const g = game();
    const id = g.party[0]!.id;
    const off = unequipGear(g, id, { shield: true });
    expect(off.party[0]!.equipment.shield).toBe(false);
    expect(off.inventory['shield']).toBe(1);
    expect(off.party[0]!.ac).toBe(g.party[0]!.ac - 2);
    const w = g.party[0]!.equipment.weapons[0]!;
    const noWeapon = unequipGear(g, id, { weapon: w });
    expect(noWeapon.inventory[w]).toBe(1);
  });
  it('PHB: heavy armor too heavy for your Strength costs 10 ft of speed (not for dwarves)', () => {
    const h = hero('fighter', 'Mira');
    const weak = {
      ...h,
      abilities: { ...h.abilities, str: 10 },
      equipment: { ...h.equipment, armor: 'plate' },
    };
    expect(heroSpeed(weak)).toBe(getSpecies(h.speciesId).speed - 10);
    const strong = { ...weak, abilities: { ...weak.abilities, str: 15 } };
    expect(heroSpeed(strong)).toBe(getSpecies(h.speciesId).speed);
    const dwarf = { ...weak, speciesId: 'hill-dwarf' };
    expect(heroSpeed(dwarf)).toBe(getSpecies('hill-dwarf').speed);
  });
});

describe('preparing spells (PHB: Preparing and Casting Spells)', () => {
  it('clerics, druids and paladins prepare after a long rest; others change at level-up', () => {
    expect(spellChange(hero('cleric', 'T'))).toBe('after-long-rest');
    expect(spellChange(hero('paladin', 'P'))).toBe('after-long-rest');
    expect(spellChange(hero('bard', 'B'))).toBe('at-level-up');
    expect(spellChange(hero('wizard', 'W'))).toBe('spellbook');
    expect(spellChange(hero('fighter', 'F'))).toBeNull();
  });
  it('only after a long rest, up to ability modifier + level, from the class list', () => {
    const c = hero('cleric', 'Thorn');
    const pool = spellRules(c, c.level)!.spellPool.map((s) => s.id);
    const max = spellRules(c, c.level)!.spells;
    const pick = pool.slice(0, max);
    expect(prepareProblem({ ...c, canPrepare: false }, pick)).toMatch(/after a long rest/);
    expect(prepareProblem({ ...c, canPrepare: true }, pick)).toBeNull();
    expect(prepareProblem({ ...c, canPrepare: true }, pool.slice(0, max + 1))).toMatch(
      /can prepare/,
    );
    expect(prepareProblem({ ...c, canPrepare: true }, ['fireball'])).toMatch(/can't prepare/);
    const next = prepareSpells(c, pick);
    const cantrips = c.spells.filter((id) => !pool.includes(id));
    expect(next.spells).toEqual([...cantrips, ...pick]);
    expect(prepareProblem({ ...hero('bard', 'B'), canPrepare: true }, [])).toMatch(/level-up/);
  });
});

describe('gear in a fight', () => {
  const withGear = (inv: Record<string, number>) => {
    const s = arrange(
      fight('f7-sunken-shrine', party(L('fighter', 'Mira', 3), 3), 3, { inventory: inv }),
      { mira: { x: 4, y: 4 }, 'skeleton-a': { x: 6, y: 4 } },
      'mira',
    );
    return s;
  };
  it('holy water: a thrown flask (Dex, no proficiency) for 2d6 radiant against undead, used up', () => {
    const s = withGear({ 'holy-water': 1 });
    const r = act(s, { type: 'use-item', itemId: 'holy-water', targetId: 'skeleton-a' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/throws holy water at Skeleton A/);
    expect(texts(r.state)).toMatch(/vs AC/);
    expect(r.state.inventory['holy-water']).toBe(0);
  });
  it('holy water does nothing to the living, so it can’t be wasted on them', () => {
    const s = arrange(
      fight('f2-road-ambush', party(L('fighter', 'Mira', 3), 3), 3, {
        inventory: { 'holy-water': 1 },
      }),
      {},
      'mira',
    );
    const goblin = Object.values(s.combatants).find((c) => c.side === 'enemy')!;
    expect(act(s, { type: 'use-item', itemId: 'holy-water', targetId: goblin.id }).error).toMatch(
      /only harms undead and fiend/,
    );
  });
  it("alchemist's fire sets a target burning: 1d4 fire each turn until a DC 10 Dex save", () => {
    let s = withGear({ 'alchemists-fire': 3 });
    for (let i = 0; i < 3; i++) {
      const r = act(s, { type: 'use-item', itemId: 'alchemists-fire', targetId: 'skeleton-a' });
      if (r.state.combatants['skeleton-a']!.effects.some((e) => e.tag === 'burning')) {
        s = r.state;
        break;
      }
      s = arrange(r.state, {}, 'mira');
    }
    expect(s.combatants['skeleton-a']!.effects.some((e) => e.tag === 'burning')).toBe(true);
  });
  it("PHB: Healer's Kit stabilizes a dying ally next to you, no check", () => {
    const s = arrange(
      fight('f2-road-ambush', party(L('fighter', 'Mira', 3), 3), 3, {
        inventory: { 'healers-kit': 1 },
      }),
      { mira: { x: 4, y: 4 }, thorn: { x: 5, y: 4 } },
      'mira',
    );
    s.combatants['thorn']!.creature = { ...s.combatants['thorn']!.creature, hp: 0, stable: false };
    const r = act(s, { type: 'use-item', itemId: 'healers-kit', targetId: 'thorn' });
    expect(r.error).toBeUndefined();
    expect(r.state.combatants['thorn']!.creature.stable).toBe(true);
    expect(r.state.inventory['healers-kit']).toBe(1); // never runs out (no bookkeeping)
  });
});

describe('story choices that need gear', () => {
  const hi = () => new ScriptedRng(Array(40).fill(20));
  it('torches show the bad beam in the cellar tunnel (no trap)', () => {
    const g = game({ inventory: { torches: 1 }, flags: { 'won:s1-cellar-rats': true } });
    const c = new Conversation('tavern', g, hi()).start('cellar.tunnel');
    const ch = c.choices.find((x) => x.gear === 'Torches')!;
    expect(ch).toBeTruthy();
    c.choose(ch.index);
    expect(c.game.party.every((h, i) => h.hp === g.party[i]!.hp)).toBe(true);
    expect(c.game.flags['truth_collapse']).toBe(true);
    expect(
      new Conversation('tavern', game({ flags: g.flags }), hi())
        .start('cellar.tunnel')
        .choices.some((x) => x.gear),
    ).toBe(false);
  });
  it('rope gets round the ogres at Ashfall Pass', () => {
    const c = new Conversation('pass', game({ inventory: { rope: 1 } }), hi()).start('arrive');
    const ch = c.choices.find((x) => x.gear === 'Rope (50 feet)')!;
    c.choose(ch.index);
    expect(c.game.flags['pass_cleared']).toBe(true);
  });
  it("a crowbar opens the dwarven arch; thieves' tools work the Kiln's dials", () => {
    let c = new Conversation('mine', game({ inventory: { crowbar: 1 } }), hi()).start(
      'arrive.halls',
    );
    c.choose(c.choices.find((x) => x.gear === 'Crowbar')!.index);
    expect(c.game.flags['found_halls']).toBe(true);
    c = new Conversation('kiln', game({ inventory: { 'thieves-tools': 1 } }), hi()).start(
      'arrive.puzzle',
    );
    c.choose(c.choices.find((x) => x.gear === "Thieves' tools")!.index);
    expect(c.game.flags['gate_open']).toBe(true);
  });
});
