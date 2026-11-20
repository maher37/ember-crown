// The Drowned Lantern, top-down (original SVG). Laid out to match the clickable spots in
// ExploreScreen: the bar north-east, the hearth west, stairs south-west, the door south.
import { useState } from 'react';
import { shapeRng, uid } from './parts';
import './scenes.css';

const TABLES: [number, number, number][] = [
  [200, 130, 30],
  [200, 226, 30],
  [330, 330, 30],
  [470, 180, 30],
  [800, 410, 28],
];
/** Chairs around each table (angles in degrees). */
const CHAIRS: Record<number, number[]> = {
  0: [180, 0, 270],
  1: [180, 0, 90],
  2: [180, 0],
  3: [180, 0, 270],
  4: [270],
};
/** Townsfolk at their tables: [x, y, cloak colour]. */
const PATRONS: [number, number, string][] = [
  [290, 300, '#4a5a6e'],
  [510, 210, '#5a4a6a'],
  [160, 130, '#6a4a3a'],
  [470, 142, '#4a6a52'],
];

function Lamp({ x, y, r = 90, id }: { x: number; y: number; r?: number; id: string }) {
  return (
    <g>
      <circle className="anim-glow" cx={x} cy={y} r={r} fill={`url(#${id})`} />
      <circle cx={x} cy={y} r="6" fill="#f6c76a" />
      <circle cx={x} cy={y} r="3" fill="#fff1c2" />
    </g>
  );
}

function Patron({ x, y, cloak }: { x: number; y: number; cloak: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx="15" ry="11" fill="#000" opacity="0.25" />
      <ellipse cx={x} cy={y} rx="14" ry="10" fill={cloak} stroke="#2a2420" strokeWidth="1.5" />
      <circle cx={x} cy={y - 1} r="6.5" fill="#c99a76" />
      <path d={`M${x - 6} ${y - 3} a6.5 6.5 0 0 1 12 0`} fill="#3a2a1e" />
    </g>
  );
}

