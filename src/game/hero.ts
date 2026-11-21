import {
  armor as armorList,
  backgrounds,
  classes,
  defaultChoices,
  loadouts,
  magicItems,
  spellSlots,
  species as speciesList,
} from '../data';
import type { ClassDef } from '../data/schemas/class';
import type { Species } from '../data/schemas/species';
import {
  ABILITIES,
  abilityModifier,
  applyBonuses,
  firstLevelHp,
  isValidPointBuy,
  noDefenses,
  placeByPriority,
  proficiencyBonus,
  SKILLS,
  STANDARD_ARRAY,
  type Ability,
  type AbilityScores,
  type Creature,
  type DamageType,
  type DieSize,
  type Skill,
} from '../rules';

export type HairStyle = 'short' | 'long' | 'bald' | 'hood';
export interface Portrait {
  skin: string;
  hair: string;
  eyes: string;
  hairStyle: HairStyle;
  beard: boolean;
  scar: boolean;
  /** Show a helm (cosmetic). Unset: shown with chain mail, half plate, splint and plate. */
  helmet?: boolean;
}

export type AbilityMethod = 'array' | 'point' | 'roll';

/** A party member: a rules-engine creature plus everything the character sheet needs. */
export interface Hero extends Creature {
  origin: 'custom' | 'corin';
  speciesId: string;
  classId: string;
  backgroundId: string;
  baseAbilities: AbilityScores;
  abilityMethod: AbilityMethod;
  skills: Skill[];
  expertise: Skill[];
  fightingStyle: string | null;
  speed: number;
  portrait: Portrait;
  /**
   * What the hero wears and wields. `loadout` (the slots) is the source of truth; `armor`,
   * `shield`, `weapons` and `magic` are worked out from it (src/game/loadout.ts) for the rules.
   */
  equipment: {
    armor: string | null;
    shield: boolean;
    weapons: string[];
    magic: string[];
    loadout?: import('./loadout').Loadout;
  };
  /** The chosen subclass when there's a choice (cleric domains); unset = the class default. */
  subclassId?: string;
  /** A Hex or Hunter's Mark still running after a fight, until this game hour (PHB: 1 hour). */
  lingering?: { spell: string; until?: number };
  /** Abjuration wizard: the Arcane Ward's hit points (undefined until made after a long rest). */
  arcaneWard?: number;
  /** Clerics, druids and paladins may re-prepare spells (set after a long rest, cleared by a fight). */
  canPrepare?: boolean;
  /** Cantrips and leveled spells known or prepared. */
  cantrips: string[];
  spells: string[];
  /** Warlock invocations (defaults until the level-up screen, M5). */
  invocations: string[];
  /** Spell slots spent, per slot level (index 0 = 1st level). Max comes from class and level. */
  slotsUsed: number[];
  /** Uses spent of class resources (rage, ki, second-wind...). Max comes from class data. */
  resourcesUsed: Record<string, number>;
  /** Level-up picks by feature id (metamagic, pact-boon, hunters-prey, favored-enemy...). */
  choices: Record<string, string[]>;
  /** Hit point maximum lost to Life Drain (specters, wraiths) until a long rest. */
  maxHpDrain?: number;
}

/** What the player has picked so far in the creator. */
export interface HeroDraft {
  origin: 'custom' | 'corin';
  name: string;
  speciesId: string;
  classId: string;
  backgroundId: string;
  method: AbilityMethod;
  /** Scores before species bonuses. */
  baseAbilities: AbilityScores;
  /** The six rolled totals (Roll method), highest first; null until rolled. */
  rolled: number[] | null;
  rollLog: string[];
  /** Half-elf: the two abilities that get +1. */
  halfElfBonus: Ability[];
  classSkills: Skill[];
  /** Half-elf Skill Versatility picks. */
  bonusSkills: Skill[];
  expertise: Skill[];
  fightingStyle: string | null;
  portrait: Portrait;
  /** Cleric domain (or another subclass picked at level 1). */
  subclassId?: string;
}

/**
 * Which abilities get the best scores for each class (from docs/mockups/CharacterCreator.dc.html).
 * Used to place the standard array and rolls automatically; the player can swap afterwards.
 */
