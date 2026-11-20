// Cutaway maps of the Old Mine and the King's Kiln (original SVG, 900×492), drawn around the
// spot positions in src/data/placeMaps.json.
import { useState } from 'react';
import { Particles, shapeRng, uid } from './parts';
import './scenes.css';

function Strata({ seed, color, y0, y1 }: { seed: number; color: string; y0: number; y1: number }) {
  const r = shapeRng(seed);
  return (
    <g stroke={color} strokeWidth="2" fill="none" opacity="0.5">
      {Array.from({ length: 9 }, (_, i) => {
        const y = y0 + ((y1 - y0) * (i + 0.5)) / 9;
        let d = `M0 ${y}`;
        for (let x = 0; x <= 900; x += 90)
          d += ` Q${x + 45} ${y + (r() - 0.5) * 18} ${x + 90} ${y}`;
        return <path key={i} d={d} />;
      })}
    </g>
  );
}

function Lamp({ x, y, glow }: { x: number; y: number; glow: string }) {
  return (
    <g>
      <circle className="anim-glow" cx={x} cy={y} r="34" fill={`url(#${glow})`} />
      <rect x={x - 4} y={y - 5} width="8" height="10" rx="2" fill="#f6c76a" />
    </g>
  );
}

function Rocks({
  seed,
  x0,
  x1,
  y,
  color,
}: {
  seed: number;
  x0: number;
  x1: number;
  y: number;
  color: string;
}) {
  const r = shapeRng(seed);
  const out = [];
  for (let x = x0; x < x1; x += 14 + r() * 20)
    out.push(
      <ellipse key={x} cx={x} cy={y + r() * 6} rx={5 + r() * 8} ry={3 + r() * 4} fill={color} />,
    );
  return <g>{out}</g>;
}

