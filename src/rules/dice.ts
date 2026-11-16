import type { RandomSource } from './rng';

/** A parsed dice expression such as "2d6+3": `count` dice of `sides`, plus `bonus`. */
export interface DiceExpr {
  count: number;
  sides: number;
  bonus: number;
}

export interface DiceRoll {
  expr: DiceExpr;
  /** Each die's result, in order. */
  rolls: number[];
  total: number;
  /** Log text, e.g. "2d6+3 (4, 6) + 3 = 13". */
  text: string;
}

const DICE_RE = /^\s*(?:(\d*)d(\d+)\s*([+-]\s*\d+)?|([+-]?\s*\d+))\s*$/i;

/** Parse "1d8", "2d6+3", "d20", "1d4-1" or a flat number like "5". */
export function parseDice(notation: string): DiceExpr {
  const m = DICE_RE.exec(notation);
  if (!m) throw new Error(`Bad dice notation: "${notation}"`);
  const num = (s: string) => Number(s.replace(/\s/g, ''));
  if (m[4] !== undefined) return { count: 0, sides: 0, bonus: num(m[4]) };
  return { count: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), bonus: m[3] ? num(m[3]) : 0 };
}

export function formatDice({ count, sides, bonus }: DiceExpr): string {
  const dice = count > 0 ? `${count}d${sides}` : '';
  if (!bonus) return dice || '0';
  if (!dice) return String(bonus);
  return `${dice}${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`;
}

/** Roll a dice expression. Pass a string or a parsed `DiceExpr`. */
export function roll(notation: string | DiceExpr, rng: RandomSource): DiceRoll {
  const expr = typeof notation === 'string' ? parseDice(notation) : notation;
  const rolls = Array.from({ length: expr.count }, () => rng.die(expr.sides));
  const total = rolls.reduce((a, b) => a + b, 0) + expr.bonus;
  return { expr, rolls, total, text: describeRoll(expr, rolls, total) };
}

export function describeRoll(expr: DiceExpr, rolls: number[], total: number): string {
  const parts: string[] = [];
  if (rolls.length) parts.push(`(${rolls.join(', ')})`);
  if (expr.bonus) parts.push(`${expr.bonus > 0 ? '+' : '-'} ${Math.abs(expr.bonus)}`);
  return `${formatDice(expr)} ${parts.join(' ')} = ${total}`;
}

/** "+5", "-1", "+0": how modifiers are shown in the log. */
export function signed(n: number): string {
  return n < 0 ? `- ${-n}` : `+ ${n}`;
}
