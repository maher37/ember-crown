// Equipment slots, the same for every hero (playtest feedback): two weapon sets (main hand and off
// hand), armor, cloak, neck, two rings, feet and two trinkets. The older equipment fields
// (`weapons`, `shield`, `magic`) are worked out from the slots, so combat and AC read them as before.
import { armor, magicItems, weapons } from '../data';
import type { MagicItem, Weapon } from '../data/schemas/item';
import { armorProficient, weaponProficient } from './gear';
import { armorProfsOf, getClass, weaponProfsOf, type Hero } from './hero';

export const SLOT_IDS = [
  'main1',
  'off1',
  'main2',
  'off2',
  'armor',
  'cloak',
  'neck',
  'ring1',
  'ring2',
  'feet',
  'trinket1',
  'trinket2',
] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export type Loadout = Record<SlotId, string | null> & { active: 1 | 2 };

export const SLOT_NAMES: Record<SlotId, string> = {
  main1: 'Main hand',
  off1: 'Off hand',
  main2: 'Main hand',
  off2: 'Off hand',
  armor: 'Armor',
  cloak: 'Cloak',
  neck: 'Neck',
  ring1: 'Ring',
  ring2: 'Ring',
  feet: 'Feet',
  trinket1: 'Trinket',
  trinket2: 'Trinket',
};

export const emptyLoadout = (): Loadout => ({
  main1: null,
  off1: null,
  main2: null,
  off2: null,
  armor: null,
  cloak: null,
  neck: null,
  ring1: null,
  ring2: null,
  feet: null,
  trinket1: null,
  trinket2: null,
  active: 1,
});

const magicOf = (id: string): MagicItem | undefined => magicItems.find((x) => x.id === id);
const mundaneWeapon = (id: string): Weapon | undefined => weapons.find((x) => x.id === id);

/** What kind of slot an item goes in. */
export type SlotKind =
  'weapon' | 'shield' | 'armor' | 'cloak' | 'neck' | 'ring' | 'feet' | 'trinket';

export function slotKindOf(id: string): SlotKind | null {
  if (id === 'shield') return 'shield';
  if (armor.some((a) => a.id === id)) return 'armor';
  if (mundaneWeapon(id)) return 'weapon';
  const m = magicOf(id);
  if (!m || m.consumable) return null;
  switch (m.kind) {
    case 'weapon':
    case 'staff':
      return 'weapon';
    case 'shield':
      return 'shield';
    case 'cloak':
      return 'cloak';
    case 'ring':
      return 'ring';
    case 'armor':
      return 'armor';
    default:
      return m.slot ?? 'trinket';
  }
}

const SLOT_ACCEPTS: Record<SlotId, SlotKind[]> = {
  main1: ['weapon'],
  main2: ['weapon'],
  off1: ['weapon', 'shield'],
  off2: ['weapon', 'shield'],
  armor: ['armor'],
  cloak: ['cloak'],
  neck: ['neck'],
  ring1: ['ring'],
  ring2: ['ring'],
  feet: ['feet'],
  trinket1: ['trinket'],
  trinket2: ['trinket'],
};

/**
 * The weapon an item fights as (Deepdelver → warhammer). A staff fights as a quarterstaff. The
 * Kiln-Quenched Weapon takes the form of a weapon the hero is trained with [inferred].
 */
export function weaponFor(
  id: string,
  hero?: Pick<Hero, 'classId' | 'speciesId' | 'abilities'>,
): Weapon | null {
  const w = mundaneWeapon(id);
  if (w) return w;
  const m = magicOf(id);
  if (!m) return null;
  if (m.kind === 'staff') return mundaneWeapon('quarterstaff') ?? null;
  if (m.kind !== 'weapon' || !m.baseWeapon) return null;
  const options =
    m.baseWeapon === 'any'
      ? ['longsword', 'rapier', 'warhammer', 'mace', 'shortsword', 'quarterstaff', 'dagger']
      : Array.isArray(m.baseWeapon)
        ? m.baseWeapon
        : [m.baseWeapon];
  const usable = hero
    ? options.find((x) => {
        const b = mundaneWeapon(x);
        if (!b || !weaponProficient(hero, b)) return false;
        // Finesse fighters prefer a finesse form of "any" weapon.
        if (m.baseWeapon === 'any' && hero.abilities.dex > hero.abilities.str)
          return b.properties.includes('finesse');
        return true;
      })
    : undefined;
  return mundaneWeapon(usable ?? options[0]!) ?? null;
}

