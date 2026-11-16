import { z } from 'zod';
import { fileOf, Id, SkillId, Verify } from './common';

export const Background = z
  .object({
    id: Id,
    name: z.string().min(1),
    skills: z.tuple([SkillId, SkillId]),
    tools: z.array(z.string().min(1)).default([]),
    extraLanguages: z.number().int().min(0).default(0),
    feature: z.object({ name: z.string().min(1), summary: z.string().min(1) }).strict(),
    /** Where this background opens dialogue options (docs/Rules_Scope.md §3). */
    dialogueTag: z.string().min(1),
    ...Verify,
  })
  .strict();
export type Background = z.infer<typeof Background>;
export const BackgroundFile = fileOf('backgrounds', Background);
