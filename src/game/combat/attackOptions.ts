// The attacks a combatant can make, and whether one can reach its target (split from attacks.ts).
import { weapons } from '../../data';
import type { Effect, LeafEffect } from '../../data/schemas/common';
import { getMonster } from '../creatures';
import { getItem, magicWeaponBase } from '../items';
import {
  abilityModifier,
  hasCondition,
  isIncapacitated,
  parseDice,
  type DamagePart,
  type DamageType,
} from '../../rules';
import { heroOf, type Ctx } from './core';
import { conscious, distanceFeet, hasLineOfSight } from './grid';
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
  /** Only against a prone creature (a giant elk's Hooves). */
  onlyVsProne?: boolean;
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Every attack a combatant can make with the Attack action. */
export function attackOptions(c: Combatant): AttackOption[] {
  if (c.wildShape) return monsterAttacks(c.wildShape.monsterId);
  const h = heroOf(c);
  // PHB: Find Familiar. A familiar can't attack (a Pact of the Chain familiar can).
  if (c.pet && !c.pet.canAttack) return [];
  // PHB: Ranger's Companion. The ranger's proficiency bonus is added to its attack and damage rolls.
  if (!h && c.monsterId && c.pet?.bonus) return withBonus(monsterAttacks(c.monsterId), c.pet.bonus);
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
    const w = magicWeaponBase(item, h);
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
    // PHB: Monk, Ki-Empowered Strikes (level 6). Unarmed strikes count as magical.
    magical: monk && h.level >= 6,
  });
  return opts;
}

/** Add `b` to each attack's to-hit and to its first damage roll ("2d4+2" → "2d4+4"). */
function withBonus(opts: AttackOption[], b: number): AttackOption[] {
  return opts.map((o) => ({
    ...o,
    toHit: o.toHit + b,
    damage: o.damage.map((d, i) => {
      if (i > 0) return d;
      const e = parseDice(d.dice);
      const bonus = e.bonus + b;
      const sign = bonus >= 0 ? '+' : '-';
      return {
        ...d,
        dice: e.count ? `${e.count}d${e.sides}${sign}${Math.abs(bonus)}` : String(bonus),
      };
    }),
  }));
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
        ...(a.onlyVsProne ? { onlyVsProne: true } : {}),
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
  // SRD: Giant Elk, Hooves. Only against a prone creature.
  if (opt.onlyVsProne && !hasCondition(target.creature, 'prone'))
    return 'only against a prone creature';
  return null;
}
