import { describe, expect, it } from 'vitest';
import { dataFiles, difficulties } from '../../src/data';
import { DifficultyFile } from '../../src/data/schemas/difficulty';

describe('data files', () => {
  it.each(dataFiles.map((f) => [f.name, f] as const))('%s passes its zod schema', (_name, file) => {
    const result = file.schema.safeParse(file.raw);
    expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
  });
});

describe('difficulties (D9)', () => {
  it('offers Easy, Medium and Hard in that order', () => {
    expect(difficulties.levels.map((l) => l.id)).toEqual(['easy', 'medium', 'hard']);
  });

  it('defaults to Medium', () => {
    expect(difficulties.default).toBe('medium');
  });

  it('rejects a file with a duplicated difficulty', () => {
    const bad = {
      default: 'easy',
      levels: [
        { id: 'easy', name: 'Easy', tag: 't', summary: ['x'] },
        { id: 'easy', name: 'Easy', tag: 't', summary: ['x'] },
        { id: 'hard', name: 'Hard', tag: 't', summary: ['x'] },
      ],
    };
    expect(DifficultyFile.safeParse(bad).success).toBe(false);
  });
});
