import { magicItems, weapons } from '../data';
import type { MagicItem } from '../data/schemas/item';
import { computeAc, type Hero } from './hero';

/** DMG: Attunement. A creature can be attuned to no more than three magic items at a time. */
export const MAX_ATTUNED = 3;

export const getItem = (id: string): MagicItem => {
  const it = magicItems.find((x) => x.id === id);
  if (!it) throw new Error(`Unknown item "${id}"`);
  return it;
};

export type ItemModTarget = 'ac' | 'save' | 'check' | 'attack' | 'damage';

/** Flat bonuses from everything a hero has equipped (weapon bonuses only count for that weapon). */
export function itemMods(
  hero: Pick<Hero, 'equipment'>,
  opts: { includeWeapons?: boolean } = {},
): Record<ItemModTarget, number> {
  const out: Record<ItemModTarget, number> = { ac: 0, save: 0, check: 0, attack: 0, damage: 0 };
  for (const id of hero.equipment.magic ?? []) {
    const it = getItem(id);
    if (it.kind === 'weapon' && !opts.includeWeapons) continue;
    for (const e of it.effects)
      if (e.type === 'modifier' && e.target in out && typeof e.value === 'number')
        out[e.target as ItemModTarget] += e.value;
  }
  return out;
}

export const hasItem = (hero: Pick<Hero, 'equipment'>, id: string) =>
  (hero.equipment.magic ?? []).includes(id);

/** AC with armor, class features and items (Cloak of Protection, Ring of Protection...). */
export function heroAc(hero: Hero): number {
  // A magic shield (Kell's Shield, the Shield of the Morninglord) is a normal +2 shield too,
  // unless the hero already carries one [inferred: it replaces the plain shield].
  const magicShield = (hero.equipment.magic ?? []).some((id) => getItem(id).kind === 'shield');
  return (
    computeAc(hero.classId, hero.abilities, hero.equipment, hero.fightingStyle) +
    itemMods(hero).ac +
    (magicShield && !hero.equipment.shield ? 2 : 0)
  );
}

/** An item's special effect ids (e.g. 'initiative-advantage'). */
export const hasSpecial = (hero: Pick<Hero, 'equipment'>, special: string) =>
  (hero.equipment.magic ?? []).some((id) =>
    getItem(id).effects.some((e) => e.type === 'special' && e.id === special),
  );

export const attunedCount = (hero: Pick<Hero, 'equipment'>) =>
  (hero.equipment.magic ?? []).filter((id) => getItem(id).attunement).length;

/** The weapon a magic weapon is based on (Deepdelver → warhammer). */
export function magicWeaponBase(item: MagicItem) {
  if (item.kind !== 'weapon' || typeof item.baseWeapon !== 'string' || item.baseWeapon === 'any')
    return null;
  return weapons.find((w) => w.id === item.baseWeapon) ?? null;
}

/** Can this item be worn or wielded (as opposed to drunk)? */
export const isEquippable = (item: MagicItem) => !item.consumable;

export interface EquipResult {
  hero: Hero;
  error?: string;
}

export function equip(hero: Hero, id: string): EquipResult {
  const it = getItem(id);
  if (!isEquippable(it)) return { hero, error: `${it.name} can't be equipped.` };
  if (hasItem(hero, id)) return { hero, error: `${hero.name} already has ${it.name}.` };
  if (
    it.kind === 'shield' &&
    (hero.equipment.magic ?? []).some((x) => getItem(x).kind === 'shield')
  )
    return { hero, error: `${hero.name} can only carry one magic shield.` };
  if (it.attunement && attunedCount(hero) >= MAX_ATTUNED)
    return { hero, error: `${hero.name} is already attuned to three items.` };
  if (
    it.attunement === 'spellcaster' &&
    !['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'].includes(
      hero.classId,
    )
  )
    return { hero, error: `${it.name} needs a spellcaster.` };
  const next = {
    ...hero,
    equipment: { ...hero.equipment, magic: [...(hero.equipment.magic ?? []), id] },
  };
  return { hero: { ...next, ac: heroAc(next) } };
}

export function unequip(hero: Hero, id: string): Hero {
  const next = {
    ...hero,
    equipment: { ...hero.equipment, magic: (hero.equipment.magic ?? []).filter((x) => x !== id) },
  };
  return { ...next, ac: heroAc(next) };
}
