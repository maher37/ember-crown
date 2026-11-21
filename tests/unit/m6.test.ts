import { describe, expect, it } from 'vitest';
import { letters } from '../../src/data';
import { GAME_START } from '../../src/game/calendar';
import { buildHero, corinDraft, newDraft, type HeroDraft } from '../../src/game/hero';
import {
  deliverLetters,
  finaleDcReduction,
  letterText,
  getLetter,
  readLetter,
  trust,
} from '../../src/game/letters';
import {
  canLongRest,
  finishShortRest,
  spendDie,
  startShortRest,
  takeLongRest,
} from '../../src/game/rest';
import type { GameState } from '../../src/game/save';
import { getPlace, roadCheck, travelHours, travelLeg } from '../../src/game/travel';
import { ScriptedRng } from '../../src/rules';

const hero = (cls: string, name: string, patch: Partial<HeroDraft> = {}) =>
  buildHero(
    {
      ...newDraft(cls),
      name,
      classSkills: (
        {
          fighter: ['athletics', 'perception'],
          warlock: ['arcana', 'deception'],
          wizard: ['arcana', 'history'],
          bard: ['arcana', 'history', 'insight'],
        } as unknown as Record<string, never[]>
      )[cls]!,
      fightingStyle: cls === 'fighter' ? 'defense' : null,
      ...patch,
    },
    name.toLowerCase(),
  );

function game(patch: Partial<GameState> = {}): GameState {
  return {
    id: 'g',
    createdAt: 'x',
    seed: 1,
    rngState: 1,
    party: [
      hero('fighter', 'Mira'),
      hero('warlock', 'Vex'),
      hero('wizard', 'Wren'),
      hero('bard', 'Lark'),
    ],
    act: 1,
    location: 'drowned-lantern',
    playSeconds: 0,
    flags: {},
    quests: {
      'lantern-night': { status: 'done', steps: [] },
      'old-mine': { status: 'active', steps: [] },
    },
    notes: [],
    ink: {},
    clock: GAME_START,
    lastLongRest: null,
    letters: [],
    inventory: {},
    gold: 0,
    ...patch,
  };
}
const dice = (...n: number[]) => new ScriptedRng(n);

// PHB: Resting.
describe('short rest', () => {
  it('takes an hour and recharges short-rest abilities and warlock pact slots', () => {
    const g = game();
    g.party[0] = { ...g.party[0]!, resourcesUsed: { 'second-wind': 1 } };
    g.party[1] = { ...g.party[1]!, slotsUsed: [1] };
    g.party[2] = { ...g.party[2]!, slotsUsed: [1] };
    const r = startShortRest(g, dice());
    expect(r.game.clock).toBe(GAME_START + 1);
    expect(r.game.party[0]!.resourcesUsed).toEqual({});
    expect(r.game.party[1]!.slotsUsed).toEqual([]);
    expect(r.game.party[2]!.slotsUsed).toEqual([1]); // wizards need a long rest (or Arcane Recovery)
  });

  it('spends Hit Dice: die + Con', () => {
    const g = game();
    g.party[0] = { ...g.party[0]!, hp: 2 };
    const r = spendDie(g, 'mira', dice(7));
    const con = Math.floor((g.party[0].abilities.con - 10) / 2);
    expect(r.game.party[0]!.hp).toBe(2 + 7 + con);
    expect(r.game.party[0]!.hitDice.remaining).toBe(0);
    expect(() => spendDie(r.game, 'mira', dice(3))).toThrow(/no Hit Dice/);
  });

  it('Arcane Recovery gives a wizard back a spent slot once a day', () => {
    const g = game();
    g.party[2] = { ...g.party[2]!, slotsUsed: [2] };
    const r = finishShortRest(g, [], dice());
    expect(r.game.party[2]!.slotsUsed).toEqual([1]);
    expect(r.log.join(' ')).toContain('Arcane Recovery');
    expect(finishShortRest(r.game, [], dice()).game.party[2]!.slotsUsed).toEqual([1]);
  });

  it('Song of Rest: a level-2 bard adds 1d6 to allies who spent Hit Dice', () => {
    const g = game();
    g.party[3] = { ...g.party[3]!, level: 2 };
    g.party[0] = { ...g.party[0]!, hp: 2 };
    const r = finishShortRest(g, ['mira'], dice(4));
    expect(r.game.party[0]!.hp).toBe(6);
    expect(r.log[0]).toMatch(/^Song of Rest \(Lark\): Mira regains 4 more HP/);
  });
});

