// Milestone M7: the store's scene → fight → scene loop, items and potions outside a fight.
import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../src/game/store';
import type { GameState } from '../../src/game/save';
import { hero } from './combat/helpers';
import { readyParty } from '../../src/game/combat';

function game(patch: Partial<GameState> = {}): GameState {
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
    location: 'warren',
    playSeconds: 0,
    flags: {},
    quests: {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
    },
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: {},
    ...patch,
  };
}

beforeEach(() => {
  localStorage.clear();
  useGame.setState({
    game: game(),
    rngState: 5,
    screen: 'map',
    resume: null,
    afterDialogue: null,
    combat: null,
    shortRest: null,
  });
});

describe('a scene starts a fight and picks the story up afterwards', () => {
  it('warren gate: dialogue → prepare → combat → victory → back in the warren scene', () => {
    const st = useGame.getState;
    st().enterPlace();
    expect(st().screen).toBe('dialogue');
    const c = st().conversation!;
    st().choose(c.choices.find((x) => /Charge the gate/.test(x.text))!.index);
    st().leaveDialogue();
    expect(st().screen).toBe('prepare');
    expect(st().encounterId).toBe('f3-warren-gate');
    expect(st().resume).toEqual({ story: 'warren', knot: 'arrive.after_gate' });
    st().startFight({ difficulty: 'medium', formation: undefined as never, mageArmor: [] });
    expect(st().screen).toBe('combat');
    // Win at once (the fight itself is tested elsewhere).
    useGame.setState({ combat: { ...st().combat!, outcome: 'victory' } });
    st().endFight();
    expect(st().screen).toBe('dialogue');
    expect(st().conversation!.storyId).toBe('warren');
    expect(st().game!.flags['won:f3-warren-gate']).toBe(true);
    expect(st().game!.party[0]!.xp).toBe(300 + 50); // level 2 starts at 300
    expect(st().game!.quests['old-mine']!.steps).toContain('warren-gate');
  });

  it('losing the tavern brawl carries on with the story (defeatContinues)', () => {
    const st = useGame.getState;
    useGame.setState({
      game: game({ location: 'drowned-lantern', flags: { edric_tended: true } }),
    });
    st().talk('strangers');
    const c = st().conversation!;
    st().choose(c.choices.find((x) => /come and take it/.test(x.text))!.index);
    st().leaveDialogue();
    expect(st().encounterId).toBe('f1-tavern-brawl');
    st().startFight({ difficulty: 'medium', formation: undefined as never, mageArmor: [] });
    useGame.setState({ combat: { ...st().combat!, outcome: 'defeat' } });
    st().endFight();
    expect(st().screen).toBe('dialogue');
    expect(st().game!.flags['lost:f1-tavern-brawl']).toBe(true);
    expect(st().game!.flags['strangers_gone']).toBe(true);
    expect(st().game!.party.every((h) => h.hp >= 1)).toBe(true);
  });

  it('a saved game away from Ashford loads onto the map', () => {
    const st = useGame.getState;
    const save = st().saveTo('slot1');
    useGame.setState({ screen: 'title' });
    st().loadGame(save);
    expect(st().screen).toBe('map');
  });
});

describe('items outside a fight', () => {
  it('a potion heals 2d4 + 2 and is used up', () => {
    const g = game({ inventory: { 'potion-of-healing': 1 } });
    g.party[0] = { ...g.party[0]!, hp: 1 };
    useGame.setState({ game: g });
    expect(useGame.getState().drinkPotion(g.party[0]!.id, 'potion-of-healing')).toBeUndefined();
    const after = useGame.getState().game!;
    expect(after.party[0]!.hp).toBeGreaterThanOrEqual(5);
    expect(after.inventory['potion-of-healing']).toBe(0);
  });

  it('attuning needs a short rest (Items.md); plain magic items equip any time', () => {
    useGame.setState({ game: game({ inventory: { 'cloak-of-protection': 1, deepdelver: 1 } }) });
    const id = useGame.getState().game!.party[0]!.id;
    expect(useGame.getState().equipItem(id, 'cloak-of-protection')).toMatch(/short rest/);
    expect(useGame.getState().equipItem(id, 'deepdelver')).toBeUndefined();
    useGame.setState({ shortRest: [] });
    const ac = useGame.getState().game!.party[0]!.ac;
    expect(useGame.getState().equipItem(id, 'cloak-of-protection')).toBeUndefined();
    expect(useGame.getState().game!.party[0]!.ac).toBe(ac + 1);
    useGame.getState().unequipItem(id, 'cloak-of-protection');
    expect(useGame.getState().game!.inventory['cloak-of-protection']).toBe(1);
  });
});
