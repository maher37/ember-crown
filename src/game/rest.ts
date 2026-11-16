import { getClass, maxSlots, type Hero } from './hero';
import {
  longRest as rulesLongRest,
  canLongRest as rulesCanLongRest,
  roll,
  spendHitDie,
  type RandomSource,
} from '../rules';
import type { GameState } from './save';

export interface RestResult {
  game: GameState;
  log: string[];
}

/** Refill class resources that recharge on this kind of rest. */
function recharge(h: Hero, kind: 'short-rest' | 'long-rest'): Hero {
  const cls = getClass(h.classId);
  const resourcesUsed = { ...h.resourcesUsed };
  for (const r of cls.resources)
    if (kind === 'long-rest' || r.recharge === 'short-rest') delete resourcesUsed[r.id];
  // Bard: Font of Inspiration (level 5) makes Bardic Inspiration recharge on a short rest.
  if (kind === 'short-rest' && h.classId === 'bard' && h.level >= 5)
    delete resourcesUsed['bardic-inspiration'];
  // PHB: Warlock Pact Magic slots come back on a short rest; everyone's come back on a long rest.
  const pact = cls.spellcasting?.progression === 'pact';
  const slotsUsed = kind === 'long-rest' || pact ? [] : h.slotsUsed;
  return { ...h, resourcesUsed, slotsUsed };
}

/** PHB: Stabilizing a creature. A stable hero at 0 HP regains 1 HP after 1d4 hours. */
function stableWakes(h: Hero, hours: number, rng: RandomSource, log: string[]): Hero {
  if (h.dead || h.hp > 0) return h;
  const need = roll('1d4', rng).total;
  if (need > hours) return h;
  log.push(`${h.name} wakes with 1 HP after ${need} hour${need === 1 ? '' : 's'}.`);
  return { ...h, hp: 1, stable: false, conditions: [], deathSaves: { successes: 0, failures: 0 } };
}

/**
 * PHB: Short Rest. One hour. Short-rest resources (Second Wind, Action Surge, Channel Divinity, ki,
 * warlock slots...) recharge. Hit Dice are spent one at a time afterwards with `spendDie`.
 */
export function startShortRest(game: GameState, rng: RandomSource): RestResult {
  const log = ['Short rest (1 hour).'];
  const party = game.party.map((h) =>
    h.dead ? h : recharge(stableWakes(h, 1, rng, log), 'short-rest'),
  );
  return { game: { ...game, party, clock: game.clock + 1 }, log };
}

/** Spend one Hit Die during a short rest. Song of Rest (bard 2+) adds 1d6 once per rest [applied by `finishShortRest`]. */
export function spendDie(game: GameState, heroId: string, rng: RandomSource): RestResult {
  const h = game.party.find((x) => x.id === heroId);
  if (!h) throw new Error(`No hero ${heroId}`);
  const r = spendHitDie(h, rng);
  const party = game.party.map((x) => (x.id === heroId ? (r.creature as Hero) : x));
  return { game: { ...game, party }, log: r.log.map((l) => l.text) };
}

/**
 * PHB: Bard, Song of Rest. Allies who spent Hit Dice during the rest regain an extra 1d6 (d8 at
 * bard level 9). Also Arcane Recovery for wizards and Natural Recovery for Land druids: one
 * spent slot of the lowest level comes back per point, up to half the class level (rounded up)
 * [simplified: recovered automatically, lowest slots first].
 */
export function finishShortRest(game: GameState, spentBy: string[], rng: RandomSource): RestResult {
  const log: string[] = [];
  let party = game.party;
  const bard = party.find((h) => h.classId === 'bard' && h.level >= 2 && !h.dead && h.hp > 0);
  if (bard) {
    party = party.map((h) => {
      if (!spentBy.includes(h.id) || h.dead) return h;
      const r = roll('1d6', rng);
      const healed = Math.min(h.maxHp - h.hp, r.total);
      log.push(`Song of Rest (${bard.name}): ${h.name} regains ${healed} more HP (${r.text}).`);
      return { ...h, hp: h.hp + healed };
    });
  }
  party = party.map((h) => {
    const res =
      h.classId === 'wizard'
        ? 'arcane-recovery'
        : h.classId === 'druid' && h.level >= 2
          ? 'natural-recovery'
          : null;
    if (!res || h.dead || (h.resourcesUsed[res] ?? 0) > 0 || !h.slotsUsed.some((n) => n > 0))
      return h;
    let budget = Math.ceil(h.level / 2);
    const used = [...h.slotsUsed];
    for (let lvl = 1; lvl <= Math.min(5, used.length) && budget > 0; lvl++) {
      while ((used[lvl - 1] ?? 0) > 0 && budget >= lvl) {
        used[lvl - 1]! -= 1;
        budget -= lvl;
      }
    }
    log.push(
      `${h.name} uses ${res === 'arcane-recovery' ? 'Arcane Recovery' : 'Natural Recovery'} to regain spell slots.`,
    );
    return { ...h, slotsUsed: used, resourcesUsed: { ...h.resourcesUsed, [res]: 1 } };
  });
  return { game: { ...game, party }, log };
}

/** PHB: Long Rest. Only one long rest in any 24-hour period (measured from the start). */
export const canLongRest = (game: GameState) => rulesCanLongRest(game.clock, game.lastLongRest);

/**
 * PHB: Long Rest. Eight hours. Heroes with at least 1 HP regain all HP, half their Hit Dice, every
 * spell slot and class resource, and lose a level of exhaustion. A stable hero at 0 HP wakes with
 * 1 HP but gets none of the benefits (it needs 1 HP at the start).
 */
export function takeLongRest(game: GameState, rng: RandomSource): RestResult {
  if (!canLongRest(game)) throw new Error('Only one long rest every 24 hours.');
  const log = ['Long rest (8 hours).'];
  const party = game.party.map((h) => {
    if (h.dead) return h;
    if (h.hp < 1) return stableWakes(h, 8, rng, log);
    const r = rulesLongRest(h);
    return recharge(r.creature as Hero, 'long-rest');
  });
  log.push('Hit points, spell slots and class abilities are restored. Half your Hit Dice return.');
  return { game: { ...game, party, clock: game.clock + 8, lastLongRest: game.clock }, log };
}

export { maxSlots };
