// What the game should sound like right now. Pure functions (no Web Audio) so they can be tested.
// Sound is presentation only: nothing here touches the rules or the seeded dice.
import { encounters, monsters, spells } from '../data';
import type { LogLine } from '../game/combat';

/** Background music, one per kind of moment. */
export type Mood =
  | 'title'
  | 'tavern'
  | 'travel'
  | 'dungeon'
  | 'marsh'
  | 'combat'
  | 'battle-undead'
  | 'battle-beast'
  | 'battle-fire'
  | 'boss'
  | 'camp'
  | 'epilogue';

/** The sound of the place you're in. */
export type Ambience =
  'none' | 'tavern' | 'fire' | 'cave' | 'river' | 'forest' | 'marsh' | 'wind' | 'forge' | 'night';

export type Element =
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'thunder'
  | 'radiant'
  | 'necrotic'
  | 'acid'
  | 'poison'
  | 'psychic'
  | 'force'
  | 'heal'
  | 'arcane';

/** One sound effect. */
export type Cue =
  | 'click'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'arrow'
  | 'block'
  | `spell-${Element}`
  | 'down'
  | 'death'
  | 'victory'
  | 'defeat'
  | 'dice'
  | 'success'
  | 'fail'
  | 'quest'
  | 'item'
  | 'levelup'
  | 'page'
  | 'steps';

/** Each place's background sound (by places.json id). */
export const PLACE_AMBIENCE: Record<string, Ambience> = {
  'drowned-lantern': 'tavern',
  ashford: 'tavern',
  'old-mine': 'cave',
  warren: 'cave',
  'steaming-cave': 'cave',
  'wix-caves': 'cave',
  mill: 'river',
  'toll-bridge': 'river',
  ashwood: 'forest',
  abbey: 'marsh',
  marrowmere: 'marsh',
  'lizardfolk-grounds': 'marsh',
  sallow: 'marsh',
  'deserters-camp': 'marsh',
  'ashfall-pass': 'wind',
  'great-forge': 'forge',
  'kings-kiln': 'forge',
};

/** Each place's music when you're there (outside a fight). */
const PLACE_MOOD: Record<string, Mood> = {
  'drowned-lantern': 'tavern',
  ashford: 'tavern',
  'old-mine': 'dungeon',
  warren: 'dungeon',
  'steaming-cave': 'dungeon',
  'wix-caves': 'dungeon',
  'great-forge': 'dungeon',
  'kings-kiln': 'dungeon',
  abbey: 'marsh',
  marrowmere: 'marsh',
  'lizardfolk-grounds': 'marsh',
  sallow: 'marsh',
  'deserters-camp': 'marsh',
};

/** Elite fights, the shrine, the undercroft, the last stand and the Crowning get the boss theme. */
const BOSS_FIGHT = /^(e\d|f7-|f14-|f20-|f21-)/;

export interface SoundScene {
  screen: string;
  location?: string | null;
  encounterId?: string | null;
  campScene?: string | null;
  difficulty?: string | null;
}

/**
 * Battle music by what you're fighting (playtest): undead get an eerie theme with tolling bells,
 * beasts tribal drums, fire creatures and dragons a fierce theme, everyone else (cultists,
 * soldiers, bandits) the march. Elites, bosses and the finale get the boss theme.
 */
