import type { z } from 'zod';
import difficultiesJson from './difficulties.json';
import { DifficultyFile } from './schemas/difficulty';

/**
 * Every JSON content file, paired with the zod schema that checks it.
 * `npm run validate-data` and the unit tests walk this list; add new files here.
 */
export const dataFiles: { name: string; schema: z.ZodType; raw: unknown }[] = [
  { name: 'difficulties.json', schema: DifficultyFile, raw: difficultiesJson },
];

// Parsed at startup: a broken data file fails loudly instead of misbehaving in play.
export const difficulties: DifficultyFile = DifficultyFile.parse(difficultiesJson);
