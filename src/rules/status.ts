import {
  addCondition,
  MAX_EXHAUSTION,
  removeCondition,
  type ConditionInstance,
} from './conditions';
import { effectiveMaxHp, type Creature } from './creature';
import { dropConcentrationIfIncapacitated } from './damage';
import { log, type LogEntry } from './log';

/** Give a creature a condition, with its knock-on effects. */
export function applyCondition(
  c: Creature,
  cond: ConditionInstance,
): { creature: Creature; log: LogEntry[] } {
  if (c.dead) return { creature: c, log: [] };
  let next = addCondition(c, cond);
  // PHB Appendix A: Unconscious. The creature also falls prone.
  if (cond.id === 'unconscious') next = addCondition(next, { id: 'prone' });
  const out = [log('condition', `${c.name} is ${cond.id}`)];
  const after = dropConcentrationIfIncapacitated(next);
  if (after !== next)
    out.push(log('condition', `${c.name} loses concentration on ${c.concentration}`));
  return { creature: after, log: out };
}

export function clearCondition(c: Creature, id: ConditionInstance['id'], source?: string) {
  return removeCondition(c, id, source);
}

/**
 * PHB Appendix A: Exhaustion. Levels stack up to 6; level 4 halves the HP maximum (current HP
 * can't exceed it); level 6 is death. Pass a negative `levels` to remove exhaustion.
 */
export function changeExhaustion(
  c: Creature,
  levels: number,
): { creature: Creature; log: LogEntry[] } {
  if (c.dead) return { creature: c, log: [] };
  const exhaustion = Math.max(0, Math.min(MAX_EXHAUSTION, c.exhaustion + levels));
  let next: Creature = { ...c, exhaustion };
  next = { ...next, hp: Math.min(next.hp, effectiveMaxHp(next)) };
  const out = [log('condition', `${c.name} exhaustion: level ${c.exhaustion} → ${exhaustion}`)];
  if (exhaustion >= MAX_EXHAUSTION) {
    next = { ...next, hp: 0, dead: true, concentration: null };
    out.push(log('death', `${c.name} dies of exhaustion`));
  }
  return { creature: next, log: out };
}