/** The Old Mine: the mouth on the hillside, the miners' tunnel, the Deep Seam, the dwarf halls and the drowned shrine. */
export function MineMap() {
  const [ids] = useState(() => ({
    sky: uid('msky'),
    lamp: uid('mlamp'),
    water: uid('mwater'),
    shard: uid('mshard'),
  }));
  const tunnel = '#241c17';
  return (
    <svg
      viewBox="0 0 900 492"
      width="900"
      height="492"
      className="place-art"
      role="img"
      aria-label="Cutaway map of the Old Mine: the mouth on the hillside, a miners' tunnel, the Deep Seam, the old dwarf halls and a drowned shrine at the bottom."
    >
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4560" />
          <stop offset="1" stopColor="#c98a5e" />
        </linearGradient>
        <radialGradient id={ids.lamp}>
          <stop offset="0" stopColor="#ffd28a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.water} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f8a8a" />
          <stop offset="1" stopColor="#1f3a40" />
        </linearGradient>
        <radialGradient id={ids.shard}>
          <stop offset="0" stopColor="#ff7a3a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff7a3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Sky and the mountain above. */}
      <rect width="900" height="492" fill={`url(#${ids.sky})`} />
      <path d="M380 130 L520 40 L600 70 L700 10 L790 50 L900 20 V130 Z" fill="#4b5466" />
      <path d="M690 18 L700 10 L712 22 L702 20 Z M512 46 L520 40 L530 50 Z" fill="#dfe6ee" />
      {/* The rock, with strata. */}
      <path
        d="M0 122 Q120 112 200 118 Q300 126 380 122 L460 118 Q600 128 900 124 V492 H0 Z"
        fill="#4a3f36"
      />
      <Strata seed={3} color="#3a312a" y0={130} y1={492} />
      <path
        d="M0 122 Q120 112 200 118 Q300 126 380 122 L460 118 Q600 128 900 124"
        stroke="#5d6b3a"
        strokeWidth="6"
        fill="none"
      />
      {/* Spoil heaps, the crane and the track to the road. */}
      <path d="M250 122 Q290 92 330 122 Z M90 122 Q120 104 150 122 Z" fill="#6a5a46" />
      <path d="M0 116 Q100 104 190 112" stroke="#8c7652" strokeWidth="8" fill="none" />
      <path
        d="M262 120 V60 L330 72 M262 70 L320 74 M320 74 V96"
        stroke="#6a4c30"
        strokeWidth="4"
        fill="none"
      />
      {/* The mouth and the shaft. */}
      <rect x="196" y="96" width="36" height="110" fill={tunnel} />
      <path d="M190 98 H238 M196 98 V122 M232 98 V122" stroke="#7a5a3a" strokeWidth="6" />
      {/* Level 1: the miners' tunnel. */}
      <path
        d="M196 176 H560 Q600 180 610 220 L640 260 L610 268 L580 228 Q560 214 540 216 H196 Z"
        fill={tunnel}
      />
      {[260, 380, 500].map((x) => (
        <path
          key={x}
          d={`M${x} 176 V216 M${x - 14} 178 H${x + 14}`}
          stroke="#6a4c30"
          strokeWidth="4"
        />
      ))}
      <path d="M210 212 H560" stroke="#5a4a3a" strokeWidth="2" strokeDasharray="6 4" />
      {/* The ore cart and the names in the rock. */}
      <rect
        x="300"
        y="198"
        width="30"
        height="14"
        rx="2"
        fill="#5a5a60"
        transform="rotate(-18 315 205)"
      />
      <path
        d="M452 180 v24 M462 180 v24 M472 180 v24 M482 180 v24"
        stroke="#c9b48a"
        strokeWidth="1.5"
        opacity="0.6"
      />
      {/* The Deep Seam: a warm cave with glowing cracks and a nest. */}
      <path
        d="M560 250 Q600 230 690 240 Q780 250 800 290 Q790 330 700 336 Q610 340 572 310 Q548 280 560 250 Z"
        fill={tunnel}
      />
      <g className="anim-glow" stroke="#ff8a3a" strokeWidth="2" fill="none" opacity="0.8">
        <path d="M600 248 l10 14 l-6 10 l12 8" />
        <path d="M760 268 l-8 12 l10 8" />
        <path d="M700 330 l6 -12 l-8 -8" />
      </g>
      <Rocks seed={5} x0={590} x1={780} y={322} color="#3a2e26" />
      <path d="M690 300 q20 -10 40 0 q-20 10 -40 0" fill="#d9cdb4" opacity="0.5" />
      {/* Down to the halls. */}
      <path d="M580 310 L540 352 L560 360 L600 320 Z" fill={tunnel} />
      {/* The Ammarindar halls: carved, straight, pillared. */}
      <rect x="150" y="342" width="420" height="72" fill="#2a2420" />
      <rect x="150" y="342" width="420" height="6" fill="#6a5c50" />
      <rect x="150" y="408" width="420" height="6" fill="#6a5c50" />
      {[200, 280, 360, 500].map((x) => (
        <rect key={x} x={x - 6} y="348" width="12" height="60" fill="#5a4e44" />
      ))}
      <path
        d="M410 408 V370 Q430 346 450 370 V408"
        fill="#3a302a"
        stroke="#c9a46a"
        strokeWidth="3"
      />
      <path d="M425 380 l5 -8 l5 8 Z" fill="#c9a46a" />
      <rect
        x="196"
        y="364"
        width="80"
        height="44"
        fill="#2e2620"
        stroke="#6a5c50"
        strokeWidth="2"
      />
      {[206, 226, 246].map((x) => (
        <ellipse key={x} cx={x + 6} cy="400" rx="7" ry="5" fill="#8a6a46" />
      ))}
      {/* The sunken shrine: steaming water and a glowing shard. */}
      <path d="M570 380 H880 V486 H570 Z" fill="#2a2420" />
      <path d="M560 400 L600 380 L570 412 Z" fill={tunnel} />
      <rect x="570" y="436" width="310" height="50" fill={`url(#${ids.water})`} />
      <g className="anim-shimmer" stroke="#cfe0f0" strokeWidth="2" opacity="0.4">
        <path d="M600 450 h40 M700 462 h50 M800 448 h40" />
      </g>
      <rect x="800" y="404" width="50" height="34" fill="#5a5048" />
      <circle className="anim-glow" cx="825" cy="398" r="34" fill={`url(#${ids.shard})`} />
      <path d="M820 402 l5 -12 l5 12 Z" fill="#ff9a4a" />
      <g fill="#cfe0f0" opacity="0.5">
        {[620, 690, 760].map((x, i) => (
          <circle
            key={x}
            className="anim-rise"
            style={{ animationDelay: `${-i * 2}s` }}
            cx={x}
            cy="432"
            r="10"
          />
        ))}
      </g>
      {/* Lamps along the way. */}
      <Lamp x={244} y={186} glow={ids.lamp} />
      <Lamp x={420} y={186} glow={ids.lamp} />
      <Lamp x={318} y={356} glow={ids.lamp} />
      <Lamp x={540} y={356} glow={ids.lamp} />
    </svg>
  );
}

