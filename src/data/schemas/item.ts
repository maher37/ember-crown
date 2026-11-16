import { z } from 'zod';
import { DamageTypeId, Dice, Effect, fileOf, Id, Verify } from './common';

export const WEAPON_PROPERTIES = [
  'ammunition',
  'finesse',
  'heavy',
  'light',
  'loading',
  'reach',
  'special',
  'thrown',
  'two-handed',
  'versatile',
] as const;

export const Weapon = z
  .object({
    id: Id,
    name: z.string().min(1),
    category: z.enum(['simple', 'martial']),
    kind: z.enum(['melee', 'ranged']),
    damage: z.object({ dice: Dice, type: DamageTypeId }).strict(),
    properties: z.array(z.enum(WEAPON_PROPERTIES)).default([]),
    range: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    versatile: Dice.optional(),
    costGp: z.number().min(0),
    weightLb: z.number().min(0),
    ...Verify,
  })
  .strict()
  .refine(
    (w) => w.properties.includes('versatile') === !!w.versatile,
    'versatile weapons need a versatile die',
  )
  .refine(
    (w) => (w.properties.includes('thrown') || w.properties.includes('ammunition')) === !!w.range,
    'thrown and ammunition weapons need a range',
  );
export type Weapon = z.infer<typeof Weapon>;
export const WeaponFile = fileOf('weapons', Weapon);

export const Armor = z
  .object({
    id: Id,
    name: z.string().min(1),
    category: z.enum(['light', 'medium', 'heavy', 'shield']),
    /** Base AC, or the bonus for a shield. */
    ac: z.number().int().positive(),
    /** Max Dex bonus: null = no cap, 0 = none added. */
    dexCap: z.number().int().min(0).nullable(),
    strength: z.number().int().positive().optional(),
    stealthDisadvantage: z.boolean().default(false),
    costGp: z.number().min(0),
    weightLb: z.number().min(0),
    ...Verify,
  })
  .strict();
export const ArmorFile = fileOf('armor', Armor);

export const MagicItem = z
  .object({
    id: Id,
    name: z.string().min(1),
    /** The DMG item it uses, or "homebrew". */
    base: z.string().min(1),
    kind: z.enum(['weapon', 'armor', 'shield', 'potion', 'ring', 'wondrous', 'staff', 'cloak']),
    rarity: z.enum(['common', 'uncommon', 'rare', 'very-rare']),
    attunement: z.union([z.boolean(), z.literal('spellcaster')]),
    /** For +1 weapons etc.: which weapon ids it can be ("any" = the player's choice). */
    baseWeapon: z.union([Id, z.literal('any'), z.array(Id)]).optional(),
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    source: z.string().min(1).optional(),
    consumable: z.boolean().default(false),
    /** Passive bonuses while equipped/attuned, or what using it does. */
    effects: z.array(Effect).default([]),
    summary: z.string().min(1),
    homebrew: z.boolean().default(false),
    costGp: z.number().min(0).optional(),
    ...Verify,
  })
  .strict();
export type MagicItem = z.infer<typeof MagicItem>;
export const MagicItemFile = fileOf('items', MagicItem);
