import { weapons } from '../../data';
import type { Effect, LeafEffect } from '../../data/schemas/common';
import { getMonster } from '../creatures';
import { getItem, magicWeaponBase } from '../items';
import { resourceLeft } from '../hero';
import { nextTurnRound } from './leaves';
import {
  abilityModifier,
  addCondition,
  attackRoll,
  hasCondition,
  isIncapacitated,
  parseDice,
  roll,
  type DamagePart,
  type DamageType,
} from '../../rules';
import {
  classLevel,
  combatSave,
  currentAc,
  dealDamage,
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
} from './core';
import { conscious, coverBetween, distanceFeet, hasLineOfSight, isAdjacent } from './grid';
import { applyLeaf } from './leaves';
import type { Combatant } from './types';

export interface AttackOption {
  id: string;
  name: string;
  kind: 'melee' | 'ranged';
  toHit: number;
  /** Melee reach in feet. */
  reach: number;
  /** Normal and long range for ranged / thrown attacks. */
  range?: [number, number];
  damage: DamagePart[];
  /** Extra effects on a hit (monster poison, prone...). */
  onHit: (LeafEffect | Extract<Effect, { type: 'save' }>)[];
  finesse: boolean;
  light: boolean;
  /** Two-handed, or a versatile weapon used in two hands (Great Weapon Fighting). */
  twoHanded: boolean;
  ability: 'str' | 'dex' | 'none';
  weaponId?: string;
  /** Counts as a monk weapon or unarmed strike (Martial Arts). */
  monk: boolean;
  unarmed: boolean;
  /** Overcomes resistance to nonmagical weapons (shadows, wights...). */
  magical?: boolean;
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Every attack a combatant can make with the Attack action. */
export function attackOptions(c: Combatant): AttackOption[] {
  if (c.wildShape) return monsterAttacks(c.wildShape.monsterId);
  const h = heroOf(c);
  if (!h) return c.monsterId ? monsterAttacks(c.monsterId) : [];
  const str = abilityModifier(h.abilities.str);
  const dex = abilityModifier(h.abilities.dex);
  const monk = h.classId === 'monk';
  const martialDie = monk ? (h.level >= 5 ? 6 : 4) : 0;
  const style = h.fightingStyle;
  const opts: AttackOption[] = [];
  const meleeCount = h.equipment.weapons.filter(
    (id) => weapons.find((w) => w.id === id)?.kind === 'melee',
  ).length;
  for (const id of [...new Set(h.equipment.weapons)]) {
    const w = weapons.find((x) => x.id === id);
    if (!w) continue;
    const finesse = w.properties.includes('finesse');
    const isMonkWeapon =
      monk &&
      (w.id === 'shortsword' ||
        (w.category === 'simple' &&
          w.kind === 'melee' &&
          !w.properties.includes('two-handed') &&
          !w.properties.includes('heavy')));
    const useDex = w.kind === 'ranged' || ((finesse || isMonkWeapon) && dex > str);
    // PHB: Shillelagh. A club or quarterstaff uses Wisdom and a d8, and counts as magical.
    const shillelagh =
      (w.id === 'club' || w.id === 'quarterstaff') &&
      !!c.effects?.some((e) => e.tag === 'shillelagh');
    const wis = abilityModifier(h.abilities.wis);
    const mod = shillelagh ? Math.max(wis, useDex ? dex : str) : useDex ? dex : str;
    // Versatile weapons are used two-handed when there is no shield and only one melee weapon [inferred].
    const twoHands =
      w.properties.includes('two-handed') ||
      (!!w.versatile && !h.equipment.shield && meleeCount === 1);
    let die = twoHands && w.versatile ? w.versatile : w.damage.dice;
    if (isMonkWeapon && parseDice(die).sides < martialDie) die = `1d${martialDie}`;
    if (shillelagh && parseDice(die).sides < 8) die = '1d8';
    // Fighting styles: Archery +2 to hit with ranged weapons; Dueling +2 damage one-handed.
    const archery = style === 'archery' && w.kind === 'ranged' ? 2 : 0;
    const dueling = style === 'dueling' && w.kind === 'melee' && !twoHands ? 2 : 0;
    const base: AttackOption = {
      id: w.id,
      name: w.name,
      kind: w.kind,
      toHit: mod + h.proficiencyBonus + archery,
      reach: w.properties.includes('reach') ? 10 : 5,
      range: w.kind === 'ranged' ? w.range : undefined,
      damage: [
        {
          dice: `${die}${mod + dueling ? fmt(mod + dueling) : ''}`,
          type: w.damage.type as DamageType,
        },
      ],
      onHit: [],
      finesse,
      light: w.properties.includes('light'),
      twoHanded: twoHands && w.kind === 'melee',
      ability: useDex ? 'dex' : 'str',
      weaponId: w.id,
      monk: isMonkWeapon,
      unarmed: false,
      ...(shillelagh ? { magical: true, name: `${w.name} (Shillelagh)` } : {}),
    };
    opts.push(base);
    if (w.kind === 'melee' && w.properties.includes('thrown') && w.range) {
      opts.push({
        ...base,
        id: `${w.id}-thrown`,
        name: `${w.name} (thrown)`,
        kind: 'ranged',
        range: w.range,
        toHit: mod + h.proficiencyBonus + (style === 'archery' ? 0 : 0),
        twoHanded: false,
        damage: [
          { dice: `${w.damage.dice}${mod ? fmt(mod) : ''}`, type: w.damage.type as DamageType },
        ],
      });
    }
  }
  // Magic weapons (Deepdelver: +1 warhammer). DMG: +1 Weapon.
  for (const id of h.equipment.magic ?? []) {
    const item = getItem(id);
    const w = magicWeaponBase(item);
    if (!w) continue;
    const bonus = item.effects.reduce(
      (n, e) =>
        n +
        (e.type === 'modifier' && e.target === 'attack' && typeof e.value === 'number'
          ? e.value
          : 0),
      0,
    );
    const finesse = w.properties.includes('finesse');
    const useDex = w.kind === 'ranged' || (finesse && dex > str);
    const mod = useDex ? dex : str;
    const twoHands =
      w.properties.includes('two-handed') ||
      (!!w.versatile && !h.equipment.shield && meleeCount === 0);
    const die = twoHands && w.versatile ? w.versatile : w.damage.dice;
    const dueling = style === 'dueling' && w.kind === 'melee' && !twoHands ? 2 : 0;
    opts.unshift({
      id: item.id,
      name: item.name,
      kind: w.kind,
      toHit:
        mod + h.proficiencyBonus + bonus + (style === 'archery' && w.kind === 'ranged' ? 2 : 0),
      reach: w.properties.includes('reach') ? 10 : 5,
      range: w.kind === 'ranged' ? w.range : undefined,
      damage: [{ dice: `${die}${fmt(mod + bonus + dueling)}`, type: w.damage.type as DamageType }],
      onHit: [],
      finesse,
      light: w.properties.includes('light'),
      twoHanded: twoHands && w.kind === 'melee',
      ability: useDex ? 'dex' : 'str',
      weaponId: item.id,
      monk: false,
      unarmed: false,
      magical: true,
    });
  }
  // PHB: Pact of the Blade. A summoned pact weapon (we use a longsword) that counts as magical.
  if (h.choices['pact-boon']?.includes('pact-of-the-blade')) {
    const mod = str;
    const twoHands = !h.equipment.shield;
    opts.unshift({
      id: 'pact-blade',
      name: 'Pact blade',
      kind: 'melee',
      toHit: mod + h.proficiencyBonus,
      reach: 5,
      damage: [{ dice: `${twoHands ? '1d10' : '1d8'}${mod ? fmt(mod) : ''}`, type: 'slashing' }],
      onHit: [],
      finesse: false,
      light: false,
      twoHanded: twoHands,
      ability: 'str',
      weaponId: 'longsword',
      monk: false,
      unarmed: false,
      magical: true,
    });
  }
  // PHB: Unarmed Strike: 1 + Str bludgeoning. Monks use Dex and the martial arts die.
  const uMod = monk ? Math.max(str, dex) : str;
  opts.push({
    id: 'unarmed',
    name: 'Unarmed strike',
    kind: 'melee',
    toHit: uMod + h.proficiencyBonus,
    reach: 5,
    damage: [
      {
        dice: monk ? `1d${martialDie}${uMod ? fmt(uMod) : ''}` : String(Math.max(1, 1 + str)),
        type: 'bludgeoning',
      },
    ],
    onHit: [],
    finesse: false,
    light: false,
    twoHanded: false,
    ability: monk && dex > str ? 'dex' : 'str',
    monk,
    unarmed: true,
  });
  return opts;
}

export function monsterAttacks(monsterId: string): AttackOption[] {
  const m = getMonster(monsterId);
  const out: AttackOption[] = [];
  for (const a of m.actions)
    for (const e of a.effects as Effect[]) {
      if (e.type !== 'attack') continue;
      const dmg = e.onHit.flatMap((x) =>
        x.type === 'damage' ? [{ dice: x.dice, type: x.damageType as DamageType }] : [],
      );
      out.push({
        id: e.kind === 'ranged' && out.some((o) => o.id === a.id) ? `${a.id}-thrown` : a.id,
        name: e.kind === 'ranged' && out.some((o) => o.id === a.id) ? `${a.name} (thrown)` : a.name,
        kind: e.kind,
        toHit: e.toHit ?? 0,
        reach: e.reach ?? 5,
        range: e.range,
        damage: dmg,
        onHit: e.onHit.filter((x) => x.type !== 'damage'),
        finesse: false,
        light: false,
        twoHanded: false,
        ability: 'none',
        monk: false,
        unarmed: false,
      });
    }
  return out;
}

/** Can `attacker` use `opt` against `target` from where it stands? Null if yes, else why not. */
export function attackBlocked(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  opt: AttackOption,
): string | null {
  const d = distanceFeet(attacker.pos, target.pos);
  if (!conscious(attacker) || isIncapacitated(attacker.creature))
    return `${attacker.name} can't act`;
  if (opt.kind === 'melee' && d > opt.reach) return 'out of reach';
  if (opt.kind === 'ranged' && opt.range && d > opt.range[1]) return 'out of range';
  if (!hasLineOfSight(ctx.s.map, attacker.pos, target.pos)) return 'no line of sight';
  if (target.gone || target.creature.dead) return 'not a valid target';
  return null;
}

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
}

