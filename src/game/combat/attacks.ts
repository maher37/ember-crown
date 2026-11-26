import { protectedFrom } from './wards';
import { getMonster } from '../creatures';
import { hasSubclass, resourceLeft } from '../hero';
import { nextTurnRound } from './leaves';
import {
  abilityModifier,
  attackRoll,
  hasCondition,
  isIncapacitated,
  roll,
  type DamagePart,
} from '../../rules';
import {
  breakInvisibility,
  classLevel,
  currentAc,
  diceBonuses,
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
import { conscious, coverBetween, distanceFeet, isAdjacent } from './grid';
import type { Combatant } from './types';
import { fx, weaponShot } from './fx';

import { attackBlocked, attackOptions, type AttackOption } from './attackOptions';
import { applyHit } from './attackHit';

// The pieces split into their own files, re-exported so other files import from here as before.
export { attackBlocked, attackOptions, monsterAttacks, type AttackOption } from './attackOptions';
export { applyHit, rollWeaponDamage } from './attackHit';

export interface AttackExtras {
  /** Divine Smite: spend a slot of this level if the attack hits. */
  smiteLevel?: number;
  /** An off-hand (two-weapon) attack: no ability modifier to damage without the style. */
  offhand?: boolean;
  /** An opportunity attack (reaction). */
  opportunity?: boolean;
  /** Only roll the attack; a reaction prompt (Shield) may change the AC before damage. */
  rollOnly?: boolean;
  /** Extra reasons for disadvantage (e.g. the Protection fighting style). */
  disadvantage?: string[];
  /** Monk: Stunning Strike on a melee hit (1 ki). */
  stun?: boolean;
  /** Battle Master: a maneuver on a hit (1 superiority die). */
  maneuver?: 'trip' | 'push';
  /** Extra damage dice already decided (a Riposte's superiority die). */
  extraDamage?: DamagePart;
}

/** One attack, start to finish: roll, then damage and on-hit effects. Returns whether it hit. */
export function makeAttack(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  opt: AttackOption,
  extras: AttackExtras = {},
): { hit: boolean; critical: boolean; total: number; natural: number } {
  // M11: the shot is recorded before its damage so the screen plays them in order; whether it
  // hit is filled in once the roll is known.
  const shot = fx(ctx.s, {
    type: 'shot',
    fromId: attacker.id,
    toId: target.id,
    style: weaponShot(opt.name, opt.kind),
    hit: false as boolean,
    damageType: opt.damage[0]?.type,
  });
  const r = resolveAttack(ctx, attacker, target, opt, extras);
  shot.hit = r.hit;
  return r;
}

function resolveAttack(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  opt: AttackOption,
  extras: AttackExtras,
): { hit: boolean; critical: boolean; total: number; natural: number } {
  const { s, rng } = ctx;
  const adv: string[] = [];
  const dis: string[] = [...(extras.disadvantage ?? [])];
  const d = distanceFeet(attacker.pos, target.pos);

  // PHB: Ranged Attacks in Close Combat, and long range.
  if (opt.kind === 'ranged') {
    const nearHostile = Object.values(s.combatants).some(
      (o) =>
        o.side !== attacker.side &&
        conscious(o) &&
        !isIncapacitated(o.creature) &&
        isAdjacent(o.pos, attacker.pos),
    );
    if (nearHostile) dis.push('hostile within 5 ft');
    if (opt.range && d > opt.range[0]) dis.push('long range');
  }
  if (hasEffect(target, 'dodge') && !isIncapacitated(target.creature)) dis.push('target Dodging');
  if (hasEffect(target, 'hidden')) dis.push('target hidden');
  // PHB: Blur. Attacks against a blurred creature have disadvantage.
  if (hasEffect(target, 'blurred')) dis.push('Blur');
  // PHB: Protection from Evil and Good. Warded types attack the target with disadvantage.
  if (protectedFrom(target, attacker)) dis.push('Protection from Evil and Good');
  if (hasEffect(attacker, 'hidden')) adv.push('unseen attacker');
  if (hasEffect(target, 'outlined')) adv.push('Faerie Fire');
  if (hasEffect(target, 'reckless')) adv.push('target attacked recklessly');
  if (hasEffect(attacker, 'reckless') && opt.kind === 'melee' && opt.ability === 'str')
    adv.push('Reckless Attack');
  const guided = effectsWith(target, 'advantage-next-attack-against')[0];
  if (guided) adv.push('Guiding Bolt');
  const mocked = effectsWith(attacker, 'disadvantage-next-attack')[0];
  if (mocked) dis.push('Vicious Mockery');
  const helped = effectsWith(attacker, 'help')[0];
  if (helped) adv.push('Help');
  // PHB: Totem Warrior (Wolf). Allies of a raging wolf-totem barbarian have advantage on melee
  // attacks against enemies within 5 ft of the barbarian.
  if (
    opt.kind === 'melee' &&
    Object.values(s.combatants).some(
      (o) =>
        o.id !== attacker.id &&
        o.side === attacker.side &&
        isSub(o, 'barbarian', 'totem-wolf', 3) &&
        hasEffect(o, 'rage') &&
        conscious(o) &&
        isAdjacent(o.pos, target.pos),
    )
  )
    adv.push('Wolf totem');
  // PHB: Vengeance, Vow of Enmity (advantage against the sworn foe).
  if (attacker.effects.some((e) => e.tag === 'vow-of-enmity' && e.data?.targetId === target.id))
    adv.push('Vow of Enmity');
  // PHB: Great Old One, Entropic Ward: advantage on the next attack after the ward made a foe miss.
  const entropic = attacker.effects.find(
    (e) => e.tag === 'entropic-edge' && e.data?.targetId === target.id,
  );
  if (entropic) adv.push('Entropic Ward');
  // PHB: Assassin, Assassinate. Advantage against a creature that hasn't taken a turn yet.
  if (isSub(attacker, 'rogue', 'assassin', 3) && notActedYet(s, target)) adv.push('Assassinate');
  // MM: Pack Tactics.
  if (
    attacker.monsterId &&
    getMonster(attacker.wildShape?.monsterId ?? attacker.monsterId).traits.some(
      (t) => t.id === 'pack-tactics',
    )
  ) {
    if (
      Object.values(s.combatants).some(
        (o) =>
          o.side === attacker.side &&
          o.id !== attacker.id &&
          conscious(o) &&
          isAdjacent(o.pos, target.pos),
      )
    )
      adv.push('Pack Tactics');
  }
  if (
    attacker.wildShape &&
    attacker.side === 'party' &&
    Object.values(s.combatants).some(
      (o) =>
        o.side === 'party' && o.id !== attacker.id && conscious(o) && isAdjacent(o.pos, target.pos),
    )
  )
    adv.push('Pack Tactics');

  // PHB: Mirror Image. The attack may hit a duplicate instead (d20: 6+ with 3, 8+ with 2, 11+ with 1).
  const images = effectsWith(target, 'mirror-image')[0];
  if (images && Number(images.data?.images) > 0) {
    const n = Number(images.data!.images);
    const d = rng.die(20);
    if (d >= [0, 11, 8, 6][n]!) {
      const dupAc = 10 + abilityModifier(target.creature.abilities.dex);
      const r0 = rng.die(20) + opt.toHit;
      say(
        s,
        attacker.side === 'party' ? 'you' : 'foe',
        `${attacker.name} targets a mirror image of ${target.name} (d20 ${d}): ${r0} vs AC ${dupAc} → ${r0 >= dupAc ? 'the image vanishes' : 'MISS'}`,
      );
      if (r0 >= dupAc) images.data = { ...images.data, images: n - 1 };
      attacker.effects = attacker.effects.filter((e) => e.tag !== 'hidden');
      breakInvisibility(s, attacker);
      return { hit: false, critical: false, total: r0, natural: 0 };
    }
  }
  // PHB: Light Domain, Warding Flare; Improved Flare (cleric 6) also shields allies [used automatically].
  if (!dis.length && attacker.side !== target.side) {
    const flarer = reactingCleric(
      ctx,
      target.side,
      attacker,
      'light',
      'warding-flare',
      (o) => o.id === target.id || classLevel(o, 'cleric') >= 6,
    );
    if (flarer) {
      flarer.reactionUsed = true;
      spendResource(flarer, 'warding-flare');
      dis.push('Warding Flare');
      say(s, 'you', `${flarer.name} flares with light: ${attacker.name} is dazzled (disadvantage)`);
    }
  }
  // PHB: Great Old One, Entropic Ward (warlock 6). Reaction: disadvantage on an attack against you
  // [used automatically].
  let ward = false;
  if (
    !dis.length &&
    attacker.side !== target.side &&
    isSub(target, 'warlock', 'great-old-one', 6) &&
    !target.reactionUsed &&
    canReact(target) &&
    resourceLeft(heroOf(target)!, 'entropic-ward') > 0
  ) {
    target.reactionUsed = true;
    spendResource(target, 'entropic-ward');
    dis.push('Entropic Ward');
    ward = true;
    say(s, 'you', `${target.name} twists fate with an Entropic Ward`);
  }
  const cover = coverBetween(s, attacker.pos, target.pos, [attacker.id, target.id]);
  // PHB: Champion, Improved Critical (fighter 3).
  const critRange = isSub(attacker, 'fighter', 'champion', 3) ? 19 : 20;
  const shown = { ...target.creature, ac: currentAc(target) };
  const r = attackRoll(attacker.creature, shown, rng, {
    attackBonus: opt.toHit,
    melee: opt.kind === 'melee',
    within5ft: d <= 5,
    critRange,
    cover: cover === 'total' ? 'total' : cover,
    advantage: adv,
    disadvantage: dis,
    diceBonuses: diceBonuses(attacker, 'attack', rng),
    label: opt.name,
  });
  // One-shot effects are used up by the attack.
  for (const e of [guided, mocked, helped])
    if (e) removeEffect(e === guided ? target : attacker, e);
  if (entropic) removeEffect(attacker, entropic);
  attacker.effects = attacker.effects.filter((e) => e.tag !== 'hidden');
  breakInvisibility(s, attacker);

  let hit = r.hit;
  let total = r.total ?? 0;
  // Bardic Inspiration: used automatically when it turns a miss into a hit [inferred].
  if (
    !hit &&
    r.allowed &&
    r.roll!.natural !== 1 &&
    attacker.inspiration &&
    total + attacker.inspiration >= r.targetAc
  ) {
    const die = roll(`1d${attacker.inspiration}`, rng);
    attacker.inspiration = undefined;
    if (total + die.total >= r.targetAc) {
      hit = true;
      total += die.total;
      sayAll(s, [r.log], attacker);
      say(
        s,
        attacker.side === 'party' ? 'you' : 'foe',
        `Bardic Inspiration: ${die.text} → now ${total}, a HIT`,
      );
    } else sayAll(s, [r.log], attacker);
  } else sayAll(s, [r.log], attacker);
  const natural = r.roll?.natural ?? 0;
  // PHB: War Domain, Guided Strike and War God's Blessing (cleric 6): +10 to an attack roll, chosen
  // after seeing the roll. Used only when it turns a miss into a hit [inferred].
  if (!hit && r.allowed && natural !== 1 && total + 10 >= r.targetAc) {
    const ready = effectsWith(attacker, 'guided-strike')[0];
    const self = heroOf(attacker);
    const guide =
      ready && self && resourceLeft(self, 'channel-divinity') > 0
        ? attacker
        : reactingCleric(
            ctx,
            attacker.side,
            attacker,
            'war',
            'channel-divinity',
            (o) => classLevel(o, 'cleric') >= 6,
          );
    if (guide) {
      if (guide === attacker) removeEffect(attacker, ready!);
      else guide.reactionUsed = true;
      spendResource(guide, 'channel-divinity');
      hit = true;
      total += 10;
      say(
        s,
        attacker.side === 'party' ? 'you' : 'foe',
        guide === attacker
          ? `Guided Strike: +10 → now ${total}, a HIT`
          : `${guide.name} calls War God's Blessing on ${attacker.name}: +10 → now ${total}, a HIT`,
      );
    }
  }
  // PHB: Battle Master, Precision Attack. Add a superiority die to an attack roll that missed
  // [used automatically, only when it turns the miss into a hit].
  if (
    !hit &&
    r.allowed &&
    natural !== 1 &&
    isSub(attacker, 'fighter', 'battle-master', 3) &&
    resourceLeft(heroOf(attacker)!, 'superiority-dice') > 0 &&
    total + 8 >= r.targetAc
  ) {
    const die = roll('1d8', rng);
    spendResource(attacker, 'superiority-dice');
    if (total + die.total >= r.targetAc) {
      hit = true;
      total += die.total;
      say(s, 'you', `Precision Attack: ${die.text} → now ${total}, a HIT`);
    } else say(s, 'you', `Precision Attack: ${die.text} → ${total + die.total}, still a miss`);
  }
  // PHB: Valor bard, Combat Inspiration. An inspired creature adds its die to AC against a hit
  // [used automatically when the hit was close enough for the die to matter].
  if (
    hit &&
    !r.critical &&
    target.inspiration &&
    total < currentAc(target) + target.inspiration &&
    Object.values(s.combatants).some(
      (o) => o.side === target.side && isSub(o, 'bard', 'valor', 3) && !o.creature.dead,
    )
  ) {
    const die = roll(`1d${target.inspiration}`, rng);
    target.inspiration = undefined;
    const ac = currentAc(target) + die.total;
    say(
      s,
      'you',
      `${target.name} uses Combat Inspiration: ${die.text} → AC ${ac}${total < ac ? ', a MISS' : ', still a hit'}`,
    );
    if (total < ac) hit = false;
  }
  // PHB: Assassin, Assassinate. Any hit against a surprised creature is a critical hit.
  const assassinCrit =
    hit && !!target.surprised && isSub(attacker, 'rogue', 'assassin', 3) && !r.critical;
  if (assassinCrit) say(s, 'you', `Assassinate: a strike from nowhere, a CRITICAL HIT`);
  // PHB: Great Old One, Entropic Ward: a miss gives the warlock advantage on their next attack.
  if (ward && !hit)
    target.effects.push({
      id: 'entropic-edge',
      name: 'Entropic Ward',
      sourceId: target.id,
      tag: 'entropic-edge',
      data: { targetId: attacker.id },
      expires: { turnOf: target.id, when: 'end', round: nextTurnRound(s, target.id) },
    });
  // PHB: Battle Master, Riposte. When a creature misses you with a melee attack, use your reaction
  // to attack it, adding a superiority die to the damage [used automatically].
  if (
    !hit &&
    opt.kind === 'melee' &&
    attacker.side !== target.side &&
    isSub(target, 'fighter', 'battle-master', 3) &&
    !target.reactionUsed &&
    canReact(target) &&
    conscious(attacker) &&
    resourceLeft(heroOf(target)!, 'superiority-dice') > 0
  ) {
    const back = attackOptions(target).find(
      (o) => o.kind === 'melee' && !o.unarmed && !attackBlocked(ctx, target, attacker, o),
    );
    if (back) {
      target.reactionUsed = true;
      spendResource(target, 'superiority-dice');
      say(s, 'you', `${target.name} ripostes!`);
      fx(s, { type: 'banner', text: 'Riposte!', side: target.side });
      const die = roll('1d8', rng);
      makeAttack(ctx, target, attacker, back, {
        extraDamage: { dice: String(die.total), type: back.damage[0]!.type },
      });
    }
  }
  // A spellcasting monster that knows Shield (Maelis, mages) raises it against a hit (PHB: Shield)
  // [used automatically].
  if (hit && !r.critical && target.monsterId && !target.reactionUsed && conscious(target)) {
    const sc = getMonster(target.monsterId).spellcasting;
    if (
      sc &&
      Object.values(sc.spells).flat().includes('shield') &&
      (target.monsterSlots?.['1'] ?? 0) > 0 &&
      total < currentAc(target) + 5
    ) {
      target.reactionUsed = true;
      spendSlot(target, 1);
      fx(s, { type: 'banner', text: 'Shield!', side: target.side });
      target.effects.push({
        id: 'shield',
        name: 'Shield',
        sourceId: target.id,
        mod: { ac: 5 },
        expires: { turnOf: target.id, when: 'start', round: nextTurnRound(s, target.id) },
      });
      say(
        s,
        'foe',
        `${target.name} casts Shield (+5 AC): ${total} vs AC ${currentAc(target)} → MISS`,
      );
      return { hit: false, critical: false, total, natural };
    }
  }
  // MM: Parry (bandit captain). Reaction: +2 AC against one melee hit it can see.
  if (
    hit &&
    !r.critical &&
    opt.kind === 'melee' &&
    target.monsterId &&
    !target.reactionUsed &&
    conscious(target)
  ) {
    const parry = getMonster(target.monsterId).actions.find((a) => a.id === 'parry');
    if (parry && total < currentAc(target) + 2) {
      target.reactionUsed = true;
      fx(s, { type: 'banner', text: 'Parry!', side: target.side });
      say(
        s,
        'foe',
        `${target.name} parries (+2 AC): ${total} vs AC ${currentAc(target) + 2} → MISS`,
      );
      return { hit: false, critical: false, total, natural };
    }
  }
  const critical = (r.critical || assassinCrit) && hit;
  if (!hit || extras.rollOnly) return { hit, critical, total, natural };
  return { ...applyHit(ctx, attacker, target, opt, critical, extras), total, natural };
}

export const isTarget = (c: Combatant) => conscious(c) && !hasCondition(c.creature, 'unconscious');

/**
 * A cleric of this domain on `side` who can still react and has a use of `resource` left, within
 * 30 ft of `near` (the domain reactions all need the creature in sight within 30 ft).
 */
function reactingCleric(
  ctx: Ctx,
  side: Combatant['side'],
  near: Combatant,
  domain: string,
  resource: string,
  ok: (o: Combatant) => boolean,
): Combatant | undefined {
  return Object.values(ctx.s.combatants).find((o) => {
    const h = heroOf(o);
    return (
      o.side === side &&
      !!h &&
      hasSubclass(h, 'cleric', domain) &&
      !o.reactionUsed &&
      conscious(o) &&
      !isIncapacitated(o.creature) &&
      distanceFeet(o.pos, near.pos) <= 30 &&
      resourceLeft(h, resource) > 0 &&
      ok(o)
    );
  });
}

/** Hasn't taken a turn yet this fight (round 1, later in the order, or surprised). */
function notActedYet(s: Ctx['s'], c: Combatant): boolean {
  if (s.round > 1) return false;
  return !!c.surprised || s.order.indexOf(c.id) > s.turnIndex;
}

/** Can take a reaction right now (conscious, not incapacitated, not stopped from reacting). */
function canReact(c: Combatant): boolean {
  return conscious(c) && !isIncapacitated(c.creature) && !hasEffect(c, 'no-reactions');
}
