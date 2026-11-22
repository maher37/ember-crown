// Dragonborn parts for <Portrait> (playtest wish, Nov 22: "the dragonborn portrait should
// look a little like a dragon"). Original SVG art. Dragonborn have no hair, so the hair
// colour tints the crest, the fins at the sides of the head and the chin barbels.

const HORN = '#d9cdb4';
const HORN_DARK = '#8a7e66';
/** Small arcs that read as scales. */
const SCALE_ROW = (x: number, y: number, n: number) => `M${x} ${y}` + ' q3 4 6 0'.repeat(n);

/** Swept-back horns and a spiky crest, drawn behind the head. */
export function DragonHorns({ crest, color }: { crest: boolean; color: string }) {
  return (
    <g>
      {crest && (
        <path
          d="M64 54 L60 34 L72 50 L80 26 L88 50 L100 34 L96 54 Z"
          fill={color}
          stroke="#000000"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      )}
      <path
        d="M56 70 C44 62 32 54 16 48 C32 44 50 46 64 56 Z"
        fill={HORN}
        stroke={HORN_DARK}
        strokeWidth="1.5"
      />
      <path
        d="M104 70 C116 62 128 54 144 48 C128 44 110 46 96 56 Z"
        fill={HORN}
        stroke={HORN_DARK}
        strokeWidth="1.5"
      />
    </g>
  );
}

/** Fins at the sides of the head, in place of ears. */
export function DragonFins({ color }: { color: string }) {
  return (
    <g>
      <path d="M50 84 L26 74 L36 90 L22 100 L38 104 L28 118 L50 110 Z" fill={color} />
      <path d="M110 84 L134 74 L124 90 L138 100 L122 104 L132 118 L110 110 Z" fill={color} />
    </g>
  );
}

/** A broad jaw under the head shape, so the face reads as a short snout. */
export function DragonJaw({ skin }: { skin: string }) {
  return <path d="M46 92 C46 124 58 144 80 144 C102 144 114 124 114 92 Z" fill={skin} />;
}

/** Scales, brow ridges, a muzzle ridge, nostrils, slit pupils and a fanged mouth. */
export function DragonFace({ eyes }: { eyes: string }) {
  const dark = { stroke: '#000000', strokeOpacity: 0.28, fill: 'none' } as const;
  return (
    <g>
      <path
        d={[
          SCALE_ROW(62, 60, 6),
          SCALE_ROW(65, 68, 5),
          SCALE_ROW(50, 106, 2),
          SCALE_ROW(98, 106, 2),
          SCALE_ROW(68, 146, 4),
        ].join(' ')}
        {...dark}
        strokeWidth="1.5"
      />
      {/* Heavy brow ridges instead of eyebrows. */}
      <path
        d="M55 88 C61 81 69 81 75 86 M85 86 C91 81 99 81 105 88"
        {...dark}
        strokeOpacity={0.45}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Reptile eyes: coloured all over, with a slit pupil. */}
      <ellipse cx="66" cy="94" rx="6.5" ry="3.8" fill={eyes} />
      <ellipse cx="94" cy="94" rx="6.5" ry="3.8" fill={eyes} />
      <ellipse cx="66" cy="94" rx="1.2" ry="3.4" fill="#111111" />
      <ellipse cx="94" cy="94" rx="1.2" ry="3.4" fill="#111111" />
      {/* Muzzle ridge and nostrils. */}
      <path d="M80 92 V106" {...dark} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M71 111 C73 107 76 107 77 109 M89 111 C87 107 84 107 83 109"
        {...dark}
        strokeOpacity={0.55}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* A wide mouth with two small fangs. */}
      <path d="M68 125 L70.5 131 L73 125.6 Z M92 125 L89.5 131 L87 125.6 Z" fill={HORN} />
      <path
        d="M58 122 C68 127 92 127 102 122"
        stroke="#3a1a14"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Barbels under the chin, in place of a beard. */
export function DragonBarbels({ color }: { color: string }) {
  return (
    <path
      d="M68 140 C66 150 62 156 56 162 M80 144 V164 M92 140 C94 150 98 156 104 162"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  );
}