/** One attack, start to finish: roll, then damage and on-hit effects. Returns whether it hit. */
export function makeAttack(
  ctx: Ctx,
  attacker: Combatant,
  target: Combatant,
  opt: AttackOption,
  extras: AttackExtras = {},
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
      return { hit: false, critical: false, total: r0, natural: 0 };
    }
  }
  const cover = coverBetween(s, attacker.pos, target.pos, [attacker.id, target.id]);
  const h = heroOf(attacker);
  const critRange = h && h.classId === 'fighter' && h.level >= 3 ? 19 : 20;
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
  attacker.effects = attacker.effects.filter((e) => e.tag !== 'hidden');

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
      say(
        s,
        'foe',
        `${target.name} parries (+2 AC): ${total} vs AC ${currentAc(target) + 2} → MISS`,
      );
      return { hit: false, critical: false, total, natural };
    }
  }
  if (!hit || extras.rollOnly) return { hit, critical: r.critical && hit, total, natural };
  return { ...applyHit(ctx, attacker, target, opt, r.critical, extras), total, natural };
}

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
    if (e.tag === 'hunters-mark-target' && opt.weaponId)
      parts.push({ dice: '1d6', type: parts[0]!.type });
  }
  if (hasEffect(attacker, 'divine-favor') && opt.weaponId)
    parts.push({ dice: '1d4', type: 'radiant' });
  // DMG: Mace of Disruption. +2d6 radiant against fiends and undead.
  const tm = target.monsterId ? getMonster(target.monsterId) : undefined;
  const disruption =
    opt.id === 'mace-of-disruption' && !!tm && (tm.type === 'undead' || tm.type === 'fiend');
  if (disruption) parts.push({ dice: '2d6', type: 'radiant' });
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

export const isTarget = (c: Combatant) => conscious(c) && !hasCondition(c.creature, 'unconscious');
