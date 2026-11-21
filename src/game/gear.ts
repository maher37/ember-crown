// Mundane equipment: the catalog (armor, weapons, adventuring gear, magic items), the shop, and
// wearing or wielding things from the party's pack. Pure functions over the game state.
import { armor, gear, magicItems, startingSupplies, weapons } from '../data';
import type { Gear, Weapon } from '../data/schemas/item';
import { getClass, getSpecies, type Hero } from './hero';
import { heroAc } from './items';
import {
  autoSlot,
  clearSlot,
  loadoutFromLegacy,
  loadoutOf,
  placeItem,
  setSlots,
  slotKindOf,
  switchSet,
  withLoadout,
  type Loadout,
  type SlotId,
} from './loadout';
import { heroSpeed } from './levelup';
import type { GameState } from './save';

export type ItemType = 'magic' | 'armor' | 'shield' | 'weapon' | 'gear';

export interface CatalogItem {
  id: string;
  name: string;
  type: ItemType;
  /** PHB price in gold pieces (magic items other than potions have none: not for sale). */
  costGp?: number;
  summary: string;
}

const weaponSummary = (w: Weapon) =>
  `${w.category === 'simple' ? 'Simple' : 'Martial'} ${w.kind} weapon: ${w.damage.dice} ${w.damage.type}${
    w.properties.length ? ` (${w.properties.join(', ')})` : ''
  }.`;

/** Anything that can be in the party's pack, by id. */
export function lookupItem(id: string): CatalogItem | null {
  const m = magicItems.find((x) => x.id === id);
  if (m) return { id, name: m.name, type: 'magic', costGp: m.costGp, summary: m.summary };
  const a = armor.find((x) => x.id === id);
  if (a) {
    const isShield = a.category === 'shield';
    return {
      id,
      name: a.name,
      type: isShield ? 'shield' : 'armor',
      costGp: a.costGp,
      summary: isShield
        ? '+2 AC while carried.'
        : `${a.category[0]!.toUpperCase()}${a.category.slice(1)} armor: AC ${a.ac}${
            a.dexCap === null ? ' + Dex' : a.dexCap > 0 ? ` + Dex (max ${a.dexCap})` : ''
          }${a.strength ? `; needs Str ${a.strength}` : ''}${a.stealthDisadvantage ? '; noisy (Stealth)' : ''}.`,
    };
  }
  const w = weapons.find((x) => x.id === id);
  if (w) return { id, name: w.name, type: 'weapon', costGp: w.costGp, summary: weaponSummary(w) };
  const g = gear.find((x) => x.id === id);
  if (g) return { id, name: g.name, type: 'gear', costGp: g.costGp, summary: g.summary };
  return null;
}

export const itemName = (id: string) => lookupItem(id)?.name ?? id.replace(/-/g, ' ');
export const isMagicItem = (id: string) => magicItems.some((x) => x.id === id);
export const getGear = (id: string): Gear | undefined => gear.find((x) => x.id === id);

/** gp as coins: 0.1 → "1 sp", 0.01 → "1 cp", 2.5 → "2 gp 5 sp". */
export function formatCoins(gp: number): string {
  const cp = Math.round(gp * 100);
  const parts: string[] = [];
  if (cp >= 100) parts.push(`${Math.floor(cp / 100)} gp`);
  if (cp % 100 >= 10) parts.push(`${Math.floor((cp % 100) / 10)} sp`);
  if (cp % 10) parts.push(`${cp % 10} cp`);
  return parts.join(' ') || '0 gp';
}

// ------------------------------------------------------------------ the shop

/** What Brannoc can get you: PHB armor, weapons and adventuring gear, and healing potions. */
export const SHOP_STOCK: string[] = [
  ...gear.map((g) => g.id),
  'potion-of-healing',
  ...armor.map((a) => a.id),
  ...weapons.map((w) => w.id),
];

/** Brannoc's rare finds: magic items that turn up as the story goes (magicItems.json `shopAct`). */
export const RARE_FINDS = magicItems.filter(
  (m) => m.shopAct !== undefined && m.costGp !== undefined,
);

