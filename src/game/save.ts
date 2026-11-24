import { z } from 'zod';
import { AbilityId, ConditionIdSchema, DamageTypeId, SkillId } from '../data/schemas/common';
import { ORIGIN_IDS } from '../data/schemas/origin';
import { defaultInvocations, defaultSpells, type Hero } from './hero';
import { startingPack } from './gear';
import { heroSpeed } from './levelup';
import { giveLoadouts } from './loadout';
import type { QuestState } from './journal';
import type { LetterState } from './letters';
import { GAME_START } from './calendar';

/** Bump when the save format changes, and add a migration below. Never break old saves. */
export const SAVE_VERSION = 9;

export interface GameState {
  id: string;
  createdAt: string;
  /** The seed the game started with, and where the dice are now (CLAUDE.md: seeded RNG). */
  seed: number;
  rngState: number;
  party: Hero[];
  act: 1 | 2 | 3;
  location: string;
  /** Total play time, in seconds, up to the last save. */
  playSeconds: number;
  /** Story flags: choices made, people met, Corin's Ember meter... */
  flags: Record<string, boolean | number | string>;
  /** Quest progress, by quest id (src/data/quests.json). */
  quests: Record<string, QuestState>;
  /** Journal notes: clues and rumors, in the order found. */
  notes: { text: string; at: string }[];
  /** Saved Ink story state per dialogue file (visit counts and variables). */
  ink: Record<string, string>;
  /** Game clock: hours since midnight, 1 Hammer 1492 DR (see calendar.ts). */
  clock: number;
  /** Clock hour when the last long rest started (once per 24 hours), or null. */
  lastLongRest: number | null;
  /** Maelis's letters that have arrived. */
  letters: LetterState[];
  /** The party's shared pack: item id → how many (potions, unequipped magic items). */
  inventory: Record<string, number>;
  /** The party's purse, in gold pieces (M8). */
  gold: number;
  /** Things found while exploring (finds.json): spotted, or opened and emptied. */
  finds?: Record<string, 'seen' | 'done'>;
  /** Purchases from merchants with a limit, by "shop:visit". */
  purchases?: Record<string, number>;
}

export interface SaveFile {
  saveVersion: number;
  savedAt: string;
  game: GameState;
}

const Scores = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

const Slot = z.string().nullable();

export const HeroSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('pc'),
  level: z.number().int().min(1).max(6),
  xp: z.number().int().min(0),
  proficiencyBonus: z.number().int().min(2),
  abilities: Scores,
  saveProficiencies: z.array(AbilityId),
  ac: z.number().int().positive(),
  maxHp: z.number().int().positive(),
  hp: z.number().int().min(0),
  tempHp: z.number().int().min(0),
  hitDice: z.object({
    die: z.union([
      z.literal(4),
      z.literal(6),
      z.literal(8),
      z.literal(10),
      z.literal(12),
      z.literal(20),
    ]),
    total: z.number().int(),
    remaining: z.number().int(),
  }),
  conditions: z.array(z.object({ id: ConditionIdSchema, source: z.string().optional() })),
  exhaustion: z.number().int().min(0).max(6),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  stable: z.boolean(),
  dead: z.boolean(),
  defenses: z.object({
    resistances: z.array(DamageTypeId),
    vulnerabilities: z.array(DamageTypeId),
    immunities: z.array(DamageTypeId),
  }),
  concentration: z.string().nullable(),
  // New origin ids widen this list; old saves (custom/corin) still load unchanged.
  origin: z.enum(['custom', ...ORIGIN_IDS]),
  speciesId: z.string().min(1),
  classId: z.string().min(1),
  backgroundId: z.string().min(1),
  baseAbilities: Scores,
  abilityMethod: z.enum(['array', 'point', 'roll']),
  skills: z.array(SkillId),
  expertise: z.array(SkillId),
  fightingStyle: z.string().nullable(),
  speed: z.number().int().positive(),
  portrait: z.object({
    skin: Hex,
    hair: Hex,
    eyes: Hex,
    hairStyle: z.enum(['short', 'long', 'bald', 'hood']),
    beard: z.boolean(),
    scar: z.boolean(),
    helmet: z.boolean().optional(),
  }),
  canPrepare: z.boolean().optional(),
  subclassId: z.string().optional(),
  lingering: z.object({ spell: z.string(), until: z.number().optional() }).optional(),
  buffs: z
    .array(
      z.object({
        spell: z.enum(['aid', 'mage-armor', 'armor-of-agathys', 'false-life']),
        until: z.number(),
        amount: z.number().optional(),
        hpAbove: z.number().optional(),
        tempHp: z.number().optional(),
        cold: z.number().optional(),
      }),
    )
    .optional(),
  arcaneWard: z.number().int().min(0).optional(),
  // Find Familiar: the shape, and whether it's lost until a long rest (optional: old saves load as is).
  familiar: z.object({ form: z.string(), lost: z.boolean().optional() }).optional(),
  equipment: z.object({
    armor: z.string().nullable(),
    shield: z.boolean(),
    weapons: z.array(z.string()),
    magic: z.array(z.string()),
    loadout: z
      .object({
        main1: Slot,
        off1: Slot,
        main2: Slot,
        off2: Slot,
        armor: Slot,
        cloak: Slot,
        neck: Slot,
        ring1: Slot,
        ring2: Slot,
        feet: Slot,
        trinket1: Slot,
        trinket2: Slot,
        active: z.union([z.literal(1), z.literal(2)]),
      })
      .optional(),
  }),
  cantrips: z.array(z.string()),
  spells: z.array(z.string()),
  invocations: z.array(z.string()),
  slotsUsed: z.array(z.number().int().min(0)),
  resourcesUsed: z.record(z.string(), z.number().int().min(0)),
  choices: z.record(z.string(), z.array(z.string())),
  maxHpDrain: z.number().int().min(0).optional(),
}) satisfies z.ZodType<Hero>;

