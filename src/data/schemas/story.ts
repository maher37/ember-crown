import { z } from 'zod';
import { fileOf, Id, Verify } from './common';

export const Quest = z
  .object({
    id: Id,
    title: z.string().min(1),
    kind: z.enum(['main', 'side']),
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    summary: z.string().min(1),
    /** XP per character when the quest completes (docs/Encounters_and_XP.md). */
    xp: z.number().int().min(0),
    steps: z.array(z.object({ id: Id, text: z.string().min(1) }).strict()).min(1),
    /** The quest completes when all of these steps are done. */
    completeWhen: z.array(Id).min(1),
    /** Quest that starts when this one completes. */
    next: Id.optional(),
  })
  .strict()
  .refine(
    (q) => q.completeWhen.every((s) => q.steps.some((x) => x.id === s)),
    'completeWhen names an unknown step',
  );
export type Quest = z.infer<typeof Quest>;

export const QuestFile = z
  .object({
    ...Verify,
    quests: z.array(Quest).min(1),
    /** One-off XP awards (fights talked past, discoveries). Per character. */
    awards: z.array(
      z.object({ id: Id, xp: z.number().int().positive(), reason: z.string().min(1) }).strict(),
    ),
  })
  .strict();

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const Npc = z
  .object({
    id: Id,
    name: z.string().min(1),
    title: z.string().min(1),
    portrait: z
      .object({
        skin: Hex,
        hair: Hex,
        eyes: Hex,
        cloth: Hex,
        hairStyle: z.enum(['short', 'long', 'bald', 'hood']),
        beard: z.boolean(),
        scar: z.boolean(),
      })
      .strict()
      /** No portrait: a place speaking (the narrator of a scene). */
      .optional(),
    ...Verify,
  })
  .strict();
export type Npc = z.infer<typeof Npc>;
export const NpcFile = fileOf('npcs', Npc);

export const Place = z
  .object({
    id: Id,
    name: z.string().min(1),
    x: z.number(),
    y: z.number(),
    kind: z.enum(['town', 'main', 'side', 'elite']),
    tag: z.string().min(1),
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Road-encounter table for legs to this place ("none" in town). */
    region: z.enum(['none', 'road', 'marsh', 'heights']),
    desc: z.string().min(1),
    /** Locked until a story flag is set, with a hint for the map. */
    requires: z
      .object({ flag: z.string().min(1), hint: z.string().min(1) })
      .strict()
      .optional(),
    ...Verify,
  })
  .strict();
export type Place = z.infer<typeof Place>;
export const PlaceFile = fileOf('places', Place);

/**
 * A condition on story state: a list of groups that must ALL hold, where each group holds if ANY
 * of its tokens does. A token is a flag name, "quest:<id>" (that quest is done), and "!" in
 * front negates it. [["won:f5", "mouth_cleared"], ["!act1_complete"]] = (won:f5 or mouth_cleared)
 * and not act1_complete.
 */
export const StoryCondition = z.array(z.array(z.string().min(1)).min(1));

/** One clickable spot on a walk-around place map. */
export const MapSpot = z
  .object({
    id: Id,
    label: z.string().min(1),
    /** One or two characters on the marker. */
    glyph: z.string().min(1).max(2),
    /** area: a stage of the place's story; search: something to find; quest: a meeting; exit. */
    kind: z.enum(['area', 'search', 'quest', 'exit']),
    /** The stitch in the place's story to start ("arrive.seam"). Not for exits. */
    knot: z.string().min(1).optional(),
    x: z.number(),
    y: z.number(),
    /** Can be visited once this holds (otherwise shown dimmed, with `hint`). */
    requires: StoryCondition.optional(),
    /** Finished once this holds (shown with a tick). */
    done: StoryCondition.optional(),
    /** Only on the map at all while this holds. */
    showIf: StoryCondition.optional(),
    hint: z.string().min(1).optional(),
    /** Darkness over the unexplored part of the map, lifted once the spot can be visited. */
    fog: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  })
  .strict();
export type MapSpot = z.infer<typeof MapSpot>;

/** A place you walk around instead of reading one long scene (the Old Mine, the King's Kiln). */
export const PlaceMap = z
  .object({
    /** The places.json id. */
    id: Id,
    title: z.string().min(1),
    subtitle: z.string().min(1),
    /** Its Ink story (src/content/dialogue/<story>.ink). */
    story: z.string().min(1),
    /** The quest whose steps show beside the map. */
    quest: Id,
    art: z.enum(['mine', 'kiln']),
    /** Where the party stands on arrival. */
    start: z.tuple([z.number(), z.number()]),
    spots: z.array(MapSpot).min(2),
    ...Verify,
  })
  .strict();
export type PlaceMap = z.infer<typeof PlaceMap>;
export const PlaceMapFile = fileOf('maps', PlaceMap);

export const WixFile = z
  .object({ jokes: z.array(z.string().min(1)).min(1), greeting: z.string().min(1) })
  .strict();

export const Letter = z
  .object({
    id: Id,
    number: z.number().int().min(0),
    title: z.string().min(1),
    /** Story flag that makes this letter arrive at the next long rest (null: in Corin's pack from the start). */
    trigger: z.string().min(1).nullable(),
    when: z.string().min(1),
    /** Verbatim text (docs/Maelis_Letters.md). `if` is a story flag, "!flag", or "corin". */
    paragraphs: z
      .array(z.object({ text: z.string().min(1), if: z.string().min(1).optional() }).strict())
      .min(1),
    originOnly: z.boolean(),
  })
  .strict();
export type Letter = z.infer<typeof Letter>;
export const LetterFile = z
  .object({
    replies: z
      .array(
        z.object({ id: Id, label: z.string().min(1), trust: z.number().int().min(0) }).strict(),
      )
      .min(1),
    trustDcBonus: z
      .object({ threshold: z.number().int().positive(), dcReduction: z.number().int().positive() })
      .strict(),
    letters: z.array(Letter).min(1),
  })
  .strict();

/** Endings and epilogue slides (docs/Story_Bible.md §8–9, Maelis_Letters.md epilogue letters). */
export const EpilogueFile = z
  .object({
    ...Verify,
    endings: z.array(
      z
        .object({
          id: Id,
          title: z.string().min(1),
          text: z.array(z.string().min(1)).min(1),
          /** Maelis's epilogue letter for this ending (verbatim). */
          letter: Id.optional(),
        })
        .strict(),
    ),
    letters: z.array(
      z
        .object({
          id: Id,
          title: z.string().min(1),
          note: z.string().min(1),
          paragraphs: z.array(z.string().min(1)).min(1),
        })
        .strict(),
    ),
    /** Epilogue slides. `if`: all must hold (flag, "!flag", "corin"); `endings` / `except`: ending ids. */
    slides: z.array(
      z
        .object({
          title: z.string().min(1),
          text: z.string().min(1),
          if: z.array(z.string().min(1)).optional(),
          endings: z.array(Id).optional(),
          except: z.array(Id).optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type EpilogueData = z.infer<typeof EpilogueFile>;