/** The King's Kiln: the gate on the mountainside, the halls inside, and the burning heart below. */
export function KilnMap() {
  const [ids] = useState(() => ({
    sky: uid('ksky'),
    lava: uid('klava'),
    heart: uid('kheart'),
    lamp: uid('klamp'),
  }));
  const hall = '#1e1716';
  return (
    <svg
      viewBox="0 0 900 492"
      width="900"
      height="492"
      className="place-art"
      role="img"
      aria-label="Cutaway map of the King's Kiln: the black gate on the mountainside, the Furnace Halls, the Hall of the Honor Guard, the ossuary, the Cold Forge, the Ember Galleries, and the heart of the mountain far below."
    >
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1a1e" />
          <stop offset="1" stopColor="#a04a2a" />
        </linearGradient>
        <linearGradient id={ids.lava} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb25a" />
          <stop offset="1" stopColor="#c43a1a" />
        </linearGradient>
        <radialGradient id={ids.heart}>
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ff6a2a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.lamp}>
          <stop offset="0" stopColor="#ff9a4a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="900" height="492" fill={`url(#${ids.sky})`} />
      {/* The mountain. */}
      <path d="M0 140 L200 140 L220 40 L380 30 L520 0 H900 V492 H0 Z" fill="#2e2424" />
      <Strata seed={9} color="#241c1c" y0={60} y1={492} />
      {/* The ledge and the road in. */}
      <path d="M0 132 H222 V146 H0 Z" fill="#5a4a40" />
      <path d="M60 196 H200 V210 H60 Z" fill="#4a3c34" />
      <path d="M150 146 L180 196" stroke="#5a4a40" strokeWidth="10" />
      {/* The cult's crates. */}
      {[100, 128, 156].map((x, i) => (
        <rect
          key={x}
          x={x - 12}
          y={172 + (i % 2) * 6}
          width="24"
          height="20"
          fill="#6b5442"
          stroke="#3a2a1e"
          strokeWidth="2"
        />
      ))}
      {/* The black gate, with winged pillars. */}
      <rect x="216" y="60" width="44" height="80" fill="#0e0b0b" stroke="#5a4e4a" strokeWidth="3" />
      <path d="M238 60 V140" stroke="#5a4e4a" strokeWidth="2" />
      <path d="M206 50 l-16 -16 l12 4 Z M270 50 l16 -16 l-12 4 Z" fill="#6a5e5a" />
      {/* The corridor in, the door of dials, the Furnace Halls, the red seal. */}
      <rect x="260" y="104" width="380" height="64" fill={hall} />
      <circle cx="330" cy="136" r="18" fill="none" stroke="#c9a46a" strokeWidth="4" />
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 9;
        return (
          <circle
            key={i}
            cx={330 + Math.cos(a) * 18}
            cy={136 + Math.sin(a) * 18}
            r="3"
            fill="#c9a46a"
          />
        );
      })}
      <rect x="380" y="80" width="160" height="110" fill={hall} />
      {[410, 470, 520].map((x) => (
        <g key={x}>
          <rect x={x - 16} y="96" width="32" height="40" rx="4" fill="#3a2e2a" />
          <rect x={x - 10} y="112" width="20" height="18" fill="#140e0c" />
        </g>
      ))}
      <rect
        x="578"
        y="122"
        width="24"
        height="46"
        rx="4"
        fill="#8a2a1e"
        stroke="#ff6a3a"
        strokeWidth="2"
        className="anim-glow"
      />
      {/* Down into the Hall of the Honor Guard, with its ranks of dead knights. */}
      <path d="M620 168 L640 168 L660 210 L640 210 Z" fill={hall} />
      <rect x="610" y="206" width="200" height="86" fill={hall} />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} fill="#5a5e6a">
          <circle cx={626 + i * 28} cy="218" r="5" />
          <rect x={622 + i * 28} y="223" width="8" height="12" />
          <circle cx={626 + i * 28} cy="270" r="5" />
          <rect x={622 + i * 28} y="275" width="8" height="12" />
        </g>
      ))}
      {/* The mural passage. */}
      <rect x="810" y="196" width="80" height="30" fill={hall} />
      <path d="M820 204 h60" stroke="#c9a46a" strokeWidth="2" opacity="0.6" />
      {/* The ossuary. */}
      <path d="M610 270 L560 290 L560 300 L612 284 Z" fill={hall} />
      <rect x="420" y="280" width="146" height="54" fill={hall} />
      {Array.from({ length: 10 }, (_, i) => (
        <circle
          key={i}
          cx={430 + i * 13}
          cy={326 - (i % 3) * 3}
          r="5"
          fill="#d9cdb4"
          opacity="0.7"
        />
      ))}
      {/* The lava tubes to the Cold Forge. */}
      <path d="M810 280 Q850 300 840 330" stroke={hall} strokeWidth="26" fill="none" />
      <rect
        x="784"
        y="320"
        width="106"
        height="44"
        fill="#1a1414"
        stroke="#3a3a46"
        strokeWidth="3"
      />
      <rect x="812" y="340" width="34" height="12" fill="#5a5a60" />
      {/* The Ember Galleries: a glass bridge over a lake of fire. */}
      <path d="M700 292 L720 340" stroke={hall} strokeWidth="24" />
      <rect
        x="560"
        y="352"
        width="220"
        height="40"
        fill={`url(#${ids.lava})`}
        className="anim-glow"
      />
      <path d="M560 350 H780" stroke="#101014" strokeWidth="8" />
      {/* The great stair down. */}
      <path d="M560 352 L470 440 L500 440 L590 352 Z" fill={hall} />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M${552 - i * 11} ${362 + i * 10} h26`} stroke="#3a2e2a" strokeWidth="3" />
      ))}
      {/* The heart of the mountain. */}
      <path d="M220 492 Q230 420 330 412 Q460 410 500 492 Z" fill="#2a1410" />
      <circle className="anim-glow" cx="360" cy="470" r="110" fill={`url(#${ids.heart})`} />
      <circle
        cx="360"
        cy="458"
        r="22"
        fill="none"
        stroke="#ffcf7a"
        strokeWidth="3"
        strokeDasharray="6 5"
      />
      <Lamp x={290} y={116} glow={ids.lamp} />
      <Lamp x={560} y={116} glow={ids.lamp} />
      <Lamp x={710} y={250} glow={ids.lamp} />
      <Particles kind="embers" count={26} seed={41} />
    </svg>
  );
}