const twoHanded = (w: Weapon | null) => !!w && w.properties.includes('two-handed');

export const setSlots = (set: 1 | 2) =>
  set === 1 ? (['main1', 'off1'] as const) : (['main2', 'off2'] as const);

/**
 * Why this item can't go in this slot, or null if it can (the reasons are shown to the player).
 * PHB: proficiency for weapons, armor and shields; two-handed weapons need both hands; an off-hand
 * weapon must be light (Two-Weapon Fighting).
 */
export function placeProblem(hero: Hero, lo: Loadout, slot: SlotId, id: string): string | null {
  const kind = slotKindOf(id);
  const name = itemLabel(id);
  if (!kind) return `${name} isn't worn or wielded.`;
  if (!SLOT_ACCEPTS[slot].includes(kind))
    return `${name} doesn't go in the ${SLOT_NAMES[slot].toLowerCase()} slot.`;
  const first = hero.name.split(' ')[0];
  if (kind === 'armor' && !armorProficient(hero, id) && armor.some((a) => a.id === id)) {
    const cat = armor.find((a) => a.id === id)!.category;
    return `${first} isn't trained in ${cat} armor (${getClass(hero.classId).name}s: ${
      getClass(hero.classId)
        .armor.filter((x) => x !== 'shields')
        .join(', ') || 'none'
    }).`;
  }
  if (kind === 'shield' && !armorProfsOf(hero).includes('shields'))
    return `${first} isn't trained with shields.`;
  // DMG: Attunement. Some items can only be attuned by a spellcaster (Wand of the War Mage, Pearl of Power).
  if (magicOf(id)?.attunement === 'spellcaster' && !getClass(hero.classId).spellcasting)
    return `${name} needs a spellcaster to attune to it.`;
  if (kind === 'weapon') {
    const w = weaponFor(id, hero);
    if (!w) return `${name} can't be wielded.`;
    if (!weaponProficient(hero, w))
      return `${first} isn't trained with the ${w.name.toLowerCase()} (${getClass(hero.classId).name}s use ${weaponProfsOf(hero).join(', ')}).`;
    const set: 1 | 2 = slot.endsWith('1') ? 1 : 2;
    const [main, off] = setSlots(set);
    if (slot === off) {
      if (twoHanded(w))
        return `The ${w.name.toLowerCase()} needs both hands: put it in the main hand.`;
      if (!w.properties.includes('light'))
        return `Only a light weapon fits the off hand (two-weapon fighting). The ${w.name.toLowerCase()} isn't light.`;
      const m = lo[main] ? weaponFor(lo[main]!, hero) : null;
      if (twoHanded(m)) return `The ${m!.name.toLowerCase()} in the main hand needs both hands.`;
    }
  }
  if (kind === 'shield') {
    const set: 1 | 2 = slot.endsWith('1') ? 1 : 2;
    const main = lo[setSlots(set)[0]];
    const m = main ? weaponFor(main, hero) : null;
    if (twoHanded(m))
      return `The ${m!.name.toLowerCase()} needs both hands, so there's no room for a shield.`;
  }
  return null;
}

/** A short name for any item id. */
export function itemLabel(id: string): string {
  if (id === 'shield') return 'Shield';
  return (
    magicOf(id)?.name ??
    armor.find((a) => a.id === id)?.name ??
    mundaneWeapon(id)?.name ??
    id.replace(/-/g, ' ')
  );
}

/** Every item in a loadout (both weapon sets and every worn slot). */
export const loadoutItems = (lo: Loadout) =>
  SLOT_IDS.map((s) => lo[s]).filter((x): x is string => !!x);

