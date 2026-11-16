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
      .strict(),
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
    ...Verify,
  })
  .strict();
export type Place = z.infer<typeof Place>;
export const PlaceFile = fileOf('places', Place);

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