/** Everything for sale in this act. */
export const shopStock = (act: number): string[] => [
  ...SHOP_STOCK,
  ...RARE_FINDS.filter((m) => m.shopAct! <= act).map((m) => m.id),
];

/** PHB: Selling Treasure. Equipment and potions sell for half their price; story items don't sell. */
export const sellPrice = (id: string): number | null => {
  const it = lookupItem(id);
  if (!it || it.costGp === undefined) return null;
  if (it.type === 'magic' && !SHOP_STOCK.includes(id) && !RARE_FINDS.some((m) => m.id === id))
    return null;
  return Math.floor((it.costGp / 2) * 100) / 100;
};

export function buy(g: GameState, id: string): { game: GameState; error?: string } {
  const it = lookupItem(id);
  if (!it || !shopStock(g.act).includes(id) || it.costGp === undefined)
    return { game: g, error: 'Not for sale.' };
  if (g.gold + 1e-9 < it.costGp) return { game: g, error: `Not enough gold for ${it.name}.` };
  return {
    game: {
      ...g,
      gold: Math.round((g.gold - it.costGp) * 100) / 100,
      inventory: { ...g.inventory, [id]: (g.inventory[id] ?? 0) + 1 },
    },
  };
}

export function sell(g: GameState, id: string): { game: GameState; error?: string } {
  const price = sellPrice(id);
  if (price === null) return { game: g, error: "Brannoc won't buy that." };
  if ((g.inventory[id] ?? 0) < 1) return { game: g, error: 'Nothing to sell.' };
  return {
    game: {
      ...g,
      gold: Math.round((g.gold + price) * 100) / 100,
      inventory: { ...g.inventory, [id]: g.inventory[id]! - 1 },
    },
  };
}

// ------------------------------------------------------------------ proficiency

/** PHB class tables (and species weapon training): can this hero use this weapon well? */
export function weaponProficient(hero: Pick<Hero, 'classId' | 'speciesId'>, w: Weapon): boolean {
  const names = getClass(hero.classId).weapons.map((x) => x.toLowerCase());
  if (names.includes(w.category)) return true;
  if (names.includes(`${w.name.toLowerCase()}s`)) return true;
  return getSpecies(hero.speciesId).traits.some((t) =>
    t.mechanics.some((m) => m.type === 'weapons' && m.weapons.includes(w.id)),
  );
}

export function armorProficient(hero: Pick<Hero, 'classId'>, id: string): boolean {
  const a = armor.find((x) => x.id === id);
  if (!a) return false;
  const cats = getClass(hero.classId).armor;
  return cats.includes(a.category === 'shield' ? 'shields' : a.category);
}

/**
 * Why this hero can't take up this item right now, or null if they can: the first slot it could
 * go in, with the reason it can't (proficiency, two hands, light off-hand weapons).
 */
export function equipProblem(hero: Hero, id: string): string | null {
  const lo = loadoutOf(hero);
  const slot = autoSlot(hero, lo, id);
  if (!slot) return `${lookupItem(id)?.name ?? id} isn't worn or wielded.`;
  return placeItem(hero, lo, slot, id).error ?? null;
}

const refresh = (h: Hero): Hero => {
  const next = { ...h };
  next.ac = heroAc(next);
  next.speed = heroSpeed(next);
  return next;
};

const take = (inv: Record<string, number>, id: string) => ({ ...inv, [id]: (inv[id] ?? 0) - 1 });
const putAll = (inv: Record<string, number>, ids: string[]) => {
  const out = { ...inv };
  for (const id of ids) out[id] = (out[id] ?? 0) + 1;
  return out;
};

/** A hero's loadout, converting an older hero (anything that doesn't fit goes to the pack). */
function heroLoadout(g: GameState, hero: Hero): { lo: Loadout; inventory: Record<string, number> } {
  if (hero.equipment.loadout) return { lo: hero.equipment.loadout, inventory: g.inventory };
  const r = loadoutFromLegacy(hero);
  return { lo: r.loadout, inventory: putAll(g.inventory, r.leftovers) };
}

