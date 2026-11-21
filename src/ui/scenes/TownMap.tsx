// Ashford from above (original SVG, 900×492), drawn around the spot positions in
// src/data/placeMaps.json: the Hall, the forge, the shrine, the curio shop, the market square,
// the Drowned Lantern on the river and the docks. Ash falls in Act III.
import { useState, type ReactNode } from 'react';
import { Particles, Plume, shapeRng, uid } from './parts';
import './scenes.css';

/** A building seen from above and a little to the south: wall face, roof, door, windows. */
function House({
  x,
  y,
  w,
  h,
  wall,
  roof,
  windows = 2,
  lit = true,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  windows?: number;
  lit?: boolean;
  children?: ReactNode;
}) {
  const wallH = h * 0.42;
  return (
    <g>
      <ellipse cx={x + w / 2} cy={y + h + 4} rx={w * 0.55} ry={6} fill="#000" opacity="0.22" />
      <rect x={x} y={y + h - wallH} width={w} height={wallH} fill={wall} />
      <path
        d={`M${x - 6} ${y + h - wallH} L${x + w / 2} ${y} L${x + w + 6} ${y + h - wallH} Z`}
        fill={roof}
      />
      <path
        d={`M${x + w / 2} ${y} L${x + w + 6} ${y + h - wallH} L${x + w / 2} ${y + h - wallH} Z`}
        fill="#000"
        opacity="0.18"
      />
      <rect x={x + w / 2 - 6} y={y + h - 16} width="12" height="16" rx="5" fill="#3a2516" />
      {Array.from({ length: windows }, (_, i) => {
        const wx = x + ((i + 0.5) * w) / windows - 5 + (i < windows / 2 ? -6 : 6);
        return (
          <rect
            key={i}
            x={wx}
            y={y + h - wallH + 7}
            width="10"
            height="10"
            fill={lit ? '#f3b25e' : '#2b3442'}
            className={lit ? 'anim-glow' : undefined}
          />
        );
      })}
      {children}
    </g>
  );
}

function Tree({
  x,
  y,
  s = 1,
  color = '#3f5a36',
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
}) {
  return (
    <g>
      <ellipse cx={x} cy={y + 10 * s} rx={14 * s} ry={4 * s} fill="#000" opacity="0.2" />
      <rect x={x - 2 * s} y={y} width={4 * s} height={10 * s} fill="#4a3424" />
      <circle cx={x} cy={y - 6 * s} r={14 * s} fill={color} />
      <circle cx={x - 6 * s} cy={y - 10 * s} r={8 * s} fill="#4f6d42" opacity="0.8" />
    </g>
  );
}

