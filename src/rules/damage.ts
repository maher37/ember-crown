import type { DamageInstance } from './attack';
import { savingThrow, type TestResult } from './checks';
import { addCondition, hasCondition, isIncapacitated, removeCondition } from './conditions';
import { effectiveMaxHp, type Creature } from './creature';
import type { DamageType, Defenses } from './damageTypes';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

/**
 * PHB: Damage Resistance and Vulnerability. Immunity = no damage. Resistance halves (round down),
 * vulnerability doubles. Several resistances (or vulnerabilities) to one type count only once.
 * Resistance is applied before vulnerability.
 * PHB Appendix A: Petrified creatures have resistance to all damage.
 */
export function adjustForDefenses(
  amount: number,
  type: DamageType,
  defenses: Defenses,
  petrified = false,
): { amount: number; note: string } {
  if (defenses.immunities.includes(type)) return { amount: 0, note: 'immune' };
  let a = amount;
  const notes: string[] = [];
  if (petrified || defenses.resistances.includes(type)) {
    a = Math.floor(a / 2);
    notes.push(petrified ? 'resisted (petrified)' : 'resisted');
  }
  if (defenses.vulnerabilities.includes(type)) {
    a *= 2;
    notes.push('vulnerable');
  }
  return { amount: a, note: notes.join(', ') };
}

export interface DamageOptions {
  /** The damage came from a critical hit (2 death-save failures at 0 HP). */
  critical?: boolean;
  /** The damage came from a melee attack. Needed for knockouts. */
  melee?: boolean;
  /** The attacker chose to knock the target out rather than kill it. */
  knockOut?: boolean;
}

export interface DamageOutcome {
  creature: Creature;
  /** Damage after resistance etc., before temporary hit points soak it up. */
  damageTaken: number;
  /** The concentration save this damage forced, if any. */
  concentrationSave?: TestResult;
  log: LogEntry[];
}

/** Apply damage to a creature, with every consequence: temp HP, 0 HP, death, concentration. */
export function applyDamage(
  target: Creature,
  instances: DamageInstance[],
  rng: RandomSource,
  opts: DamageOptions = {},
): DamageOutcome {
  const out: LogEntry[] = [];
  if (target.dead) return { creature: target, damageTaken: 0, log: out };

  const petrified = hasCondition(target, 'petrified');
  let taken = 0;
  const notes: string[] = [];
  for (const inst of instances) {
    const adj = adjustForDefenses(inst.amount, inst.type, target.defenses, petrified);
    taken += adj.amount;
    if (adj.note) notes.push(`${inst.type} ${adj.note}`);
  }

  let c: Creature = { ...target };
  // PHB: Temporary Hit Points. They're lost first; leftover damage carries over to real HP.
  const soaked = Math.min(c.tempHp, taken);
  c.tempHp -= soaked;
  const toHp = taken - soaked;
  const noteText = notes.length ? ` [${notes.join('; ')}]` : '';
  const soakText = soaked ? ` (${soaked} absorbed by temporary HP)` : '';
  out.push(log('damage', `${c.name} takes ${taken} damage${noteText}${soakText}`));

  if (toHp === 0) return concentrationAfterDamage(c, taken, rng, out);

  // Already at 0 HP.
  if (c.hp === 0) {
    // PHB: Damage at 0 Hit Points. Damage at or above the hit point maximum = instant death.
    if (toHp >= effectiveMaxHp(c)) return died(c, 'massive damage while down', out, taken);
    // Otherwise one death-save failure, two from a critical hit. A stable creature starts dying.
    const failures = c.deathSaves.failures + (opts.critical ? 2 : 1);
    c = { ...c, stable: false, deathSaves: { ...c.deathSaves, failures } };
    out.push(
      log(
        'death',
        `${c.name} is hit while down: ${opts.critical ? 2 : 1} death save failure(s) (${failures}/3)`,
      ),
    );
    if (failures >= 3) return died(c, 'three failed death saves', out, taken);
    return { creature: c, damageTaken: taken, log: out };
  }

  const overflow = toHp - c.hp;
  c.hp = Math.max(0, c.hp - toHp);
  if (c.hp > 0) return concentrationAfterDamage(c, taken, rng, out);

  // Dropped to 0 HP.
  // PHB: Instant Death. Leftover damage at or above the hit point maximum kills outright.
  if (overflow >= effectiveMaxHp(c)) return died(c, 'massive damage', out, taken);

  // PHB: Knocking a Creature Out. A melee attack that drops a creature to 0 can knock it out:
  // it falls unconscious and is stable.
  if (opts.knockOut && opts.melee) {
    c = knockDown(c, true);
    out.push(log('condition', `${c.name} is knocked out (unconscious, stable)`));
    return { creature: c, damageTaken: taken, log: out };
  }
  // Rules_Scope §1: monsters simply die at 0 HP.
  if (c.kind === 'monster') return died(c, 'reduced to 0 HP', out, taken);
  // Rules_Scope §1: named villains fall unconscious (stable) so the story can continue.
  if (c.kind === 'villain') {
    c = knockDown(c, true);
    out.push(log('condition', `${c.name} falls unconscious (stable)`));
    return { creature: c, damageTaken: taken, log: out };
  }
  // PHB: Falling Unconscious. Heroes fall unconscious and start making death saves.
  c = knockDown(c, false);
  out.push(log('condition', `${c.name} falls unconscious and is dying`));
  return { creature: c, damageTaken: taken, log: out };
}

