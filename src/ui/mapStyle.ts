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
  // Toll bridge: river banks, the bridge planks, reeds, deep fast water, posts.
  bridge: {
    open: '#3a4a2e',
    road: '#7a5e3a',
    brush: '#4a5e34',
    trees: '#2a4a66',
    boulder: '#5f5a52',
  },
  // Marsh: mud, a raised track, bog (difficult), deep water, dead stumps.
  marsh: {
    open: '#3f4a33',
    road: '#5e5a40',
    brush: '#35503a',
    trees: '#1f3a42',
    boulder: '#4a3e30',
  },
  // Abbey / crypt: flagstones, the aisle, rubble, walls, pillars and tombs.
  abbey: {
    open: '#4a4a52',
    road: '#5e4a5a',
    brush: '#55524a',
    trees: '#22232a',
    boulder: '#6e6a62',
  },
  // Town street: cobbles, the high street, carts and crates, houses, a well.
  town: {
    open: '#504a44',
    road: '#655c52',
    brush: '#6b5236',
    trees: '#2c2622',
    boulder: '#5a6470',
  },
  // High Greypeaks: ash-covered rock, the path, scree, cliffs, boulders.
  heights: {
    open: '#5a5650',
    road: '#6e6658',
    brush: '#4a4640',
    trees: '#2a2826',
    boulder: '#77716a',
  },
  // The King's Kiln: black forge-stone, the processional, cinders, lava channels, anvils.
  kiln: {
    open: '#3a302c',
    road: '#5a3a2c',
    brush: '#4a3428',
    trees: '#a8401c',
    boulder: '#5a5a62',
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
    bridge: {
      open: 'riverbank',
      road: 'bridge',
      brush: 'reeds',
      trees: 'deep water',
      boulder: 'post',
    },
    marsh: {
      open: 'mud',
      road: 'raised track',
      brush: 'bog',
      trees: 'deep water',
      boulder: 'dead stump',
    },
    abbey: { open: 'flagstones', road: 'aisle', brush: 'rubble', trees: 'wall', boulder: 'pillar' },
    town: {
      open: 'cobbles',
      road: 'high street',
      brush: 'crates',
      trees: 'house',
      boulder: 'well',
    },
    heights: { open: 'ash', road: 'path', brush: 'scree', trees: 'cliff', boulder: 'boulder' },
    kiln: {
      open: 'forge-stone',
      road: 'processional',
      brush: 'cinders',
      trees: 'lava',
      boulder: 'anvil',
    },
  };
  return names[style ?? '']?.[t] ?? t;
}
