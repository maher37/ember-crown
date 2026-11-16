import { beforeEach, describe, expect, it } from 'vitest';
import { buildHero, newDraft } from '../../src/game/hero';
import {
  describeSave,
  latestSave,
  listSlots,
  makeSave,
  MIGRATIONS,
  parseSave,
  readSlot,
  SAVE_VERSION,
  serializeSave,
  writeSlot,
  type GameState,
} from '../../src/game/save';
import { useGame } from '../../src/game/store';

const hero = (i: number) =>
  buildHero(
    {
      ...newDraft('fighter'),
      name: `Hero ${i}`,
      classSkills: ['athletics', 'perception'],
      fightingStyle: 'defense',
    },
    `h${i}`,
  );
const game = (): GameState => ({
  id: 'game-1',
  createdAt: '2026-11-16T10:00:00.000Z',
  seed: 42,
  rngState: 42,
  party: [hero(1), hero(2), hero(3), hero(4)],
  act: 1,
  location: 'drowned-lantern',
  playSeconds: 754,
  flags: {},
});

describe('save files', () => {
  it('carry a save version and round-trip exactly', () => {
    const save = makeSave(game(), new Date('2026-11-16T12:00:00Z'));
    expect(save.saveVersion).toBe(SAVE_VERSION);
    const back = parseSave(serializeSave(save));
    expect(back).toEqual({ ok: true, save });
  });

  it('store the seed and dice position (CLAUDE.md: reproducible bugs)', () => {
    const r = parseSave(serializeSave(makeSave({ ...game(), seed: 7, rngState: 12345 })));
    expect(r.ok && [r.save.game.seed, r.save.game.rngState]).toEqual([7, 12345]);
  });

  it('reject text that is not JSON', () => {
    expect(parseSave('not json')).toEqual({
      ok: false,
      error: "This file isn't a save file (it isn't valid JSON).",
    });
  });

  it('reject JSON without a save version', () => {
    expect(parseSave('{"hello":1}').ok).toBe(false);
  });

  it('reject saves from a newer game version', () => {
    const r = parseSave(JSON.stringify({ ...makeSave(game()), saveVersion: SAVE_VERSION + 1 }));
    expect(r).toEqual({
      ok: false,
      error: `This save is from a newer version of the game (save version ${SAVE_VERSION + 1}).`,
    });
  });

  it('reject damaged saves with a readable reason', () => {
    const bad = makeSave(game());
    (bad.game.party[0] as { hp: unknown }).hp = 'lots';
    const r = parseSave(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/^This save is damaged \(game\.party\.0\.hp/);
  });

  it('run migrations for older versions', () => {
    // Simulate a future format change: pretend version 0 stored play time in minutes.
    MIGRATIONS[0] = (old) => {
      const g = old.game as GameState & { playMinutes?: number };
      const { playMinutes = 0, ...rest } = g;
      return { ...old, game: { ...rest, playSeconds: playMinutes * 60 } };
    };
    try {
      const { playSeconds: _drop, ...g } = game();
      void _drop;
      const old = {
        saveVersion: 0,
        savedAt: '2026-01-01T00:00:00.000Z',
        game: { ...g, playMinutes: 3 },
      };
      const r = parseSave(JSON.stringify(old));
      expect(r.ok && r.save.game.playSeconds).toBe(180);
    } finally {
      delete MIGRATIONS[0];
    }
  });

  it('describe themselves for the title screen', () => {
    expect(describeSave(makeSave(game()))).toEqual({
      party: 'Hero, Hero, Hero, Hero · Act I',
      detail: 'Party level 1 · 0h 12m',
    });
  });
});

describe('save slots', () => {
  beforeEach(() => localStorage.clear());

  it('start empty', () => {
    expect(listSlots().map((s) => s.save)).toEqual([null, null, null]);
    expect(latestSave()).toBeNull();
  });

  it('write and read back', () => {
    const save = makeSave(game());
    writeSlot('slot1', save);
    expect(readSlot('slot1').save).toEqual(save);
  });

  it('report unreadable slots instead of crashing', () => {
    localStorage.setItem('ember-crown:save:slot2', '{broken');
    expect(readSlot('slot2')).toMatchObject({
      save: null,
      error: expect.stringContaining('valid JSON'),
    });
  });

  it('find the newest save for Continue', () => {
    writeSlot('slot1', makeSave(game(), new Date('2026-11-16T09:00:00Z')));
    writeSlot('autosave', makeSave(game(), new Date('2026-11-16T11:00:00Z')));
    expect(latestSave()!.slot).toBe('autosave');
  });
});

describe('game store', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({ screen: 'title', game: null, pendingParty: [] });
  });

  it('makes a party of four, autosaves, and opens the party screen', () => {
    const g = useGame.getState();
    g.startNewGame(99);
    for (let i = 1; i <= 4; i++) useGame.getState().addHero(hero(i));
    const save = useGame.getState().beginAdventure();
    expect(useGame.getState().screen).toBe('party');
    expect(save.game.party).toHaveLength(4);
    expect(save.game.seed).toBe(99);
    expect(readSlot('autosave').save!.game.id).toBe(save.game.id);
  });

  it('allows only one Corin and at most four heroes', () => {
    useGame.getState().startNewGame(1);
    const corin = { ...hero(1), origin: 'corin' as const };
    useGame.getState().addHero(corin);
    expect(() => useGame.getState().addHero({ ...corin, id: 'c2' })).toThrow(/Corin/);
    for (let i = 2; i <= 4; i++) useGame.getState().addHero(hero(i));
    expect(() => useGame.getState().addHero(hero(5))).toThrow(/full/);
  });

  it('keeps the seeded dice moving forward across rolls', () => {
    useGame.getState().startNewGame(5);
    const a = useGame.getState().withRng((r) => r.die(20));
    const b = useGame.getState().withRng((r) => r.die(20));
    useGame.getState().startNewGame(5);
    expect([
      useGame.getState().withRng((r) => r.die(20)),
      useGame.getState().withRng((r) => r.die(20)),
    ]).toEqual([a, b]);
  });

  it('loads a save back into play', () => {
    useGame.getState().loadGame(makeSave(game()));
    expect(useGame.getState()).toMatchObject({ screen: 'party', rngState: 42 });
  });
});

describe('save version 1 → 2 (M4: spells, slots and resources)', () => {
  it('adds default spells and empty usage to old heroes', () => {
    const g = game();
    const oldParty = g.party.map((h) => {
      const {
        cantrips: _c,
        spells: _s,
        invocations: _i,
        slotsUsed: _u,
        resourcesUsed: _r,
        ...rest
      } = h;
      void [_c, _s, _i, _u, _r];
      return { ...rest, classId: 'wizard' };
    });
    const v1 = {
      saveVersion: 1,
      savedAt: '2026-11-16T00:00:00.000Z',
      game: { ...g, party: oldParty },
    };
    const r = parseSave(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    const h = r.ok ? r.save.game.party[0]! : null;
    expect(h).toMatchObject({
      cantrips: ['fire-bolt', 'ray-of-frost', 'mage-hand'],
      slotsUsed: [],
      resourcesUsed: {},
      invocations: [],
    });
    expect(r.ok && r.save.saveVersion).toBe(2);
  });
});
