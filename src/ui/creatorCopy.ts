// Screen text and colors from docs/mockups/CharacterCreator.dc.html.

export const CLASS_COPY: Record<string, { role: string; blurb: string; cloth: string }> = {
  barbarian: {
    role: 'Melee tank',
    cloth: '#6b4a2f',
    blurb: 'Enters a rage to hit harder and shrug off weapon damage.',
  },
  bard: {
    role: 'Support caster',
    cloth: '#7a3b5a',
    blurb: 'Inspires allies, heals, and charms foes with magic and wit.',
  },
  cleric: {
    role: 'Healer',
    cloth: '#8a7a50',
    blurb: 'Divine caster in heavy armor and the party’s strongest healer.',
  },
  druid: {
    role: 'Nature caster',
    cloth: '#4a6a3a',
    blurb: 'Nature magic for healing and battlefield control, plus Wild Shape.',
  },
  fighter: {
    role: 'Weapon master',
    cloth: '#5a5f66',
    blurb: 'Trained in every weapon and armor, with Second Wind and Action Surge.',
  },
  monk: {
    role: 'Mobile striker',
    cloth: '#a0702a',
    blurb: 'Unarmored martial artist with flurries of blows and fast movement.',
  },
  paladin: {
    role: 'Holy knight',
    cloth: '#7d8590',
    blurb: 'Armored warrior who spends spell slots on Divine Smite.',
  },
  ranger: {
    role: 'Skirmisher',
    cloth: '#3f5a3a',
    blurb: 'Expert hunter and archer with a touch of nature magic.',
  },
  rogue: {
    role: 'Precision striker',
    cloth: '#2f2f36',
    blurb: 'Sneak Attack, many skills, and Cunning Action to strike and slip away.',
  },
  sorcerer: {
    role: 'Innate caster',
    cloth: '#7a2f2f',
    blurb: 'Born with magic, bending spells with Metamagic.',
  },
  warlock: {
    role: 'Pact caster',
    cloth: '#4a2f5a',
    blurb: 'Draws power from a patron: Eldritch Blast and spell slots that return on a short rest.',
  },
  wizard: {
    role: 'Arcane scholar',
    cloth: '#3d4f7a',
    blurb: 'Learns the widest range of spells, recorded in a spellbook.',
  },
};

/** Species in the mockup's order. */
export const SPECIES_ORDER = [
  'human',
  'hill-dwarf',
  'high-elf',
  'lightfoot-halfling',
  'dragonborn',
  'rock-gnome',
  'half-elf',
  'half-orc',
  'tiefling',
];
export const ELF_EARS = new Set(['high-elf', 'half-elf']);

export const SKIN_TONES = ['#f1c9a5', '#d9a982', '#c99a74', '#a06b48', '#7a4a30', '#4e3224'];
export const HAIR_COLORS = ['#1e1712', '#3b2a20', '#7a4a2a', '#a0522d', '#d8c27a', '#9a9a9a'];
export const EYE_COLORS = ['#4a7a5a', '#4a6fa5', '#6b4a2b', '#9a8a3a'];

export const SKILL_NAMES: Record<string, string> = {
  acrobatics: 'Acrobatics',
  animalHandling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
