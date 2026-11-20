import { useState } from 'react';
import type { Portrait as PortraitData } from '../game/hero';
import { uid } from './scenes/parts';

/** How a hero's armor reads in a portrait. */
export type ArmorLook =
  | 'none'
  | 'padded'
  | 'leather'
  | 'studded'
  | 'hide'
  | 'chain'
  | 'scale'
  | 'breastplate'
  | 'half-plate'
  | 'plate';

export interface PortraitGear {
  armor: ArmorLook;
  shield: boolean;
  helmet: boolean;
  /** Shield face colour (the class colour). */
  shieldColor?: string;
}

interface Props extends PortraitData {
  ears: 'human' | 'elf';
  cloth: string;
  bg?: string;
  label: string;
  gear?: PortraitGear;
}

const STEEL = '#a9b1bc';
const STEEL_DARK = '#6e7682';

/** Armor over the shoulders and chest (drawn over the clothes). */
function ArmorLayer({
  look,
  ids,
}: {
  look: ArmorLook;
  ids: { rings: string; scales: string; shine: string };
}) {
  const torso = 'M12 200 C16 166 48 150 80 150 C112 150 144 166 148 200 Z';
  switch (look) {
    case 'none':
      return null;
    case 'padded':
      return (
        <g>
          <path d={torso} fill="#8a7a5e" />
          <path
            d="M30 172 C50 164 110 164 130 172 M24 186 C50 178 110 178 136 186"
            stroke="#6a5c44"
            strokeWidth="2"
            fill="none"
          />
        </g>
      );
    case 'leather':
    case 'studded':
      return (
        <g>
          <path d={torso} fill="#6b4a2e" />
          <path d="M58 152 C62 176 98 176 102 152" fill="#5a3d25" />
          <path d="M40 166 L52 200 M120 166 L108 200" stroke="#3e2a18" strokeWidth="3" />
          <path d="M60 172 H100" stroke="#c9a46a" strokeWidth="2" strokeDasharray="3 3" />
          {look === 'studded' &&
            [44, 60, 76, 92, 108, 124].flatMap((x) =>
              [178, 192].map((y) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#d9cdb4" />
              )),
            )}
        </g>
      );
    case 'hide':
      return (
        <g>
          <path d={torso} fill="#7a5a3a" />
          <path
            d="M40 160 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 L124 170 C100 162 60 162 36 170 Z"
            fill="#c9b08a"
          />
        </g>
      );
    case 'chain':
      return (
        <g>
          <path d={torso} fill={STEEL_DARK} />
          <path d={torso} fill={`url(#${ids.rings})`} />
          {/* A mail coif around the neck. */}
          <path d="M56 150 C60 164 100 164 104 150 L100 142 C92 152 68 152 60 142 Z" fill={STEEL} />
        </g>
      );
    case 'scale':
      return (
        <g>
          <path d={torso} fill="#5e6b5a" />
          <path d={torso} fill={`url(#${ids.scales})`} />
        </g>
      );
    case 'breastplate':
    case 'half-plate':
    case 'plate':
      return (
        <g>
          {look === 'plate' && <path d={torso} fill={STEEL_DARK} />}
          {/* The breastplate. */}
          <path d="M44 200 C44 176 56 160 80 158 C104 160 116 176 116 200 Z" fill={STEEL} />
          <path d="M80 160 V200" stroke={STEEL_DARK} strokeWidth="2" />
          <path
            d="M52 196 C56 178 66 168 78 164"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="3"
            fill="none"
          />
          {/* A gorget at the throat. */}
          <path
            d="M60 150 C64 160 96 160 100 150 L98 160 C90 166 70 166 62 160 Z"
            fill={STEEL_DARK}
          />
          {look !== 'breastplate' && (
            <g>
              {/* Pauldrons. */}
              <path
                d="M14 196 C12 172 28 158 50 160 C46 172 42 184 42 198 Z"
                fill={STEEL}
                stroke={STEEL_DARK}
                strokeWidth="2"
              />
              <path
                d="M146 196 C148 172 132 158 110 160 C114 172 118 184 118 198 Z"
                fill={STEEL}
                stroke={STEEL_DARK}
                strokeWidth="2"
              />
              <path
                d="M18 182 C24 172 34 166 46 166 M142 182 C136 172 126 166 114 166"
                stroke={STEEL_DARK}
                strokeWidth="2"
                fill="none"
              />
            </g>
          )}
          <path
            d="M44 200 C44 176 56 160 80 158 C104 160 116 176 116 200 Z"
            fill={`url(#${ids.shine})`}
          />
        </g>
      );
  }
}

