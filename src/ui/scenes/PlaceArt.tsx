// Illustrated backdrops for every place (original vector art, gently animated).
// Each one keeps its main subject on the left, because the story text sits on the right.
import { useState, type ReactNode } from 'react';
import {
  Fire,
  Forest,
  H,
  Hills,
  Mist,
  Particles,
  Pine,
  Plume,
  Ridge,
  shapeRng,
  uid,
  Sky,
  W,
  Water,
  Window,
} from './parts';
import './scenes.css';

export type SceneId =
  | 'tavern'
  | 'cellar'
  | 'road'
  | 'warren'
  | 'mine'
  | 'mill'
  | 'ashwood'
  | 'cave'
  | 'bridge'
  | 'marsh'
  | 'marrowmere'
  | 'abbey'
  | 'sallow'
  | 'deserters'
  | 'bog'
  | 'hall'
  | 'ashford'
  | 'camp'
  | 'forest'
  | 'pass'
  | 'forge'
  | 'kiln'
  | 'caves'
  | 'epilogue';

/** Speakers that are places (npcs.json entries with no portrait) → their scene. */
const SPEAKER_SCENE: Record<string, SceneId> = {
  road: 'road',
  warren: 'warren',
  mine: 'mine',
  mill: 'mill',
  ashwood: 'ashwood',
  cave: 'cave',
  cellar: 'cellar',
  bridge: 'bridge',
  marsh: 'marsh',
  marrowmere: 'marrowmere',
  abbey: 'abbey',
  hall: 'hall',
  camp: 'camp',
  forest: 'forest',
  bog: 'bog',
  pass: 'pass',
  kiln: 'kiln',
  forge: 'forge',
  caves: 'caves',
  ashford: 'ashford',
  epilogue: 'epilogue',
  tavern: 'tavern',
};

/** Where the party is → the scene behind conversations held there. */
const PLACE_SCENE: Record<string, SceneId> = {
  'drowned-lantern': 'tavern',
  ashford: 'ashford',
  'old-mine': 'mine',
  warren: 'warren',
  mill: 'mill',
  ashwood: 'ashwood',
  'steaming-cave': 'cave',
  'toll-bridge': 'bridge',
  abbey: 'abbey',
  marrowmere: 'marrowmere',
  'lizardfolk-grounds': 'marsh',
  sallow: 'sallow',
  'deserters-camp': 'deserters',
  'ashfall-pass': 'pass',
  'great-forge': 'forge',
  'kings-kiln': 'kiln',
  'wix-caves': 'caves',
};

/** True when a speaker is a place (the mine, the tavern…) rather than a person. */
export const isPlaceSpeaker = (id: string) => id in SPEAKER_SCENE;

export function sceneFor(speaker: string, location: string | null | undefined): SceneId {
  return SPEAKER_SCENE[speaker] ?? (location ? PLACE_SCENE[location] : undefined) ?? 'road';
}

export const SCENE_IDS = Object.keys({
  tavern: 1,
  cellar: 1,
  road: 1,
  warren: 1,
  mine: 1,
  mill: 1,
  ashwood: 1,
  cave: 1,
  bridge: 1,
  marsh: 1,
  marrowmere: 1,
  abbey: 1,
  sallow: 1,
  deserters: 1,
  bog: 1,
  hall: 1,
  ashford: 1,
  camp: 1,
  forest: 1,
  pass: 1,
  forge: 1,
  kiln: 1,
  caves: 1,
  epilogue: 1,
} satisfies Record<SceneId, 1>) as SceneId[];

// ------------------------------------------------------------------ shared pieces

function House({
  x,
  y,
  w,
  h,
  roof = '#4a3426',
  wall = '#6b5442',
  lit = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  roof?: string;
  wall?: string;
  lit?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={wall} />
      <path
        d={`M${x - 8} ${y - h} L${x + w / 2} ${y - h - w * 0.45} L${x + w + 8} ${y - h} Z`}
        fill={roof}
      />
      {lit && <Window x={x + w * 0.2} y={y - h * 0.7} w={w * 0.18} h={h * 0.3} />}
      <rect x={x + w * 0.6} y={y - h * 0.5} width={w * 0.18} height={h * 0.5} fill="#2a1d14" />
    </g>
  );
}

