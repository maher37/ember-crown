import { abilityCheck } from './checks';
import { isDying, type Creature } from './creature';
import { rollD20 } from './d20';
import { roll } from './dice';
import { heal } from './damage';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

export type DeathSaveOutcome = 'success' | 'failure' | 'stable' | 'dead' | 'revived';

/**
 * PHB: Death Saving Throws. At the start of each of its turns, a dying creature rolls a d20 with
 * no modifiers: 10 or higher succeeds. Three successes = stable; three failures = dead.
 * A natural 1 counts as two failures. A natural 20 = regain 1 HP (and wake up).
 */
export function deathSave(
  c: Creature,
  rng: RandomSource,
): { creature: Creature; outcome: DeathSaveOutcome; log: LogEntry[] } {
  if (!isDying(c)) throw new Error(`${c.name} is not dying`);
  const nat = rollD20('normal', rng).natural;
  const head = `${c.name} death save: d20 (${nat})`;

  if (nat === 20) {
    const healed = heal(c, 1, 'a natural 20 death save');
    return {
      creature: healed.creature,
      outcome: 'revived',
      log: [
        log('death', `${head} → NATURAL 20, back on their feet with 1 HP`),
        ...healed.log.slice(1),
      ],
    };
  }

  let { successes, failures } = c.deathSaves;
  if (nat >= 10) successes++;
  else failures += nat === 1 ? 2 : 1;
  const tally = `(${successes} success, ${failures} failure)`;
  const verdict = nat >= 10 ? 'SUCCESS' : nat === 1 ? 'NATURAL 1, two failures' : 'FAIL';
  const out = [log('death', `${head} vs DC 10 → ${verdict} ${tally}`)];

  if (failures >= 3) {
    out.push(log('death', `${c.name} dies`));
    return {
      creature: { ...c, dead: true, concentration: null, deathSaves: { successes, failures } },
      outcome: 'dead',
      log: out,
    };
  }
  if (successes >= 3) {
    out.push(log('death', `${c.name} is stable`));
    return { creature: stabilize(c), outcome: 'stable', log: out };
  }
  return {
    creature: { ...c, deathSaves: { successes, failures } },
    outcome: nat >= 10 ? 'success' : 'failure',
    log: out,
  };
}

/** PHB: Stabilizing a Creature. Stable: stays at 0 HP, unconscious, no more death saves. */
export function stabilize(c: Creature): Creature {
  return { ...c, stable: true, deathSaves: { successes: 0, failures: 0 } };
}

/**
 * PHB: Stabilizing a Creature. Another creature can use its action for a DC 10 Wisdom (Medicine)
 * check to stabilize a dying creature.
 */
export function medicineStabilize(
  healer: Creature,
  patient: Creature,
  rng: RandomSource,
  proficient = false,
): { patient: Creature; log: LogEntry[] } {
  if (!isDying(patient)) throw new Error(`${patient.name} is not dying`);
  const check = abilityCheck(healer, 'wis', 10, rng, { label: 'Medicine', proficient });
  if (!check.success) return { patient, log: [check.log] };
  return {
    patient: stabilize(patient),
    log: [check.log, log('death', `${patient.name} is stable`)],
  };
}

/** PHB: Stabilizing a Creature. A stable creature regains 1 HP after 1d4 hours. */
export function stableRecoveryHours(rng: RandomSource): number {
  return roll('1d4', rng).total;
}