/** A nasal helm over the top of the head. */
function Helmet() {
  return (
    <g>
      <path
        d="M42 92 C38 54 58 34 80 34 C102 34 122 54 118 92 C112 72 100 64 80 64 C60 64 48 72 42 92 Z"
        fill={STEEL}
      />
      <path
        d="M42 92 C46 78 56 70 66 68 L44 98 Z M118 92 C114 78 104 70 94 68 L116 98 Z"
        fill={STEEL_DARK}
      />
      <path d="M40 80 C54 66 106 66 120 80 L118 88 C104 76 56 76 42 88 Z" fill={STEEL_DARK} />
      <path
        d="M77 66 H83 V108 L80 112 L77 108 Z"
        fill={STEEL}
        stroke={STEEL_DARK}
        strokeWidth="1"
      />
      <path
        d="M56 46 C64 40 74 38 82 38"
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A heater shield held in front, lower left. */
function Shield({ color }: { color: string }) {
  return (
    <g>
      <path d="M2 150 H58 V172 C58 190 44 200 30 206 C16 200 2 190 2 172 Z" fill={STEEL_DARK} />
      <path d="M7 155 H53 V172 C53 187 42 195 30 200 C18 195 7 187 7 172 Z" fill={color} />
      <path d="M30 158 V196 M12 172 H48" stroke="#e8c27a" strokeWidth="3" />
    </g>
  );
}

/** Layered SVG portrait, rebuilt from docs/mockups/Portrait.dc.html (original art). */
export function Portrait({
  skin,
  hair,
  eyes,
  cloth,
  hairStyle,
  ears,
  beard,
  scar,
  bg = '#3a4558',
  label,
  gear,
}: Props) {
  const [ids] = useState(() => ({
    rings: uid('rings'),
    scales: uid('scales'),
    shine: uid('shine'),
  }));
  const helmet = !!gear?.helmet;
  // A helmet replaces the hood (you can't wear both).
  const hooded = hairStyle === 'hood' && !helmet;
  return (
    <svg
      viewBox="0 0 160 200"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
    >
      <rect x="0" y="0" width="160" height="200" fill={bg} />
      <circle cx="80" cy="92" r="72" fill="#ffffff" opacity="0.05" />
      {gear && gear.armor !== 'none' && (
        <defs>
          <pattern id={ids.rings} width="6" height="5" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="2.5" r="2" fill="none" stroke="#c3cad3" strokeWidth="1" />
          </pattern>
          <pattern id={ids.scales} width="10" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 0 Q5 9 10 0" fill="#7e8c78" stroke="#3e4a3a" strokeWidth="1" />
          </pattern>
          <linearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      )}
      {hooded && (
        <>
          <path
            d="M22 200 L26 104 C26 52 50 26 80 26 C110 26 134 52 134 104 L138 200 Z"
            fill={cloth}
          />
          <path
            d="M22 200 L26 104 C26 52 50 26 80 26 C110 26 134 52 134 104 L138 200 Z"
            fill="#000000"
            opacity="0.3"
          />
        </>
      )}
      {hairStyle === 'long' && (
        <path
          d="M40 86 C36 52 56 38 80 38 C104 38 124 52 120 86 L127 160 C113 168 101 162 96 150 L64 150 C59 162 47 168 33 160 Z"
          fill={hair}
        />
      )}
      <path d="M12 200 C16 166 48 150 80 150 C112 150 144 166 148 200 Z" fill={cloth} />
      <path
        d="M58 152 L80 178 L102 152"
        fill="none"
        stroke="#000000"
        strokeOpacity="0.3"
        strokeWidth="3"
      />
      {gear && <ArmorLayer look={gear.armor} ids={ids} />}
      <path d="M66 122 L66 152 C72 158 88 158 94 152 L94 122 Z" fill={skin} />
      <path d="M66 134 C74 142 86 142 94 134 L94 122 L66 122 Z" fill="#000000" opacity="0.15" />
      {!hooded && ears === 'human' && (
        <g>
          <ellipse cx="45" cy="98" rx="7" ry="11" fill={skin} />
          <ellipse cx="115" cy="98" rx="7" ry="11" fill={skin} />
        </g>
      )}
      {!hooded && ears === 'elf' && (
        <g>
          <path d="M49 90 L20 66 L45 112 Z" fill={skin} />
          <path d="M111 90 L140 66 L115 112 Z" fill={skin} />
        </g>
      )}
      <path
        d="M46 88 C46 60 60 46 80 46 C100 46 114 60 114 88 C114 116 102 138 80 138 C58 138 46 116 46 88 Z"
        fill={skin}
      />
      <path d="M46 92 C48 116 60 136 80 138 C66 130 56 116 52 96 Z" fill="#000000" opacity="0.1" />
      <ellipse cx="66" cy="94" rx="6.5" ry="3.8" fill="#f4efe6" />
      <ellipse cx="94" cy="94" rx="6.5" ry="3.8" fill="#f4efe6" />
      <circle cx="66" cy="94" r="3" fill={eyes} />
      <circle cx="94" cy="94" r="3" fill={eyes} />
      <circle cx="66" cy="94" r="1.3" fill="#111111" />
      <circle cx="94" cy="94" r="1.3" fill="#111111" />
      <path
        d="M58 86 C62 83 68 83 73 85"
        fill="none"
        stroke={hair}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M87 85 C92 83 98 83 102 86"
        fill="none"
        stroke={hair}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M80 96 C79 104 76 110 78 113 C80 115 84 114 85 112"
        fill="none"
        stroke="#000000"
        strokeOpacity="0.3"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {scar && (
        <path
          d="M98 80 L106 104"
          fill="none"
          stroke="#8a3b2e"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      {beard && (
        <g>
          <path
            d="M47 100 C50 128 62 152 80 154 C98 152 110 128 113 100 C108 114 98 120 90 118 C86 116 74 116 70 118 C62 120 52 114 47 100 Z"
            fill={hair}
          />
          <path
            d="M63 119 C69 112 78 113 80 116 C82 113 91 112 97 119 C91 118 85 119 80 120 C75 119 69 118 63 119 Z"
            fill={hair}
          />
        </g>
      )}
      <path
        d="M71 123 C76 126 84 126 89 123"
        fill="none"
        stroke="#6b3328"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {(hairStyle === 'short' || hairStyle === 'long') && !helmet && (
        <path
          d="M44 90 C40 56 58 40 80 40 C104 40 122 56 116 92 C112 76 106 66 96 62 C86 70 66 72 54 64 C48 72 46 80 44 90 Z"
          fill={hair}
        />
      )}
      {helmet && <Helmet />}
      {hooded && (
        <path
          d="M36 124 C32 70 54 42 80 42 C106 42 128 70 124 124 C120 82 104 58 80 58 C56 58 40 82 36 124 Z"
          fill={cloth}
        />
      )}
      {gear?.shield && <Shield color={gear.shieldColor ?? cloth} />}
    </svg>
  );
}
