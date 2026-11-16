// Colors for combat-map squares by map style (forest road, tavern, cave, mill). Original art.
export const STYLE_FILL: Record<string, Record<string, string>> = {
  'forest-road': {
    open: '#2f3b26',
    road: '#6b5638',
    brush: '#3c5530',
    trees: '#1d2a17',
    boulder: '#5f5a52',
  },
  // Tavern: plank floor, rugs, spilled benches, stone walls, tables.
  tavern: {
    open: '#5a4430',
    road: '#7a3b2e',
    brush: '#6d5236',
    trees: '#2c2622',
    boulder: '#4a3423',
  },
  // Cave / mine: dark rock, worn track, rubble, solid rock, boulders.
  cave: {
    open: '#3d3a36',
    road: '#55504a',
    brush: '#4a453d',
    trees: '#1b1a19',
    boulder: '#68625a',
  },
  // Mill: floorboards, flour drifts, broken crates, walls, the millstone.
  mill: {
    open: '#4f4233',
    road: '#8a7c64',
    brush: '#5d4d38',
    trees: '#26211c',
    boulder: '#77736b',
  },
};

export const terrainFill = (style: string | undefined, t: string): string =>
  (STYLE_FILL[style ?? 'forest-road'] ?? STYLE_FILL['forest-road']!)[t] ?? '#333';

/** What a terrain kind is called on this kind of map (for tooltips). */
export function terrainName(style: string | undefined, t: string): string {
  const names: Record<string, Record<string, string>> = {
    tavern: {
      open: 'floor',
      road: 'rug',
      brush: 'overturned benches',
      trees: 'wall',
      boulder: 'table',
    },
    cave: {
      open: 'rock floor',
      road: 'cart track',
      brush: 'rubble',
      trees: 'rock wall',
      boulder: 'boulder',
    },
    mill: {
      open: 'floorboards',
      road: 'flour',
      brush: 'broken crates',
      trees: 'wall',
      boulder: 'millstone',
    },
  };
  return names[style ?? '']?.[t] ?? t;
}
