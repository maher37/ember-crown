import { z } from 'zod';
import { fileOf, Id } from './common';

/** The premade origin heroes (Story_Bible §9 and §9b; D33). Saves store one of these ids. */
export const ORIGIN_IDS = ['corin', 'harl', 'nessa', 'vorna'] as const;
export type OriginId = (typeof ORIGIN_IDS)[number];

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const Origin = z
  .object({
    id: z.enum(ORIGIN_IDS),
    name: z.string().min(1),
    /** Banner heading in the creator ("the last king's blood"). */
    title: z.string().min(1),
    speciesId: Id,
    classId: Id,
    /** Suggested subclass (picked to start with, but changeable) when the class picks one at level 1 (cleric domain, warlock patron). */
    subclassId: Id.optional(),
    /** The starting background; the player can still change it, as with Corin. */
    backgroundId: Id,
    portrait: z
      .object({
        skin: Hex,
        hair: Hex,
        eyes: Hex,
        hairStyle: z.enum(['short', 'long', 'bald', 'hood']),
        beard: z.boolean(),
        scar: z.boolean(),
      })
      .strict(),
    /** One or two sentences for the creator banner. */
    pitch: z.string().min(1),
    /** The backstory shown on the character sheet, one paragraph per entry. */
    backstory: z.array(z.string().min(1)).min(1),
    wants: z.string().min(1),
  })
  .strict();
export type Origin = z.infer<typeof Origin>;
export const OriginFile = fileOf('origins', Origin);
