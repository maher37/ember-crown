// Equipment slots (playtest feedback): two weapon sets, worn slots, and the rules for hands.
import { describe, expect, it } from 'vitest';
import { act } from '../../src/game/combat';
import { equipToSlot, switchWeapons, unequipSlot } from '../../src/game/gear';
import {
  attunedIn,
  deriveEquipment,
  giveLoadouts,
  loadoutFromLegacy,
  placeItem,
  setLabel,
  slotKindOf,
  weaponFor,
} from '../../src/game/loadout';
import type { GameState } from '../../src/game/save';
import { MIGRATIONS } from '../../src/game/save';
import { arrange, fight, L, party, texts } from './combat/arrange';
import { hero } from './combat/helpers';

const game = (patch: Partial<GameState> = {}): GameState => {
  const r = giveLoadouts(
    [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    {},
  );
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party: r.party,
    act: 2,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags: {},
    quests: {},
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: r.inventory,
    gold: 0,
    ...patch,
  };
};

describe('slots from the starting kits', () => {
  it('fighter: longsword and shield in set 1, handaxes in set 2', () => {
    const lo = loadoutFromLegacy(hero('fighter', 'Mira')).loadout;
    expect([lo.main1, lo.off1]).toEqual(['longsword', 'shield']);
    expect([lo.main2, lo.off2]).toEqual(['handaxe', 'handaxe']);
    expect(lo.armor).toBe('chain-mail');
  });
  it('rogue: rapier and dagger, then the shortbow; the spare dagger goes to the pack', () => {
    const r = loadoutFromLegacy(hero('rogue', 'Ilse'));
    expect([r.loadout.main1, r.loadout.off1]).toEqual(['rapier', 'dagger']);
    expect(r.loadout.main2).toBe('shortbow');
    expect(r.leftovers).toEqual(['dagger']);
  });
  it('magic items find their slots (Deepdelver is a warhammer; the Locket at the neck)', () => {
    const h = hero('fighter', 'Mira');
    const old = {
      ...h,
      equipment: { ...h.equipment, magic: ['deepdelver', 'lysas-locket', 'mayors-boots'] },
    };
    const lo = loadoutFromLegacy(old).loadout;
    expect(lo.main1).toBe('deepdelver');
    expect(lo.neck).toBe('lysas-locket');
    expect(lo.feet).toBe('mayors-boots');
    expect(weaponFor('deepdelver')!.id).toBe('warhammer');
    expect(slotKindOf('cloak-of-protection')).toBe('cloak');
  });
  it('the older fields (for the rules) follow the active set', () => {
    const lo = loadoutFromLegacy(hero('fighter', 'Mira')).loadout;
    const e1 = deriveEquipment(lo);
    expect(e1.weapons).toEqual(['longsword']);
    expect(e1.shield).toBe(true);
    const e2 = deriveEquipment({ ...lo, active: 2 });
    expect(e2.weapons).toEqual(['handaxe', 'handaxe']);
    expect(e2.shield).toBe(false);
  });
});

describe('the rules for hands (PHB: two-handed, light, proficiency)', () => {
  const mira = () => game().party[0]!;
  it('a two-handed weapon empties the off hand, and then a shield is refused', () => {
    const h = mira();
    const lo = h.equipment.loadout!;
    const r = placeItem(h, lo, 'main1', 'greatsword');
    expect(r.error).toBeUndefined();
    expect(r.loadout.off1).toBeNull();
    expect(r.toPack).toEqual(expect.arrayContaining(['shield', 'longsword']));
    expect(placeItem(h, r.loadout, 'off1', 'shield').error).toMatch(/needs both hands/);
  });
  it('only a light weapon fits the off hand', () => {
    const h = mira();
    const lo = { ...h.equipment.loadout!, off1: null };
    expect(placeItem(h, lo, 'off1', 'longsword').error).toMatch(/Only a light weapon/);
    expect(placeItem(h, lo, 'off1', 'shortsword').error).toBeUndefined();
  });
  it('says why someone can’t use a thing', () => {
    const w = game().party[3]!;
    expect(placeItem(w, w.equipment.loadout!, 'main1', 'longsword').error).toMatch(
      /isn't trained with the longsword/,
    );
    expect(placeItem(w, w.equipment.loadout!, 'armor', 'chain-mail').error).toMatch(
      /isn't trained in heavy armor/,
    );
    expect(placeItem(w, w.equipment.loadout!, 'off1', 'shield').error).toMatch(
      /isn't trained with shields/,
    );
  });
  it('DMG: at most three attuned items, across every slot', () => {
    const h = mira();
    const lo = {
      ...h.equipment.loadout!,
      cloak: 'cloak-of-protection',
      ring1: 'honor-guards-ring',
      neck: 'lysas-locket',
    };
    expect(attunedIn(lo)).toBe(3);
    expect(placeItem(h, lo, 'trinket1', 'luck-stone').error).toMatch(/three items/);
  });
});

describe('equipping from the pack', () => {
  it('swaps what was in the slot back into the pack; AC follows', () => {
    const g = game({ inventory: { 'longsword-plus-1': 1 } });
    const before = g.party[0]!;
    const r = equipToSlot(g, before.id, 'longsword-plus-1', 'main1');
    expect(r.error).toBeUndefined();
    expect(r.game.party[0]!.equipment.loadout!.main1).toBe('longsword-plus-1');
    expect(r.game.inventory['longsword']).toBe(1);
    const off = unequipSlot(r.game, before.id, 'off1');
    expect(off.party[0]!.ac).toBe(before.ac - 2);
    expect(off.inventory['shield']).toBe(1);
  });
  it('switching sets out of a fight', () => {
    const g = game();
    const next = switchWeapons(g, g.party[0]!.id);
    expect(next.party[0]!.equipment.loadout!.active).toBe(2);
    expect(setLabel(next.party[0]!.equipment.loadout!, 2)).toBe('Handaxe + Handaxe');
  });
});

describe('switching weapons in a fight', () => {
  it('free, once a turn; the shield comes off with set 1', () => {
    const g = game();
    const h = { ...L('fighter', 'Mira', 3), equipment: g.party[0]!.equipment, ac: g.party[0]!.ac };
    const s = arrange(fight('f2-road-ambush', party(h, 3)), {}, 'mira');
    const ac = s.combatants['mira']!.creature.ac;
    const r = act(s, { type: 'swap-weapons' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/switches to Handaxe \+ Handaxe/);
    expect(r.state.combatants['mira']!.creature.ac).toBe(ac - 2);
    expect(r.state.combatants['mira']!.turn.actionUsed).toBe(false);
    expect(act(r.state, { type: 'swap-weapons' }).error).toMatch(/Already switched/);
  });
});

describe('save version 7 → 8 (slots)', () => {
  it('gives old heroes slots, and spare weapons go to the pack', () => {
    const g = game();
    const old = { ...g, inventory: {}, party: [hero('rogue', 'Ilse')] };
    const out = MIGRATIONS[7]!({ saveVersion: 7, game: old }) as { game: GameState };
    expect(out.game.party[0]!.equipment.loadout!.main1).toBe('rapier');
    expect(out.game.inventory['dagger']).toBe(1);
  });
});
