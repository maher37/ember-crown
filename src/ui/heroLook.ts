// How a hero looks: the portrait plus what they're wearing.
import type { Hero } from '../game/hero';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import type { ArmorLook, PortraitGear, PortraitKind, Stature } from './Portrait';

const ARMOR_LOOK: Record<string, ArmorLook> = {
  padded: 'padded',
  leather: 'leather',
  'studded-leather': 'studded',
  hide: 'hide',
  'chain-shirt': 'chain',
  'ring-mail': 'chain',
  'chain-mail': 'chain',
  'scale-mail': 'scale',
  breastplate: 'breastplate',
  'half-plate': 'half-plate',
  splint: 'plate',
  plate: 'plate',
};

/** Armor that usually comes with a helm [inferred: 5e has no separate helmet item]. */
const HELMED = new Set(['chain-mail', 'splint', 'plate', 'half-plate']);

export function portraitGear(hero: {
  classId: string;
  portrait: Hero['portrait'];
  equipment: { armor?: string | null; shield?: boolean; magic?: string[] };
}): PortraitGear {
  const armorId = hero.equipment.armor ?? null;
  const magicShield = (hero.equipment.magic ?? []).some((id) => /shield/.test(id));
  return {
    armor: armorId ? (ARMOR_LOOK[armorId] ?? 'leather') : 'none',
    shield: !!hero.equipment.shield || magicShield,
    // The player can switch the helmet on or off on the character sheet.
    helmet: hero.portrait.helmet ?? (armorId ? HELMED.has(armorId) : false),
    shieldColor: CLASS_COPY[hero.classId]?.cloth,
  };
}

/** Species drawn shorter (playtest wish, Nov 22). Dwarves are Medium in the rules but short. */
const STATURE: Record<string, Stature> = {
  'hill-dwarf': 'stocky',
  'lightfoot-halfling': 'small',
  'rock-gnome': 'small',
};

/** The head shape and height a species gets in its portrait. */
export function speciesLook(speciesId: string): { ears: PortraitKind; stature: Stature } {
  return {
    ears: speciesId === 'dragonborn' ? 'dragon' : ELF_EARS.has(speciesId) ? 'elf' : 'human',
    stature: STATURE[speciesId] ?? 'medium',
  };
}

/** Everything <Portrait> needs for a hero. */
export function heroPortrait(hero: Hero, label = `Portrait of ${hero.name}`) {
  return {
    ...hero.portrait,
    ...speciesLook(hero.speciesId),
    cloth: CLASS_COPY[hero.classId]!.cloth,
    gear: portraitGear(hero),
    wounds: woundsOf(hero),
    label,
  };
}

/** How hurt a hero looks, from their HP: 0 above 3/4, 1 above half, 2 above 1/4, else 3. */
export function woundsOf(hero: Pick<Hero, 'hp' | 'maxHp' | 'dead'>): 0 | 1 | 2 | 3 {
  if (hero.dead || hero.hp <= 0) return 3;
  const f = hero.hp / Math.max(1, hero.maxHp);
  return f > 0.75 ? 0 : f > 0.5 ? 1 : f > 0.25 ? 2 : 3;
}
