// Endings and the epilogue slides (docs/Story_Bible.md §8–9). Which slides play depends on flags.
import { epilogue } from '../data';
import { conditionHolds } from './letters';
import type { GameState } from './save';

export type EndingId =
  | 'lamp-lit'
  | 'last-varrow'
  | 'lamp-snuffed'
  | 'ember-queen'
  | 'ember-heir'
  | 'ember-crown'
  | 'guild-prize';

export interface Slide {
  title: string;
  /** Paragraphs. */
  text: string[];
  kind: 'ending' | 'letter' | 'fate';
  note?: string;
}

export const getEnding = (id: string) => {
  const e = epilogue.endings.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown ending "${id}"`);
  return e;
};

/** The slides for this game's ending, in order: the ending, the people, then Maelis's letter. */
export function epilogueSlides(g: GameState): Slide[] {
  const id = String(g.flags['ending'] ?? '');
  if (!id) return [];
  const ending = getEnding(id);
  const out: Slide[] = [{ title: ending.title, text: ending.text, kind: 'ending' }];
  for (const s of epilogue.slides) {
    if (s.endings && !s.endings.includes(id)) continue;
    if (s.except?.includes(id)) continue;
    if (!(s.if ?? []).every((c) => conditionHolds(g, c))) continue;
    out.push({ title: s.title, text: [s.text], kind: 'fate' });
  }
  const letter = ending.letter && epilogue.letters.find((l) => l.id === ending.letter);
  if (letter)
    out.push({
      title: `“${letter.title}”`,
      text: letter.paragraphs,
      kind: 'letter',
      note: letter.note,
    });
  return out;
}
