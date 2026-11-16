import { z } from 'zod';
import { Id, Verify } from './common';

const Cell = z.tuple([z.number().int().min(0), z.number().int().min(0)]);

/**
 * Terrain letters: "." open, "=" road, "b" brush (difficult terrain; somewhere to hide),
 * "T" trees (block movement and sight), "r" boulder (blocks movement; half cover).
 */
export const TERRAIN = { '.': 'open', '=': 'road', b: 'brush', T: 'trees', r: 'boulder' } as const;

export const Encounter = z
  .object({
    id: Id,
    code: z.string().min(1),
    name: z.string().min(1),
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** docs/Encounters_and_XP.md: XP per character, the same on every difficulty. */
    xpPerPc: z.number().int().positive(),
    briefing: z.string().min(1),
    /** Whether the enemies roll Stealth to surprise the party. */
    surprise: z.boolean(),
    map: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        style: z.string().min(1),
        terrain: z.array(z.string().regex(/^[.=bTr]+$/)),
      })
      .strict()
      .refine(
        (m) => m.terrain.length === m.height && m.terrain.every((r) => r.length === m.width),
        'terrain must match width × height',
      ),
    partyStart: z.array(Cell).length(4),
    /** Talk-or-fight: a party-best skill check that avoids the fight for the same XP (D16). */
    talk: z
      .object({
        skill: z.string().min(1),
        dc: z.number().int().positive(),
        prompt: z.string().min(1),
        success: z.string().min(1),
        failure: z.string().min(1),
        note: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    enemies: z
      .array(
        z
          .object({
            id: Id,
            monster: Id,
            name: z.string().min(1),
            pos: Cell,
            difficulties: z.array(z.enum(['easy', 'medium', 'hard'])).min(1),
            tactic: z.enum(['melee', 'ranged']),
          })
          .strict(),
      )
      .min(1),
    ...Verify,
  })
  .strict();
export type Encounter = z.infer<typeof Encounter>;
export const EncounterFile = z
  .object({
    ...Verify,
    encounters: z.array(Encounter).min(1),
    /** Encounters_and_XP.md §5b: d8 tables per region (null = a no-fight event, see roadEvents). */
    roadTables: z.record(z.string(), z.array(Id.nullable()).length(8)),
    roadEvents: z.record(
      z.string(),
      z.record(
        z.string(),
        z.object({ text: z.string().min(1), note: z.string().min(1).optional() }).strict(),
      ),
    ),
  })
  .strict();

export const LoadoutFile = z
  .object({
    ...Verify,
    loadouts: z.array(
      z.object({ classId: Id, cantrips: z.array(Id), spells: z.array(Id) }).strict(),
    ),
    defaultChoices: z.object({ warlockInvocations: z.array(Id) }).strict(),
  })
  .strict();