export function battleMood(
  encounterId: string,
  difficulty: string | null | undefined = 'medium',
): Mood {
  if (BOSS_FIGHT.test(encounterId)) return 'boss';
  const enc = encounters.find((e) => e.id === encounterId);
  if (!enc) return 'combat';
  const count: Record<string, number> = {};
  for (const en of enc.enemies) {
    if (!en.difficulties.includes((difficulty ?? 'medium') as never)) continue;
    const m = monsters.find((x) => x.id === en.monster);
    if (!m) continue;
    const kind =
      m.type === 'undead'
        ? 'undead'
        : m.type === 'beast' || m.type === 'monstrosity'
          ? 'beast'
          : m.type === 'elemental' ||
              m.type === 'dragon' ||
              m.type === 'fiend' ||
              m.type === 'giant'
            ? 'fire'
            : 'humanoid';
    count[kind] = (count[kind] ?? 0) + 1;
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top === 'undead'
    ? 'battle-undead'
    : top === 'beast'
      ? 'battle-beast'
      : top === 'fire'
        ? 'battle-fire'
        : 'combat';
}

/** Hard fights (and bosses on Hard) play faster and with more drums. */
export const intenseFor = ({ screen, difficulty }: SoundScene) =>
  (screen === 'combat' || screen === 'prepare') && difficulty === 'hard';

export function moodFor(scene: SoundScene): Mood {
  const { screen, location, encounterId } = scene;
  switch (screen) {
    case 'title':
    case 'creator':
      return 'title';
    case 'explore':
      return 'tavern';
    case 'map':
      return 'travel';
    case 'camp':
      return 'camp';
    case 'epilogue':
      return 'epilogue';
    case 'prepare':
    case 'combat':
      return encounterId ? battleMood(encounterId, scene.difficulty) : 'combat';
    default:
      // Dialogue, party, level-up and the place maps follow where the party is.
      return (location && PLACE_MOOD[location]) || (location ? 'travel' : 'title');
  }
}

export function ambienceFor({ screen, location, campScene }: SoundScene): Ambience {
  if (screen === 'title' || screen === 'creator' || screen === 'epilogue') return 'none';
  if (screen === 'map') return 'wind';
  if (screen === 'camp')
    return campScene === 'inn' ? 'fire' : campScene === 'cave' ? 'cave' : 'night';
  return (location && PLACE_AMBIENCE[location]) || 'none';
}

const RANGED = /bow|crossbow|thrown|sling|dart|javelin|net|blowgun|spit/i;

/** The element of a spell, from its effects in spells.json (fire for Fireball, heal for Cure Wounds…). */
export function spellElement(name: string): Element {
  const sp = spells.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!sp) return 'arcane';
  let found: Element | null = null;
  const walk = (x: unknown): void => {
    if (found || !x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (o['type'] === 'heal' || o['type'] === 'temp-hp') found = 'heal';
    else if (typeof o['damageType'] === 'string') {
      const t = o['damageType'];
      found = (
        [
          'fire',
          'cold',
          'lightning',
          'thunder',
          'radiant',
          'necrotic',
          'acid',
          'poison',
          'psychic',
          'force',
        ] as const
      ).includes(t as never)
        ? (t as Element)
        : 'force';
    }
    Object.values(o).forEach(walk);
  };
  walk(sp.effects);
  return found ?? 'arcane';
}

/** Sound effects for new combat log lines, in order (at most `max`, so a busy turn stays clear). */
export function cuesForLog(lines: LogLine[], max = 4): Cue[] {
  const out: Cue[] = [];
  for (const { kind, text } of lines) {
    let cue: Cue | null = null;
    const attack = /^(.+?) attacks .+? with (.+?):/.exec(text);
    if (/^Victory!/.test(text)) cue = 'victory';
    else if (/^Defeat|party falls|The party is beaten/i.test(text)) cue = 'defeat';
    else if (/casts Shield|parries|glances off/.test(text)) cue = 'block';
    else if (attack && /→ MISS/.test(text)) cue = 'miss';
    else if (attack && /→ HIT/.test(text))
      cue =
        kind === 'crit' || /CRITICAL/.test(text)
          ? 'crit'
          : RANGED.test(attack[2]!)
            ? 'arrow'
            : 'hit';
    else if (/^.+? casts (.+?)(?: at level| \(|!|$)/.test(text)) {
      const name = /casts (.+?)(?: at level| \(|!|$)/.exec(text)![1]!;
      cue = `spell-${spellElement(name)}`;
    } else if (/falls unconscious/.test(text)) cue = 'down';
    else if (/\bdies\b|is destroyed|crumbles|is slain/.test(text)) cue = 'death';
    else if (/death save/.test(text)) cue = 'dice';
    if (cue && out.at(-1) !== cue) out.push(cue);
  }
  return out.slice(0, max);
}

/** Sound effects for the journal pop-ups ("Quest complete: …", "Received: …"). */
export function cuesForMessages(messages: string[]): Cue[] {
  const out = new Set<Cue>();
  for (const m of messages) {
    if (/^Quest complete|^Truth learned|Truth:/i.test(m)) out.add('quest');
    else if (/^Received|gold|^Found/i.test(m)) out.add('item');
    else if (/can level up|Level up/i.test(m)) out.add('levelup');
    else if (/^Journal|^Quest updated|^New quest|^Note/i.test(m)) out.add('page');
  }
  return [...out];
}
