import { encounters } from '../../data';
import { levelUpHero, type Hero } from '../hero';
import { awardXp, stabilize } from '../../rules';
import type { CombatState } from './types';

export const getEncounter = (id: string) => {
  const e = encounters.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown encounter "${id}"`);
  return e;
};

/**
 * Bring a level-1 party up to the level a fight expects, with fixed HP. Stand-in for the story XP
 * and the level-up screen (M5): F2 expects level 2 (Lantern Night XP) [inferred].
 */
export function readyParty(party: Hero[], level: number): Hero[] {
  return party.map((h) => {
    let out = h;
    while (out.level < level) out = levelUpHero(out);
    return out;
  });
}

export interface CombatResult {
  party: Hero[];
  xpEach: number;
  notes: string[];
}

/**
 * After a won fight: heroes keep their HP, spent slots and resources. Lingering effects end.
 * Dying heroes are patched up and stabilized at 0 HP [inferred]; on Easy every downed (not dead)
 * hero gets back up with 1 HP (docs/mockups/Main.dc.html). XP is the same on every difficulty.
 */
export function finishCombat(state: CombatState, party: Hero[]): CombatResult {
  const notes: string[] = [];
  const xpEach = state.outcome === 'victory' ? state.xpPerPc : 0;
  const out = party.map((orig) => {
    const c = state.combatants[orig.id];
    if (!c) return orig;
    let h = { ...(c.creature as Hero) };
    h = {
      ...h,
      tempHp: 0,
      concentration: null,
      conditions: [],
      deathSaves: h.hp > 0 ? { successes: 0, failures: 0 } : h.deathSaves,
    };
    if (!h.dead && h.hp === 0) {
      if (state.difficulty === 'easy' && state.outcome === 'victory') {
        h = { ...h, hp: 1, stable: false, deathSaves: { successes: 0, failures: 0 } };
        notes.push(`${h.name} gets back up with 1 HP.`);
      } else {
        h = stabilize(h) as Hero;
        notes.push(`${h.name} is down but stable (0 HP).`);
      }
    }
    if (h.dead) notes.push(`${h.name} has died.`);
    if (xpEach && !h.dead) h = awardXp(h, xpEach).creature as Hero;
    return h;
  });
  return { party: out, xpEach, notes };
}