export const GameStateSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  seed: z.number().int(),
  rngState: z.number().int(),
  party: z.array(HeroSchema).min(1).max(4),
  act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  location: z.string().min(1),
  playSeconds: z.number().min(0),
  flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  quests: z.record(
    z.string(),
    z.object({ status: z.enum(['active', 'done']), steps: z.array(z.string()) }),
  ),
  notes: z.array(z.object({ text: z.string(), at: z.string() })),
  ink: z.record(z.string(), z.string()),
  clock: z.number().int().min(0),
  lastLongRest: z.number().int().nullable(),
  letters: z.array(z.object({ id: z.string(), read: z.boolean(), reply: z.string().optional() })),
  inventory: z.record(z.string(), z.number().int().min(0)),
  // Gold can be fractional (1 sp = 0.1 gp).
  gold: z.number().min(0),
  finds: z.record(z.string(), z.enum(['seen', 'done'])).optional(),
  purchases: z.record(z.string(), z.number().int().min(0)).optional(),
}) satisfies z.ZodType<GameState>;

export const SaveFileSchema = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  savedAt: z.string().min(1),
  game: GameStateSchema,
});

/**
 * Migrations: `MIGRATIONS[n]` turns a version-n save into version n+1. Add one every time
 * SAVE_VERSION goes up, with a test that loads an old save.
 */
export const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> =
  {
    // v1 → v2 (M4): heroes gain spells, spell slots, class resources and invocations.
    1: (old) => {
      const game = old.game as { party: Record<string, unknown>[] };
      const party = game.party.map((h) => ({
        ...defaultSpells(String(h.classId)),
        invocations: defaultInvocations(String(h.classId), Number(h.level)),
        slotsUsed: [],
        resourcesUsed: {},
        ...h,
      }));
      return { ...old, game: { ...game, party } };
    },
    // v2 → v3 (M5): quests, journal notes, Ink state, and level-up choices on heroes.
    2: (old) => {
      const game = old.game as { party: Record<string, unknown>[] };
      const party = game.party.map((h) => ({ choices: {}, ...h }) as Record<string, unknown>);
      // A party that already reached level 2 (the M4 shortcut) has finished Lantern Night.
      const past = party.some((h) => Number(h.xp) >= 300);
      const quests = past
        ? {
            'lantern-night': {
              status: 'done',
              steps: ['talk-brannoc', 'tend-edric', 'secure-letter'],
            },
            'old-mine': { status: 'active', steps: [] },
          }
        : { 'lantern-night': { status: 'active', steps: [] } };
      return { ...old, game: { notes: [], ink: {}, ...game, party, quests } };
    },
    // v3 → v4 (M6): the game clock, long-rest timing and Maelis's letters.
    3: (old) => {
      const game = old.game as { party: { origin?: string }[]; location?: string };
      const corin = game.party.some((h) => h.origin === 'corin');
      return {
        ...old,
        game: {
          clock: GAME_START,
          lastLongRest: null,
          letters: corin ? [{ id: 'letter-0', read: false }] : [],
          ...game,
        },
      };
    },
    // v4 → v5 (M7): a party inventory, and magic items worn by heroes.
    4: (old) => {
      const game = old.game as { party: { equipment: Record<string, unknown> }[] };
      const party = game.party.map((h) => ({ ...h, equipment: { magic: [], ...h.equipment } }));
      return { ...old, game: { inventory: {}, ...game, party } };
    },
    // v5 → v6 (M8): the party's gold.
    5: (old) => ({ ...old, game: { gold: 0, ...(old.game as Record<string, unknown>) } }),
    // v6 → v7 (equipment): the starting supplies and purse a new party gets, speed that
    // counts heavy armor, and spells can be re-prepared until the next fight.
    6: (old) => {
      const game = old.game as GameState;
      const pack = startingPack(game.party);
      const inventory = { ...game.inventory };
      for (const [id, n] of Object.entries(pack.items))
        inventory[id] = Math.max(inventory[id] ?? 0, n);
      const party = game.party.map((h) => ({ ...h, speed: heroSpeed(h), canPrepare: true }));
      return {
        ...old,
        game: { ...game, party, inventory, gold: (game.gold ?? 0) + pack.gold },
      };
    },
    // v7 → v8 (equipment slots): every hero gets slots and two weapon sets, filled from what
    // they carried; anything that doesn't fit goes back in the party's pack.
    7: (old) => {
      const game = old.game as GameState;
      const r = giveLoadouts(game.party, game.inventory);
      return { ...old, game: { ...game, party: r.party, inventory: r.inventory } };
    },
    // v8 → v9 (D33): the origin hero Rhessa Kalvaar was renamed Vorna Kalvaar (owner, Nov 22).
    8: (old) => {
      const game = old.game as { party: { origin?: string; name?: string }[] };
      const party = game.party.map((h) =>
        h.origin === 'rhessa'
          ? { ...h, origin: 'vorna', name: h.name === 'Rhessa Kalvaar' ? 'Vorna Kalvaar' : h.name }
          : h,
      );
      return { ...old, game: { ...game, party } };
    },
  };