/** The older equipment fields, worked out from the slots (the active weapon set only). */
export function deriveEquipment(lo: Loadout): Hero['equipment'] {
  const [main, off] = setSlots(lo.active);
  const held = [lo[main], lo[off]].filter((x): x is string => !!x);
  const worn = (['cloak', 'neck', 'ring1', 'ring2', 'feet', 'trinket1', 'trinket2'] as const)
    .map((s) => lo[s])
    .filter((x): x is string => !!x);
  const magicArmor = lo.armor && magicOf(lo.armor) ? [lo.armor] : [];
  return {
    armor: lo.armor && !magicOf(lo.armor) ? lo.armor : null,
    shield: held.includes('shield'),
    weapons: held.filter((x) => !!mundaneWeapon(x)),
    magic: [...held.filter((x) => !!magicOf(x)), ...magicArmor, ...worn],
    loadout: lo,
  };
}

/**
 * Slots from the older lists (old saves and the starting kits): the best melee weapon and a
 * shield or light weapon in set 1, a ranged or thrown weapon in set 2, worn magic in its place.
 * Anything left over goes back to the pack.
 */
export function loadoutFromLegacy(
  hero: Pick<Hero, 'classId' | 'speciesId' | 'abilities' | 'equipment'>,
): { loadout: Loadout; leftovers: string[] } {
  const e = hero.equipment;
  const lo = emptyLoadout();
  lo.armor = e.armor;
  const items = [...e.weapons, ...(e.magic ?? []).filter((id) => slotKindOf(id) === 'weapon')];
  const pool = [...items];
  const take = (pred: (w: Weapon, id: string) => boolean) => {
    const i = pool.findIndex((id) => {
      const w = weaponFor(id, hero);
      return !!w && pred(w, id);
    });
    return i < 0 ? null : pool.splice(i, 1)[0]!;
  };
  // Magic weapons first, then the best melee weapon.
  lo.main1 =
    take((w, id) => !!magicOf(id) && w.kind === 'melee') ??
    take((w) => w.kind === 'melee' && !w.properties.includes('light')) ??
    take((w) => w.kind === 'melee');
  const mainW = lo.main1 ? weaponFor(lo.main1, hero) : null;
  const magicShield = (e.magic ?? []).find((id) => slotKindOf(id) === 'shield');
  if (!twoHanded(mainW)) {
    if (magicShield) lo.off1 = magicShield;
    else if (e.shield) lo.off1 = 'shield';
    else lo.off1 = take((w) => w.kind === 'melee' && w.properties.includes('light'));
  }
  lo.main2 =
    take((w, id) => !!magicOf(id) && w.kind === 'ranged') ??
    take((w) => w.kind === 'ranged') ??
    take((w) => w.properties.includes('thrown'));
  const m2 = lo.main2 ? weaponFor(lo.main2, hero) : null;
  if (lo.main2 && !twoHanded(m2) && m2?.properties.includes('thrown'))
    lo.off2 = take((w) => w.properties.includes('light') && w.properties.includes('thrown'));
  // Worn magic.
  const rings: SlotId[] = ['ring1', 'ring2'];
  const trinkets: SlotId[] = ['trinket1', 'trinket2'];
  const leftovers = [...pool];
  for (const id of e.magic ?? []) {
    const k = slotKindOf(id);
    if (k === 'weapon' || id === magicShield) continue;
    const slot =
      k === 'ring'
        ? rings.find((s) => !lo[s])
        : k === 'trinket'
          ? trinkets.find((s) => !lo[s])
          : k === 'cloak' || k === 'neck' || k === 'feet' || k === 'armor'
            ? (k as SlotId)
            : undefined;
    if (slot && !lo[slot]) lo[slot] = id;
    else leftovers.push(id);
  }
  if (e.shield && lo.off1 !== 'shield' && !magicShield) leftovers.push('shield');
  if (magicShield && lo.off1 !== magicShield) leftovers.push(magicShield);
  return { loadout: lo, leftovers };
}

/** A hero's loadout (older heroes are converted on the fly). */
export const loadoutOf = (hero: Hero): Loadout =>
  hero.equipment.loadout ?? loadoutFromLegacy(hero).loadout;

/** Put a loadout on a hero and refresh everything that depends on it. */
export function withLoadout(hero: Hero, lo: Loadout, refresh: (h: Hero) => Hero): Hero {
  return refresh({ ...hero, equipment: deriveEquipment(lo) });
}

// ------------------------------------------------------------------ changing what's worn

export const ATTUNE_MAX = 3;

