// The headless balance simulator (docs/BUILD_ROADMAP.md M10; targets in RPG_Game_Plan §5:
// main-path fights won about 85–95% of the time at the expected level on Medium).
import { encounters } from '../data';
import type { DifficultyId } from '../data/schemas/difficulty';
import { getEncounter, startCombat, type CombatState } from '../game/combat';
import { simPlay } from './bot';
import { simParty } from './party';

export interface SimResult {
  encounterId: string;
  code: string;
  name: string;
  level: number;
  party: string;
  difficulty: DifficultyId;
  runs: number;
  /** Fraction of fights won (talking a foe down counts as a win). */
  winRate: number;
  avgRounds: number;
  /** Party HP left at the end, as a fraction of their maximum (wins only). */
  hpLeft: number;
  /** Average heroes at 0 HP or dead at the end. */
  downed: number;
  /** Fraction of fights where at least one hero died. */
  deathRate: number;
  /** Fights that hit the step limit (a stuck AI: a bug to look at). */
  stuck: number;
  errors: string[];
}

export function simulate(
  encounterId: string,
  opts: {
    runs?: number;
    party?: string;
    difficulty?: DifficultyId;
    levelBonus?: number;
    seed?: number;
  } = {},
): SimResult {
  const enc = getEncounter(encounterId);
  const runs = opts.runs ?? 500;
  const difficulty = opts.difficulty ?? 'medium';
  const level = Math.min(6, enc.expectedLevel + (opts.levelBonus ?? 0));
  const party = simParty(opts.party ?? 'classic', level);
  let wins = 0;
  let rounds = 0;
  let hp = 0;
  let downed = 0;
  let deaths = 0;
  let stuck = 0;
  const errors: string[] = [];
  for (let i = 0; i < runs; i++) {
    let end: CombatState;
    try {
      const s = startCombat({
        encounter: enc,
        party,
        difficulty,
        rngState: (opts.seed ?? 1) + i * 7919,
        inventory: {},
      });
      end = simPlay(s);
    } catch (e) {
      if (errors.length < 5)
        errors.push(
          e instanceof Error
            ? `${e.message}\n${e.stack?.split('\n').slice(1, 4).join('\n')}`
            : String(e),
        );
      continue;
    }
    if (!end.outcome) stuck++;
    const heroes = Object.values(end.combatants).filter((c) => c.side === 'party' && !c.summon);
    const won = end.outcome === 'victory' || end.outcome === 'parley';
    if (won) {
      wins++;
      hp +=
        heroes.reduce((n, c) => n + c.creature.hp, 0) /
        Math.max(
          1,
          heroes.reduce((n, c) => n + c.creature.maxHp, 0),
        );
    }
    rounds += end.round;
    downed += heroes.filter((c) => c.creature.hp === 0 || c.creature.dead).length;
    if (heroes.some((c) => c.creature.dead)) deaths++;
  }
  return {
    encounterId,
    code: enc.code,
    name: enc.name,
    level,
    party: opts.party ?? 'classic',
    difficulty,
    runs,
    winRate: wins / runs,
    avgRounds: rounds / runs,
    hpLeft: wins ? hp / wins : 0,
    downed: downed / runs,
    deathRate: deaths / runs,
    stuck,
    errors,
  };
}

/** Story fights (main, side, elite), in order; road encounters separately. */
export const storyFights = () => encounters.filter((e) => !/^(road|marsh|heights)-/.test(e.id));
export const roadFights = () => encounters.filter((e) => /^(road|marsh|heights)-/.test(e.id));

/** The documented target for a fight on Medium at its expected level [inferred, RPG_Game_Plan §5]. */
export function target(encounterId: string): [number, number] {
  // Elites are Deadly at their expected level by design (Encounters_and_XP §5c).
  if (/^e\d/.test(encounterId)) return [0.4, 0.85];
  // Travel encounters are Easy: they should almost always be won.
  if (/^(road|marsh|heights)-/.test(encounterId)) return [0.9, 1];
  // Fights designed as Hard (bosses, the finale, the hard side quests) may bite a little more.
  if (/^(f7|f11|f14|f21|s3|s5|s7|s9|s10|s12)-/.test(encounterId)) return [0.75, 0.95];
  return [0.85, 0.97];
}
