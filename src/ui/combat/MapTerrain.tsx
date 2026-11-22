// The combat map's terrain, grid lines and spell zones (split from CombatScreen.tsx).
import { zoneCells, type CombatState } from '../../game/combat';
import { terrainFill } from '../mapStyle';

export const CELL = 48;
const ZONE_FILL: Record<string, string> = {
  damage: '#e8c27a',
  spikes: '#6a8a3a',
  silence: '#7fb3e6',
  darkness: '#05070a',
};

/** Terrain, grid lines and zones, drawn as one SVG under the tokens. */
export function MapTerrain({ s }: { s: CombatState }) {
  return (
    <svg
      viewBox={`0 0 ${s.map.width * CELL} ${s.map.height * CELL}`}
      width={s.map.width * CELL}
      height={s.map.height * CELL}
      aria-hidden="true"
      className="map-svg"
    >
      {s.map.terrain.flatMap((row, y) =>
        row.map((t, x) => (
          <g key={`${x},${y}`}>
            <rect
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={terrainFill(s.map.style, t)}
            />
            {t === 'trees' && s.map.style === 'forest-road' && (
              <circle cx={x * CELL + 24} cy={y * CELL + 24} r={22} fill="#2f4226" />
            )}
            {t === 'boulder' && (s.map.style === 'forest-road' || s.map.style === 'cave') && (
              <path
                d={`M${x * CELL + 8} ${y * CELL + 34} L${x * CELL + 16} ${y * CELL + 12} L${x * CELL + 36} ${y * CELL + 10} L${x * CELL + 42} ${y * CELL + 32} L${x * CELL + 24} ${y * CELL + 42} Z`}
                fill="#6f6a62"
                stroke="#3b3833"
                strokeWidth="2"
              />
            )}
            {t === 'boulder' && s.map.style !== 'forest-road' && s.map.style !== 'cave' && (
              <rect
                x={x * CELL + 6}
                y={y * CELL + 6}
                width={CELL - 12}
                height={CELL - 12}
                rx={s.map.style === 'mill' ? 18 : 3}
                fill="none"
                stroke="#00000055"
                strokeWidth="3"
              />
            )}
            {t === 'brush' && s.map.style === 'forest-road' && (
              <path
                d={`M${x * CELL + 10} ${y * CELL + 40} q6 -18 12 0 q6 -22 12 0 q6 -16 10 0`}
                fill="none"
                stroke="#5f8a45"
                strokeWidth="3"
              />
            )}
          </g>
        )),
      )}
      <g stroke="#000" strokeOpacity="0.18">
        {Array.from({ length: s.map.width + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={s.map.height * CELL} />
        ))}
        {Array.from({ length: s.map.height + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL} x2={s.map.width * CELL} y2={i * CELL} />
        ))}
      </g>
      {s.zones.map((z) =>
        zoneCells(s, z).map((p) => (
          <rect
            key={`${z.id}-${p.x},${p.y}`}
            x={p.x * CELL}
            y={p.y * CELL}
            width={CELL}
            height={CELL}
            fill={ZONE_FILL[z.kind]}
            opacity={z.kind === 'darkness' ? 0.75 : 0.3}
          >
            <title>{z.name}</title>
          </rect>
        )),
      )}
    </svg>
  );
}