/** DMG: Attunement, at most three items, counted across every slot (both weapon sets). */
export const attunedIn = (lo: Loadout) =>
  loadoutItems(lo).filter((id) => !!magicOf(id)?.attunement).length;

/** Where an item from the pack would go if the player just clicks "Equip". */
export function autoSlot(hero: Hero, lo: Loadout, id: string): SlotId | null {
  const kind = slotKindOf(id);
  const [main, off] = setSlots(lo.active);
  const free = (slots: SlotId[]) => slots.find((s) => !lo[s]) ?? slots[0]!;
  switch (kind) {
    case 'armor':
      return 'armor';
    case 'shield':
      return off;
    case 'cloak':
    case 'neck':
    case 'feet':
      return kind;
    case 'ring':
      return free(['ring1', 'ring2']);
    case 'trinket':
      return free(['trinket1', 'trinket2']);
    case 'weapon': {
      const w = weaponFor(id, hero);
      if (w?.kind === 'ranged' && !lo.main2) return 'main2';
      if (lo[main] && !lo[off] && w?.properties.includes('light') && w.kind === 'melee') return off;
      return main;
    }
    default:
      return null;
  }
}

export interface LoadoutChange {
  loadout: Loadout;
  /** Items that go back to the party's pack. */
  toPack: string[];
  error?: string;
  note?: string;
}

/** Put an item in a slot. Whatever was there goes back to the pack (and an off-hand item, if a two-handed weapon needs both hands). */
export function placeItem(hero: Hero, lo: Loadout, slot: SlotId, id: string): LoadoutChange {
  const next = { ...lo };
  const toPack: string[] = [];
  let note: string | undefined;
  // A two-handed weapon in the main hand empties the off hand first.
  const w = slotKindOf(id) === 'weapon' ? weaponFor(id, hero) : null;
  const pairOff = slot === 'main1' ? 'off1' : slot === 'main2' ? 'off2' : null;
  const probe = { ...next };
  if (pairOff && twoHanded(w) && probe[pairOff]) probe[pairOff] = null;
  const problem = placeProblem(hero, probe, slot, id);
  if (problem) return { loadout: lo, toPack: [], error: problem };
  if (pairOff && twoHanded(w) && next[pairOff]) {
    toPack.push(next[pairOff]!);
    note = `${itemLabel(next[pairOff]!)} goes back in the pack: the ${w!.name.toLowerCase()} needs both hands.`;
    next[pairOff] = null;
  }
  if (next[slot]) toPack.push(next[slot]!);
  next[slot] = id;
  if (
    !magicOf(lo[slot] ?? '')?.attunement &&
    magicOf(id)?.attunement &&
    attunedIn(next) > ATTUNE_MAX
  )
    return {
      loadout: lo,
      toPack: [],
      error: `${hero.name.split(' ')[0]} is already attuned to three items.`,
    };
  return { loadout: next, toPack, note };
}

export function clearSlot(lo: Loadout, slot: SlotId): LoadoutChange {
  const id = lo[slot];
  if (!id) return { loadout: lo, toPack: [] };
  return { loadout: { ...lo, [slot]: null }, toPack: [id] };
}

export const switchSet = (lo: Loadout): Loadout => ({ ...lo, active: lo.active === 1 ? 2 : 1 });

/** A one-line description of a weapon set ("Longsword + Shield"). */
export function setLabel(lo: Loadout, set: 1 | 2): string {
  const [main, off] = setSlots(set);
  const parts = [lo[main], lo[off]].filter((x): x is string => !!x).map(itemLabel);
  return parts.join(' + ') || 'empty hands';
}

/** Give every hero slots from what they carry (new parties and old saves); leftovers go in the pack. */
export function giveLoadouts(
  party: Hero[],
  inventory: Record<string, number>,
): { party: Hero[]; inventory: Record<string, number> } {
  const inv = { ...inventory };
  const out = party.map((h) => {
    if (h.equipment.loadout) return h;
    const r = loadoutFromLegacy(h);
    for (const id of r.leftovers) inv[id] = (inv[id] ?? 0) + 1;
    return { ...h, equipment: deriveEquipment(r.loadout) };
  });
  return { party: out, inventory: inv };
}
