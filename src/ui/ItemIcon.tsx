// Item icons (playtest): a small drawing for every item, framed by rarity, so a hard-won magic item
// looks special beside plain gear. Original SVG.
import { armor, magicItems, weapons } from '../data';
import { SOLD_ANYWHERE } from '../game/shops';
import { slotKindOf } from '../game/loadout';

export type Rarity = 'mundane' | 'common' | 'uncommon' | 'rare' | 'very-rare' | 'story';

/** How special an item is: story treasures (found, not bought) outrank everything. */
export function rarityOf(id: string): Rarity {
  const m = magicItems.find((x) => x.id === id);
  if (!m) return 'mundane';
  const bought = SOLD_ANYWHERE.has(id) || id.startsWith('potion-of-healing');
  if (!bought && !m.consumable) return 'story';
  return m.rarity;
}

export const RARITY_NAMES: Record<Rarity, string> = {
  mundane: 'Ordinary',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very-rare': 'Very rare',
  story: 'Unique',
};

const FRAME: Record<Rarity, [string, string]> = {
  mundane: ['#51607a', '#2b3442'],
  common: ['#c3ccd9', '#2f3a4b'],
  uncommon: ['#4fbf6a', '#22392a'],
  rare: ['#5a9ae8', '#1f2e48'],
  'very-rare': ['#b07ad9', '#30214a'],
  story: ['#e8c27a', '#3a2e1a'],
};

type Glyph =
  | 'sword'
  | 'dagger'
  | 'axe'
  | 'hammer'
  | 'bow'
  | 'crossbow'
  | 'spear'
  | 'staff'
  | 'sling'
  | 'whip'
  | 'light-armor'
  | 'medium-armor'
  | 'heavy-armor'
  | 'shield'
  | 'potion'
  | 'flask'
  | 'ring'
  | 'cloak'
  | 'amulet'
  | 'boots'
  | 'stone'
  | 'lantern'
  | 'bag'
  | 'rope'
  | 'torch'
  | 'crowbar'
  | 'tools'
  | 'kit';

const WEAPON_GLYPH: [RegExp, Glyph][] = [
  [/dagger/, 'dagger'],
  [/sword|rapier|scimitar|slayer/, 'sword'],
  [/axe/, 'axe'],
  [/hammer|mace|maul|club|morningstar|flail|deepdelver|pick/, 'hammer'],
  [/crossbow/, 'crossbow'],
  [/bow/, 'bow'],
  [/spear|javelin|pike|halberd|glaive|trident|lance/, 'spear'],
  [/staff/, 'staff'],
  [/sling|dart|blowgun/, 'sling'],
  [/whip/, 'whip'],
  [/sickle/, 'axe'],
];

function glyphOf(id: string): Glyph {
  const m = magicItems.find((x) => x.id === id);
  if (m?.kind === 'potion') return 'potion';
  if (id === 'shield' || m?.kind === 'shield') return 'shield';
  const a = armor.find((x) => x.id === id);
  if (a)
    return a.category === 'heavy'
      ? 'heavy-armor'
      : a.category === 'medium'
        ? 'medium-armor'
        : 'light-armor';
  if (weapons.some((w) => w.id === id) || m?.kind === 'weapon' || m?.kind === 'staff') {
    const base = m?.baseWeapon && typeof m.baseWeapon === 'string' ? m.baseWeapon : id;
    return WEAPON_GLYPH.find(([re]) => re.test(base) || re.test(id))?.[1] ?? 'sword';
  }
  const slot = slotKindOf(id);
  if (slot === 'ring') return 'ring';
  if (slot === 'cloak') return 'cloak';
  if (slot === 'neck') return 'amulet';
  if (slot === 'feet') return 'boots';
  if (/lantern/.test(id)) return 'lantern';
  if (/gift|bag/.test(id)) return 'bag';
  if (slot === 'trinket') return 'stone';
  if (id === 'rope') return 'rope';
  if (id === 'torches') return 'torch';
  if (id === 'crowbar') return 'crowbar';
  if (id === 'thieves-tools') return 'tools';
  if (id === 'healers-kit') return 'kit';
  if (/fire|water|acid/.test(id)) return 'flask';
  return 'bag';
}

