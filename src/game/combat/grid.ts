import type { CombatMap, CombatState, Combatant, Pos, TerrainKind } from './types';

export const CELL_FEET = 5;
const LETTERS: Record<string, TerrainKind> = {
  '.': 'open',
  '=': 'road',
  b: 'brush',
  T: 'trees',
  r: 'boulder',
};

export function parseMap(width: number, height: number, rows: string[]): CombatMap {
  return {
    width,
    height,
    style: 'forest-road',
    terrain: rows.map((r) => [...r].map((ch) => LETTERS[ch] ?? 'open')),
  };
}

export const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const inBounds = (m: CombatMap, p: Pos) =>
  p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
export const terrainAt = (m: CombatMap, p: Pos): TerrainKind => m.terrain[p.y]?.[p.x] ?? 'trees';
export const blocksMovement = (t: TerrainKind) => t === 'trees' || t === 'boulder';
export const blocksSight = (t: TerrainKind) => t === 'trees';
// PHB: Difficult Terrain. Every foot costs 1 extra foot.
export const isDifficult = (t: TerrainKind) => t === 'brush';

/** PHB: distance on a grid. Each square is 5 feet, diagonals included (Chebyshev). */
export function distanceFeet(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * CELL_FEET;
}

export const isAdjacent = (a: Pos, b: Pos) => distanceFeet(a, b) === CELL_FEET;

export const living = (s: CombatState) =>
  Object.values(s.combatants).filter((c) => !c.gone && !c.creature.dead);
export const conscious = (c: Combatant) => !c.gone && !c.creature.dead && c.creature.hp > 0;

export function occupant(s: CombatState, p: Pos): Combatant | undefined {
  return Object.values(s.combatants).find((c) => !c.gone && !c.creature.dead && samePos(c.pos, p));
}

/** Cells on the line between two cell centers (Bresenham), excluding both ends. */
export function lineCells(a: Pos, b: Pos): Pos[] {
  const out: Pos[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    if (!(x0 === b.x && y0 === b.y)) out.push({ x: x0, y: y0 });
  }
  return out;
}

export function hasLineOfSight(m: CombatMap, a: Pos, b: Pos): boolean {
  // PHB: Darkness. Nobody sees into, out of or through it.
  if (m.dark?.length) {
    const dark = new Set(m.dark);
    if ([a, b, ...lineCells(a, b)].some((p) => dark.has(posKey(p)))) return false;
  }
  return lineCells(a, b).every((p) => !blocksSight(terrainAt(m, p)));
}

/**
 * Feet to step into a cell for this mover: difficult terrain doubles it (flying ignores it),
 * and so do Spike Growth and Spirit Guardians for those they slow.
 */
export function moveCost(
  s: CombatState,
  mover: Combatant,
  p: Pos,
  slows: (s: CombatState, m: Combatant, p: Pos) => boolean = () => false,
): number {
  const flying = mover.effects.some((e) => e.tag === 'flying');
  const difficult = (!flying && isDifficult(terrainAt(s.map, p))) || slows(s, mover, p);
  return (difficult ? 2 : 1) * CELL_FEET;
}

/**
 * PHB: Cover (simplified for the grid [inferred]). Trees between you = total cover; a boulder or
 * another creature in the way = half cover. Adjacent creatures never have cover from each other.
 */
export function coverBetween(
  s: CombatState,
  from: Pos,
  to: Pos,
  ignoreIds: string[] = [],
): 'none' | 'half' | 'total' {
  if (isAdjacent(from, to)) return 'none';
  let cover: 'none' | 'half' = 'none';
  for (const p of lineCells(from, to)) {
    const t = terrainAt(s.map, p);
    if (blocksSight(t)) return 'total';
    if (t === 'boulder') cover = 'half';
    const o = occupant(s, p);
    if (o && !ignoreIds.includes(o.id)) cover = 'half';
  }
  return cover;
}

const DIRS = [-1, 0, 1]
  .flatMap((dx) => [-1, 0, 1].map((dy) => ({ dx, dy })))
  .filter((d) => d.dx || d.dy);

/** Feet to step into a cell (difficult terrain doubles it). */
export const stepCost = (m: CombatMap, p: Pos) =>
  (isDifficult(terrainAt(m, p)) ? 2 : 1) * CELL_FEET;