function CaveMouth({
  x,
  y,
  w,
  h,
  glow,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  glow?: string;
}) {
  const [gid] = useState(() => uid('cave'));
  return (
    <g>
      <path
        d={`M${x - w * 0.8} ${y} Q${x - w * 0.6} ${y - h * 1.5} ${x} ${y - h * 1.6} Q${x + w * 0.7} ${y - h * 1.5} ${x + w * 0.9} ${y} Z`}
        fill="#3d3833"
      />
      <path
        d={`M${x - w / 2} ${y} Q${x - w / 2} ${y - h} ${x} ${y - h} Q${x + w / 2} ${y - h} ${x + w / 2} ${y} Z`}
        fill="#0f0c0a"
      />
      {glow && (
        <>
          <defs>
            <radialGradient id={gid} cx="0.5" cy="1" r="0.9">
              <stop offset="0" stopColor={glow} stopOpacity="0.6" />
              <stop offset="1" stopColor={glow} stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            className="anim-glow"
            d={`M${x - w / 2} ${y} Q${x - w / 2} ${y - h} ${x} ${y - h} Q${x + w / 2} ${y - h} ${x + w / 2} ${y} Z`}
            fill={`url(#${gid})`}
          />
        </>
      )}
    </g>
  );
}

function Reeds({
  x0,
  x1,
  y,
  seed,
  color = '#5d6b3a',
}: {
  x0: number;
  x1: number;
  y: number;
  seed: number;
  color?: string;
}) {
  const r = shapeRng(seed);
  const out: ReactNode[] = [];
  for (let x = x0; x < x1; x += 6 + r() * 10) {
    const h = 30 + r() * 60;
    out.push(
      <path
        key={x}
        d={`M${x} ${y} q${r() * 10 - 5} ${-h / 2} ${r() * 16 - 8} ${-h}`}
        stroke={color}
        strokeWidth="3"
        fill="none"
      />,
    );
    if (r() < 0.2)
      out.push(<ellipse key={`c${x}`} cx={x + 2} cy={y - h * 0.8} rx="3" ry="9" fill="#5a3d24" />);
  }
  return <g className="anim-sway">{out}</g>;
}

function Moon({ x, y, r = 34 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#f3ead6" opacity="0.85" />;
}

function Stars({ seed, count = 60, maxY = 300 }: { seed: number; count?: number; maxY?: number }) {
  const r = shapeRng(seed);
  return (
    <g fill="#f3ead6" className="anim-twinkle">
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={r() * W}
          cy={r() * maxY}
          r={0.6 + r() * 1.3}
          opacity={0.3 + r() * 0.6}
          style={{ animationDelay: `${-r() * 4}s` }}
        />
      ))}
    </g>
  );
}

function Lantern({ x, y, color = '#f3b25e' }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <circle className="anim-glow" cx={x} cy={y} r="26" fill={color} opacity="0.18" />
      <rect x={x - 5} y={y - 7} width="10" height="14" rx="2" fill={color} />
      <path d={`M${x} ${y - 7} v-10`} stroke="#2a1d14" strokeWidth="2" />
    </g>
  );
}

// ------------------------------------------------------------------ the scenes

