// Sneak past or ambush (D35, owner Nov 22): one scout's Stealth check before chosen fights.
import { beforeEach, describe, expect, it } from 'vitest';
import { getEncounter, readyParty, startCombat } from '../../src/game/combat';
import { equip } from '../../src/game/items';
import { monsterPassive, rollSneak, sneakChance, sneakDc, sneakOdds } from '../../src/game/sneak';
import { useGame } from '../../src/game/store';
import type { GameState } from '../../src/game/save';
import { ScriptedRng } from '../../src/rules';
import { hero } from './combat/helpers';

const party = () =>
  readyParty(
    [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    4,
  );

function game(): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party: party(),
    act: 2,
    location: 'toll-bridge',
    playSeconds: 0,
    flags: {},
    quests: {},
    notes: [],
    ink: {},
    clock: 7972,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
  };
}

describe('the scout’s odds', () => {
  it('DC: the sharpest passive Perception, +1 for each other enemy watching [inferred house rule]', () => {
    const enc = getEncounter('marsh-zombies');
    const foes = enc.enemies.filter((e) => e.difficulties.includes('medium'));
    expect(sneakDc(enc, 'medium')).toBe(monsterPassive('zombie') + foes.length - 1);
    // Hard adds enemies, so it is harder to sneak past.
    expect(sneakDc(enc, 'hard')).toBeGreaterThanOrEqual(sneakDc(enc, 'medium'));
  });

  it('PHB armor table: noisy armor gives disadvantage; a Cloak of Elvenkind gives advantage', () => {
    const [mira, , ilse] = party();
    const fighter = sneakOdds(mira!);
    expect(mira!.equipment.armor).toBe('chain-mail');
    expect(fighter.disadvantage).toEqual(['Chain mail']);
    const rogue = sneakOdds(equip(ilse!, 'cloak-of-elvenkind').hero);
    expect(rogue.advantage).toEqual(['Cloak of Elvenkind']);
  });

  it('chance: d20 + bonus ≥ DC; advantage rolls twice and keeps the higher (PHB)', () => {
    const base = { heroId: 'x', name: 'X', bonus: 5, advantage: [], disadvantage: [] };
    expect(sneakChance(base, 15)).toBe(55); // needs 10+
    expect(sneakChance({ ...base, advantage: ['cloak'] }, 15)).toBe(80); // 1 − 0.45²
    expect(sneakChance({ ...base, disadvantage: ['armor'] }, 15)).toBe(30); // 0.55²
    expect(sneakChance({ ...base, advantage: ['a'], disadvantage: ['b'] }, 15)).toBe(55);
  });

  it('the roll is logged with its breakdown', () => {
    const ilse = party()[2]!;
    const r = rollSneak(ilse, 14, new ScriptedRng([12]));
    expect(r.log.text).toMatch(/Stealth check/);
    expect(r.log.text).toMatch(/vs DC 14/);
  });

  // D34: Pass without Trace planned on the Prepare screen gives the scout +10 (PHB: Pass without Trace).
  it('Pass without Trace adds +10 to the odds and to the roll', () => {
    const ilse = party()[2]!;
    expect(sneakOdds(ilse, true).bonus).toBe(sneakOdds(ilse).bonus + 10);
    const plain = rollSneak(ilse, 30, new ScriptedRng([12]));
    const pwt = rollSneak(ilse, 30, new ScriptedRng([12]), true);
    expect(pwt.total).toBe(plain.total + 10);
  });
});

describe('PHB: Surprise. An ambush or a spotted scout', () => {
  const start = (surprise: 'enemies' | 'party') =>
    startCombat({
      encounter: getEncounter('f9-lizardfolk'),
      party: party(),
      difficulty: 'medium',
      rngState: 3,
      surprise,
    });

  it('after a successful sneak every enemy is surprised', () => {
    const s = start('enemies');
    const foes = Object.values(s.combatants).filter((c) => c.side === 'enemy');
    expect(foes.every((c) => c.surprised || s.order.indexOf(c.id) < s.turnIndex)).toBe(true);
    expect(Object.values(s.combatants).some((c) => c.side === 'party' && c.surprised)).toBe(false);
    expect(s.log.map((l) => l.text).join('\n')).toMatch(/Ambush!/);
  });

  it('a spotted scout leaves the party surprised', () => {
    const s = start('party');
    expect(s.log.map((l) => l.text).join('\n')).toMatch(/Spotted!/);
    expect(Object.values(s.combatants).some((c) => c.side === 'enemy' && c.surprised)).toBe(false);
  });
});

describe('the store: scout, then slip past or ambush', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({
      game: game(),
      rngState: 5,
      screen: 'prepare',
      resume: null,
      afterDialogue: null,
      combat: null,
      scouted: null,
      pendingArrival: null,
      backToCamp: false,
    });
  });

  /** Try seeds until the scout's roll comes out the way the test needs. */
  const scoutUntil = (encounterId: string, success: boolean) => {
    for (let seed = 1; seed < 500; seed++) {
      useGame.setState({ rngState: seed, scouted: null });
      useGame.getState().openPrepare(encounterId);
      const r = useGame.getState().scout('ilse', 'medium')!;
      if (r.success === success) return r;
    }
    throw new Error('no seed');
  };

  it('one try per fight', () => {
    useGame.getState().openPrepare('marsh-zombies');
    const a = useGame.getState().scout('ilse', 'medium');
    const b = useGame.getState().scout('mira', 'medium');
    expect(b).toEqual(a);
    // Backing out ("Not yet") and coming back doesn't give a second try.
    useGame.getState().openPrepare('marsh-zombies');
    expect(useGame.getState().scouted).toEqual(a);
  });

  it('slipping past a road fight gives its XP (D35: the same XP as the fight)', () => {
    scoutUntil('marsh-zombies', true);
    const before = useGame.getState().game!.party[0]!.xp;
    useGame.getState().slipPast();
    const st = useGame.getState();
    const enc = getEncounter('marsh-zombies');
    expect(st.game!.party[0]!.xp).toBe(before + enc.xpPerPc);
    expect(st.game!.flags['sneaked:marsh-zombies']).toBe(true);
    expect(st.screen).not.toBe('combat');
  });

  it('slipping past the toll bridge goes on with the story, without Kell turning hostile', () => {
    scoutUntil('f8-toll-bridge', true);
    useGame.setState({ resume: { story: 'bridge', knot: 'arrive.after_fight' } });
    useGame.getState().slipPast();
    const st = useGame.getState();
    expect(st.game!.flags['won:f8-toll-bridge']).toBe(true);
    expect(st.game!.flags['bridge_crossed']).toBe(true);
    expect(st.game!.flags['kell_hostile']).toBeFalsy();
  });

  it('the deserters can only be ambushed, not slipped past', () => {
    scoutUntil('s6-deserters', true);
    useGame.getState().slipPast();
    expect(useGame.getState().game!.flags['won:s6-deserters']).toBeFalsy();
    useGame.getState().startFight({ difficulty: 'medium', mageArmor: [] });
    const s = useGame.getState().combat!;
    expect(s.log.map((l) => l.text).join('\n')).toMatch(/Ambush!/);
  });

  it('a spotted scout: the fight starts with the party surprised', () => {
    scoutUntil('f9-lizardfolk', false);
    useGame.getState().startFight({ difficulty: 'medium', mageArmor: [] });
    expect(
      useGame
        .getState()
        .combat!.log.map((l) => l.text)
        .join('\n'),
    ).toMatch(/Spotted!/);
  });
});