describe('long rest', () => {
  it('restores HP, slots and resources, and takes 8 hours', () => {
    const g = game();
    g.party[0] = {
      ...g.party[0]!,
      hp: 1,
      resourcesUsed: { 'second-wind': 1 },
      hitDice: { die: 10, total: 1, remaining: 0 },
    };
    g.party[2] = { ...g.party[2]!, slotsUsed: [2] };
    const r = takeLongRest(g, dice());
    expect(r.game.party[0]).toMatchObject({
      hp: g.party[0].maxHp,
      resourcesUsed: {},
      hitDice: { remaining: 1 },
    });
    expect(r.game.party[2]!.slotsUsed).toEqual([]);
    expect(r.game.clock).toBe(GAME_START + 8);
    expect(r.game.lastLongRest).toBe(GAME_START);
  });

  it('house rule (owner, Nov 21): a long rest any time, each still 8 hours', () => {
    const r = takeLongRest(game(), dice());
    expect(canLongRest(r.game)).toBe(true);
    const again = takeLongRest(r.game, dice());
    expect(again.game.clock).toBe(r.game.clock + 8);
    void GAME_START;
  });

  it('a stable hero at 0 HP wakes with 1 HP but gets no other benefit (PHB)', () => {
    const g = game();
    g.party[0] = { ...g.party[0]!, hp: 0, stable: true, conditions: [{ id: 'unconscious' }] };
    const r = takeLongRest(g, dice(3));
    expect(r.game.party[0]!.hp).toBe(1);
    expect(r.log).toContain('Mira wakes with 1 HP after 3 hours.');
  });
});

describe('travel', () => {
  it('times legs by distance on the mockup map (÷ 32, at least 1 hour)', () => {
    expect(travelHours(getPlace('ashford'), getPlace('old-mine'))).toBe(
      Math.round(Math.hypot(82, 118) / 32),
    );
    expect(travelHours(getPlace('ashford'), getPlace('mill'))).toBe(
      Math.max(1, Math.round(Math.hypot(58, 42) / 32)),
    );
  });

  it('the road to the mine is where the goblins wait (F2), once', () => {
    const t = travelLeg(game(), 'old-mine', dice());
    expect(t).toMatchObject({ kind: 'encounter', encounterId: 'f2-road-ambush', story: true });
    const after = game({
      quests: {
        'lantern-night': { status: 'done', steps: [] },
        'old-mine': { status: 'active', steps: ['road'] },
      },
    });
    expect(travelLeg(after, 'old-mine', dice(5)).kind).toBe('arrive');
  });

  // Encounters_and_XP.md §5b.
  it('rolls d20 per leg: 17 is quiet, 18+ rolls a d8 on the region table', () => {
    expect(roadCheck('road', 'x', [], dice(17))).toMatchObject({ kind: 'arrive' });
    expect(roadCheck('road', 'x', [], dice(18, 1))).toMatchObject({
      kind: 'encounter',
      encounterId: 'road-wolves',
    });
    expect(roadCheck('road', 'x', [], dice(20, 7))).toMatchObject({
      kind: 'encounter',
      encounterId: 'road-recruiters',
    });
  });

  it('d8 = 8 is the dwarven pilgrim: no fight, a rumor', () => {
    const r = roadCheck('road', 'x', [], dice(19, 8));
    expect(r.kind).toBe('arrive');
    expect(r.log.at(-1)).toMatch(/dwarven pilgrim/);
  });

  it('never in town', () => {
    expect(roadCheck('none', 'x', [], dice())).toMatchObject({ kind: 'arrive' });
  });
});

