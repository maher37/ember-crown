// Building blocks for the place backdrops: skies, ridges, trees, water, mist, fire and drifting
// particles. Original vector art. Shapes come from a tiny seeded generator so each place always
// looks the same (presentation only; nothing here touches the game dice).
import { useState, type ReactNode } from 'react';

export const W = 1280;
export const H = 720;

/** mulberry32: a small repeatable random generator for shapes. */
export function shapeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let gid = 0;
/** Unique ids for gradients (several scenes can be on screen during a fade). */
export const uid = (name: string) => `${name}-${++gid}`;

export function Sky({
  top,
  bottom,
  glow,
}: {
  top: string;
  bottom: string;
  glow?: [number, number, string];
}) {
  const [id] = useState(() => uid('sky'));
  const [gl] = useState(() => uid('glow'));
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        {glow && (
          <radialGradient id={gl}>
            <stop offset="0" stopColor={glow[2]} stopOpacity="0.7" />
            <stop offset="1" stopColor={glow[2]} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      {glow && <circle cx={glow[0]} cy={glow[1]} r="320" fill={`url(#${gl})`} />}
    </>
  );
}

/** A jagged mountain ridge from x=0 to the right edge, filled down to the bottom. */
export function Ridge({
  y,
  amp,
  color,
  seed,
  step = 60,
  snow,
}: {
  y: number;
  amp: number;
  color: string;
  seed: number;
  step?: number;
  snow?: string;
}) {
  const r = shapeRng(seed);
  const pts: [number, number][] = [];
  for (let x = -40; x <= W + 40; x += step * (0.6 + r() * 0.8))
    pts.push([x, y - r() * amp - (r() < 0.25 ? amp * 0.6 : 0)]);
  const d = `M${pts.map(([x, py]) => `${x.toFixed(0)} ${py.toFixed(0)}`).join(' L')} L${W + 40} ${H} L-40 ${H} Z`;
  return (
    <g>
      <path d={d} fill={color} />
      {snow &&
        pts.map(([x, py], i) => {
          // A cap only on real peaks, following the slopes down a little way.
          const a = pts[i - 1];
          const b = pts[i + 1];
          if (!a || !b || py > y - amp * 0.55 || py > a[1] || py > b[1]) return null;
          const t = (p: [number, number]) => Math.min(0.45, 26 / Math.max(1, p[1] - py));
          const l: [number, number] = [x + (a[0] - x) * t(a), py + (a[1] - py) * t(a)];
          const r2: [number, number] = [x + (b[0] - x) * t(b), py + (b[1] - py) * t(b)];
          const mid = (l[1] + r2[1]) / 2;
          return (
            <path
              key={i}
              d={`M${l[0]} ${l[1]} L${x} ${py} L${r2[0]} ${r2[1]} L${x + (r2[0] - x) * 0.4} ${mid - 6} L${x} ${mid + 2} L${x + (l[0] - x) * 0.4} ${mid - 5} Z`}
              fill={snow}
            />
          );
        })}
    </g>
  );
}

/** Rolling ground (softer than a ridge). */
export function Hills({
  y,
  amp,
  color,
  seed,
}: {
  y: number;
  amp: number;
  color: string;
  seed: number;
}) {
  const r = shapeRng(seed);
  let d = `M-20 ${y}`;
  for (let x = 0; x <= W + 200; x += 200) {
    const cy = y - r() * amp;
    d += ` Q${x + 100} ${cy - amp * 0.5} ${x + 200} ${y - r() * amp * 0.5}`;
  }
  d += ` L${W + 200} ${H} L-20 ${H} Z`;
  return <path d={d} fill={color} />;
}

export function Pine({ x, y, h, color }: { x: number; y: number; h: number; color: string }) {
  const w = h * 0.42;
  return (
    <g>
      <rect x={x - h * 0.03} y={y - h * 0.15} width={h * 0.06} height={h * 0.15} fill="#2a1d14" />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${x} ${y - h + i * h * 0.22} L${x + w * (0.55 + i * 0.22)} ${y - h * 0.4 + i * h * 0.18} L${x - w * (0.55 + i * 0.22)} ${y - h * 0.4 + i * h * 0.18} Z`}
          fill={color}
        />
      ))}
    </g>
  );
}

/** A band of pines between x0 and x1. */
export function Forest({
  x0,
  x1,
  y,
  h,
  color,
  seed,
  gap = 26,
}: {
  x0: number;
  x1: number;
  y: number;
  h: number;
  color: string;
  seed: number;
  gap?: number;
}) {
  const r = shapeRng(seed);
  const trees: ReactNode[] = [];
  for (let x = x0; x < x1; x += gap * (0.6 + r() * 0.8))
    trees.push(<Pine key={x} x={x} y={y + r() * 14} h={h * (0.7 + r() * 0.5)} color={color} />);
  return <g>{trees}</g>;
}

/** Still water with a few moving glints. */
export function Water({
  y,
  color,
  glint = '#cfe0f0',
  h = H - y,
}: {
  y: number;
  color: string;
  glint?: string;
  h?: number;
}) {
  const r = shapeRng(y);
  return (
    <g>
      <rect x="0" y={y} width={W} height={h} fill={color} />
      <g
        className="anim-shimmer"
        stroke={glint}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      >
        {Array.from({ length: 22 }, (_, i) => {
          const gx = r() * W;
          const gy = y + 10 + r() * (h - 20);
          return <path key={i} d={`M${gx} ${gy} h${20 + r() * 50}`} />;
        })}
      </g>
    </g>
  );
}

/** Slow drifting mist. */
export function Mist({
  y,
  color = '#dfe6ee',
  opacity = 0.18,
}: {
  y: number;
  color?: string;
  opacity?: number;
}) {
  const [blur] = useState(() => uid('mist'));
  return (
    <g className="anim-drift" opacity={opacity} filter={`url(#${blur})`}>
      <defs>
        <filter id={blur} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={i * 330 - 60} cy={y + (i % 2) * 24} rx="320" ry="38" fill={color} />
      ))}
    </g>
  );
}

