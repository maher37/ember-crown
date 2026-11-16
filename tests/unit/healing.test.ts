// Healing between fights (playtest feedback): healing spells and Lay on Hands.
import { describe, expect, it } from 'vitest';
import { castHealing, healingSpells, layOnHands } from '../../src/game/healing';
import { readyParty } from '../../src/game/combat';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const game = (
  party = readyParty(
    [
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('paladin', 'Pell'),
      hero('wizard', 'Wren'),
    ],
    3,
  ),
): GameState => ({
  id: 'g',
  createdAt: 'x',
  seed: 1,
  rngState: 1,
  party,
  act: 1,
  location: 'drowned-lantern',
  playSeconds: 0,
  flags: {},
  quests: {},
  notes: [],
  ink: {},
  clock: 0,
  lastLongRest: null,
  letters: [],
  inventory: {},
  gold: 0,
});

describe('healing outside a fight', () => {
  it('Cure Wounds: 1d8 + Wis, + Disciple of Life (2 + slot level) for a Life cleric; spends the slot (PHB)', () => {
    const g = game();
    g.party[1] = { ...g.party[1]!, hp: 1 };
    const thorn = g.party[0]!;
    const known = { ...thorn, spells: [...thorn.spells, 'cure-wounds'] };
    g.party[0] = known;
    expect(healingSpells(known).some((x) => x.spell.id === 'cure-wounds')).toBe(true);
    const r = castHealing(g, known.id, 'cure-wounds', 1, g.party[1]!.id, new ScriptedRng([4]));
    if ('error' in r) throw new Error(r.error);
    const wis = Math.floor((known.abilities.wis - 10) / 2);
    expect(r.game.party[1]!.hp).toBe(Math.min(r.game.party[1]!.maxHp, 1 + 4 + wis + 3));
    expect(r.game.party[0]!.slotsUsed[0]).toBe((known.slotsUsed[0] ?? 0) + 1);
  });
  it('a hero down at 0 HP wakes up when healed', () => {
    const g = game();
    g.party[1] = { ...g.party[1]!, hp: 0, stable: true, conditions: [{ id: 'unconscious' }] };
    g.party[0] = { ...g.party[0]!, spells: [...g.party[0]!.spells, 'cure-wounds'] };
    const r = castHealing(
      g,
      g.party[0]!.id,
      'cure-wounds',
      1,
      g.party[1]!.id,
      new ScriptedRng([4]),
    );
    if ('error' in r) throw new Error(r.error);
    expect(r.game.party[1]!.hp).toBeGreaterThan(0);
    expect(r.game.party[1]!.conditions).toEqual([]);
  });
  it('no slot, no spell', () => {
    const g = game();
    g.party[0] = {
      ...g.party[0]!,
      spells: [...g.party[0]!.spells, 'cure-wounds'],
      slotsUsed: [9, 9],
    };
    const r = castHealing(
      g,
      g.party[0]!.id,
      'cure-wounds',
      1,
      g.party[1]!.id,
      new ScriptedRng([4]),
    );
    expect('error' in r && r.error).toMatch(/No spell slot/);
  });
  it('Lay on Hands spends just what the target needs from the pool (PHB)', () => {
    const g = game();
    g.party[1] = { ...g.party[1]!, hp: g.party[1]!.maxHp - 5 };
    const r = layOnHands(g, g.party[2]!.id, g.party[1]!.id);
    if ('error' in r) throw new Error(r.error);
    expect(r.game.party[1]!.hp).toBe(r.game.party[1]!.maxHp);
    expect(r.game.party[2]!.resourcesUsed['lay-on-hands']).toBe(5);
  });
});