const FLASK_COLOR: Record<string, string> = {
  'alchemists-fire': '#f08a3a',
  'holy-water': '#cfe6ff',
  'acid-vial': '#8fd14f',
  'potion-of-healing': '#e04a4a',
  'potion-of-greater-healing': '#b0203a',
  'potion-of-fire-resistance': '#f0a040',
};

function GlyphPath({ g, ink, accent }: { g: Glyph; ink: string; accent: string }) {
  const stroke = {
    stroke: ink,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  switch (g) {
    case 'sword':
      return (
        <g>
          <path d="M6 18 L16.5 7.5 L18 4 L14.5 5.5 L4 16" {...stroke} />
          <path d="M5 13 L9 17 M3.5 18.5 L5.5 20.5" {...stroke} />
        </g>
      );
    case 'dagger':
      return (
        <path d="M8 16 L15 9 L16.5 5.5 L13 7 L6 14 M6 12 L10 16 M5.5 17.5 L4.5 18.5" {...stroke} />
      );
    case 'axe':
      return (
        <g>
          <path d="M6 20 L15 7" {...stroke} />
          <path d="M12 5 C16 3 20 6 19 10 C17 9 15 9 13.5 10 Z" fill={ink} />
        </g>
      );
    case 'hammer':
      return (
        <g>
          <path d="M7 20 L14 9" {...stroke} />
          <rect
            x="11"
            y="3.5"
            width="9"
            height="6"
            rx="1"
            transform="rotate(33 15.5 6.5)"
            fill={ink}
          />
        </g>
      );
    case 'bow':
      return (
        <g>
          <path d="M7 3 C17 6 17 18 7 21" {...stroke} />
          <path d="M7 3 L7 21" stroke={ink} strokeWidth="0.8" />
          <path d="M5 12 H18 M16 10 L18 12 L16 14" {...stroke} />
        </g>
      );
    case 'crossbow':
      return (
        <g>
          <path d="M4 9 C8 5 16 5 20 9" {...stroke} />
          <path d="M12 6 V20 M4 9 L12 12 L20 9" {...stroke} />
        </g>
      );
    case 'spear':
      return (
        <g>
          <path d="M5 19 L16 8" {...stroke} />
          <path d="M15 5 L19.5 4.5 L19 9 L16 8 Z" fill={ink} />
        </g>
      );
    case 'staff':
      return (
        <g>
          <path d="M7 21 L15 5" {...stroke} />
          <circle cx="16" cy="4.5" r="2.2" fill={accent} />
        </g>
      );
    case 'sling':
      return <path d="M5 6 C9 14 15 14 19 6 M12 13 V19" {...stroke} />;
    case 'whip':
      return <path d="M5 19 L9 15 C14 10 19 12 17 16 C15 20 10 17 13 13" {...stroke} />;
    case 'light-armor':
      return (
        <path
          d="M7 5 L10 4 C11 6 13 6 14 4 L17 5 L18 10 L16 11 V20 H8 V11 L6 10 Z"
          fill={ink}
          opacity="0.85"
        />
      );
    case 'medium-armor':
      return (
        <g>
          <path d="M7 5 L10 4 C11 6 13 6 14 4 L17 5 L18 10 L16 11 V20 H8 V11 L6 10 Z" fill={ink} />
          <path
            d="M9 13 Q12 15 15 13 M9 16 Q12 18 15 16"
            stroke="#2b3442"
            strokeWidth="1"
            fill="none"
          />
        </g>
      );
    case 'heavy-armor':
      return (
        <g>
          <path
            d="M6 7 C6 4 9 3 12 3 C15 3 18 4 18 7 V12 C18 17 15 20 12 21 C9 20 6 17 6 12 Z"
            fill={ink}
          />
          <path d="M12 4 V20 M8 9 H16" stroke="#2b3442" strokeWidth="1" />
        </g>
      );
    case 'shield':
      return (
        <g>
          <path d="M5 5 H19 V11 C19 16 15 19 12 21 C9 19 5 16 5 11 Z" fill={ink} />
          <path d="M12 7 V18 M8 11 H16" stroke={accent} strokeWidth="1.6" />
        </g>
      );
    case 'potion':
    case 'flask':
      return (
        <g>
          <path
            d="M10 3 H14 V7 L17 11 C19 15 17 20 12 20 C7 20 5 15 7 11 L10 7 Z"
            stroke={ink}
            strokeWidth="1.4"
            fill="none"
          />
          <path
            d="M7.5 13 C9 12 15 12 16.5 13 C17 17 15 19 12 19 C9 19 7 17 7.5 13 Z"
            fill={accent}
          />
          <rect x="9.5" y="2" width="5" height="2" rx="0.6" fill={ink} />
        </g>
      );
    case 'ring':
      return (
        <g>
          <circle cx="12" cy="14" r="5.5" {...stroke} strokeWidth={2.4} />
          <path d="M10 7 L12 4 L14 7 Z" fill={accent} />
        </g>
      );
    case 'cloak':
      return <path d="M9 4 H15 L18 20 C15 21 9 21 6 20 Z M9 4 C10 7 14 7 15 4" fill={ink} />;
    case 'amulet':
      return (
        <g>
          <path d="M6 4 C7 10 17 10 18 4" {...stroke} />
          <circle cx="12" cy="14" r="4.5" fill={accent} stroke={ink} strokeWidth="1.2" />
        </g>
      );
    case 'boots':
      return <path d="M8 4 H13 V14 L19 16 V20 H6 V14 Z" fill={ink} />;
    case 'stone':
      return (
        <path
          d="M7 9 L11 5 L17 7 L19 13 L14 19 L7 17 L5 12 Z"
          fill={accent}
          stroke={ink}
          strokeWidth="1"
        />
      );
    case 'lantern':
      return (
        <g>
          <path d="M9 7 H15 V18 H9 Z" {...stroke} />
          <path d="M10.5 9 H13.5 V16 H10.5 Z" fill={accent} />
          <path d="M12 3 V7 M10 3 H14" {...stroke} />
        </g>
      );
    case 'bag':
      return (
        <path d="M9 5 H15 L14 8 C18 10 19 14 18 17 C17 20 7 20 6 17 C5 14 6 10 10 8 Z" fill={ink} />
      );
    case 'rope':
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="4" />
          <path d="M18 15 L21 19" />
        </g>
      );
    case 'torch':
      return (
        <g>
          <path d="M10 21 L12 10 L14 21 Z" fill={ink} />
          <path d="M12 3 C9 6 10 9 12 10 C14 9 15 6 12 3 Z" fill={accent} />
        </g>
      );
    case 'crowbar':
      return <path d="M6 19 L16 6 C17 4 19 4 19.5 6" {...stroke} strokeWidth={2.2} />;
    case 'tools':
      return (
        <g {...stroke}>
          <path d="M6 18 L13 11 M13 11 L17 7 L19 9" />
          <path d="M8 6 L18 16 M16 18 L18 16" />
        </g>
      );
    case 'kit':
      return (
        <g>
          <rect x="4" y="7" width="16" height="12" rx="2" fill={ink} />
          <path d="M12 10 V16 M9 13 H15" stroke="#c0392b" strokeWidth="2" />
          <path d="M9 7 V5 H15 V7" {...stroke} />
        </g>
      );
  }
}

/** A framed icon for an item (rarity sets the frame; story treasures glow). */
export function ItemIcon({ id, size = 36 }: { id: string; size?: number }) {
  const rarity = rarityOf(id);
  const [edge, fill] = FRAME[rarity];
  const g = glyphOf(id);
  const ink = rarity === 'mundane' ? '#b8c0cc' : '#f3ead6';
  const accent = FLASK_COLOR[id] ?? (rarity === 'mundane' ? '#8a96a8' : edge);
  return (
    <span
      className={`item-icon rarity-${rarity}`}
      style={{ width: size, height: size }}
      title={RARITY_NAMES[rarity]}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size - 8} height={size - 8}>
        <GlyphPath g={g} ink={ink} accent={accent} />
      </svg>
      <span className="item-icon-frame" style={{ borderColor: edge, background: fill }} />
    </span>
  );
}