describe("Maelis's letters (verbatim from docs/Maelis_Letters.md)", () => {
  it('has letters 0-7', () => {
    expect(letters.map((l) => l.title)).toEqual([
      'Come Home',
      'Thirty Lanterns',
      'The Ledger',
      'Marrowmere',
      'His Handwriting',
      'Burnt Honey-Bread',
      'Ash',
      'Bring a Lantern',
    ]);
    expect(getLetter('letter-1').paragraphs[4]!.text).toBe(
      'They have floated thirty, every year, for ten years. I have counted.',
    );
  });

  it('a letter arrives once its trigger is set', () => {
    expect(deliverLetters(game()).delivered).toEqual([]);
    const r = deliverLetters(game({ flags: { act1_complete: true } }));
    expect(r.delivered.map((l) => l.id)).toEqual(['letter-1']);
    expect(deliverLetters(r.game).delivered).toEqual([]);
  });

  it("Corin's party gets letter 0", () => {
    const g = game();
    g.party[0] = buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin');
    expect(deliverLetters(g).delivered.map((l) => l.id)).toEqual(['letter-0']);
  });

  it('shows only the conditional lines that match the story', () => {
    const l = getLetter('letter-1');
    const spared = letterText(game({ flags: { ulric_spared: true } }), l).join('\n');
    expect(spared).toContain('Thank you for Ulric.');
    expect(spared).not.toContain('Ulric is dead.');
    expect(spared).not.toContain("P.S. You've grown into Father's shoulders.");
  });

  it('kind and honest replies add Trust; 3+ Trust lowers the finale DC by 2', () => {
    let g = game({
      letters: ['letter-1', 'letter-2', 'letter-3', 'letter-4'].map((id) => ({ id, read: false })),
    });
    g = readLetter(g, 'letter-1', 'kind');
    g = readLetter(g, 'letter-2', 'hard');
    g = readLetter(g, 'letter-3', 'honest');
    expect(trust(g)).toBe(2);
    expect(finaleDcReduction(g)).toBe(0);
    g = readLetter(g, 'letter-4', 'kind');
    expect(finaleDcReduction(g)).toBe(2);
    expect(readLetter(g, 'letter-4', 'kind')).toEqual({ ...g, letters: g.letters });
  });
});

describe('talk or fight (D16: same XP)', () => {
  it('talking past the cult recruiters awards the encounter XP and arrives', async () => {
    const { useGame } = await import('../../src/game/store');
    let success = 0;
    let failure = 0;
    for (let seed = 1; seed <= 40; seed++) {
      useGame.setState({
        game: game(),
        encounterId: 'road-recruiters',
        pendingArrival: 'mill',
        backToCamp: false,
        rngState: seed,
        screen: 'prepare',
      });
      const r = useGame.getState().talkPast()!;
      const g = useGame.getState().game!;
      if (r.success) {
        success++;
        expect(g.party[0]!.xp).toBe(43);
        expect(g.location).toBe('mill');
        // M7: arriving opens the place's scene.
        expect(useGame.getState().screen).toBe('dialogue');
        expect(useGame.getState().conversation!.storyId).toBe('mill');
      } else {
        failure++;
        expect(r.text).toMatch(/Persuasion check: d20 \(\d+\).*FAIL\. "Unbelievers!"/);
        expect(g.party[0]!.xp).toBe(0);
        expect(useGame.getState().screen).toBe('prepare');
      }
    }
    expect(success).toBeGreaterThan(0);
    expect(failure).toBeGreaterThan(0);
  });
});