/** A flickering fire, with a glow on the ground. */
export function Fire({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [g] = useState(() => uid('fireglow'));
  return (
    <g>
      <defs>
        <radialGradient id={g}>
          <stop offset="0" stopColor="#ffb25a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="anim-glow" cx={x} cy={y - 10 * s} r={140 * s} fill={`url(#${g})`} />
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path
          d="M-26 6 L26 -4 M-24 -4 L24 6"
          stroke="#3a2516"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <g className="anim-flicker">
          <path d="M0 0 C-20 -18 -10 -40 0 -64 C10 -40 22 -20 0 0 Z" fill="#e8833a" />
          <path d="M0 0 C-10 -12 -6 -26 0 -40 C6 -26 12 -12 0 0 Z" fill="#f6c76a" />
        </g>
      </g>
    </g>
  );
}

/** A rising column of smoke or steam. */
export function Plume({
  x,
  y,
  color = '#c9ced6',
  scale = 1,
}: {
  x: number;
  y: number;
  color?: string;
  scale?: number;
}) {
  const [blur] = useState(() => uid('plume'));
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color} filter={`url(#${blur})`}>
      <defs>
        <filter id={blur} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${(i % 2) * 14 - 7 + i * 4} ${-i * 34})`}>
          <ellipse
            className="anim-rise"
            style={{ animationDelay: `${i * -1.2}s` }}
            cx="0"
            cy="0"
            rx={14 + i * 6}
            ry={10 + i * 4}
            opacity={0.3 - i * 0.04}
          />
        </g>
      ))}
    </g>
  );
}

/** Drifting particles: falling ash or snow, rising embers, or fireflies. */
export function Particles({
  kind,
  count = 40,
  seed = 7,
  color,
}: {
  kind: 'ash' | 'embers' | 'fireflies' | 'snow';
  count?: number;
  seed?: number;
  color?: string;
}) {
  const r = shapeRng(seed);
  const fill =
    color ?? { ash: '#b7b0a6', embers: '#ff9a4a', fireflies: '#e9f59a', snow: '#ffffff' }[kind];
  return (
    <g className={`anim-${kind === 'snow' ? 'ash' : kind}`} fill={fill}>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={r() * W}
          cy={r() * H}
          r={kind === 'embers' ? 1.5 + r() * 2 : kind === 'fireflies' ? 2.5 : 1.2 + r() * 2}
          style={{ animationDelay: `${-r() * 12}s`, animationDuration: `${8 + r() * 8}s` }}
          opacity={0.5 + r() * 0.5}
        />
      ))}
    </g>
  );
}

/** A warm lit window. */
export function Window({ x, y, w = 18, h = 22 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#f3b25e" className="anim-glow" />
      <path
        d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`}
        stroke="#3a2516"
        strokeWidth="2"
      />
    </g>
  );
}
