// What happens when an attack hits: damage, riders and on-hit features (split from attacks.ts).
import { getMonster } from '../creatures';
import { hasSubclass, resourceLeft } from '../hero';
import { nextTurnRound, pushPull, thunderbolt } from './leaves';
import {
  abilityModifier,
  addCondition,
  isIncapacitated,
  parseDice,
  roll,
  type DamagePart,
  type DamageType,
} from '../../rules';
import {
  classLevel,
  combatSave,
  dealDamage,
  effectsWith,
  hasEffect,
  heroOf,
  removeEffect,
  say,
  sayAll,
  spendResource,
  spendSlot,
  type Ctx,
  isSub,
} from './core';
import { conscious, distanceFeet, isAdjacent } from './grid';
import { applyLeaf } from './leaves';
import type { Combatant } from './types';
import { chargeAfterHit, chargeDamage } from './beastMoves';

import { attackOptions, type AttackOption } from './attackOptions';
import { makeAttack, type AttackExtras } from './attacks';

/** Damage and everything else that happens on a hit. */
export function applyHit(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  opt: AttackOption,
  critical: boolean,
  extras: AttackExtras = {},
): { hit: true; critical: boolean } {
  const { s } = ctx;
  const h = heroOf(attacker);
  const parts: DamagePart[] = opt.damage.map((p) => ({ ...p }));
  if (extras.offhand && h?.fightingStyle !== 'two-weapon-fighting') {
    // PHB: Two-Weapon Fighting. No ability modifier to the off-hand attack's damage (unless negative).
    const e = parseDice(parts[0]!.dice);
    if (e.bonus > 0) parts[0] = { ...parts[0]!, dice: `${e.count}d${e.sides}` };
  }
  // PHB: Rage. +2 damage with Strength melee weapon attacks.
  if (hasEffect(attacker, 'rage') && opt.kind === 'melee' && opt.ability === 'str')
    parts.push({ dice: '2', type: parts[0]!.type });
  // PHB: Sneak Attack (once per turn: finesse or ranged, with advantage or an ally next to the target).
  const rogue = classLevel(attacker, 'rogue');
  if (rogue && !attacker.turn.sneakAttackUsed && (opt.finesse || opt.kind === 'ranged')) {
    const allyNear = Object.values(s.combatants).some(
      (o) =>
        o.side === attacker.side &&
        o.id !== attacker.id &&
        conscious(o) &&
        !isIncapacitated(o.creature) &&
        isAdjacent(o.pos, target.pos),
    );
    const lastLog = s.log.at(-1)?.text ?? '';
    const hadAdvantage = /d20 adv/.test(lastLog);
    if (allyNear || hadAdvantage) {
      const dice = Math.ceil(rogue / 2);
      parts.push({ dice: `${dice}d6`, type: parts[0]!.type });
      attacker.turn.sneakAttackUsed = true;
      say(s, 'you', `Sneak Attack! +${dice}d6`);
    }
  }
  // Hex / Hunter's Mark / Divine Favor: extra damage on each hit.
  for (const e of target.effects) {
    if (e.sourceId !== attacker.id) continue;
    if (e.tag === 'hex-target') parts.push({ dice: '1d6', type: 'necrotic' });
    // PHB: Bestow Curse (the extra-damage option): +1d8 necrotic from the curser's attacks.
    if (e.tag === 'cursed') parts.push({ dice: '1d8', type: 'necrotic' });
    if (e.tag === 'hunters-mark-target' && opt.weaponId)
      parts.push({ dice: '1d6', type: parts[0]!.type });
  }
  if (hasEffect(attacker, 'divine-favor') && opt.weaponId)
    parts.push({ dice: '1d4', type: 'radiant' });
  // Story_Review #1: "let our blows burn". Once a turn, a marked hero's weapon hit adds 1d4 fire.
  if (h && s.flags?.['kindled_strike'] && opt.weaponId && !hasEffect(attacker, 'kindled-burned')) {
    parts.push({ dice: '1d4', type: 'fire' });
    attacker.effects.push({
      id: 'kindled-burned',
      name: 'Kindled strike used',
      sourceId: attacker.id,
      tag: 'kindled-burned',
      expires: { turnOf: attacker.id, when: 'end', round: s.round },
    });
    say(s, 'you', `The ember-mark flares: +1d4 fire`);
  }
  // DMG: Mace of Disruption. +2d6 radiant against fiends and undead.
  const tm = target.monsterId ? getMonster(target.monsterId) : undefined;
  const disruption =
    opt.id === 'mace-of-disruption' && !!tm && (tm.type === 'undead' || tm.type === 'fiend');
  if (disruption) parts.push({ dice: '2d6', type: 'radiant' });
  // DMG: Dragon Slayer. +3d6 against dragons (the ember-wraith counts).
  if (opt.id === 'dragon-slayer' && tm?.type === 'dragon')
    parts.push({ dice: '3d6', type: parts[0]!.type });
  // Branding Smite and similar: the next weapon hit deals extra damage.
  const nextHit = effectsWith(attacker, 'next-hit')[0];
  if (nextHit && opt.weaponId) {
    parts.push({
      dice: String(nextHit.data?.dice ?? '2d6'),
      type: String(nextHit.data?.type ?? 'radiant') as DamageType,
    });
    removeEffect(attacker, nextHit);
  }
  // PHB: Hunter, Colossus Slayer. Once per turn, +1d8 against a creature below its HP maximum.
  if (
    h?.choices['hunters-prey']?.includes('colossus-slayer') &&
    !attacker.turn.colossusUsed &&
    opt.weaponId &&
    target.creature.hp < target.creature.maxHp
  ) {
    parts.push({ dice: '1d8', type: parts[0]!.type });
    attacker.turn.colossusUsed = true;
  }
  // Riposte's superiority die, already rolled.
  if (extras.extraDamage) parts.push(extras.extraDamage);
  // SRD: Charge (boar, giant elk) and Pounce (panther): a hit after a 20-ft run.
  const charge = chargeDamage(ctx, attacker, target, opt.id, parts[0]!.type);
  if (charge?.part) parts.push(charge.part);
  // PHB: Battle Master, Trip Attack / Pushing Attack. A superiority die on the damage, then a
  // Strength save (Large or smaller) or the target is knocked prone / pushed 15 ft.
  let maneuver: 'trip' | 'push' | null = null;
  if (
    extras.maneuver &&
    h &&
    isSub(attacker, 'fighter', 'battle-master', 3) &&
    resourceLeft(h, 'superiority-dice') > 0
  ) {
    spendResource(attacker, 'superiority-dice');
    const die = roll('1d8', ctx.rng);
    parts.push({ dice: String(die.total), type: parts[0]!.type });
    maneuver = extras.maneuver;
    say(s, 'you', `${maneuver === 'trip' ? 'Trip Attack' : 'Pushing Attack'}: +${die.text}`);
  }
  // PHB: Divine Smite. 2d8 radiant, +1d8 per slot level above 1st, +1d8 vs undead or fiends.
  if (extras.smiteLevel && opt.kind === 'melee' && opt.weaponId) {
    spendSlot(attacker, extras.smiteLevel);
    const m = target.monsterId ? getMonster(target.monsterId) : null;
    const dice = 1 + extras.smiteLevel + (m && (m.type === 'undead' || m.type === 'fiend') ? 1 : 0);
    parts.push({ dice: `${Math.min(dice, 6)}d8`, type: 'radiant' });
    say(s, 'you', `Divine Smite (level ${extras.smiteLevel} slot)!`);
  }
  // Hobgoblin: Martial Advantage.
  if (
    attacker.monsterId &&
    getMonster(attacker.monsterId).traits.some((t) => t.id === 'martial-advantage') &&
    !attacker.turn.sneakAttackUsed
  ) {
    if (
      Object.values(s.combatants).some(
        (o) =>
          o.side === attacker.side &&
          o.id !== attacker.id &&
          conscious(o) &&
          isAdjacent(o.pos, target.pos),
      )
    ) {
      parts.push({ dice: '2d6', type: parts[0]!.type });
      attacker.turn.sneakAttackUsed = true;
    }
  }

  const dmg = rollWeaponDamage(
    ctx,
    parts,
    critical,
    h?.fightingStyle === 'great-weapon-fighting' && opt.twoHanded,
    opt.name,
  );
  sayAll(s, [dmg.log], attacker);
  // PHB: Monk, Deflect Missiles (level 3). Reaction: reduce ranged weapon damage by 1d10 + Dex + monk level [used automatically].
  const monkLvl = classLevel(target, 'monk');
  if (
    monkLvl >= 3 &&
    opt.kind === 'ranged' &&
    !target.reactionUsed &&
    conscious(target) &&
    !isIncapacitated(target.creature)
  ) {
    const cut = ctx.rng.die(10) + abilityModifier(target.creature.abilities.dex) + monkLvl;
    target.reactionUsed = true;
    say(s, 'you', `${target.name} deflects the missile: −${cut} damage`);
    let left = cut;
    for (const inst of dmg.instances) {
      const take = Math.min(inst.amount, left);
      inst.amount -= take;
      left -= take;
    }
  }
  // PHB: Rogue, Uncanny Dodge (level 5). Reaction: halve the damage of a hit [used automatically].
  if (
    classLevel(target, 'rogue') >= 5 &&
    !target.reactionUsed &&
    conscious(target) &&
    !isIncapacitated(target.creature)
  ) {
    target.reactionUsed = true;
    for (const inst of dmg.instances) inst.amount = Math.floor(inst.amount / 2);
    say(s, 'you', `${target.name} rolls with the blow (Uncanny Dodge): half damage`);
  }
  ctx.lastDamage = dealDamage(ctx, target, dmg.instances, {
    critical,
    melee: opt.kind === 'melee',
    attacker,
  });
  wrathOfTheStorm(ctx, attacker, target);
  if (charge)
    chargeAfterHit(ctx, attacker, target, charge.trait, (id) => {
      const bite = attackOptions(attacker).find((o) => o.id === id);
      if (bite) makeAttack(ctx, attacker, target, bite);
    });
  if (maneuver && h && conscious(target) && !target.creature.dead) {
    const size = target.monsterId ? getMonster(target.monsterId).size : 'Medium';
    if (size === 'Huge')
      say(s, 'info', `${target.name} is too big to ${maneuver === 'trip' ? 'trip' : 'push'}`);
    else {
      const dc =
        8 +
        h.proficiencyBonus +
        Math.max(abilityModifier(h.abilities.str), abilityModifier(h.abilities.dex));
      const sv = combatSave(ctx, target, 'str', dc, {
        label: `Str (${maneuver === 'trip' ? 'Trip Attack' : 'Pushing Attack'})`,
      });
      if (!sv.success) {
        if (maneuver === 'trip') {
          target.creature = addCondition(target.creature, { id: 'prone' });
          say(s, 'dmg', `${target.name} is knocked prone`);
        } else pushPull(ctx, attacker, target, 15);
      }
    }
  }
  // DMG: Mace of Disruption. A fiend or undead left with 25 HP or fewer: DC 15 Wis save or destroyed.
  if (disruption && conscious(target) && target.creature.hp <= 25) {
    const save = combatSave(ctx, target, 'wis', 15, { label: 'Wis (Mace of Disruption)' });
    if (!save.success) {
      target.creature = { ...target.creature, hp: 0, dead: true };
      say(s, 'crit', `${target.name} is destroyed by the Mace of Disruption`);
    }
  }
  // PHB: Monk, Stunning Strike (level 5). 1 ki: Con save or stunned until the end of your next turn.
  const sh = heroOf(attacker);
  if (
    extras.stun &&
    sh &&
    opt.kind === 'melee' &&
    classLevel(attacker, 'monk') >= 5 &&
    resourceLeft(sh, 'ki') > 0 &&
    conscious(target)
  ) {
    spendResource(attacker, 'ki');
    const dc = 8 + sh.proficiencyBonus + abilityModifier(sh.abilities.wis);
    const save = combatSave(ctx, target, 'con', dc, {
      against: 'stunned',
      label: 'Con (Stunning Strike)',
    });
    if (!save.success) {
      target.creature = addCondition(target.creature, { id: 'stunned', source: attacker.id });
      target.effects.push({
        id: `cond-stunned-${attacker.id}`,
        name: 'stunned',
        sourceId: attacker.id,
        tag: 'condition',
        data: { condition: 'stunned' },
        expires: { turnOf: attacker.id, when: 'end', round: nextTurnRound(s, attacker.id) },
      });
      say(s, 'dmg', `${target.name} is stunned`);
    }
  }

  // Armor of Agathys: a melee attacker takes cold damage while the temporary HP last.
  const agathys = effectsWith(target, 'agathys')[0];
  if (agathys && opt.kind === 'melee' && target.creature.tempHp > 0) {
    say(s, 'dmg', `Armor of Agathys bites back with cold`);
    dealDamage(ctx, attacker, [{ amount: Number(agathys.data?.cold ?? 5), type: 'cold' }], {
      attacker: target,
    });
  }
  for (const extra of opt.onHit)
    if (!target.creature.dead) applyLeaf(ctx, attacker, target, extra, { dc: undefined });
  return { hit: true, critical };
}

