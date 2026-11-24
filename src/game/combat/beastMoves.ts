import { getMonster } from '../creatures';
import { addCondition, hasCondition } from '../../rules';
import type { Monster } from '../../data/schemas/monster';

type MonsterTrait = Monster['traits'][number];
import type { DamagePart } from '../../rules';
import { combatSave, say, type Ctx } from './core';
import { distanceFeet } from './grid';
import type { Combatant } from './types';

// Beast special moves (SRD 5.1): Charge (boar, giant elk), Pounce (panther), Relentless (boar).
// The numbers live on each trait in monsters.json.

/** The attacker's Charge or Pounce trait for this attack, if it has one. */
export function chargeTrait(attacker: Combatant, attackId: string): MonsterTrait | undefined {
  if (!attacker.monsterId) return undefined;
  return getMonster(attacker.monsterId).traits.find((t) => t.charge?.attack === attackId);
}

/**
 * SRD: Charge / Pounce. "Moves at least 20 ft straight toward" the target this turn: here, it
 * moved 20 ft or more since its turn began and got at least 20 ft closer to the target
 * [inferred grid reading of "straight"]. Once a turn.
 */
export function charged(attacker: Combatant, target: Combatant): boolean {
  const start = attacker.turn.startPos;
  if (!start || attacker.turn.chargeUsed) return false;
  const moved = distanceFeet(start, attacker.pos);
  const closer = distanceFeet(start, target.pos) - distanceFeet(attacker.pos, target.pos);
  return moved >= 20 && closer >= 20;
}

/** The Charge's extra damage, added to the hit (marks the charge used). */
export function chargeDamage(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  attackId: string,
  type: DamagePart['type'],
): { part: DamagePart | null; trait: MonsterTrait } | null {
  const t = chargeTrait(attacker, attackId);
  if (!t || !charged(attacker, target)) return null;
  attacker.turn.chargeUsed = true;
  say(
    ctx.s,
    attacker.side === 'party' ? 'you' : 'foe',
    `${t.name}! ${attacker.name} hits at a run`,
  );
  const c = t.charge!;
  return { part: c.dice ? { dice: c.dice, type: c.damageType ?? type } : null, trait: t };
}

/**
 * After a Charge or Pounce hit: a creature makes a Strength save or is knocked prone. Pounce: a
 * prone target is then bitten as a bonus action (made at once here [inferred]).
 */
export function chargeAfterHit(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  trait: MonsterTrait,
  bonusAttack: (attackId: string) => void,
): void {
  const c = trait.charge!;
  if (target.creature.dead || target.creature.hp <= 0) return;
  const sv = combatSave(ctx, target, 'str', c.dc, { label: `Str (${trait.name})` });
  if (!sv.success && !hasCondition(target.creature, 'prone')) {
    target.creature = addCondition(target.creature, { id: 'prone' });
    say(ctx.s, 'dmg', `${target.name} is knocked prone`);
  }
  if (c.bonusAttack && hasCondition(target.creature, 'prone') && !attacker.turn.bonusUsed) {
    attacker.turn.bonusUsed = true;
    bonusAttack(c.bonusAttack);
  }
}

/**
 * SRD: Boar, Relentless. Damage of `limit` or less that would drop it leaves it at 1 HP instead.
 * Once a fight [inferred: RAW once per short or long rest].
 */
export function relentless(ctx: Ctx, target: Combatant, damage: number): boolean {
  if (!target.monsterId) return false;
  const t = getMonster(target.monsterId).traits.find((x) => x.id === 'relentless');
  const key = `relentless:${target.id}`;
  if (!t?.limit || damage > t.limit || ctx.s.flags[key]) return false;
  ctx.s.flags = { ...ctx.s.flags, [key]: true };
  target.creature = {
    ...target.creature,
    hp: 1,
    dead: false,
    conditions: target.creature.conditions.filter((c) => c.id !== 'unconscious'),
  };
  say(
    ctx.s,
    target.side === 'party' ? 'you' : 'foe',
    `${target.name} refuses to fall (Relentless)`,
  );
  return true;
}