const SCENES: Record<SceneId, () => ReactNode> = {
  tavern: () => (
    <>
      <rect width={W} height={H} fill="#2a1d14" />
      {/* Plank wall and beams. */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={i * 110}
          y="0"
          width="108"
          height="470"
          fill={i % 2 ? '#3d2a1c' : '#3a281b'}
        />
      ))}
      <rect y="70" width={W} height="26" fill="#24170f" />
      {[60, 360, 660, 960].map((x) => (
        <rect key={x} x={x} y="0" width="30" height="470" fill="#24170f" />
      ))}
      {/* The hearth. */}
      <rect x="120" y="230" width="300" height="240" fill="#4a4743" />
      <rect x="150" y="300" width="240" height="170" fill="#140c08" />
      <rect x="100" y="215" width="340" height="24" fill="#5b5752" />
      <Fire x={270} y={460} s={1.6} />
      <Lantern x={520} y={160} />
      <Lantern x={900} y={160} />
      {/* Floor, table, mugs. */}
      <rect y="470" width={W} height="250" fill="#4b3424" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M0 ${490 + i * 30} H${W}`} stroke="#3a281b" strokeWidth="2" />
      ))}
      <ellipse cx="300" cy="610" rx="200" ry="44" fill="#5b402b" />
      <ellipse cx="300" cy="600" rx="200" ry="44" fill="#6b4a31" />
      {[230, 300, 370].map((x) => (
        <g key={x}>
          <rect x={x - 12} y="570" width="24" height="28" rx="3" fill="#8a6a46" />
          <ellipse cx={x} cy="570" rx="12" ry="4" fill="#efe1c0" />
        </g>
      ))}
    </>
  ),
  cellar: () => (
    <>
      <rect width={W} height={H} fill="#1a1612" />
      {Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 110 + (row % 2) * 55 - 40}
            y={row * 60}
            width="104"
            height="54"
            rx="4"
            fill={(row + col) % 3 ? '#2e2822' : '#332c25'}
          />
        )),
      )}
      {[120, 260, 400].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="560" rx="60" ry="80" fill="#5b402b" />
          <path
            d={`M${x - 58} 530 H${x + 58} M${x - 58} 590 H${x + 58}`}
            stroke="#3a2516"
            strokeWidth="6"
          />
        </g>
      ))}
      <path d="M520 0 L560 0 L620 200 L580 200 Z" fill="#f3b25e" opacity="0.08" />
      <Lantern x={300} y={330} />
    </>
  ),
  road: () => (
    <>
      <Sky top="#4a5a76" bottom="#e2a66d" glow={[260, 420, '#ffd08a']} />
      <Ridge y={360} amp={150} color="#58637a" seed={3} snow="#dfe6ee" />
      <Ridge y={430} amp={90} color="#47513f" seed={8} />
      <Hills y={520} amp={50} color="#3e4a33" seed={2} />
      <path
        d="M380 720 C340 640 300 560 200 500 L230 500 C340 560 420 640 480 720 Z"
        fill="#8c7652"
      />
      <Forest x0={-20} x1={180} y={560} h={130} color="#2c3a2a" seed={11} />
      <Water y={600} color="#3b5f86" />
    </>
  ),
  warren: () => (
    <>
      <Sky top="#3d4a5f" bottom="#a77d5a" />
      <Ridge y={330} amp={140} color="#525c70" seed={21} snow="#d9dee6" />
      <Hills y={500} amp={80} color="#4a4636" seed={4} />
      <CaveMouth x={280} y={520} w={170} h={130} glow="#e8833a" />
      {/* Palisade with goblin banners. */}
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M${100 + i * 28} 560 V${490 - (i % 3) * 10} l8 -14 l8 14 V560 Z`}
          fill="#5b402b"
        />
      ))}
      <path d="M150 470 V400 L190 412 L150 424" fill="#b04a2a" className="anim-sway" />
      <path d="M380 470 V410 L420 422 L380 434" fill="#b04a2a" className="anim-sway" />
      <Plume x={330} y={360} color="#7a7570" />
      <rect y="560" width={W} height="160" fill="#3a3528" />
    </>
  ),
  mine: () => (
    <>
      <Sky top="#2e3646" bottom="#9a6a4a" glow={[150, 380, '#ffb26a']} />
      <Ridge y={300} amp={160} color="#4b5466" seed={31} snow="#d9dee6" />
      <Ridge y={420} amp={100} color="#3f3b33" seed={32} />
      {/* Spoil heaps, timbered entrance and a crane. */}
      <path d="M-20 560 Q120 470 260 560 Z" fill="#5a4a3a" />
      <path d="M380 560 Q470 500 560 560 Z" fill="#5a4a3a" />
      <rect x="200" y="400" width="200" height="170" fill="#1a1410" />
      <path d="M190 400 H410 M200 400 V570 M400 400 V570" stroke="#7a5a3a" strokeWidth="18" />
      <path d="M300 400 V380" stroke="#7a5a3a" strokeWidth="10" />
      <path
        d="M440 560 V300 L560 330 M440 320 L540 330 M540 330 V420"
        stroke="#6a4c30"
        strokeWidth="8"
        fill="none"
      />
      <Lantern x={180} y={420} />
      <Lantern x={420} y={420} />
      <path d="M260 720 L285 570 H315 L340 720 Z" fill="#6b5a46" />
      <path d="M270 720 L290 570 M330 720 L310 570" stroke="#3a2a1e" strokeWidth="4" />
      <rect y="570" width={W} height="150" fill="#2e2a24" opacity="0.6" />
      <Particles kind="embers" count={14} seed={3} />
    </>
  ),
  mill: () => (
    <>
      <Sky top="#56607a" bottom="#c78b62" />
      <Ridge y={350} amp={120} color="#5a647a" seed={41} snow="#dfe6ee" />
      <Forest x0={420} x1={W} y={470} h={120} color="#2f3b2c" seed={42} />
      <Hills y={470} amp={30} color="#3e4a33" seed={43} />
      <Water y={560} color="#38597d" />
      {/* The mill and its turning wheel. */}
      <rect x="120" y="330" width="220" height="230" fill="#6b5442" />
      <path d="M100 330 L230 240 L360 330 Z" fill="#3e2c20" />
      <Window x={160} y={380} w={34} h={40} />
      <rect x="250" y="460" width="50" height="100" fill="#2a1d14" />
      <g className="anim-spin" style={{ transformOrigin: '400px 520px' }}>
        <circle cx="400" cy="520" r="92" fill="none" stroke="#5b402b" strokeWidth="12" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <path
              key={i}
              d={`M400 520 L${400 + Math.cos(a) * 96} ${520 + Math.sin(a) * 96}`}
              stroke="#5b402b"
              strokeWidth="9"
            />
          );
        })}
      </g>
      <Mist y={570} />
    </>
  ),
  ashwood: () => (
    <>
      <Sky top="#2a3530" bottom="#59684f" />
      <Forest x0={-20} x1={W + 20} y={420} h={240} color="#25302a" seed={51} gap={40} />
      <Forest x0={-20} x1={W + 20} y={560} h={300} color="#1b241f" seed={52} gap={55} />
      <path
        d="M260 720 C280 640 330 600 420 560 L450 570 C380 610 340 660 340 720 Z"
        fill="#6b5a46"
      />
      <Mist y={500} opacity={0.22} />
      <Particles kind="fireflies" count={18} seed={5} />
      <Forest x0={-40} x1={200} y={740} h={420} color="#141a16" seed={53} gap={70} />
    </>
  ),
  cave: () => (
    <>
      <Sky top="#3a3440" bottom="#7a5040" glow={[280, 470, '#ff6a3a']} />
      <Ridge y={320} amp={170} color="#4b4652" seed={61} snow="#d9dee6" />
      <Hills y={560} amp={60} color="#3a332e" seed={62} />
      <CaveMouth x={300} y={590} w={220} h={170} glow="#ff6a3a" />
      <Plume x={250} y={420} color="#e9e4dc" scale={1.5} />
      <Plume x={350} y={430} color="#e9e4dc" scale={1.2} />
      <path d="M0 640 H1280 V720 H0 Z" fill="#2a2420" />
    </>
  ),
  bridge: () => (
    <>
      <Sky top="#4f5d78" bottom="#d6a272" />
      <Ridge y={330} amp={140} color="#56617a" seed={71} snow="#dfe6ee" />
      <Forest x0={600} x1={W} y={430} h={110} color="#2f3b2c" seed={72} />
      <Water y={470} color="#3b5f86" />
      {/* Stone bridge with a toll gate. */}
      <path d="M-20 500 H620 V540 H-20 Z" fill="#7c766c" />
      {[60, 220, 380, 540].map((x) => (
        <path
          key={x}
          d={`M${x - 60} 540 Q${x} 470 ${x + 60} 540 V620 H${x - 60} Z`}
          fill="#615c54"
        />
      ))}
      <rect x="140" y="400" width="80" height="100" fill="#6b5442" />
      <path d="M130 400 L180 360 L230 400 Z" fill="#3e2c20" />
      <path d="M240 440 H420 M240 440 V500" stroke="#5b402b" strokeWidth="8" />
      <path d="M250 440 L270 420 L290 440" stroke="#b04a2a" strokeWidth="6" fill="none" />
      <Lantern x={250} y={420} />
      <Mist y={600} />
    </>
  ),
  marsh: () => (
    <>
      <Sky top="#4b5652" bottom="#a9a88a" />
      <Forest x0={500} x1={W} y={420} h={90} color="#3a4a3c" seed={81} gap={34} />
      <Water y={430} color="#4a5a52" glint="#d9e2d6" />
      <path d="M-20 520 Q160 500 360 530 L360 720 H-20 Z" fill="#4b5a35" />
      {/* Stilt huts and totems. */}
      <g>
        <path d="M120 470 V540 M220 470 V540" stroke="#3a2a1e" strokeWidth="8" />
        <rect x="100" y="420" width="140" height="56" fill="#6b5a3e" />
        <path d="M90 420 L170 370 L250 420 Z" fill="#8a7a50" />
        <path d="M300 540 V420" stroke="#5b402b" strokeWidth="12" />
        <circle cx="300" cy="420" r="16" fill="#b04a2a" />
      </g>
      <Reeds x0={0} x1={420} y={560} seed={4} />
      <Mist y={460} opacity={0.3} />
    </>
  ),
  marrowmere: () => (
    <>
      <Sky top="#3d4846" bottom="#8d8f7a" />
      <Water y={430} color="#3e4c48" glint="#c9d4cc" />
      {/* Drowned rooftops. */}
      {[60, 200, 340, 470].map((x, i) => (
        <g key={x}>
          <rect x={x} y={440 - (i % 2) * 20} width="110" height="60" fill="#4e463c" />
          <path
            d={`M${x - 10} ${440 - (i % 2) * 20} L${x + 55} ${390 - (i % 2) * 20} L${x + 120} ${440 - (i % 2) * 20} Z`}
            fill="#3a322a"
          />
        </g>
      ))}
      <path d="M360 300 V440 M340 330 H380" stroke="#5a5248" strokeWidth="10" />
      <Water y={500} color="#3e4c48" glint="#c9d4cc" />
      <Mist y={480} opacity={0.35} />
      <Particles kind="fireflies" count={8} seed={9} color="#bfe8ff" />
    </>
  ),
  abbey: () => (
    <>
      <Sky top="#4a5868" bottom="#e2b88a" glow={[300, 330, '#ffe2a0']} />
      <Forest x0={560} x1={W} y={440} h={100} color="#34423a" seed={91} />
      {/* The abbey, with its sunburst window. */}
      <rect x="120" y="260" width="300" height="230" fill="#8a8274" />
      <path d="M100 260 L270 150 L440 260 Z" fill="#5a544a" />
      <rect x="440" y="300" width="70" height="190" fill="#7a7266" />
      <path d="M430 300 L475 240 L520 300 Z" fill="#5a544a" />
      <circle cx="270" cy="330" r="46" fill="#f3d38a" className="anim-glow" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <path
            key={i}
            d={`M270 330 L${270 + Math.cos(a) * 46} ${330 + Math.sin(a) * 46}`}
            stroke="#8a6a3a"
            strokeWidth="3"
          />
        );
      })}
      <path d="M240 490 V420 Q270 380 300 420 V490 Z" fill="#2a1d14" />
      <Water y={490} color="#4f6070" glint="#f3ead6" />
      <Reeds x0={0} x1={160} y={560} seed={12} />
      <Mist y={510} opacity={0.25} />
    </>
  ),
  sallow: () => (
    <>
      <Sky top="#2c3632" bottom="#5c6a52" />
      <Forest x0={-20} x1={W + 20} y={420} h={200} color="#202a24" seed={101} gap={50} />
      <Water y={500} color="#2f3a34" glint="#b6c9b0" />
      {/* A crooked hut on stilts, with charms. */}
      <path d="M180 520 V440 M320 520 V450 M250 520 V440" stroke="#2a1d14" strokeWidth="9" />
      <path d="M150 440 L350 450 L340 340 L160 330 Z" fill="#5b4a36" />
      <path d="M130 335 L250 240 L370 350 Z" fill="#3a3126" />
      <Window x={230} y={370} w={36} h={34} />
      {[170, 200, 300, 330].map((x, i) => (
        <g key={x} className="anim-sway">
          <path d={`M${x} 345 v${30 + i * 6}`} stroke="#8a7a50" strokeWidth="2" />
          <circle cx={x} cy={350 + 30 + i * 6} r="5" fill="#c9b27a" />
        </g>
      ))}
      <Mist y={520} opacity={0.3} />
      <Particles kind="fireflies" count={10} seed={11} color="#c9f59a" />
    </>
  ),
  deserters: () => (
    <>
      <Sky top="#1f2633" bottom="#46506a" />
      <Moon x={980} y={120} />
      <Stars seed={3} />
      <Forest x0={-20} x1={W + 20} y={430} h={150} color="#1c2420" seed={111} gap={36} />
      <rect y="430" width={W} height="290" fill="#2e3529" />
      {/* Tents around a fire. */}
      {[
        [80, 520],
        [420, 500],
      ].map(([x, y]) => (
        <g key={x}>
          <path d={`M${x} ${y} L${x! + 90} ${y! - 110} L${x! + 180} ${y} Z`} fill="#6a6250" />
          <path d={`M${x! + 90} ${y! - 110} L${x! + 70} ${y} H${x! + 110} Z`} fill="#2a2620" />
        </g>
      ))}
      <path
        d="M330 520 V380 L380 395 L330 410"
        stroke="#3a2a1e"
        strokeWidth="5"
        fill="#5a6070"
        className="anim-sway"
      />
      <Fire x={300} y={600} s={1.3} />
    </>
  ),
  bog: () => (
    <>
      <Sky top="#1b2422" bottom="#33423a" />
      <Forest x0={-20} x1={W + 20} y={420} h={160} color="#141c18" seed={121} gap={44} />
      <Water y={470} color="#1e2a26" glint="#9fd0c0" />
      <Reeds x0={0} x1={500} y={600} seed={13} color="#3a4a2e" />
      <Particles kind="fireflies" count={24} seed={13} color="#a8f0ff" />
      <Mist y={520} opacity={0.3} />
    </>
  ),
  hall: () => (
    <>
      <rect width={W} height={H} fill="#2d2a2a" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={i * 130}
          y="0"
          width="126"
          height="500"
          fill={i % 2 ? '#3a3434' : '#363030'}
        />
      ))}
      {/* Tall windows, a banner and the mayor's table. */}
      {[120, 380].map((x) => (
        <g key={x}>
          <path d={`M${x} 360 V160 Q${x + 50} 100 ${x + 100} 160 V360 Z`} fill="#4a5a76" />
          <path d={`M${x + 50} 120 V360 M${x} 260 H${x + 100}`} stroke="#2a2424" strokeWidth="6" />
        </g>
      ))}
      <path d="M260 120 H330 V300 L295 270 L260 300 Z" fill="#7a2a2a" />
      <circle cx="295" cy="190" r="16" fill="#e8c27a" />
      <rect y="500" width={W} height="220" fill="#4a3a2e" />
      <rect x="80" y="560" width="440" height="40" fill="#5b402b" />
      <Lantern x={560} y={200} />
    </>
  ),
  ashford: () => (
    <>
      <Sky top="#5a6070" bottom="#b08a72" />
      <Ridge y={300} amp={140} color="#5a6274" seed={131} snow="#dfe6ee" />
      <rect y="420" width={W} height="300" fill="#4a4a46" />
      {[20, 140, 270, 400].map((x, i) => (
        <House key={x} x={x} y={500 - (i % 2) * 10} w={100} h={110 + (i % 3) * 20} />
      ))}
      <path d="M0 520 H1280 V720 H0 Z" fill="#5a5650" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M0 ${540 + i * 20} H1280`} stroke="#4a4640" strokeWidth="2" />
      ))}
      <Lantern x={120} y={500} />
      <Lantern x={360} y={500} />
      <Particles kind="ash" count={50} seed={17} />
    </>
  ),
  camp: () => (
    <>
      <Sky top="#151c2a" bottom="#36405a" />
      <Moon x={1000} y={110} />
      <Stars seed={21} count={90} />
      <Ridge y={380} amp={120} color="#262e40" seed={141} />
      <Forest x0={-20} x1={W + 20} y={480} h={130} color="#161d1a" seed={142} gap={34} />
      <rect y="480" width={W} height="240" fill="#232a22" />
      <Fire x={280} y={600} s={1.5} />
      <rect x="120" y="610" width="90" height="22" rx="10" fill="#4a3426" />
      <rect x="350" y="620" width="100" height="22" rx="10" fill="#4a3426" />
    </>
  ),
  forest: () => (
    <>
      <Sky top="#36463c" bottom="#7a8a66" />
      <Forest x0={-20} x1={W + 20} y={430} h={260} color="#2a3a2e" seed={151} gap={36} />
      <Forest x0={-20} x1={W + 20} y={600} h={340} color="#1d2a22" seed={152} gap={60} />
      <Mist y={480} opacity={0.2} />
    </>
  ),
  pass: () => (
    <>
      <Sky top="#3a2a2a" bottom="#b0603a" glow={[260, 300, '#ff8a4a']} />
      <Ridge y={260} amp={120} color="#4a3a38" seed={161} />
      {/* Walls of the pass. */}
      <path d="M-20 720 L-20 120 L120 160 L180 300 L230 520 L280 720 Z" fill="#2e2626" />
      <path d="M560 720 L600 520 L660 360 L760 200 L900 180 L1300 160 V720 Z" fill="#2e2626" />
      <path d="M280 720 L330 520 L380 420 L460 420 L520 520 L560 720 Z" fill="#5a4a40" />
      <Particles kind="ash" count={90} seed={19} />
      <Particles kind="embers" count={20} seed={23} />
    </>
  ),
  forge: () => (
    <>
      <rect width={W} height={H} fill="#1c1514" />
      {/* Carved hall columns and lava channels. */}
      {[60, 240, 420].map((x) => (
        <g key={x}>
          <rect x={x} y="80" width="70" height="520" fill="#3a2e2a" />
          <rect x={x - 12} y="70" width="94" height="24" fill="#4a3c36" />
          <rect x={x - 12} y="590" width="94" height="24" fill="#4a3c36" />
        </g>
      ))}
      <path
        d="M0 640 C300 620 600 660 1280 630 V660 C600 690 300 650 0 670 Z"
        fill="#ff7a2a"
        className="anim-glow"
      />
      <rect x="160" y="480" width="200" height="60" fill="#5a5a60" />
      <path d="M140 480 H380 L360 460 H160 Z" fill="#7a7a82" />
      <rect x="230" y="540" width="60" height="70" fill="#4a4a50" />
      <Particles kind="embers" count={40} seed={29} />
    </>
  ),
  kiln: () => (
    <>
      <Sky top="#1e1418" bottom="#7a2e1e" glow={[300, 420, '#ff5a2a']} />
      <Ridge y={300} amp={120} color="#2a1e1e" seed={171} />
      {/* The King's Kiln: a mountain with fire behind its doors. */}
      <path d="M-20 720 L120 300 L240 180 L360 190 L480 320 L620 720 Z" fill="#2a2020" />
      <path d="M220 560 V420 Q300 360 380 420 V560 Z" fill="#ff7a2a" className="anim-glow" />
      <path d="M232 560 V430 Q300 380 368 430 V560" stroke="#4a2a20" strokeWidth="10" fill="none" />
      <path d="M300 380 V560" stroke="#4a2a20" strokeWidth="8" />
      <path d="M200 560 H400 L420 720 H180 Z" fill="#3a2a26" />
      <Plume x={240} y={170} color="#5a4a4a" scale={2} />
      <Particles kind="embers" count={60} seed={31} />
    </>
  ),
  caves: () => (
    <>
      <Sky top="#2a3040" bottom="#6a6a72" />
      <Ridge y={360} amp={180} color="#4a4e58" seed={181} snow="#dfe6ee" />
      <rect y="520" width={W} height="200" fill="#3a3a36" />
      <CaveMouth x={160} y={540} w={110} h={90} glow="#e8a060" />
      <CaveMouth x={400} y={520} w={90} h={70} glow="#e8a060" />
      <Lantern x={250} y={470} color="#9fd18a" />
      <Lantern x={320} y={500} color="#e8a060" />
      {[90, 230, 470].map((x) => (
        <g key={x}>
          <rect x={x} y="590" width="8" height="20" fill="#d9cdb4" />
          <ellipse cx={x + 4} cy="590" rx="16" ry="8" fill="#b04a2a" />
        </g>
      ))}
    </>
  ),
  epilogue: () => (
    <>
      <Sky top="#5a6e8e" bottom="#f0c08a" glow={[300, 460, '#ffe0a0']} />
      <Ridge y={360} amp={130} color="#6a7690" seed={191} snow="#f3ead6" />
      <Hills y={500} amp={50} color="#5a6a4a" seed={192} />
      <Water y={560} color="#5a7a9e" glint="#fff6e0" />
      {[60, 170, 280].map((x) => (
        <House key={x} x={x} y={560} w={80} h={70} />
      ))}
      <Pine x={420} y={560} h={120} color="#3a4a36" />
    </>
  ),
};

/** The backdrop for a place. Decorative: screen readers skip it. */
export function PlaceArt({ scene, className = '' }: { scene: SceneId; className?: string }) {
  const draw = SCENES[scene] ?? SCENES.road;
  return (
    <svg
      className={`place-art ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {draw()}
    </svg>
  );
}
