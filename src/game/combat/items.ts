import { gear } from '../../data';
import { getMonster } from '../creatures';
import { getItem } from '../items';
import { skillBonus } from '../hero';
import { abilityCheck, abilityModifier, isDying, SKILLS, stabilize, type Skill } from '../../rules';
import { attackBlocked, makeAttack, type AttackOption } from './attacks';
import { healDice } from './wards';
import { addEffect, healCombatant, heroOf, say, type Ctx, isSub } from './core';
import { distanceFeet } from './grid';
import type { Combatant } from './types';
import { spendAction } from './basics';

// Using gear and potions, and parley, in combat (split from actions.ts).

/**
 * Adventuring gear in a fight (PHB Chapter 5): throw a flask (alchemist's fire, holy water, acid)
 * or use a healer's kit. Thrown flasks are improvised weapons: Dex to hit, no proficiency, 20/60 ft.
 */
export function applyGear(ctx: Ctx, c: Combatant, itemId: string, targetId: string): string | null {
  const { s } = ctx;
  const g = gear.find((x) => x.id === itemId)!;
  const use = g.use;
  if (!use) return `${g.name} isn't used in a fight.`;
  const target = s.combatants[targetId];
  if (!target) return 'Choose a target.';
  if (use.type === 'stabilize') {
    // PHB: Healer's Kit. Stabilize a creature at 0 HP without a Medicine check.
    if (target.side !== c.side) return 'Choose a dying ally.';
    if (!isDying(target.creature)) return `${target.name} isn't dying.`;
    if (distanceFeet(c.pos, target.pos) > 5) return 'You must be next to them.';
    if (!spendAction(c, true)) return 'No action left.';
    target.creature = stabilize(target.creature);
    say(s, 'you', `${c.name} uses a healer's kit on ${target.name}: stable (no check needed)`);
    return null;
  }
  if (target.side === c.side) return 'Throw it at an enemy.';
  const type = target.monsterId ? getMonster(target.monsterId).type : 'humanoid';
  if (use.onlyVs && !use.onlyVs.includes(type))
    return `${g.name} only harms ${use.onlyVs.join(' and ')}.`;
  const h = heroOf(c);
  const opt: AttackOption = {
    id: `throw-${g.id}`,
    name: g.name,
    kind: 'ranged',
    toHit: h ? abilityModifier(h.abilities.dex) : 0,
    reach: 5,
    range: [use.rangeFt, use.rangeFt * 3],
    damage: [{ dice: use.dice, type: use.damageType }],
    onHit: [],
    finesse: false,
    light: false,
    twoHanded: false,
    ability: 'none',
    monk: false,
    unarmed: false,
  };
  const blocked = attackBlocked(ctx, c, target, opt);
  if (blocked) return `Can't throw at ${target.name}: ${blocked}.`;
  if (!spendAction(c, true)) return 'No action left.';
  s.inventory = { ...s.inventory, [itemId]: s.inventory[itemId]! - 1 };
  say(s, 'you', `${c.name} throws ${g.name.toLowerCase()} at ${target.name}`);
  const r = makeAttack(ctx, c, target, opt);
  if (r.hit && use.burning && !target.creature.dead) {
    // PHB: Alchemist's Fire burns each turn until put out (DC 10 Dex). The target tries at the
    // end of each of its turns [inferred: monsters never spend an action on it].
    addEffect(target, {
      id: `burning-${c.id}`,
      name: "alchemist's fire",
      sourceId: c.id,
      tag: 'burning',
      data: { dice: use.dice, repeatSave: 'dex', dc: 10 },
    });
    say(s, 'dmg', `${target.name} is on fire`);
  }
  return null;
}

/** PHB: Use an Object. Drink a potion, or pour it down an adjacent ally's throat. */
export function applyItem(ctx: Ctx, c: Combatant, itemId: string, targetId: string): string | null {
  const { s, rng } = ctx;
  if ((s.inventory[itemId] ?? 0) < 1) return 'None left.';
  if (gear.some((x) => x.id === itemId)) return applyGear(ctx, c, itemId, targetId);
  const item = getItem(itemId);
  if (!item.consumable) return `${item.name} isn't something you can use in a fight.`;
  const target = s.combatants[targetId];
  if (!target || target.side !== c.side) return 'Choose yourself or an ally.';
  if (target.id !== c.id && distanceFeet(c.pos, target.pos) > 5) return 'You must be next to them.';
  // PHB: Thief, Fast Hands. Use an object with Cunning Action (a bonus action).
  const fast = isSub(c, 'rogue', 'thief', 3) && !c.turn.bonusUsed;
  if (fast) c.turn.bonusUsed = true;
  else if (!spendAction(c, true)) return 'No action left.';
  s.inventory = { ...s.inventory, [itemId]: s.inventory[itemId]! - 1 };
  say(
    s,
    'you',
    `${c.name} uses ${item.name}${target.id !== c.id ? ` on ${target.name}` : ''}${fast ? ' (Fast Hands)' : ''}`,
  );
  for (const e of item.effects) {
    if (e.type === 'heal') {
      // PHB: Beacon of Hope. Healing gives its maximum.
      const r = healDice(target, e.dice, rng);
      say(s, 'you', `${item.name}: ${r.text}`);
      healCombatant(ctx, target, r.total, item.name, c);
    } else if (e.type === 'special' && e.id === 'resistance-for-1-hour') {
      addEffect(target, {
        id: `resist-${e.note}`,
        name: `${item.name}`,
        sourceId: c.id,
        tag: 'resistance',
        data: { type: String(e.note) },
      });
      say(s, 'you', `${target.name} resists ${e.note} damage`);
    }
  }
  return null;
}

/** Talk the enemy down mid-fight (Story_Bible: Ulric). The speaker's own check, once per hero. */
export function parley(ctx: Ctx, c: Combatant): string | null {
  const { s, rng } = ctx;
  const p = s.parley;
  if (!p) return 'There is no one here to talk down.';
  if (s.parleyTried.includes(c.id)) return `${c.name} has already tried.`;
  if (!spendAction(c)) return 'No action left.';
  s.parleyTried = [...s.parleyTried, c.id];
  const h = heroOf(c)!;
  const skills = p.skills.map((sk) => sk as Skill);
  const skill = skills.reduce((best, sk) => (skillBonus(h, sk) > skillBonus(h, best) ? sk : best));
  const dc = p.easierFlag && s.flags[p.easierFlag] ? (p.easierDc ?? p.dc) : p.dc;
  const ability = SKILLS[skill];
  const bonus = skillBonus(h, skill) - abilityModifier(h.abilities[ability]);
  const r = abilityCheck(h, ability, dc, rng, {
    label: skill[0]!.toUpperCase() + skill.slice(1),
    bonuses: bonus ? [{ label: 'skill', value: bonus }] : [],
  });
  say(s, 'you', `${c.name} tries to talk the fight down: ${r.log.text.replace(`${h.name} `, '')}`);
  if (r.success) {
    say(s, 'head', p.text);
    s.outcome = 'parley';
  } else say(s, 'info', 'The words don\u2019t land. The fight goes on.');
  return null;
}
