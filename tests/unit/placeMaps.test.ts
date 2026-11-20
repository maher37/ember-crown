// Walk-around place maps: which spots show, open and finish; the data points at real stories.
import { describe, expect, it } from 'vitest';
import { placeMaps, places, quests } from '../../src/data';
import { readyParty } from '../../src/game/combat';
import { Conversation } from '../../src/game/dialogue';
import { holds, nextSpot, placeMapFor, spotState } from '../../src/game/placeMaps';
import type { GameState } from '../../src/game/save';
import { homeScreen, useGame } from '../../src/game/store';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const game = (flags: GameState['flags'] = {}, location = 'old-mine'): GameState => ({
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
    3,
  ),
  act: 1,
  location,
  playSeconds: 0,
  flags,
  quests: {},
  notes: [],
  ink: {},
  clock: 7972,
  lastLongRest: null,
  letters: [],
  inventory: {},
  gold: 0,
});
const spot = (mapId: string, id: string) => placeMapFor(mapId)!.spots.find((s) => s.id === id)!;

describe('place map data', () => {
  it('every map is a real place with a real quest, and every spot opens in its story', () => {
    for (const m of placeMaps) {
      expect(
        places.some((p) => p.id === m.id),
        m.id,
      ).toBe(true);
      expect(
        quests.some((q) => q.id === m.quest),
        m.quest,
      ).toBe(true);
      expect(m.spots.filter((s) => s.kind === 'exit')).toHaveLength(1);
      for (const s of m.spots) {
        if (s.kind === 'exit') continue;
        expect(s.knot, s.id).toBeTruthy();
        expect(
          () =>
            new Conversation(m.story, game(), new ScriptedRng(Array(40).fill(10))).start(s.knot!),
          `${m.id}.${s.id}`,
        ).not.toThrow();
        // Spots sit on the 900×492 map, clear of the edges.
        expect(s.x).toBeGreaterThanOrEqual(20);
        expect(s.x).toBeLessThanOrEqual(880);
        expect(s.y).toBeGreaterThanOrEqual(20);
        expect(s.y).toBeLessThanOrEqual(472);
      }
    }
  });
});

describe('conditions', () => {
  it('all groups must hold; any token in a group will do; ! negates; quest: means done', () => {
    const g = { ...game({ a: true }), quests: { q: { status: 'done' as const, steps: [] } } };
    expect(holds(g, undefined)).toBe(true);
    expect(holds(g, [['a', 'b']])).toBe(true);
    expect(holds(g, [['a'], ['b']])).toBe(false);
    expect(holds(g, [['!b']])).toBe(true);
    expect(holds(g, [['quest:q']])).toBe(true);
    expect(holds(g, [['quest:other']])).toBe(false);
  });
});

describe('the Old Mine map opens up as you go', () => {
  it('at first only the mouth is open; inside is dark', () => {
    const g = game();
    expect(spotState(g, spot('old-mine', 'mouth'))).toBe('open');
    expect(spotState(g, spot('old-mine', 'seam'))).toBe('locked');
    expect(spotState(g, spot('old-mine', 'cart'))).toBe('locked');
    expect(spotState(g, spot('old-mine', 'maelis'))).toBe('hidden');
    expect(nextSpot(g, placeMapFor('old-mine')!)!.id).toBe('mouth');
  });
  it('talking the diggers down opens the tunnel and the seam', () => {
    const g = game({ mouth_cleared: true });
    expect(spotState(g, spot('old-mine', 'mouth'))).toBe('done');
    expect(spotState(g, spot('old-mine', 'cart'))).toBe('open');
    expect(nextSpot(g, placeMapFor('old-mine')!)!.id).toBe('seam');
  });
  it('after the shrine, Maelis waits at the mouth; after her, the mine is finished', () => {
    const g = game({
      mouth_cleared: true,
      'won:f6-deep-seam': true,
      found_halls: true,
      'parley:f7-sunken-shrine': true,
    });
    expect(spotState(g, spot('old-mine', 'maelis'))).toBe('open');
    expect(nextSpot(g, placeMapFor('old-mine')!)!.id).toBe('maelis');
    const after = { ...g, flags: { ...g.flags, act1_complete: true } };
    expect(spotState(after, spot('old-mine', 'maelis'))).toBe('done');
    expect(nextSpot(after, placeMapFor('old-mine')!)).toBeNull();
  });
});

describe("the King's Kiln map", () => {
  it('the ossuary only appears if Ida stood aside', () => {
    const base = { seal_broken: true, 'won:f18-honor-guard': true };
    expect(spotState(game(base, 'kings-kiln'), spot('kings-kiln', 'ossuary'))).toBe('hidden');
    expect(
      spotState(game({ ...base, ida_aside: true }, 'kings-kiln'), spot('kings-kiln', 'ossuary')),
    ).toBe('open');
  });
  it('the heart opens only after the last stand', () => {
    expect(spotState(game({}, 'kings-kiln'), spot('kings-kiln', 'heart'))).toBe('locked');
    expect(
      spotState(game({ before_crowning: true }, 'kings-kiln'), spot('kings-kiln', 'heart')),
    ).toBe('open');
  });
});

describe('arriving at a mapped place', () => {
  it('home is the tavern, a place map, or the world map', () => {
    expect(homeScreen(game({}, 'drowned-lantern'))).toBe('explore');
    expect(homeScreen(game({}, 'old-mine'))).toBe('placemap');
    expect(homeScreen(game({}, 'kings-kiln'))).toBe('placemap');
    expect(homeScreen(game({}, 'mill'))).toBe('map');
  });
  it('entering the Old Mine opens its map, and leaving a scene there returns to it', () => {
    useGame.setState({ game: game(), screen: 'map', rngState: 5 });
    useGame.getState().enterPlace('old-mine');
    expect(useGame.getState().screen).toBe('placemap');
    useGame.getState().talk('arrive.memorial', 'mine');
    expect(useGame.getState().screen).toBe('dialogue');
    useGame.getState().choose(useGame.getState().conversation!.choices[0]!.index);
    useGame.getState().leaveDialogue();
    expect(useGame.getState().screen).toBe('placemap');
    expect(useGame.getState().game!.flags['mine_memorial']).toBe(true);
  });
});
