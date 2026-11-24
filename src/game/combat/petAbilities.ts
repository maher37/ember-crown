import { getMonster } from '../creatures';
import type { Effect } from '../../data/schemas/common';
import { spendAction } from './basics';
import { breakInvisibility, combatSave, say, type Ctx } from './core';
import { conscious, distanceFeet } from './grid';
import { giveCondition } from './leaves';
import type { FeatureInfo } from './featureList';
import type { Combatant } from './types';

// Familiar abilities in a fight (SRD 5.1; D36): Invisibility (imp, quasit, sprite), Scare
// (quasit), Flyby (owl), Magic Resistance (imp, pseudodragon, quasit) and delivering a touch spell.

const hasAction = (c: Combatant, id: string) =>
  !!c.monsterId && getMonster(c.monsterId).actions.some((a) => a.id === id);
export const hasTrait = (c: Combatant, id: string) =>
  !!c.monsterId && getMonster(c.monsterId).traits.some((t) => t.id === id);

/** SRD: Scare reaches 20 ft. */
const SCARE_FEET = 20;

/** The abilities a familiar (or other creature on the party's side) can use now. */
export function petFeatures(c: Combatant): FeatureInfo[] {
  if (!c.pet) return [];
  const out: FeatureInfo[] = [];
  const action = c.turn.actionUsed && c.turn.extraActions < 1 ? 'action used' : undefined;
  if (hasAction(c, 'invisibility'))
    out.push({
      id: 'pet-invisibility',
      name: 'Invisibility',
      cost: 'action',
      detail: 'until it attacks or its concentration ends',
      blocked:
        action ??
        (c.creature.conditions.some((x) => x.id === 'invisible') ? 'already invisible' : undefined),
    });
  if (hasAction(c, 'scare'))
    out.push({
      id: 'pet-scare',
      name: 'Scare',
      cost: 'action',
      target: 'enemy',
      detail: `DC 10 Wis or frightened · ${SCARE_FEET} ft · once a fight`,
      blocked:
        action ?? (c.effects.some((e) => e.tag === 'scare-used') ? 'used this fight' : undefined),
    });
  return out;
}

/** Use one of `petFeatures`. Returns an error, or null. */
export function petFeature(ctx: Ctx, c: Combatant, id: string, target?: Combatant): string | null {
  const { s } = ctx;
  const info = petFeatures(c).find((f) => f.id === id);
  if (!info) return "It can't do that.";
  if (info.blocked) return `${info.name}: ${info.blocked}.`;
  if (id === 'pet-invisibility') {
    // SRD: Invisibility (imp, quasit, sprite). Invisible until it attacks (or uses Scare, or casts
    // a spell), or until its concentration ends, as if concentrating on a spell.
    spendAction(c);
    c.creature = { ...c.creature, concentration: 'invisibility' };
    giveCondition(ctx, c, c, 'invisible', undefined, 'invisibility');
    say(s, 'you', `${c.name} turns invisible`);
    return null;
  }
  if (id === 'pet-scare') {
    // SRD: Quasit, Scare (1/day; here once a fight [inferred]).
    if (!target || target.side === c.side || !conscious(target)) return 'Choose an enemy.';
    if (distanceFeet(c.pos, target.pos) > SCARE_FEET) return `${target.name} is too far (20 ft).`;
    spendAction(c);
    breakInvisibility(s, c);
    c.effects.push({ id: 'scare-used', name: 'Scare used', sourceId: c.id, tag: 'scare-used' });
    const save = getMonster(c.monsterId!).actions.find((a) => a.id === 'scare')!
      .effects[0] as Extract<Effect, { type: 'save' }>;
    say(s, 'you', `${c.name} uses Scare on ${target.name}`);
    const r = combatSave(ctx, target, 'wis', save.dc ?? 10, {
      against: 'frightened',
      label: 'Wis (Scare)',
    });
    if (!r.success)
      giveCondition(ctx, c, target, 'frightened', { minutes: 1 }, undefined, 'wis', save.dc ?? 10);
    return null;
  }
  return "It can't do that.";
}

/**
 * PHB: Find Familiar. A caster can deliver a touch spell through their familiar: it must be within
 * 100 ft of the caster and next to the target, and it uses its reaction. Returns the familiar.
 */
export function touchCourier(
  s: Ctx['s'],
  caster: Combatant,
  target: Combatant,
): Combatant | undefined {
  return Object.values(s.combatants).find(
    (f) =>
      f.pet?.kind === 'familiar' &&
      f.pet.ownerId === caster.id &&
      conscious(f) &&
      !f.reactionUsed &&
      distanceFeet(f.pos, caster.pos) <= 100 &&
      distanceFeet(f.pos, target.pos) <= 5,
  );
}
