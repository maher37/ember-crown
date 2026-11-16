/**
 * Random numbers for the rules engine.
 *
 * Every roll in the game goes through a `RandomSource`. The normal one is `SeededRng`: the same
 * seed always gives the same rolls, and its whole state is one number, so a save file can store
 * it and a bug can be replayed exactly (CLAUDE.md, "Seeded RNG everywhere").
 */
export interface RandomSource {
  /** A whole number from 1 to `sides`, inclusive. */
  die(sides: number): number;
}

/** mulberry32: a small, fast, well-tested 32-bit generator. Its state is a single uint32. */
export class SeededRng implements RandomSource {
  private s: number;

  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  }

  /** Rebuild a generator from `state`, e.g. after loading a save. */
  static fromState(state: number): SeededRng {
    return new SeededRng(state);
  }

  /** The current state. Store this in saves; `fromState` resumes from it exactly. */
  get state(): number {
    return this.s;
  }

  /** A float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  die(sides: number): number {
    assertSides(sides);
    return 1 + Math.floor(this.next() * sides);
  }
}

/**
 * Plays back a fixed list of die results. Tests use it to force exact rolls ("the d20 shows 20"),
 * and the "click to roll my own dice" option can feed player rolls through it later.
 */
export class ScriptedRng implements RandomSource {
  private readonly queue: number[];

  constructor(results: number[]) {
    this.queue = [...results];
  }

  die(sides: number): number {
    assertSides(sides);
    const r = this.queue.shift();
    if (r === undefined) throw new Error(`ScriptedRng ran out of results (wanted a d${sides})`);
    if (!Number.isInteger(r) || r < 1 || r > sides) {
      throw new Error(`ScriptedRng result ${r} is not a valid d${sides} roll`);
    }
    return r;
  }

  get remaining(): number {
    return this.queue.length;
  }
}

/** Turn any text (e.g. "new game 2026-11-16") into a 32-bit seed. FNV-1a hash. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function assertSides(sides: number): void {
  if (!Number.isInteger(sides) || sides < 1) throw new Error(`Invalid die size: ${sides}`);
}