/**
 * Roll damage parts (critical doubles the dice). Great Weapon Fighting rerolls 1s and 2s on
 * the weapon's dice once (PHB).
 */
export function rollWeaponDamage(
  ctx: Ctx,
  parts: DamagePart[],
  critical: boolean,
  gwf: boolean,
  label: string,
) {
  const { rng } = ctx;
  const instances: { amount: number; type: DamageType }[] = [];
  const texts: string[] = [];
  parts.forEach((p, i) => {
    const e = parseDice(p.dice);
    const count = critical ? e.count * 2 : e.count;
    const rolls: number[] = [];
    for (let k = 0; k < count; k++) {
      let v = rng.die(e.sides);
      if (gwf && i === 0 && v <= 2) v = rng.die(e.sides);
      rolls.push(v);
    }
    const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + e.bonus);
    instances.push({ amount: total, type: p.type });
    const dice = count ? `${count}d${e.sides}` : '';
    const bonus = e.bonus ? `${e.bonus > 0 ? ' + ' : ' − '}${Math.abs(e.bonus)}` : '';
    texts.push(
      `${dice}${count ? ` (${rolls.join(', ')})` : ''}${bonus || (!count ? String(e.bonus) : '')} = ${total} ${p.type}`,
    );
  });
  const total = instances.reduce((a, b) => a + b.amount, 0);
  return {
    instances,
    total,
    log: {
      kind: 'damage' as const,
      text: `${label}${critical ? ' (critical: dice doubled)' : ''}: ${texts.join(', ')}`,
    },
  };
}