export function TavernMap() {
  const [ids] = useState(() => ({
    planks: uid('planks'),
    fire: uid('hearth'),
    lamp: uid('lamp'),
    moon: uid('moon'),
    vignette: uid('vignette'),
    rug: uid('rug'),
    shadow: uid('shadow'),
  }));
  const r = shapeRng(5);
  const knots = Array.from({ length: 40 }, () => [40 + r() * 820, 40 + r() * 410] as const);
  return (
    <svg
      viewBox="0 0 900 492"
      width="900"
      height="492"
      className="place-art tavern-art"
      role="img"
      aria-label="Top-down map of the Drowned Lantern tavern: bar to the north-east, hearth to the west, stairs to the south-west, and the front door to the south."
    >
      <defs>
        <pattern id={ids.planks} width="120" height="36" patternUnits="userSpaceOnUse">
          <rect width="120" height="18" fill="#5e422c" />
          <rect y="18" width="120" height="18" fill="#573c28" />
          <rect x="30" width="60" height="18" fill="#62452e" />
          <rect x="70" y="18" width="50" height="18" fill="#5a3f2a" />
          <path
            d="M0 17.5 H120 M0 35.5 H120 M30 0 V18 M90 0 V18 M70 18 V36 M10 18 V36"
            stroke="#3b2a1c"
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id={ids.fire}>
          <stop offset="0" stopColor="#ffb25a" stopOpacity="0.42" />
          <stop offset="0.5" stopColor="#e8833a" stopOpacity="0.16" />
          <stop offset="1" stopColor="#e8833a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.lamp}>
          <stop offset="0" stopColor="#ffd28a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.moon} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd4f0" stopOpacity="0.22" />
          <stop offset="1" stopColor="#bcd4f0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.vignette} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <pattern id={ids.rug} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#7a2e26" />
          <path d="M0 8 L8 0 L16 8 L8 16 Z" fill="#8e3a2e" />
        </pattern>
        <filter id={ids.shadow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Walls and floor. */}
      <rect width="900" height="492" fill="#1d242f" />
      <rect x="24" y="24" width="852" height="444" fill={`url(#${ids.planks})`} />
      {knots.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3" ry="1.6" fill="#3b2a1c" opacity="0.6" />
      ))}
      {/* Moonlight through the north windows. */}
      {[300, 420].map((x) => (
        <g key={x}>
          <path d={`M${x} 32 h40 l30 150 h-100 Z`} fill={`url(#${ids.moon})`} />
          <rect x={x} y="20" width="40" height="10" fill="#9fb8d8" />
          <path d={`M${x + 20} 20 v10`} stroke="#2a1f17" strokeWidth="2" />
        </g>
      ))}
      <rect x="24" y="24" width="852" height="444" fill="none" stroke="#2a1f17" strokeWidth="16" />
      <rect x="33" y="33" width="834" height="426" fill="none" stroke="#6a5038" strokeWidth="2" />

      {/* Rug before the hearth, and the hearth itself. */}
      <ellipse
        cx="120"
        cy="226"
        rx="62"
        ry="84"
        fill={`url(#${ids.rug})`}
        stroke="#c9a46a"
        strokeWidth="3"
      />
      <ellipse
        cx="120"
        cy="226"
        rx="50"
        ry="72"
        fill="none"
        stroke="#c9a46a"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect x="20" y="168" width="54" height="116" fill="#5b5752" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M20 ${168 + i * 19.3} H74`} stroke="#45423e" strokeWidth="2" />
      ))}
      <rect x="30" y="190" width="32" height="72" fill="#160d08" />
      <g className="anim-flicker">
        <path d="M46 256 C32 240 38 222 46 204 C54 222 62 240 46 256 Z" fill="#e8833a" />
        <path d="M46 256 C40 246 43 236 46 226 C50 236 53 246 46 256 Z" fill="#f6c76a" />
      </g>
      <circle className="anim-glow" cx="74" cy="226" r="220" fill={`url(#${ids.fire})`} />
      {/* A dog asleep by the fire. */}
      <g transform="translate(108 296) rotate(-20)">
        <ellipse cx="0" cy="0" rx="20" ry="11" fill="#8a6a46" />
        <circle cx="18" cy="-4" r="8" fill="#8a6a46" />
        <path d="M22 -10 l5 -5 l1 7 Z" fill="#6a4c30" />
        <path d="M-20 2 q-10 4 -6 10" stroke="#8a6a46" strokeWidth="4" fill="none" />
      </g>

      {/* The bar: kegs, bottles on the back shelf, stools. */}
      <rect x="560" y="32" width="300" height="20" fill="#3a2516" />
      {Array.from({ length: 18 }, (_, i) => (
        <rect
          key={i}
          x={566 + i * 16}
          y={36}
          width="7"
          height="12"
          rx="2"
          fill={['#3f6b4a', '#7a3a2a', '#c9a46a', '#4a5a7a'][i % 4]}
        />
      ))}
      <g filter={`url(#${ids.shadow})`}>
        {[606, 642].map((x) => (
          <g key={x}>
            <circle cx={x} cy="70" r="15" fill="#6b4529" stroke="#3a2516" strokeWidth="3" />
            <circle cx={x} cy="70" r="10" fill="none" stroke="#2a1a10" strokeWidth="2" />
          </g>
        ))}
        <rect x="574" y="100" width="246" height="34" fill="#3a2516" />
        <rect x="786" y="100" width="34" height="160" fill="#3a2516" />
      </g>
      <rect x="574" y="100" width="246" height="6" fill="#7a5233" />
      <rect x="786" y="100" width="6" height="160" fill="#7a5233" />
      {[600, 650, 740].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="110" width="12" height="14" rx="3" fill="#8a6a46" />
          <ellipse cx={x} cy="110" rx="6" ry="2.5" fill="#efe1c0" />
        </g>
      ))}
      {[600, 650, 700, 750].map((x) => (
        <circle key={x} cx={x} cy="152" r="9" fill="#4a3220" stroke="#2a1c12" strokeWidth="2" />
      ))}
      {[180, 220].map((y) => (
        <circle key={y} cx="766" cy={y} r="9" fill="#4a3220" stroke="#2a1c12" strokeWidth="2" />
      ))}
      {/* Barrels by the cellar. */}
      {[
        [830, 300],
        [848, 336],
        [812, 340],
      ].map(([x, y]) => (
        <g key={`${x}${y}`} filter={`url(#${ids.shadow})`}>
          <circle cx={x} cy={y} r="16" fill="#6b4529" stroke="#2a1a10" strokeWidth="3" />
          <circle cx={x} cy={y} r="9" fill="none" stroke="#3a2516" strokeWidth="2" />
        </g>
      ))}

      {/* Stairs, trapdoor and the door mat. */}
      <rect x="40" y="378" width="112" height="78" fill="#3e2c1e" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect
          key={i}
          x={40 + i * 16}
          y="378"
          width="14"
          height="78"
          fill={i % 2 ? '#4a3424' : '#45301f'}
        />
      ))}
      <rect
        x="700"
        y="300"
        width="44"
        height="44"
        fill="#4a3220"
        stroke="#2a1c12"
        strokeWidth="3"
      />
      <path d="M700 300 L744 344 M744 300 L700 344" stroke="#2a1c12" strokeWidth="2" />
      <circle cx="736" cy="322" r="3" fill="#c9a46a" />
      <rect x="418" y="458" width="74" height="22" fill="#5b402b" />
      <rect x="425" y="430" width="60" height="22" rx="3" fill="#6a5a3a" />
      <path
        d="M418 468 A 74 74 0 0 1 492 468"
        fill="none"
        stroke="#8a6a46"
        strokeWidth="2"
        strokeDasharray="4 4"
      />

      {/* Tables, chairs and what's on them. */}
      {TABLES.map(([x, y, rad], t) => (
        <g key={t}>
          {(CHAIRS[t] ?? []).map((deg) => {
            const a = (deg * Math.PI) / 180;
            const cx = x + Math.cos(a) * (rad + 14);
            const cy = y + Math.sin(a) * (rad + 14);
            return (
              <rect
                key={deg}
                x={cx - 9}
                y={cy - 9}
                width="18"
                height="18"
                rx="4"
                fill="#5c3d26"
                stroke="#3a2516"
                strokeWidth="2"
                transform={`rotate(${deg} ${cx} ${cy})`}
              />
            );
          })}
          <circle
            cx={x}
            cy={y}
            r={rad}
            fill="#7a5232"
            stroke="#3e2a1a"
            strokeWidth="3"
            filter={`url(#${ids.shadow})`}
          />
          <circle cx={x} cy={y} r={rad - 8} fill="none" stroke="#6a4628" strokeWidth="1.5" />
          {/* A candle, a mug and a plate. */}
          <circle className="anim-glow" cx={x} cy={y} r="22" fill={`url(#${ids.lamp})`} />
          <circle cx={x} cy={y} r="3.5" fill="#efe1c0" />
          <circle cx={x} cy={y} r="1.6" fill="#ffb25a" />
          <circle cx={x - 13} cy={y + 9} r="5" fill="#8a6a46" stroke="#efe1c0" strokeWidth="1.5" />
          <circle cx={x + 12} cy={y - 8} r="7" fill="#d9cdb4" />
        </g>
      ))}

      {/* The townsfolk. */}
      {PATRONS.map(([x, y, c]) => (
        <Patron key={`${x}${y}`} x={x} y={y} cloak={c} />
      ))}

      {/* Wall lanterns and their pools of light. */}
      <Lamp x={250} y={50} r={70} id={ids.lamp} />
      <Lamp x={176} y={444} r={70} id={ids.lamp} />
      <Lamp x={852} y={200} r={70} id={ids.lamp} />
      <Lamp x={600} y={444} r={70} id={ids.lamp} />
      <Lamp x={540} y={50} r={70} id={ids.lamp} />

      <rect
        x="24"
        y="24"
        width="852"
        height="444"
        fill={`url(#${ids.vignette})`}
        pointerEvents="none"
      />
    </svg>
  );
}
