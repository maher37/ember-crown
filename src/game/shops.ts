// Ashford's shops (src/data/shops.json): what each keeper has today, buying and selling, the
// travelling merchant's market days, purchase limits, and the temple's services. Pure functions.
import { armor, gear, magicItems, shops, weapons } from '../data';
import type { Shop } from '../data/schemas/town';
import { SeededRng } from '../rules';
import { toDate } from './calendar';
import { lookupItem } from './gear';
import type { Hero } from './hero';
import type { GameState } from './save';

export const getShop = (id: string): Shop => {
  const s = shops.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shop "${id}"`);
  return s;
};

const CATEGORY_IDS: Record<string, string[]> = {
  gear: gear.map((g) => g.id),
  weapon: weapons.map((w) => w.id),
  armor: armor.filter((a) => a.category !== 'shield').map((a) => a.id),
  shield: armor.filter((a) => a.category === 'shield').map((a) => a.id),
};

/** The act an item turns up in this shop (its own `act`, else the item's shopAct, else 1). */
const itemAct = (entry: { id: string; act?: number }) =>
  entry.act ?? magicItems.find((m) => m.id === entry.id)?.shopAct ?? 1;

/**
 * Market days: days 1–4 of each tenday, and festival days (Harptos). The visit key names the
 * stretch of market days, so a merchant's stock and purchase limit reset each time they come.
 */
export function marketDay(clock: number): string | null {
  const d = toDate(clock);
  if (d.festival) return `${d.year}-${d.period}`;
  const tenday = Math.floor((d.day - 1) / 10);
  return (d.day - 1) % 10 < 4 ? `${d.year}-${d.period}-${tenday}` : null;
}

/** When the wagon comes back: hours from now to the next market day. */
export function hoursToMarket(clock: number): number {
  for (let h = 1; h <= 24 * 12; h++) if (marketDay(clock + h)) return h;
  return 0;
}

/** Which visit purchases count against (limit per visit). Hidden merchants: once ever. */
export function visitKey(g: GameState, shop: Shop): string {
  if (shop.marketDays) return `${shop.id}:${marketDay(g.clock) ?? 'away'}`;
  return `${shop.id}:once`;
}

/** Is this keeper here right now? */
export const shopOpen = (g: GameState, shop: Shop) => !shop.marketDays || !!marketDay(g.clock);

/** Simple string hash, so a rotating stock is the same all visit long (and in a reload). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Everything this shop has for sale today. */
export function stockOf(g: GameState, shopId: string): string[] {
  const shop = getShop(shopId);
  if (!shopOpen(g, shop)) return [];
  const standard = shop.categories.flatMap((c) => CATEGORY_IDS[c] ?? []);
  let special = shop.items.filter((e) => itemAct(e) <= g.act).map((e) => e.id);
  if (shop.rotating && special.length > shop.rotating) {
    // A different few each visit, the same all visit long.
    const rng = new SeededRng(hash(`${g.id}:${visitKey(g, shop)}`));
    const pool = [...special];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.die(i + 1) - 1;
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    special = pool.slice(0, shop.rotating);
  }
  return [...new Set([...special, ...standard])];
}

/** Items still to come in later acts (shown as "more arrives later"). */
export const comingLater = (g: GameState, shopId: string) =>
  getShop(shopId).items.filter((e) => itemAct(e) > g.act).length;

/** Purchases left this visit (Infinity for ordinary shops). */
export function purchasesLeft(g: GameState, shopId: string): number {
  const shop = getShop(shopId);
  if (!shop.limit) return Infinity;
  return Math.max(0, shop.limit - (g.purchases?.[visitKey(g, shop)] ?? 0));
}

/** Every item any shop can sell (story treasures are the magic items no one sells). */
export const SOLD_ANYWHERE = new Set(
  shops.flatMap((s) => [
    ...s.items.map((e) => e.id),
    ...s.categories.flatMap((c) => CATEGORY_IDS[c] ?? []),
  ]),
);

const categoryOf = (id: string): string | null => {
  const it = lookupItem(id);
  if (!it) return null;
  if (it.type === 'magic') return /potion/.test(id) ? 'potion' : 'magic';
  return it.type;
};

/**
 * PHB: Selling Treasure. Half price, only to a keeper who buys that kind of thing; story items
 * never sell. Gems, jewelry and art objects (our treasure) sell for their full value.
 */
export function sellPriceAt(shopId: string, id: string): number | null {
  const it = lookupItem(id);
  const cat = categoryOf(id);
  if (it?.type === 'treasure')
    return getShop(shopId).buys.includes('treasure') ? (it.costGp ?? null) : null;
  if (!it || it.costGp === undefined || !cat || !SOLD_ANYWHERE.has(id)) return null;
  if (!getShop(shopId).buys.includes(cat as never)) return null;
  return Math.floor((it.costGp / 2) * 100) / 100;
}

export function buyAt(
  g: GameState,
  shopId: string,
  id: string,
): { game: GameState; error?: string } {
  const shop = getShop(shopId);
  const it = lookupItem(id);
  if (!it || it.costGp === undefined || !stockOf(g, shopId).includes(id))
    return { game: g, error: 'Not for sale.' };
  if (purchasesLeft(g, shopId) <= 0)
    return {
      game: g,
      error: `${shop.keeper.split(',')[0]} won't sell you any more${shop.marketDays ? ' this visit' : ''}.`,
    };
  if (g.gold + 1e-9 < it.costGp) return { game: g, error: `Not enough gold for ${it.name}.` };
  const key = visitKey(g, shop);
  return {
    game: {
      ...g,
      gold: Math.round((g.gold - it.costGp) * 100) / 100,
      inventory: { ...g.inventory, [id]: (g.inventory[id] ?? 0) + 1 },
      purchases: shop.limit
        ? { ...(g.purchases ?? {}), [key]: (g.purchases?.[key] ?? 0) + 1 }
        : g.purchases,
    },
  };
}