function commit(
  g: GameState,
  hero: Hero,
  lo: Loadout,
  inventory: Record<string, number>,
): GameState {
  const next = withLoadout(hero, lo, refresh);
  return { ...g, inventory, party: g.party.map((h) => (h.id === hero.id ? next : h)) };
}

/** Take an item from the pack and put it in a slot (or the natural slot for it). */
export function equipToSlot(
  g: GameState,
  heroId: string,
  id: string,
  slot?: SlotId,
): { game: GameState; error?: string; note?: string } {
  const hero = g.party.find((h) => h.id === heroId);
  if (!hero) return { game: g, error: 'No such hero.' };
  if ((g.inventory[id] ?? 0) < 1) return { game: g, error: 'That isn\u2019t in the pack.' };
  const { lo, inventory } = heroLoadout(g, hero);
  const where = slot ?? autoSlot(hero, lo, id);
  if (!where) return { game: g, error: `${lookupItem(id)?.name ?? id} isn't worn or wielded.` };
  const r = placeItem(hero, lo, where, id);
  if (r.error) return { game: g, error: r.error };
  return { game: commit(g, hero, r.loadout, putAll(take(inventory, id), r.toPack)), note: r.note };
}

/** Empty a slot; its item goes back in the pack. */
export function unequipSlot(g: GameState, heroId: string, slot: SlotId): GameState {
  const hero = g.party.find((h) => h.id === heroId);
  if (!hero) return g;
  const { lo, inventory } = heroLoadout(g, hero);
  const r = clearSlot(lo, slot);
  return commit(g, hero, r.loadout, putAll(inventory, r.toPack));
}

/** Switch between weapon set 1 and 2 (free outside fights; once a turn in a fight). */
export function switchWeapons(g: GameState, heroId: string): GameState {
  const hero = g.party.find((h) => h.id === heroId);
  if (!hero) return g;
  const { lo, inventory } = heroLoadout(g, hero);
  return commit(g, hero, switchSet(lo), inventory);
}

/** Refresh AC and speed for a hero whose loadout changed (combat uses it too). */
export const refreshHero = refresh;

/** Wear or wield an item from the pack, in its natural slot. */
export function equipGear(
  g: GameState,
  heroId: string,
  id: string,
): { game: GameState; error?: string } {
  return equipToSlot(g, heroId, id);
}

/** Put worn armor, a shield or one weapon back in the pack. */
export function unequipGear(
  g: GameState,
  heroId: string,
  slot: { armor: true } | { shield: true } | { weapon: string },
): GameState {
  const hero = g.party.find((h) => h.id === heroId);
  if (!hero) return g;
  const lo = loadoutOf(hero);
  const [main, off] = setSlots(lo.active);
  const where: SlotId | undefined =
    'armor' in slot
      ? 'armor'
      : 'shield' in slot
        ? ([off, main] as SlotId[]).find(
            (s) => lo[s] === 'shield' || slotKindOf(lo[s] ?? '') === 'shield',
          )
        : ([main, off, 'main1', 'off1', 'main2', 'off2'] as SlotId[]).find(
            (s) => lo[s] === slot.weapon,
          );
  return where ? unequipSlot(g, heroId, where) : g;
}

/** Stealth checks at disadvantage in noisy armor (PHB armor table). */
export const noisyArmor = (hero: Pick<Hero, 'equipment'>) =>
  !!armor.find((x) => x.id === hero.equipment.armor)?.stealthDisadvantage;

// ------------------------------------------------------------------ starting supplies

/** A new party's shared supplies and purse (gear.json `startingSupplies`). */
export function startingPack(party: Pick<Hero, 'classId'>[]): {
  items: Record<string, number>;
  gold: number;
} {
  const items: Record<string, number> = { ...startingSupplies.items };
  for (const h of party)
    for (const [id, n] of Object.entries(startingSupplies.byClass[h.classId] ?? {}))
      items[id] = Math.max(items[id] ?? 0, n);
  return { items, gold: startingSupplies.goldPerHero * party.length };
}
