// How a hero looks: the portrait plus what they're wearing.
import type { Hero } from '../game/hero';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import type { ArmorLook, PortraitGear } from './Portrait';

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

/** Everything <Portrait> needs for a hero. */
export function heroPortrait(hero: Hero, label = `Portrait of ${hero.name}`) {
  return {
    ...hero.portrait,
    ears: ELF_EARS.has(hero.speciesId) ? ('elf' as const) : ('human' as const),
    cloth: CLASS_COPY[hero.classId]!.cloth,
    gear: portraitGear(hero),
    label,
  };
}