/** Put a creature at 0 HP: unconscious, prone, concentration lost, fresh death saves. */
function knockDown(c: Creature, stable: boolean): Creature {
  let next: Creature = { ...c, hp: 0, stable, deathSaves: { successes: 0, failures: 0 } };
  // PHB Appendix A: Unconscious. Drops what it's holding and falls prone.
  next = addCondition(next, { id: 'unconscious' });
  next = addCondition(next, { id: 'prone' });
  return dropConcentrationIfIncapacitated(next);
}

function died(c: Creature, why: string, out: LogEntry[], taken: number): DamageOutcome {
  const dead: Creature = { ...c, hp: 0, dead: true, stable: false, concentration: null };
  out.push(log('death', `${c.name} dies (${why})`));
  return { creature: dead, damageTaken: taken, log: out };
}

/**
 * PHB: Concentration. Taking damage forces a Constitution save, DC 10 or half the damage,
 * whichever is higher; failure ends the spell. Damage soaked by temporary hit points still counts
 * [inferred from Sage Advice: the creature still "takes damage"].
 */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

function concentrationAfterDamage(
  c: Creature,
  taken: number,
  rng: RandomSource,
  out: LogEntry[],
): DamageOutcome {
  if (!c.concentration || taken <= 0) return { creature: c, damageTaken: taken, log: out };
  const save = savingThrow(c, 'con', concentrationDc(taken), rng, { label: 'Con (concentration)' });
  out.push(save.log);
  if (save.success) return { creature: c, damageTaken: taken, concentrationSave: save, log: out };
  out.push(log('condition', `${c.name} loses concentration on ${c.concentration}`));
  return {
    creature: { ...c, concentration: null },
    damageTaken: taken,
    concentrationSave: save,
    log: out,
  };
}

/** PHB: Concentration. Casting another concentration spell ends the first. */
export function startConcentration(
  c: Creature,
  spellId: string,
): { creature: Creature; log: LogEntry[] } {
  const out: LogEntry[] = [];
  if (c.concentration && c.concentration !== spellId) {
    out.push(log('condition', `${c.name} stops concentrating on ${c.concentration}`));
  }
  out.push(log('condition', `${c.name} concentrates on ${spellId}`));
  return { creature: { ...c, concentration: spellId }, log: out };
}

export function endConcentration(c: Creature): Creature {
  return { ...c, concentration: null };
}

/** PHB: Concentration. Being incapacitated or killed ends concentration. */
export function dropConcentrationIfIncapacitated(c: Creature): Creature {
  return c.concentration && (c.dead || isIncapacitated(c)) ? { ...c, concentration: null } : c;
}

export interface HealOutcome {
  creature: Creature;
  healed: number;
  log: LogEntry[];
}

/**
 * PHB: Healing. HP can't go above the maximum. A creature at 0 HP that regains any HP wakes up
 * and stops making death saves (it stays prone). The dead can't be healed.
 */
export function heal(c: Creature, amount: number, source = 'healing'): HealOutcome {
  if (c.dead)
    return {
      creature: c,
      healed: 0,
      log: [log('heal', `${c.name} is dead; ${source} has no effect`)],
    };
  const max = effectiveMaxHp(c);
  const healed = Math.max(0, Math.min(amount, max - c.hp));
  let next: Creature = { ...c, hp: c.hp + healed };
  const out = [log('heal', `${c.name} regains ${healed} HP from ${source} (${next.hp}/${max})`)];
  if (c.hp === 0 && healed > 0) {
    next = removeCondition(next, 'unconscious');
    next = { ...next, stable: false, deathSaves: { successes: 0, failures: 0 } };
    out.push(log('condition', `${c.name} regains consciousness (still prone)`));
  }
  return { creature: next, healed, log: out };
}

/** PHB: Temporary Hit Points. They don't stack: keep whichever amount is higher. */
export function grantTempHp(c: Creature, amount: number): Creature {
  return { ...c, tempHp: Math.max(c.tempHp, amount) };
}