export function sellAt(
  g: GameState,
  shopId: string,
  id: string,
): { game: GameState; error?: string } {
  const price = sellPriceAt(shopId, id);
  if (price === null)
    return { game: g, error: `${getShop(shopId).keeper.split(',')[0]} won't buy that.` };
  if ((g.inventory[id] ?? 0) < 1) return { game: g, error: 'Nothing to sell.' };
  return {
    game: {
      ...g,
      gold: Math.round((g.gold + price) * 100) / 100,
      inventory: { ...g.inventory, [id]: g.inventory[id]! - 1 },
    },
  };
}

// ------------------------------------------------------------------ the temple

/** The price of a temple service for this party (healing is per wounded hero). */
export function serviceCost(g: GameState, serviceId: string, heroId?: string): number {
  const s = getShop('temple').services.find((x) => x.id === serviceId);
  if (!s) return Infinity;
  if (serviceId === 'heal-party')
    return s.costGp * g.party.filter((h) => !h.dead && h.hp < h.maxHp).length;
  if (serviceId === 'restore' && heroId) return s.costGp;
  return s.costGp;
}

/**
 * Temple services (DMG: Spellcasting Services, priced as remembered [inferred]):
 * healing prayers (everyone to full), restoration (all exhaustion), and raising the dead.
 */
export function applyService(
  g: GameState,
  serviceId: string,
  heroId?: string,
): { game: GameState; error?: string; message?: string } {
  const cost = serviceCost(g, serviceId, heroId);
  if (g.gold + 1e-9 < cost) return { game: g, error: `The shrine asks ${cost} gp for that.` };
  const pay = (party: Hero[]) => ({
    ...g,
    party,
    gold: Math.round((g.gold - cost) * 100) / 100,
  });
  if (serviceId === 'heal-party') {
    if (cost === 0) return { game: g, error: 'Nobody needs healing.' };
    return {
      game: pay(
        g.party.map((h) =>
          h.dead
            ? h
            : { ...h, hp: h.maxHp, deathSaves: { successes: 0, failures: 0 }, stable: false },
        ),
      ),
      message: 'Sister Aubra prays over the party. Every wound closes.',
    };
  }
  const h = g.party.find((x) => x.id === heroId);
  if (!h) return { game: g, error: 'Choose a hero.' };
  if (serviceId === 'restore') {
    if (!h.exhaustion) return { game: g, error: `${h.name} isn't exhausted.` };
    return {
      game: pay(g.party.map((x) => (x.id === h.id ? { ...x, exhaustion: 0 } : x))),
      message: `${h.name}'s weariness lifts.`,
    };
  }
  if (serviceId === 'raise-dead') {
    if (!h.dead) return { game: g, error: `${h.name} is alive.` };
    // PHB: Raise Dead returns the creature with 1 hit point (its -4 penalty is not used here [inferred]).
    return {
      game: pay(
        g.party.map((x) =>
          x.id === h.id
            ? { ...x, dead: false, hp: 1, deathSaves: { successes: 0, failures: 0 }, stable: false }
            : x,
        ),
      ),
      message: `Dawnlight fills the shrine. ${h.name} draws a breath.`,
    };
  }
  return { game: g, error: 'Unknown service.' };
}
