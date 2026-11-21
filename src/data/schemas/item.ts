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
    /** Where it is worn, for wondrous items (the Locket at the neck, the Boots on the feet). */
    slot: z.enum(['neck', 'feet', 'trinket']).optional(),
    /** In our own words: how it works in a fight and out of one (shown on the sheet). */
    howItWorks: z.string().min(1).optional(),
    /** Brannoc can get it from this act on (rare finds in the shop). */
    shopAct: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    ...Verify,
  })
  .strict();
export type MagicItem = z.infer<typeof MagicItem>;
export const MagicItemFile = fileOf('items', MagicItem);

/** What a piece of adventuring gear does when used (PHB Chapter 5, Adventuring Gear). */
export const GearUse = z.discriminatedUnion('type', [
  /** Thrown like a flask: a ranged attack (improvised weapon) that deals damage on a hit. */
  z
    .object({
      type: z.literal('throw'),
      rangeFt: z.number().int().positive(),
      dice: Dice,
      damageType: DamageTypeId,
      /** Only these creature types are hurt (holy water: undead and fiends). */
      onlyVs: z.array(z.string().min(1)).optional(),
      /** Keeps burning each turn until put out (alchemist's fire). */
      burning: z.boolean().optional(),
    })
    .strict(),
  /** Stabilize a dying creature without a Medicine check (healer's kit). */
  z.object({ type: z.literal('stabilize') }).strict(),
]);
export type GearUse = z.infer<typeof GearUse>;

export const Gear = z
  .object({
    id: Id,
    name: z.string().min(1),
    category: z.enum(['gear', 'tool', 'light', 'throwable']),
    costGp: z.number().min(0),
    /** In our own words: what it is and what it does in this game. */
    summary: z.string().min(1),
    use: GearUse.optional(),
    /** Used up when used (thrown flasks). Everything else lasts (no bookkeeping, D24). */
    consumable: z.boolean().default(false),
    ...Verify,
  })
  .strict();
export type Gear = z.infer<typeof Gear>;

export const GearFile = z
  .object({
    ...Verify,
    gear: z.array(Gear).min(1),
    /** What a new party starts with (PHB starting equipment, simplified): items and gold per hero. */
    startingSupplies: z
      .object({
        items: z.record(Id, z.number().int().positive()),
        /** Extra items when a hero of this class is in the party (rogues: thieves' tools). */
        byClass: z.record(Id, z.record(Id, z.number().int().positive())),
        goldPerHero: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();
