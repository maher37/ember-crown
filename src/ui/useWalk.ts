import { useRef, useState } from 'react';
import { sound } from '../audio/engine';

/** Where the party last stood on each walk-around map (kept while you talk or fight). */
const lastSpot = new Map<string, [number, number]>();
const remember = (key: string, spot: [number, number]) => {
  lastSpot.set(key, spot);
};

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A spot a few steps short of (x, y), on the side facing `center`, kept inside the map. */
export function standNear(
  x: number,
  y: number,
  center: [number, number],
  bounds: [number, number, number, number] = [70, 70, 830, 420],
): [number, number] {
  const dx = center[0] - x;
  const dy = center[1] - y;
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(56, d);
  return [
    Math.max(bounds[0], Math.min(bounds[2], x + (dx / d) * step)),
    Math.max(bounds[1], Math.min(bounds[3], y + (dy / d) * step)),
  ];
}

/** The party's marching shape around where they stand. */
export const PARTY_OFFSETS: [number, number][] = [
  [0, -18],
  [-26, 4],
  [26, 4],
  [0, 24],
];

/** The party walks to what you click (with a footstep sound), then the click happens. */
export function useWalk(key: string, start: [number, number], center: [number, number]) {
  const [at, setAt] = useState<[number, number]>(() => lastSpot.get(key) ?? start);
  const walking = useRef(false);
  const walkTo = (x: number, y: number, then: () => void) => {
    if (walking.current) return;
    const spot = standNear(x, y, center);
    const far = Math.hypot(spot[0] - at[0], spot[1] - at[1]) > 20;
    remember(key, spot);
    setAt(spot);
    if (!far || reduceMotion()) return then();
    walking.current = true;
    sound.play('steps');
    window.setTimeout(() => {
      walking.current = false;
      then();
    }, 700);
  };
  return { at, walkTo };
}
