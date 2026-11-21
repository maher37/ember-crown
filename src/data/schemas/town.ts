// Ashford's shops, the town hall's bounty board, and things to find while exploring.
import { z } from 'zod';
import { AbilityId, DamageTypeId, Dice, fileOf, Id, Verify } from './common';
import { StoryCondition } from './story';

const Act = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const Category = z.enum(['gear', 'weapon', 'armor', 'shield', 'potion', 'magic']);

/** A shop: a keeper, what they stock (from which act), and what they buy back. */
export const Shop = z
  .object({
    id: Id,
    name: z.string().min(1),
    keeper: z.string().min(1),
    /** The keeper's greeting, in our own words. */
    blurb: z.string().min(1),
    /** Whole categories of the standard PHB catalog (gear, weapons, armor, shields). */
    categories: z.array(z.enum(['gear', 'weapon', 'armor', 'shield'])).default([]),
    /** Particular items (magic items, potions), each from an act on (default: the item's shopAct, else 1). */
    items: z.array(z.object({ id: Id, act: Act.optional() }).strict()).default([]),
    /** What the keeper buys back, at half price (PHB: Selling Treasure). */
    buys: z.array(Category).default([]),
    /** Purchases allowed per visit (travelling and hidden merchants). */
    limit: z.number().int().positive().optional(),
    /** Only this many of `items` are on the cart at a time, changing each visit. */
    rotating: z.number().int().positive().optional(),
    /** In town only on market days (days 1–4 of each tenday, and festival days). */
    marketDays: z.boolean().default(false),
    /** Services for coin (the temple). */
    services: z
      .array(
        z
          .object({
            id: z.enum(['heal-party', 'raise-dead', 'restore']),
            name: z.string().min(1),
            costGp: z.number().min(0),
            summary: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    ...Verify,
  })
  .strict();
export type Shop = z.infer<typeof Shop>;
export const ShopFile = fileOf('shops', Shop);

/** A notice on the town hall board: a side quest with a fight somewhere and a purse at the end. */
export const Bounty = z
  .object({
    /** The quests.json quest this bounty runs as (steps: hunt, claim). */
    quest: Id,
    act: Act,
    /** The notice, in our own words. */
    poster: z.string().min(1),
    /** Who posted it (signs the notice). */
    from: z.string().min(1),
    place: Id,
    /** The fight at `place` (none for notices that only open an existing side quest). */
    encounter: Id.optional(),
    rewardGp: z.number().int().positive().optional(),
    /** Only posted while this holds. */
    requires: StoryCondition.optional(),
    /** A story flag the notice sets when taken (for notices that open an existing side quest). */
    setsFlag: z.string().min(1).optional(),
    ...Verify,
  })
  .strict();
export type Bounty = z.infer<typeof Bounty>;
export const BountyFile = fileOf('bounties', Bounty);

/** Something to find at a place: a chest, a buried satchel, a peddler's hidden camp. */
export const Find = z
  .object({
    id: Id,
    place: Id,
    /** What it is, once noticed ("A half-buried strongbox"). */
    label: z.string().min(1),
    kind: z.enum(['chest', 'cache', 'buried', 'body', 'herbs', 'note', 'merchant']),
    /** Perception DC to notice it; null = in plain sight. */
    dc: z.number().int().min(5).max(25).nullable(),
    /** What the finder notices (shown when spotted). */
    notice: z.string().min(1),
    /** What's inside / what happens when you look closer. */
    text: z.string().min(1),
    /** Locked: thieves' tools (Sleight of Hand, house rule) at this DC, or force it (Athletics, DC + 2). */
    lock: z
      .object({ dc: z.number().int().min(5).max(25) })
      .strict()
      .optional(),
    /** Trapped: spotted with Investigation at `dc`, disarmed with thieves' tools at `dc`. */
    trap: z
      .object({
        dc: z.number().int().min(5).max(25),
        name: z.string().min(1),
        save: AbilityId,
        saveDc: z.number().int().min(5).max(25),
        dice: Dice,
        type: DamageTypeId,
      })
      .strict()
      .optional(),
    loot: z
      .object({
        gold: z.number().int().min(0).optional(),
        items: z
          .array(z.object({ id: Id, qty: z.number().int().positive().default(1) }).strict())
          .default([]),
      })
      .strict()
      .default({ items: [] }),
    /** Only there from this act on / while this holds. */
    act: Act.optional(),
    requires: StoryCondition.optional(),
    /** Story effects when opened. */
    setsFlag: z.string().min(1).optional(),
    startsQuest: Id.optional(),
    completes: z.object({ quest: Id, step: Id }).strict().optional(),
    /** A hidden merchant: opening it opens this shop. */
    shop: Id.optional(),
    ...Verify,
  })
  .strict();
export type Find = z.infer<typeof Find>;
export const FindFile = fileOf('finds', Find);
