import { ABILITY_SHORT, type Ability } from './abilities';
import { Edge } from './advantage';
import {
  autoFailsStrDexSaves,
  exhaustionDisadvantageOnAttacksAndSaves,
  exhaustionDisadvantageOnChecks,
  hasCondition,
} from './conditions';
import { mod, type Creature } from './creature';
import { describeTotal, rollD20, type D20Roll } from './d20';
import type { DiceRoll } from './dice';
import { log, type LogEntry } from './log';
import type { RandomSource } from './rng';

export interface TestOptions {
  /** Add the proficiency bonus (skill or save proficiency). */
  proficient?: boolean;
  /** Double the proficiency bonus (Rogue/Bard Expertise). */
  expertise?: boolean;
  /** Flat bonuses or penalties, e.g. `{ label: 'cover', value: 2 }`. */
  bonuses?: { label: string; value: number }[];
  /** Extra dice already rolled, e.g. Bless or Guidance (value can be negative for Bane). */
  diceBonuses?: { label: string; roll: DiceRoll }[];
  /** Extra reasons for advantage / disadvantage (Inspiration, Reckless Attack...). */
  advantage?: string[];
  disadvantage?: string[];
  /** Label for the log, e.g. "Perception". Defaults to the ability. */
  label?: string;
}

export interface TestResult {
  roll: D20Roll;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  /** Failed automatically because of a condition (no roll made). */
  autoFail: boolean;
  log: LogEntry;
}

function profPart(c: Creature, opts: TestOptions): number {
  if (!opts.proficient) return 0;
  return opts.expertise ? c.proficiencyBonus * 2 : c.proficiencyBonus;
}

function resolveTest(
  c: Creature,
  ability: Ability,
  dc: number,
  edge: Edge,
  opts: TestOptions,
  kind: 'check' | 'save',
  rng: RandomSource,
): TestResult {
  for (const r of opts.advantage ?? []) edge.adv(r);
  for (const r of opts.disadvantage ?? []) edge.dis(r);
  const flat = (opts.bonuses ?? []).reduce((a, b) => a + b.value, 0);
  const modifier = mod(c, ability) + profPart(c, opts) + flat;
  const roll = rollD20(edge.mode, rng);
  const extras = (opts.diceBonuses ?? []).map((d) => ({ label: d.label, value: d.roll.total }));
  const total = roll.natural + modifier + extras.reduce((a, e) => a + e.value, 0);
  // PHB: Ability Checks / Saving Throws. Meet or beat the DC to succeed. A natural 20 or 1 has
  // no special effect on checks and saves (only on attack rolls and death saves).
  const success = total >= dc;
  const what = `${c.name} ${opts.label ?? ABILITY_SHORT[ability]} ${kind}`;
  const reasons = edgeReasons(edge);
  const text = `${what}: ${describeTotal(roll, modifier, extras)} vs DC ${dc} → ${success ? 'SUCCESS' : 'FAIL'}${reasons}`;
  return { roll, modifier, total, dc, success, autoFail: false, log: log(kind, text) };
}

export function edgeReasons(edge: Edge): string {
  const parts: string[] = [];
  if (edge.advantage.length) parts.push(`advantage: ${edge.advantage.join(', ')}`);
  if (edge.disadvantage.length) parts.push(`disadvantage: ${edge.disadvantage.join(', ')}`);
  return parts.length ? ` (${parts.join('; ')})` : '';
}

export interface CheckContext {
  /** The check needs sight (blinded creatures fail) or hearing (deafened creatures fail). */
  needs?: 'sight' | 'hearing';
  /** Whether the source of the creature's fear is in sight. Defaults to true. */
  fearSourceVisible?: boolean;
}

/** An ability check (with a skill: pass `proficient` and a `label`). */
export function abilityCheck(
  c: Creature,
  ability: Ability,
  dc: number,
  rng: RandomSource,
  opts: TestOptions & CheckContext = {},
): TestResult {
  const what = `${c.name} ${opts.label ?? ABILITY_SHORT[ability]} check`;
  // PHB Appendix A: Blinded / Deafened. Automatically fails checks that need sight / hearing.
  if (opts.needs === 'sight' && hasCondition(c, 'blinded'))
    return autoFail(what, dc, 'check', 'blinded');
  if (opts.needs === 'hearing' && hasCondition(c, 'deafened'))
    return autoFail(what, dc, 'check', 'deafened');

  const edge = new Edge()
    // PHB Appendix A: Poisoned. Disadvantage on ability checks.
    .dis('poisoned', hasCondition(c, 'poisoned'))
    // PHB Appendix A: Frightened. Disadvantage on checks while the source is in sight.
    .dis('frightened', hasCondition(c, 'frightened') && opts.fearSourceVisible !== false)
    // PHB Appendix A: Exhaustion level 1.
    .dis('exhaustion', exhaustionDisadvantageOnChecks(c));
  return resolveTest(c, ability, dc, edge, opts, 'check', rng);
}

/** A saving throw. Proficiency is added automatically from `saveProficiencies`. */
export function savingThrow(
  c: Creature,
  ability: Ability,
  dc: number,
  rng: RandomSource,
  opts: TestOptions = {},
): TestResult {
  const what = `${c.name} ${opts.label ?? ABILITY_SHORT[ability]} save`;
  // PHB Appendix A: paralyzed, petrified, stunned, unconscious = auto-fail Str and Dex saves.
  if ((ability === 'str' || ability === 'dex') && autoFailsStrDexSaves(c)) {
    const why = c.conditions.find((x) =>
      ['paralyzed', 'petrified', 'stunned', 'unconscious'].includes(x.id),
    )!.id;
    return autoFail(what, dc, 'save', why);
  }
  const edge = new Edge()
    // PHB Appendix A: Restrained. Disadvantage on Dexterity saving throws.
    .dis('restrained', ability === 'dex' && hasCondition(c, 'restrained'))
    // PHB Appendix A: Exhaustion level 3.
    .dis('exhaustion', exhaustionDisadvantageOnAttacksAndSaves(c));
  const proficient = opts.proficient ?? c.saveProficiencies.includes(ability);
  return resolveTest(c, ability, dc, edge, { ...opts, proficient }, 'save', rng);
}

function autoFail(what: string, dc: number, kind: 'check' | 'save', why: string): TestResult {
  return {
    roll: { mode: 'normal', dice: [], natural: 0 },
    modifier: 0,
    total: 0,
    dc,
    success: false,
    autoFail: true,
    log: log(kind, `${what}: automatic FAIL (${why}) vs DC ${dc}`),
  };
}
