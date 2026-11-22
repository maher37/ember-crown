import { abilityCheck, abilityModifier } from '../../rules';
import { attackOptions } from './attacks';
import { addEffect, heroOf, hostiles, say, type Ctx } from './core';
import { coverBetween, terrainAt } from './grid';
import { nextTurnRound } from './leaves';
import { passivePerception, stealthBonus, usesExtraAttack } from './turn';
import type { CombatState, Combatant } from './types';

// Basic actions and action bookkeeping shared by the combat action modules (split from actions.ts).

/** Uses the action, or an extra one from Action Surge. Returns false if none is left. */
/**
 * Use the action (or an extra one from Action Surge). `limited` actions (one weapon attack,
 * Dash, Disengage, Hide, Use an Object) can also use Haste's extra action (PHB: Haste).
 */
export function spendAction(c: Combatant, limited = false): boolean {
  c.turn.inHasteAction = false;
  if (!c.turn.actionUsed) {
    c.turn.actionUsed = true;
    return true;
  }
  if (c.turn.extraActions > 0) {
    c.turn.extraActions -= 1;
    return true;
  }
  if (limited && c.turn.hasteAction) {
    c.turn.hasteAction = false;
    c.turn.inHasteAction = true;
    return true;
  }
  return false;
}
export const actionFree = (c: Combatant) => !c.turn.actionUsed || c.turn.extraActions > 0;

/** Spend one attack of the Attack action, starting a new action if needed. */
export function startAttack(c: Combatant): boolean {
  if (c.turn.attacksLeft > 0) {
    c.turn.attacksLeft -= 1;
    return true;
  }
  if (!spendAction(c, true)) return false;
  // Haste's extra action allows only one weapon attack.
  c.turn.attacksLeft = c.turn.inHasteAction ? 0 : usesExtraAttack(c) - 1;
  return true;
}

/** Light melee weapons a hero carries two of (or two different ones). */
export function offhandWeapons(c: Combatant): string[] {
  const h = heroOf(c);
  if (!h) return [];
  const light = attackOptions(c).filter((o) => o.light && o.kind === 'melee' && o.weaponId);
  const counts = new Map<string, number>();
  for (const w of h.equipment.weapons) counts.set(w, (counts.get(w) ?? 0) + 1);
  return light
    .filter((o) => (o.id === c.turn.lightWeaponUsed ? (counts.get(o.id) ?? 0) > 1 : true))
    .map((o) => o.id);
}

export function dodge(s: CombatState, c: Combatant): void {
  // PHB: Dodge. Attacks against you have disadvantage; advantage on Dex saves.
  addEffect(c, {
    id: 'dodge',
    name: 'Dodge',
    sourceId: c.id,
    tag: 'dodge',
    expires: { turnOf: c.id, when: 'start', round: nextTurnRound(s, c.id) },
  });
  say(s, c.side === 'party' ? 'you' : 'foe', `${c.name} takes the Dodge action`);
}

/**
 * Hiding needs somewhere to hide: brush, or at least half cover from every enemy that is
 * still up [inferred grid version of "heavily obscured or out of sight"].
 */
export function hideProblem(s: CombatState, c: Combatant): string | null {
  if (terrainAt(s.map, c.pos) === 'brush') return null;
  const exposed = hostiles(s, c).some(
    (h) => coverBetween(s, h.pos, c.pos, [h.id, c.id]) === 'none',
  );
  return exposed ? 'Nowhere to hide: stand in brush or behind cover.' : null;
}

/** PHB: Hide. Stealth against each enemy's passive Perception. */
export function hide(ctx: Ctx, c: Combatant): void {
  const { s, rng } = ctx;
  const bonus = stealthBonus(c);
  const r = abilityCheck(c.creature, 'dex', 0, rng, {
    label: 'Stealth',
    bonuses: [{ label: 'skill', value: bonus - abilityModifier(c.creature.abilities.dex) }],
  });
  const best = Math.max(0, ...hostiles(s, c).map(passivePerception));
  const ok = r.total >= best;
  say(
    s,
    c.side === 'party' ? 'you' : 'foe',
    `${c.name} tries to hide: Stealth ${r.roll.dice.join('/')} + ${bonus} = ${r.total} vs passive Perception ${best} → ${ok ? 'HIDDEN' : 'SEEN'}`,
  );
  if (ok) addEffect(c, { id: 'hidden', name: 'Hidden', sourceId: c.id, tag: 'hidden' });
}

/** Is this creature hexed on checks with this ability (PHB: Hex)? */
export const hexedOn = (c: Combatant, ability: string) =>
  c.effects.some((e) => e.tag === 'hex-target' && e.data?.ability === ability);
