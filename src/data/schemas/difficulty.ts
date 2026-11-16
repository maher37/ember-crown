import { z } from 'zod';

// Difficulty setting (docs/RPG_Game_Plan.md, D9): Easy / Medium / Hard, Medium by default.
export const DifficultyId = z.enum(['easy', 'medium', 'hard']);
export type DifficultyId = z.infer<typeof DifficultyId>;

export const DifficultyLevel = z.object({
  id: DifficultyId,
  name: z.string().min(1),
  tag: z.string().min(1),
  summary: z.array(z.string().min(1)).min(1),
});
export type DifficultyLevel = z.infer<typeof DifficultyLevel>;

export const DifficultyFile = z
  .object({
    default: DifficultyId,
    levels: z.array(DifficultyLevel).length(3),
  })
  .refine((f) => new Set(f.levels.map((l) => l.id)).size === f.levels.length, {
    message: 'Each difficulty id must appear exactly once',
  });
export type DifficultyFile = z.infer<typeof DifficultyFile>;