/** Ashford, with its streets and buildings. `market`: Odo's wagon is in the square. */
export function TownMap({ act, market }: { act: 1 | 2 | 3; market: boolean }) {
  const [ids] = useState(() => ({
    grass: uid('tgrass'),
    river: uid('triver'),
    glow: uid('tglow'),
    peak: uid('tpeak'),
  }));
  const r = shapeRng(31);
  const road = '#a68f69';
  const ashy = act >= 3;
  return (
    <svg
      viewBox="0 0 900 492"
      width="900"
      height="492"
      className="place-art"
      role="img"
      aria-label="Map of Ashford from above: the north road, Ashford Hall and its notice board, the smithy, the Dawn Shrine, Quillon's Curios, the market square, the well, the Drowned Lantern by the river, and the docks."
    >
      <defs>
        <linearGradient id={ids.grass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ashy ? '#6d6a5c' : '#647a4f'} />
          <stop offset="1" stopColor={ashy ? '#5a584c' : '#4f6440'} />
        </linearGradient>
        <linearGradient id={ids.river} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d7f99" />
          <stop offset="1" stopColor="#2c4e63" />
        </linearGradient>
        <radialGradient id={ids.glow}>
          <stop offset="0" stopColor="#ffb75e" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffb75e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.peak} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b94a6" />
          <stop offset="1" stopColor="#59627a" />
        </linearGradient>
      </defs>

      {/* Ground, the Greypeaks to the north, the Grayflow to the south. */}
      <rect width="900" height="492" fill={`url(#${ids.grass})`} />
      <path
        d="M0 64 L60 24 L120 52 L190 8 L260 50 L330 20 L380 46 L520 46 L580 14 L650 48 L720 18 L800 50 L860 26 L900 44 L900 0 L0 0 Z"
        fill={`url(#${ids.peak})`}
      />
      <path
        d="M178 16 L190 8 L202 17 Z M570 22 L580 14 L590 22 Z M710 26 L720 18 L730 26 Z"
        fill="#eef2f7"
      />
      {act >= 2 && (
        <ellipse cx="640" cy="10" rx="70" ry="14" fill="#e8833a" opacity={act >= 3 ? 0.45 : 0.25} />
      )}
      <path
        d="M0 440 C150 420 260 470 420 450 S700 420 900 446 L900 492 L0 492 Z"
        fill={`url(#${ids.river})`}
      />
      <path
        d="M30 462 h40 M160 470 h30 M330 466 h50 M520 456 h34 M760 452 h44"
        stroke="#bcd6e4"
        strokeWidth="2"
        opacity="0.5"
        className="anim-shimmer"
      />
      {/* Red lanterns on the river (Lantern Night). */}
      {[90, 300, 400, 520, 800].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={466 + (i % 2) * 8} r="10" fill={`url(#${ids.glow})`} />
          <rect x={x - 3} y={462 + (i % 2) * 8} width="6" height="7" rx="1" fill="#e0603a" />
        </g>
      ))}

      {/* Roads: north road to the square, the high street east–west, lanes to the inn and docks. */}
      <g fill="none" stroke={road} strokeLinecap="round">
        <path d="M452 0 L452 300" strokeWidth="30" />
        <path d="M90 300 C250 296 650 304 860 296" strokeWidth="26" />
        <path d="M300 300 C270 340 240 360 220 392" strokeWidth="18" />
        <path d="M520 300 C560 360 600 400 620 432" strokeWidth="16" />
        <path d="M452 210 C500 200 520 190 548 186" strokeWidth="12" />
        <path d="M720 300 L726 320 M738 196 L740 300 M170 250 L170 300" strokeWidth="12" />
      </g>
      <circle cx="456" cy="300" r="64" fill="#9b8a6e" />
      <circle
        cx="456"
        cy="300"
        r="64"
        fill="none"
        stroke="#7d6e56"
        strokeWidth="3"
        strokeDasharray="4 6"
      />

      {/* Docks. */}
      <g fill="#7a5a3a" stroke="#4a3424" strokeWidth="1.5">
        <rect x="570" y="420" width="110" height="18" />
        <rect x="660" y="420" width="18" height="44" />
        <rect x="580" y="420" width="16" height="40" />
      </g>
      <path d="M700 470 q20 10 50 0 l-6 10 q-20 6 -38 0 Z" fill="#5a3f28" />

      {/* Houses. */}
      {Array.from({ length: 9 }, (_, i) => {
        const spots = [
          [70, 330],
          [110, 120],
          [270, 210],
          [340, 340],
          [380, 120],
          [600, 330],
          [810, 320],
          [800, 210],
          [640, 200],
        ];
        const [hx, hy] = spots[i]!;
        const roofs = ['#7a4030', '#5f4a3a', '#6a5a4a', '#8a5a3a'];
        return (
          <House
            key={i}
            x={hx!}
            y={hy!}
            w={44 + r() * 14}
            h={46}
            wall="#cdbb98"
            roof={roofs[i % roofs.length]!}
            windows={1}
            lit={i % 3 !== 0}
          />
        );
      })}

      {/* Ashford Hall: stone, slate roof, a clock tower (cracked in Act III). */}
      <House x={380} y={70} w={144} h={96} wall="#b8b2a6" roof="#4f5a6a" windows={4}>
        <rect x={438} y={30} width={28} height={70} fill="#a39d92" />
        <path d="M434 32 L452 8 L470 32 Z" fill="#4f5a6a" />
        <circle cx={452} cy={50} r={9} fill="#eef2f7" stroke="#3a3a3a" strokeWidth="2" />
        <path d="M452 50 V44 M452 50 L457 52" stroke="#3a3a3a" strokeWidth="1.5" />
        {act >= 3 && (
          <path d="M446 62 l6 12 l-4 8 l6 10" stroke="#2a2a2a" strokeWidth="2" fill="none" />
        )}
      </House>
      {/* The notice board by the Hall door. */}
      <g>
        <rect
          x={536}
          y={160}
          width={26}
          height={20}
          fill="#6a4a2a"
          stroke="#3a2516"
          strokeWidth="2"
        />
        <rect x={540} y={164} width={8} height={9} fill="#f3ead6" />
        <rect x={550} y={163} width={8} height={11} fill="#ece4cf" />
        <rect x={546} y={180} width={4} height={12} fill="#3a2516" />
      </g>

      {/* Stonemantle Forge: chimney smoke, the anvil glow. */}
      <House x={110} y={150} w={100} h={70} wall="#8f8a80" roof="#3f3a36" windows={1}>
        <rect x={186} y={126} width={14} height={40} fill="#6a625a" />
        <circle cx={150} cy={232} r={26} fill={`url(#${ids.glow})`} className="anim-glow" />
        <path d="M136 236 h26 l-4 6 h-18 Z" fill="#2f2f33" />
      </House>
      <Plume x={193} y={120} scale={0.6} color="#9aa0a8" />

      {/* The Dawn Shrine: white walls, a golden sun. */}
      <House x={690} y={92} w={96} h={70} wall="#ece4cf" roof="#c9a24a" windows={2}>
        <circle cx={738} cy={84} r={14} fill="#f0c95a" stroke="#c98a2a" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <path
              key={i}
              d={`M${738 + Math.cos(a) * 17} ${84 + Math.sin(a) * 17} L${738 + Math.cos(a) * 24} ${84 + Math.sin(a) * 24}`}
              stroke="#f0c95a"
              strokeWidth="3"
            />
          );
        })}
      </House>

      {/* Quillon's Curios: a violet roof and a star on the sign. */}
      <House x={680} y={262} w={90} h={60} wall="#c9bcd8" roof="#5a3f7a" windows={2}>
        <circle cx={760} cy={288} r={16} fill="#b58aff" opacity="0.25" className="anim-glow" />
        <path d="M760 278 l3 7 7 1 -5 5 2 7 -7 -4 -7 4 2 -7 -5 -5 7 -1 Z" fill="#e8d4ff" />
      </House>

      {/* The Drowned Lantern: a big timber inn by the river, its lantern sign. */}
      <House x={150} y={318} w={130} h={74} wall="#b08a5a" roof="#6a3f2a" windows={3}>
        <rect x={146} y={360} width="4" height="22" fill="#3a2516" />
        <circle cx={140} cy={386} r={14} fill={`url(#${ids.glow})`} />
        <rect x={136} y={380} width="8" height="10" rx="2" fill="#e0603a" />
      </House>

      {/* The well. */}
      <g>
        <circle cx={330} cy={258} r={13} fill="#7d7468" stroke="#5a5248" strokeWidth="3" />
        <circle cx={330} cy={258} r={7} fill="#2b3442" />
        <path d="M318 246 L330 236 L342 246" stroke="#5a3f28" strokeWidth="3" fill="none" />
      </g>

      {/* The market square: stalls, and Odo's wagon on market days. */}
      <g>
        {[
          [410, 266, '#b8463a'],
          [496, 266, '#3a7a8a'],
          [410, 326, '#c9a24a'],
        ].map(([sx, sy, c]) => (
          <g key={`${sx}-${sy}`}>
            <rect x={Number(sx) - 14} y={Number(sy)} width="28" height="12" fill="#7a5a3a" />
            <path d={`M${Number(sx) - 18} ${Number(sy)} h36 l-4 -8 h-28 Z`} fill={String(c)} />
          </g>
        ))}
        {market ? (
          <g>
            <rect x={474} y={316} width="48" height="26" rx="3" fill="#2f5a3a" />
            <path d="M474 316 q24 -22 48 0 Z" fill="#e8c27a" />
            <circle cx={482} cy={344} r="7" fill="#3a2516" />
            <circle cx={514} cy={344} r="7" fill="#3a2516" />
            <path d="M474 330 l-14 6" stroke="#5a3f28" strokeWidth="3" />
          </g>
        ) : (
          <path d="M478 340 l40 0" stroke="#7d6e56" strokeWidth="2" strokeDasharray="3 4" />
        )}
      </g>

      {/* Trees. */}
      {[
        [40, 220],
        [70, 150],
        [250, 120],
        [330, 196],
        [612, 120],
        [850, 120],
        [860, 380],
        [40, 404],
        [520, 390],
      ].map(([tx, ty], i) => (
        <Tree
          key={i}
          x={tx!}
          y={ty!}
          s={0.8 + (i % 3) * 0.15}
          color={ashy ? '#5a5a46' : '#3f5a36'}
        />
      ))}

      {ashy && <Particles kind="ash" count={50} seed={12} />}
    </svg>
  );
}