export const CLASS_PRIORITY: Record<string, Ability[]> = {
  barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  cleric: ['wis', 'con', 'str', 'dex', 'cha', 'int'],
  druid: ['wis', 'con', 'dex', 'int', 'str', 'cha'],
  fighter: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  paladin: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
  ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  rogue: ['dex', 'con', 'int', 'wis', 'cha', 'str'],
  sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
};

export const getClass = (id: string): ClassDef => {
  const c = classes.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown class "${id}"`);
  return c;
};
export const getSpecies = (id: string): Species => {
  const s = speciesList.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown species "${id}"`);
  return s;
};
export const getBackground = (id: string) => {
  const b = backgrounds.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown background "${id}"`);
  return b;
};

/** The values the current method places (array, rolls or point-buy starting point). */
export function methodPool(method: AbilityMethod, rolled: number[] | null): number[] {
  if (method === 'roll' && rolled) return rolled;
  return [...STANDARD_ARRAY];
}

export function defaultHalfElfBonus(classId: string): Ability[] {
  return CLASS_PRIORITY[classId]!.filter((a) => a !== 'cha').slice(0, 2);
}

export function speciesBonuses(
  draft: Pick<HeroDraft, 'speciesId' | 'halfElfBonus'>,
): Partial<AbilityScores> {
  const sp = getSpecies(draft.speciesId);
  const out: Partial<AbilityScores> = { ...sp.abilityBonuses };
  if (sp.abilityChoice)
    for (const a of draft.halfElfBonus) out[a] = (out[a] ?? 0) + sp.abilityChoice.amount;
  return out;
}

export function finalAbilities(draft: HeroDraft): AbilityScores {
  return applyBonuses(draft.baseAbilities, speciesBonuses(draft));
}

export const DEFAULT_PORTRAIT: Portrait = {
  skin: '#c99a74',
  hair: '#3b2a20',
  eyes: '#4a7a5a',
  hairStyle: 'long',
  beard: false,
  scar: true,
};

export function newDraft(classId = 'fighter', speciesId = 'human'): HeroDraft {
  return {
    origin: 'custom',
    name: '',
    speciesId,
    classId,
    backgroundId: 'folk-hero',
    method: 'array',
    baseAbilities: placeByPriority(STANDARD_ARRAY, CLASS_PRIORITY[classId]!),
    rolled: null,
    rollLog: [],
    halfElfBonus: defaultHalfElfBonus(classId),
    classSkills: [],
    bonusSkills: [],
    expertise: [],
    fightingStyle: null,
    portrait: { ...DEFAULT_PORTRAIT },
  };
}

/**
 * Corin Varrow, the origin character (docs/Story_Bible.md §9): human sorcerer, Draconic
 * Bloodline (red), amber eyes. Name, species, class and look are fixed; abilities and
 * background can be chosen. Urchin is the default background [inferred: he grew up a street
 * mage downriver].
 */
export function corinDraft(): HeroDraft {
  return {
    ...newDraft('sorcerer', 'human'),
    origin: 'corin',
    name: 'Corin Varrow',
    backgroundId: 'urchin',
    portrait: {
      skin: '#d9a982',
      hair: '#1e1712',
      eyes: '#9a8a3a',
      hairStyle: 'short',
      beard: false,
      scar: false,
    },
  };
}

/** Skills the hero gets without choosing: background and species traits. */
export function grantedSkills(draft: Pick<HeroDraft, 'speciesId' | 'backgroundId'>): Skill[] {
  const out = new Set<Skill>(getBackground(draft.backgroundId).skills);
  for (const t of getSpecies(draft.speciesId).traits)
    for (const m of t.mechanics) if (m.type === 'skill') out.add(m.skill);
  return [...out];
}

export function classSkillChoices(classId: string): { choose: number; from: Skill[] } {
  const s = getClass(classId).skills;
  return { choose: s.choose, from: s.from === 'any' ? (Object.keys(SKILLS) as Skill[]) : s.from };
}

export const bonusSkillCount = (speciesId: string): number =>
  getSpecies(speciesId).traits.reduce(
    (n, t) => n + t.mechanics.reduce((k, m) => k + (m.type === 'skillChoice' ? m.count : 0), 0),
    0,
  );

export function allSkills(draft: HeroDraft): Skill[] {
  return [...new Set([...grantedSkills(draft), ...draft.classSkills, ...draft.bonusSkills])];
}

/** Level-1 feature choices the creator asks for. */
export function levelOneChoices(classId: string) {
  const features = getClass(classId).levels[0]!.features;
  const style = features.find((f) => f.id === 'fighting-style');
  const expertise = features.find((f) => f.id === 'expertise');
  return { fightingStyles: style?.options ?? null, expertise: expertise?.choose ?? 0 };
}

/** Everything still missing or wrong. Empty = ready to add to the party. */
export function draftProblems(draft: HeroDraft): string[] {
  const p: string[] = [];
  if (!draft.name.trim()) p.push('Give your hero a name.');
  if (draft.method === 'point' && !isValidPointBuy(draft.baseAbilities))
    p.push('Point buy must spend at most 27 points on scores of 8 to 15.');
  if (draft.method === 'roll' && !draft.rolled) p.push('Roll your ability scores.');
  const sp = getSpecies(draft.speciesId);
  if (sp.abilityChoice) {
    const ok =
      draft.halfElfBonus.length === sp.abilityChoice.count &&
      new Set(draft.halfElfBonus).size === sp.abilityChoice.count;
    if (!ok || draft.halfElfBonus.some((a) => sp.abilityChoice!.exclude.includes(a)))
      p.push(
        `Pick ${sp.abilityChoice.count} different abilities for the half-elf +1s (not Charisma).`,
      );
  }
  const { choose, from } = classSkillChoices(draft.classId);
  const granted = grantedSkills(draft);
  if (draft.classSkills.length !== choose) p.push(`Choose ${choose} class skills.`);
  if (draft.classSkills.some((s) => !from.includes(s) || granted.includes(s)))
    p.push('A class skill is not on the list, or you already have it.');
  const bonus = bonusSkillCount(draft.speciesId);
  if (draft.bonusSkills.length !== bonus) p.push(`Choose ${bonus} skills from Skill Versatility.`);
  const choices = levelOneChoices(draft.classId);
  if (choices.fightingStyles && !choices.fightingStyles.some((o) => o.id === draft.fightingStyle))
    p.push('Choose a fighting style.');
  if (choices.expertise) {
    const skills = allSkills(draft);
    if (
      draft.expertise.length !== choices.expertise ||
      draft.expertise.some((s) => !skills.includes(s))
    )
      p.push(`Choose ${choices.expertise} of your skills for Expertise.`);
  }
  return p;
}

/**
 * Armor Class. PHB: Armor and Shields (light = base + Dex; medium = base + Dex up to 2;
 * heavy = base). Unarmored: 10 + Dex, or Barbarian 10 + Dex + Con, Monk 10 + Dex + Wis
 * (no shield), Draconic sorcerer 13 + Dex. A shield adds 2. Fighting style Defense: +1 in armor.
 */
export function computeAc(
  classId: string,
  abilities: AbilityScores,
  equipment: Pick<Hero['equipment'], 'armor' | 'shield'>,
  fightingStyle: string | null,
): number {
  const dex = abilityModifier(abilities.dex);
  const worn = equipment.armor ? armorList.find((a) => a.id === equipment.armor) : undefined;
  let ac: number;
  if (worn) {
    const capped = worn.dexCap === null ? dex : Math.min(dex, worn.dexCap);
    ac = worn.ac + capped;
    if (fightingStyle === 'defense') ac += 1;
  } else if (classId === 'barbarian') ac = 10 + dex + abilityModifier(abilities.con);
  else if (classId === 'monk' && !equipment.shield) ac = 10 + dex + abilityModifier(abilities.wis);
  else if (classId === 'sorcerer') ac = 13 + dex;
  else ac = 10 + dex;
  if (equipment.shield) ac += 2;
  return ac;
}

/** Level-1 HP: hit die maximum + Con, plus Dwarven Toughness / Draconic Resilience. */
export function levelOneHp(draft: HeroDraft): number {
  const cls = getClass(draft.classId);
  const sp = getSpecies(draft.speciesId);
  const conMod = abilityModifier(finalAbilities(draft).con);
  const mechanics = [
    ...sp.traits.flatMap((t) => t.mechanics),
    ...cls.levels[0]!.features.flatMap((f) => f.mechanics),
  ];
  const extra = mechanics.reduce((n, m) => n + (m.type === 'hpPerLevel' ? m.amount : 0), 0);
  return firstLevelHp(cls.hitDie as DieSize, conMod) + extra;
}

/** Turn a finished draft into a level-1 hero. */
export function buildHero(draft: HeroDraft, id: string): Hero {
  const problems = draftProblems(draft);
  if (problems.length) throw new Error(`Hero not ready: ${problems.join(' ')}`);
  const cls = getClass(draft.classId);
  const sp = getSpecies(draft.speciesId);
  const abilities = finalAbilities(draft);
  const maxHp = levelOneHp(draft);
  const kit = cls.startingKit;
  // Chosen in the creator only for classes that pick at 1st level (clerics, warlocks); the rest
  // choose at level-up.
  const subclassId =
    cls.subclasses && cls.subclass.level === 1 ? (draft.subclassId ?? cls.subclass.id) : undefined;
  // A Light cleric isn't trained in heavy armor: scale mail instead of the kit's chain mail.
  const heavy = armorList.find((a) => a.id === kit.armor)?.category === 'heavy';
  const kitArmor =
    heavy && !armorProfsOf({ classId: cls.id, subclassId }).includes('heavy')
      ? 'scale-mail'
      : (kit.armor ?? null);
  const equipment = {
    armor: kitArmor,
    shield: kit.shield,
    weapons: [...kit.weapons],
    magic: [] as string[],
  };
  const resistances = sp.traits.flatMap((t) =>
    t.mechanics.flatMap((m) => (m.type === 'resistance' ? [m.damageType as DamageType] : [])),
  );
  return {
    id,
    name: draft.name.trim(),
    kind: 'pc',
    level: 1,
    xp: 0,
    proficiencyBonus: proficiencyBonus(1),
    abilities,
    saveProficiencies: [...cls.saves],
    ac: computeAc(cls.id, abilities, equipment, draft.fightingStyle),
    maxHp,
    hp: maxHp,
    tempHp: 0,
    hitDice: { die: cls.hitDie as DieSize, total: 1, remaining: 1 },
    conditions: [],
    exhaustion: 0,
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    defenses: { ...noDefenses(), resistances },
    concentration: null,
    origin: draft.origin,
    speciesId: sp.id,
    classId: cls.id,
    backgroundId: draft.backgroundId,
    baseAbilities: { ...draft.baseAbilities },
    abilityMethod: draft.method,
    skills: allSkills(draft),
    expertise: [...draft.expertise],
    fightingStyle: draft.fightingStyle,
    speed: sp.speed,
    portrait: { ...draft.portrait },
    equipment,
    ...(subclassId ? { subclassId } : {}),
    ...defaultSpells(cls.id),
    invocations: [],
    slotsUsed: [],
    resourcesUsed: {},
    choices: {},
  };
}

/**
 * Skill bonus for the character sheet and dialogue checks (proficiency doubled with Expertise).
 * PHB: Bard, Jack of All Trades. Half proficiency (rounded down) on skills without proficiency.
 */
export function skillBonus(
  hero: Pick<Hero, 'abilities' | 'skills' | 'expertise' | 'proficiencyBonus'> &
    Partial<Pick<Hero, 'classId' | 'level'>>,
  skill: Skill,
): number {
  const base = abilityModifier(hero.abilities[SKILLS[skill]]);
  if (hero.expertise.includes(skill)) return base + hero.proficiencyBonus * 2;
  if (hero.skills.includes(skill)) return base + hero.proficiencyBonus;
  if (hero.classId === 'bard' && (hero.level ?? 1) >= 2)
    return base + Math.floor(hero.proficiencyBonus / 2);
  return base;
}

export { ABILITIES };

// ── Spells and resources ──

/** Spell slots available at this level, per slot level (index 0 = 1st). Warlocks: pact slots. */
export function maxSlots(hero: Pick<Hero, 'classId' | 'level'>): number[] {
  const sc = getClass(hero.classId).spellcasting;
  if (!sc) return [];
  const i = Math.min(hero.level, 6) - 1;
  if (sc.progression === 'pact') {
    const p = spellSlots.pact[i]!;
    return Array.from({ length: p.slotLevel }, (_, k) => (k === p.slotLevel - 1 ? p.slots : 0));
  }
  return [...(sc.progression === 'full' ? spellSlots.full : spellSlots.half)[i]!];
}

export function slotsLeft(hero: Pick<Hero, 'classId' | 'level' | 'slotsUsed'>): number[] {
  return maxSlots(hero).map((n, k) => Math.max(0, n - (hero.slotsUsed[k] ?? 0)));
}

/** Max uses of a class resource at the hero's level. */
export function resourceMax(
  hero: Pick<Hero, 'classId' | 'level' | 'abilities'> & { subclassId?: string },
  id: string,
): number {
  const r = getClass(hero.classId).resources.find((x) => x.id === id);
  if (!r) return 0;
  if (r.subclass && r.subclass !== subclassOf(hero)) return 0;
  if (r.perLevel) return r.perLevel[Math.min(hero.level, 6) - 1] ?? 0;
  const cha = abilityModifier(hero.abilities.cha);
  switch (r.formula) {
    case 'cha-mod-min-1':
      return Math.max(1, cha);
    case '1+cha-mod':
      return Math.max(1, 1 + cha);
    case '5-x-level':
      return 5 * hero.level;
    case 'wis-mod-min-1':
      return Math.max(1, abilityModifier(hero.abilities.wis));
    default:
      throw new Error(`Unknown resource formula "${r.formula}"`);
  }
}

export function resourceLeft(
  hero: Pick<Hero, 'classId' | 'level' | 'abilities' | 'resourcesUsed'>,
  id: string,
): number {
  return Math.max(0, resourceMax(hero, id) - (hero.resourcesUsed[id] ?? 0));
}

/** PHB: heavy armor with a Strength requirement slows a weaker wearer by 10 ft (not dwarves). */
export function armorSlows(hero: Pick<Hero, 'equipment' | 'abilities' | 'speciesId'>): boolean {
  const a = armorList.find((x) => x.id === hero.equipment.armor);
  if (!a?.strength || hero.speciesId.includes('dwarf')) return false;
  return hero.abilities.str < a.strength;
}

/** Default spells for a class (src/data/loadouts.json) [inferred until spell choice, M5]. */
export function defaultSpells(classId: string): { cantrips: string[]; spells: string[] } {
  const l = loadouts.find((x) => x.classId === classId);
  return { cantrips: [...(l?.cantrips ?? [])], spells: [...(l?.spells ?? [])] };
}

export function defaultInvocations(classId: string, level: number): string[] {
  return classId === 'warlock' && level >= 2 ? [...defaultChoices.warlockInvocations] : [];
}

/**
 * Raise a hero one level with fixed HP (PHB average), refreshing derived values. Used by the
 * Prepare step until the level-up screen (M5) lets the player choose.
 */
export function levelUpHero(hero: Hero): Hero {
  const cls = getClass(hero.classId);
  const sp = getSpecies(hero.speciesId);
  const level = hero.level + 1;
  const extra = [
    ...sp.traits.flatMap((t) => t.mechanics),
    ...cls.levels[0]!.features.flatMap((f) => f.mechanics),
  ].reduce((n, m) => n + (m.type === 'hpPerLevel' ? m.amount : 0), 0);
  // PHB: Hit Points at higher levels: fixed value (die / 2 + 1) + Con modifier, at least 1.
  const gain = Math.max(1, cls.hitDie / 2 + 1 + abilityModifier(hero.abilities.con)) + extra;
  return {
    ...hero,
    level,
    xp: Math.max(hero.xp, [0, 300, 900, 2700, 6500, 14000][level - 1]!),
    proficiencyBonus: proficiencyBonus(level),
    maxHp: hero.maxHp + gain,
    hp: hero.dead ? hero.hp : hero.hp + gain,
    hitDice: {
      ...hero.hitDice,
      total: hero.hitDice.total + 1,
      remaining: hero.hitDice.remaining + 1,
    },
    invocations: hero.invocations.length
      ? hero.invocations
      : defaultInvocations(hero.classId, level),
    speed: sp.speed + (hero.classId === 'monk' && level >= 2 ? 10 : 0),
  };
}

/** Spellcasting numbers. PHB: spell save DC = 8 + proficiency + ability modifier. */
export function spellNumbers(
  hero: Pick<Hero, 'classId' | 'abilities' | 'proficiencyBonus'> & {
    equipment?: Pick<Hero['equipment'], 'magic'>;
  },
): { ability: Ability; mod: number; attack: number; dc: number } | null {
  const sc = getClass(hero.classId).spellcasting;
  if (!sc) return null;
  const mod = abilityModifier(hero.abilities[sc.ability]);
  // DMG: Wand of the War Mage and similar: a bonus to spell attacks (or save DCs) while attuned.
  const bonus = (target: 'spell-attack' | 'spell-dc') =>
    (hero.equipment?.magic ?? []).reduce((n, id) => {
      const it = magicItems.find((x) => x.id === id);
      return (
        n +
        (it?.effects ?? []).reduce(
          (m, e) =>
            e.type === 'modifier' && e.target === target && typeof e.value === 'number'
              ? m + e.value
              : m,
          0,
        )
      );
    }, 0);
  return {
    ability: sc.ability,
    mod,
    attack: mod + hero.proficiencyBonus + bonus('spell-attack'),
    dc: 8 + mod + hero.proficiencyBonus + bonus('spell-dc'),
  };
}

// ── Subclasses (cleric domains, and a second choice for most classes: D4, D29) ──

/** What each class calls its subclass. */
export const SUBCLASS_TITLE: Record<string, string> = {
  barbarian: 'Primal Path',
  bard: 'Bard College',
  cleric: 'Divine Domain',
  druid: 'Druid Circle',
  fighter: 'Martial Archetype',
  monk: 'Monastic Tradition',
  paladin: 'Sacred Oath',
  ranger: 'Ranger Archetype',
  rogue: 'Roguish Archetype',
  sorcerer: 'Sorcerous Origin',
  warlock: 'Otherworldly Patron',
  wizard: 'Arcane Tradition',
};

/** The hero's subclass id: their pick, or the class's only one. */
export const subclassOf = (hero: { classId: string; subclassId?: string }): string =>
  hero.subclassId ?? getClass(hero.classId).subclass.id;

/** The subclass option record, when the class offers a choice. */
export const subclassDef = (hero: { classId: string; subclassId?: string }) =>
  getClass(hero.classId).subclasses?.find((x) => x.id === subclassOf(hero));

/** The subclass's display name ("Light Domain"). */
export const subclassName = (hero: { classId: string; subclassId?: string }) =>
  subclassDef(hero)?.name ?? getClass(hero.classId).subclass.name;

/** Armor categories the hero is trained in (class plus subclass: a Life cleric adds heavy). */
export const armorProfsOf = (hero: { classId: string; subclassId?: string }): string[] => [
  ...getClass(hero.classId).armor,
  ...(subclassDef(hero)?.armor ?? []),
];

/** Weapon proficiencies (class plus subclass: a War cleric adds martial weapons). */
export const weaponProfsOf = (hero: { classId: string; subclassId?: string }): string[] => [
  ...getClass(hero.classId).weapons,
  ...(subclassDef(hero)?.weapons ?? []),
];

/** PHB: Domain Spells. Always prepared from these class levels on; they don't count against the limit. */
export function domainSpellsOf(hero: {
  classId: string;
  subclassId?: string;
  level: number;
}): string[] {
  const d = subclassDef(hero);
  if (!d) return [];
  return [
    ...d.cantrips,
    ...Object.entries(d.spells)
      .filter(([lvl]) => Number(lvl) <= hero.level)
      .flatMap(([, ids]) => ids),
  ];
}

/** Does the hero have this subclass feature (by subclass id and class level)? */
export const hasSubclass = (
  hero: { classId: string; subclassId?: string; level: number },
  classId: string,
  subclassId: string,
  level = 1,
) => hero.classId === classId && subclassOf(hero) === subclassId && hero.level >= level;