export type LoadResult = { ok: true; save: SaveFile } | { ok: false; error: string };

/** Read a save from untrusted text (localStorage or an imported file). */
export function parseSave(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a save file (it isn't valid JSON)." };
  }
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof (raw as { saveVersion?: unknown }).saveVersion !== 'number'
  ) {
    return { ok: false, error: "This file isn't an Ember Crown save (no save version)." };
  }
  let data = raw as Record<string, unknown>;
  let version = data.saveVersion as number;
  if (version > SAVE_VERSION) {
    return {
      ok: false,
      error: `This save is from a newer version of the game (save version ${version}).`,
    };
  }
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, error: `No way to upgrade a version-${version} save.` };
    data = { ...step(data), saveVersion: version + 1 };
    version++;
  }
  const result = SaveFileSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0]!;
    return {
      ok: false,
      error: `This save is damaged (${first.path.join('.') || 'file'}: ${first.message}).`,
    };
  }
  return { ok: true, save: result.data as SaveFile };
}

export function makeSave(game: GameState, now = new Date()): SaveFile {
  return { saveVersion: SAVE_VERSION, savedAt: now.toISOString(), game };
}

export const serializeSave = (save: SaveFile): string => JSON.stringify(save, null, 2);

// ── Slots in the browser (localStorage) ──

export const SLOTS = ['autosave', 'slot1', 'slot2'] as const;
export type SlotId = (typeof SLOTS)[number];
export const SLOT_NAMES: Record<SlotId, string> = {
  autosave: 'Autosave',
  slot1: 'Slot 1',
  slot2: 'Slot 2',
};
const key = (slot: SlotId) => `ember-crown:save:${slot}`;

export type SlotInfo = { slot: SlotId; save: SaveFile | null; error?: string };

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readSlot(slot: SlotId): SlotInfo {
  const text = storage()?.getItem(key(slot));
  if (!text) return { slot, save: null };
  const r = parseSave(text);
  return r.ok ? { slot, save: r.save } : { slot, save: null, error: r.error };
}

export const listSlots = (): SlotInfo[] => SLOTS.map(readSlot);

export function writeSlot(slot: SlotId, save: SaveFile): void {
  const s = storage();
  if (!s) throw new Error('This browser does not allow saving (storage is blocked).');
  s.setItem(key(slot), serializeSave(save));
}

export function deleteSlot(slot: SlotId): void {
  storage()?.removeItem(key(slot));
}

/** The newest readable save, for the title screen's Continue button. */
export function latestSave(): SlotInfo | null {
  const ok = listSlots().filter((s) => s.save);
  ok.sort((a, b) => b.save!.savedAt.localeCompare(a.save!.savedAt));
  return ok[0] ?? null;
}

/** "Party level 1 · 0h 12m" and similar, for save cards. */
export function describeSave(save: SaveFile): { party: string; detail: string } {
  const g = save.game;
  const level = Math.max(...g.party.map((h) => h.level));
  const mins = Math.floor(g.playSeconds / 60);
  const names = g.party.map((h) => h.name.split(' ')[0]).join(', ');
  return {
    party: `${names} · Act ${['I', 'II', 'III'][g.act - 1]}`,
    detail: `Party level ${level} · ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`,
  };
}