/**
 * Cheapest paths from a start cell (Dijkstra). You can pass through allies but not enemies,
 * and can't end in an occupied cell. PHB: Moving Around Other Creatures.
 */
export function reachable(
  s: CombatState,
  mover: Combatant,
  maxFeet: number,
  slows?: (s: CombatState, m: Combatant, p: Pos) => boolean,
): Map<string, { cost: number; path: Pos[] }> {
  const key = (p: Pos) => `${p.x},${p.y}`;
  const best = new Map<string, { cost: number; path: Pos[] }>([
    [key(mover.pos), { cost: 0, path: [] }],
  ]);
  const queue: { p: Pos; cost: number; path: Pos[] }[] = [{ p: mover.pos, cost: 0, path: [] }];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    for (const d of DIRS) {
      const n = { x: cur.p.x + d.dx, y: cur.p.y + d.dy };
      if (!inBounds(s.map, n) || blocksMovement(terrainAt(s.map, n))) continue;
      const o = occupant(s, n);
      if (o && o.side !== mover.side && conscious(o)) continue;
      const cost = cur.cost + moveCost(s, mover, n, slows ?? zoneSlowsHook);
      if (cost > maxFeet) continue;
      const k = key(n);
      if (best.has(k) && best.get(k)!.cost <= cost) continue;
      const path = [...cur.path, n];
      best.set(k, { cost, path });
      queue.push({ p: n, cost, path });
    }
  }
  // Can't end a move in an occupied square.
  for (const [k, v] of best) {
    const last = v.path.at(-1);
    if (last && occupant(s, last)) best.delete(k);
  }
  return best;
}

export const posKey = (p: Pos) => `${p.x},${p.y}`;

// ── Area templates (PHB: Areas of Effect, on a grid [inferred conversion]) ──

/** Sphere / cylinder / aura: every square within `radiusFeet` of the center square. */
export function sphereCells(m: CombatMap, center: Pos, radiusFeet: number): Pos[] {
  const r = Math.floor(radiusFeet / CELL_FEET);
  const out: Pos[] = [];
  for (let y = center.y - r; y <= center.y + r; y++)
    for (let x = center.x - r; x <= center.x + r; x++)
      if (inBounds(m, { x, y })) out.push({ x, y });
  return out;
}

/** Cone from the caster toward `toward`: length = width at the far end (about 53°). */
export function coneCells(m: CombatMap, origin: Pos, toward: Pos, lengthFeet: number): Pos[] {
  const len = lengthFeet / CELL_FEET;
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  const mag = Math.hypot(dx, dy) || 1;
  const out: Pos[] = [];
  for (let y = origin.y - len; y <= origin.y + len; y++)
    for (let x = origin.x - len; x <= origin.x + len; x++) {
      const p = { x, y };
      if (!inBounds(m, p) || samePos(p, origin)) continue;
      const vx = x - origin.x;
      const vy = y - origin.y;
      const along = (vx * dx + vy * dy) / mag;
      if (along <= 0 || along > len + 0.01) continue;
      const across = Math.abs(vx * dy - vy * dx) / mag;
      if (across <= along / 2 + 0.5) out.push(p);
    }
  return out;
}

/** Cube that starts next to the caster and extends toward `toward`. */
export function cubeCells(m: CombatMap, origin: Pos, toward: Pos, sizeFeet: number): Pos[] {
  const n = sizeFeet / CELL_FEET;
  const sx = Math.sign(toward.x - origin.x);
  const sy = Math.sign(toward.y - origin.y);
  const x0 = sx > 0 ? origin.x + 1 : sx < 0 ? origin.x - n : origin.x - Math.floor(n / 2);
  const y0 = sy > 0 ? origin.y + 1 : sy < 0 ? origin.y - n : origin.y - Math.floor(n / 2);
  const out: Pos[] = [];
  for (let y = y0; y < y0 + n; y++)
    for (let x = x0; x < x0 + n; x++) if (inBounds(m, { x, y })) out.push({ x, y });
  return out;
}

/** Set by zones.ts so reachable() knows about Spike Growth without an import cycle. */
let zoneSlowsHook: (s: CombatState, m: Combatant, p: Pos) => boolean = () => false;
export function setZoneSlows(f: typeof zoneSlowsHook): void {
  zoneSlowsHook = f;
}
