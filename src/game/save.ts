import { z } from 'zod';
import { AbilityId, ConditionIdSchema, DamageTypeId, SkillId } from '../data/schemas/common';
import type { Hero } from './hero';

/** Bump when the save format changes, and add a migration below. Never break old saves. */
export const SAVE_VERSION = 1;

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
  origin: z.enum(['custom', 'corin']),
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
  }),
  equipment: z.object({
    armor: z.string().nullable(),
    shield: z.boolean(),
    weapons: z.array(z.string()),
  }),
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
  {};

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
