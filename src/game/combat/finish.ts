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
  /** Potions left after the fight. */
  inventory: Record<string, number>;
}

/**
 * After a won fight: heroes keep their HP, spent slots and resources. Lingering effects end.
 * Dying heroes are patched up and stabilized at 0 HP [inferred]; on Easy every downed (not dead)
 * hero gets back up with 1 HP (docs/mockups/Main.dc.html). XP is the same on every difficulty.
 */
export function finishCombat(state: CombatState, party: Hero[]): CombatResult {
  const notes: string[] = [];
  const won = state.outcome === 'victory' || state.outcome === 'parley';
  // A story brawl you lose still counts (the F1 XP is part of the level curve) [inferred].
  const xpEach = won || (state.defeatContinues && state.outcome === 'defeat') ? state.xpPerPc : 0;
  const out = party.map((orig) => {
    const c = state.combatants[orig.id];
    if (!c) return orig;
    let h = { ...(c.creature as Hero) };
    // Strength drained by shadows comes back when the fight ends [inferred: RAW after a rest].
    const drain = c.effects.find((e) => e.tag === 'str-drain');
    if (drain)
      h = {
        ...h,
        abilities: { ...h.abilities, str: h.abilities.str + Number(drain.data?.amount ?? 0) },
      };
    // Aid's extra hit points end with the fight [inferred: RAW 8 hours].
    const aid = c.effects.find((e) => e.tag === 'aid');
    if (aid)
      h = {
        ...h,
        maxHp: h.maxHp - Number(aid.data?.amount ?? 0),
        hp: Math.min(h.hp, h.maxHp - Number(aid.data?.amount ?? 0)),
      };
    // PHB: Berserker, Frenzy. One level of exhaustion when the frenzied rage ends.
    if (c.effects.some((e) => e.tag === 'frenzy') || state.flags[`frenzied:${c.id}`]) {
      h = { ...h, exhaustion: Math.min(6, h.exhaustion + 1) };
      notes.push(`${h.name} is exhausted after the frenzy (exhaustion ${h.exhaustion}).`);
    }
    h = {
      ...h,
      tempHp: 0,
      concentration: null,
      conditions: [],
      deathSaves: h.hp > 0 ? { successes: 0, failures: 0 } : h.deathSaves,
    };
    if (!h.dead && h.hp === 0) {
      if (
        (state.difficulty === 'easy' && won) ||
        (state.defeatContinues && state.outcome === 'defeat')
      ) {
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
  return { party: out, xpEach, notes, inventory: state.inventory };
}