/**
 * PHB: Tempest Domain, Wrath of the Storm. When a creature within 5 ft hits the cleric, the
 * cleric's reaction deals 2d8 lightning or thunder (Dex save for half) [used automatically].
 */
function wrathOfTheStorm(ctx: Ctx, attacker: Combatant, target: Combatant): void {
  const h = heroOf(target);
  if (!h || !hasSubclass(h, 'cleric', 'tempest') || attacker.side === target.side) return;
  if (target.reactionUsed || !conscious(target) || isIncapacitated(target.creature)) return;
  if (!conscious(attacker) || distanceFeet(attacker.pos, target.pos) > 5) return;
  if (resourceLeft(h, 'wrath-of-the-storm') <= 0) return;
  target.reactionUsed = true;
  spendResource(target, 'wrath-of-the-storm');
  const d = attacker.creature.defenses;
  // Lightning unless the attacker shrugs it off, then thunder [inferred: the cleric's pick].
  const type: DamageType =
    d.resistances.includes('lightning') || d.immunities.includes('lightning')
      ? 'thunder'
      : 'lightning';
  const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
  say(ctx.s, 'you', `${target.name} answers with the Wrath of the Storm (DC ${dc})`);
  const sv = combatSave(ctx, attacker, 'dex', dc, { label: 'Dex (Wrath of the Storm)' });
  const r = roll('2d8', ctx.rng);
  const amount = sv.success ? Math.floor(r.total / 2) : r.total;
  say(
    ctx.s,
    'dmg',
    `Wrath of the Storm: ${r.text} ${type}${sv.success ? ` (halved: ${amount})` : ''}`,
  );
  dealDamage(ctx, attacker, [{ amount, type }], { attacker: target });
  if (amount > 0) thunderbolt(ctx, target, attacker, type);
}
