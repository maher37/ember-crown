import { spells as allSpells } from '../data';
import type { Spell } from '../data/schemas/spell';
import {
  ABILITIES,
  ABILITY_NAMES,
  abilityModifier,
  canLevelUp,
  proficiencyBonus,
  roll,
  SKILLS,
  type Ability,
  type RandomSource,
  type Skill,
} from '../rules';
import { attackOptions } from './combat/attacks';
import type { Combatant } from './combat/types';
import {
  armorSlows,
  computeAc,
  getClass,
  getSpecies,
  maxSlots,
  skillBonus,
  spellNumbers,
  type Hero,
} from './hero';

export interface PickOption {
  id: string;
  name: string;
  summary: string;
}

export interface PickGroup {
  /** Where the pick is stored: fighting-style, invocations, pact-boon, metamagic, hunters-prey, expertise, bonus-skills. */
  id: string;
  name: string;
  count: number;
  options: PickOption[];
}

export interface SpellRules {
  style: 'known' | 'prepared' | 'spellbook';
  cantrips: number;
  spells: number;
  maxLevel: number;
  cantripPool: Spell[];
  spellPool: Spell[];
}

export interface LevelUpOptions {
  newLevel: number;
  hitDie: number;
  averageHp: number;
  asi: boolean;
  features: { id: string; name: string; summary: string; subclass?: boolean }[];
  picks: PickGroup[];
  spells: SpellRules | null;
  /** The next level's headline features, for the "coming next" card. */
  next: { level: number; names: string[] } | null;
}

export interface LevelUpPlan {
  hp: { method: 'average' } | { method: 'roll'; value: number };
  /** Ability Score Improvement points (2 in total, at most 20). */
  asi: Partial<Record<Ability, number>>;
  picks: Record<string, string[]>;
  cantrips: string[];
  spells: string[];
}

const SKILL_LABEL = (s: Skill) =>
  s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** What reaching the next level offers this hero. */
export function levelUpOptions(hero: Hero): LevelUpOptions {
  const cls = getClass(hero.classId);
  const newLevel = hero.level + 1;
  const gained = cls.levels[newLevel - 1]!.features;
  const picks: PickGroup[] = [];
  for (const f of gained) {
    if (f.id === 'fighting-style' && f.options)
      picks.push({ id: 'fighting-style', name: 'Fighting Style', count: 1, options: f.options });
    if (f.id === 'eldritch-invocations' && f.options)
      picks.push({
        id: 'invocations',
        name: 'Eldritch Invocations',
        count: 2,
        options: f.options.filter((o) => !hero.invocations.includes(o.id)),
      });
    if (f.id === 'eldritch-invocations-3') {
      const base = cls.levels[1]!.features.find((x) => x.id === 'eldritch-invocations')!.options!;
      picks.push({
        id: 'invocations',
        name: 'Eldritch Invocation',
        count: 1,
        options: base.filter((o) => !hero.invocations.includes(o.id)),
      });
    }
    if (f.id === 'pact-boon' && f.options)
      picks.push({ id: 'pact-boon', name: 'Pact Boon', count: 1, options: f.options });
    if (f.id === 'metamagic' && f.options)
      picks.push({ id: 'metamagic', name: 'Metamagic', count: f.choose ?? 2, options: f.options });
    if (f.id === 'hunters-prey' && f.options)
      picks.push({ id: 'hunters-prey', name: "Hunter's Prey", count: 1, options: f.options });
    if (f.id.startsWith('expertise')) {
      const owned = hero.skills.filter((s) => !hero.expertise.includes(s));
      picks.push({
        id: 'expertise',
        name: 'Expertise',
        count: f.choose ?? 2,
        options: owned.map((s) => ({ id: s, name: SKILL_LABEL(s), summary: 'double proficiency' })),
      });
    }
    for (const m of f.mechanics)
      if (m.type === 'skillChoice') {
        const free = (Object.keys(SKILLS) as Skill[]).filter((s) => !hero.skills.includes(s));
        picks.push({
          id: 'bonus-skills',
          name: f.name,
          count: m.count,
          options: free.map((s) => ({ id: s, name: SKILL_LABEL(s), summary: 'new proficiency' })),
        });
      }
  }
  const nextFeatures = cls.levels[newLevel]?.features;
  return {
    newLevel,
    hitDie: cls.hitDie,
    averageHp: cls.hitDie / 2 + 1,
    asi: gained.some((f) => f.id === 'ability-score-increase'),
    features: gained.map((f) => ({
      id: f.id,
      name: f.name,
      summary: f.summary,
      subclass: (f as { subclass?: boolean }).subclass,
    })),
    picks,
    spells: spellRules(hero, newLevel),
    next: nextFeatures ? { level: newLevel + 1, names: nextFeatures.map((f) => f.name) } : null,
  };
}

/**
 * How many cantrips and spells the hero may have at `level`. PHB class tables: known casters
 * use "spells known"; clerics, druids and paladins prepare ability modifier + level (paladins:
 * half level); wizards keep a spellbook of 6 + 2 per level after 1st. All of a wizard's book is
 * usable in v1 [inferred simplification].
 */
export function spellRules(
  hero: Hero,
  level: number,
  abilities = hero.abilities,
): SpellRules | null {
  const cls = getClass(hero.classId);
  const sc = cls.spellcasting;
  if (!sc) return null;
  const slots = maxSlots({ classId: hero.classId, level });
  const maxLevel = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
  const mod = abilityModifier(abilities[sc.ability]);
  const spells =
    sc.style === 'known'
      ? sc.spellsKnown![level - 1]!
      : sc.style === 'spellbook'
        ? 6 + 2 * (level - 1)
        : Math.max(1, mod + (hero.classId === 'paladin' ? Math.floor(level / 2) : level));
  const list = allSpells.filter((s) => s.classes.includes(cls.id as never));
  return {
    style: sc.style,
    cantrips: sc.cantripsKnown[level - 1]!,
    spells: maxLevel ? spells : 0,
    maxLevel,
    cantripPool: list.filter((s) => s.level === 0),
    spellPool: list.filter((s) => s.level >= 1 && s.level <= maxLevel),
  };
}

/**
 * A starting plan: average HP, current spells kept, and any new spell slots filled from the
 * class list in order, so the player only changes what they want.
 */
/** Suggested level-up picks [inferred: popular, simple choices]. */
const SUGGESTED: Record<string, string[]> = {
  metamagic: ['quickened', 'twinned'],
  'hunters-prey': ['colossus-slayer'],
  'pact-boon': ['pact-of-the-blade'],
};

export function defaultPlan(hero: Hero): LevelUpPlan {
  const o = levelUpOptions(hero);
  const fill = (current: string[], pool: Spell[], n: number) => {
    const keep = current.filter((id) => pool.some((s) => s.id === id)).slice(0, n);
    for (const s of pool) if (keep.length < n && !keep.includes(s.id)) keep.push(s.id);
    return keep;
  };
  const r = o.spells;
  // Suggested picks, so a level-up is never stuck waiting on a choice; all can be changed.
  const picks: Record<string, string[]> = {};
  for (const g of o.picks) {
    const ids = g.options.map((x) => x.id);
    const pref = (SUGGESTED[g.id] ?? []).filter((id) => ids.includes(id));
    for (const id of ids) if (pref.length < g.count && !pref.includes(id)) pref.push(id);
    picks[g.id] = pref.slice(0, g.count);
  }
  // Ability Score Improvement: suggest +2 to the hero's best score that can take it.
  const asi: LevelUpPlan['asi'] = {};
  if (o.asi) {
    const order = [...ABILITIES].sort((a, b) => hero.abilities[b] - hero.abilities[a]);
    const two = order.find((a) => hero.abilities[a] <= 18);
    if (two) asi[two] = 2;
    else {
      const ones = order.filter((a) => hero.abilities[a] <= 19).slice(0, 2);
      for (const a of ones) asi[a] = 1;
    }
  }
  return {
    hp: { method: 'average' },
    asi,
    picks,
    cantrips: r
      ? fill(
          hero.cantrips,
          r.cantripPool.filter((s) => !s.utility || hero.cantrips.includes(s.id)),
          r.cantrips,
        )
      : [],
    spells: r
      ? fill(
          hero.spells,
          r.spellPool.filter((s) => !s.utility || hero.spells.includes(s.id)),
          r.spells,
        )
      : [],
  };
}

export function newAbilities(hero: Hero, plan: Pick<LevelUpPlan, 'asi'>) {
  const out = { ...hero.abilities };
  for (const a of ABILITIES) out[a] = Math.min(20, out[a] + (plan.asi[a] ?? 0));
  return out;
}

/** What's still missing or wrong. Empty = ready to confirm. */
export function planProblems(hero: Hero, plan: LevelUpPlan): string[] {
  const o = levelUpOptions(hero);
  const p: string[] = [];
  const spent = Object.values(plan.asi).reduce((a, b) => a + (b ?? 0), 0);
  if (o.asi && spent !== 2)
    p.push(`Spend ${2 - spent} more ability point${2 - spent === 1 ? '' : 's'}.`);
  if (!o.asi && spent) p.push('No Ability Score Improvement at this level.');
  if (ABILITIES.some((a) => (plan.asi[a] ?? 0) > 2 || hero.abilities[a] + (plan.asi[a] ?? 0) > 20))
    p.push('Scores can rise by at most 2, and never above 20.');
  for (const g of o.picks) {
    const chosen = plan.picks[g.id] ?? [];
    if (chosen.length !== g.count || chosen.some((c) => !g.options.some((x) => x.id === c)))
      p.push(`Choose ${g.count} for ${g.name}.`);
  }
  const rules = spellRules(hero, o.newLevel, newAbilities(hero, plan));
  if (rules) {
    if (plan.cantrips.length !== rules.cantrips)
      p.push(`Choose ${rules.cantrips} cantrips (${plan.cantrips.length} chosen).`);
    if (plan.spells.length !== rules.spells)
      p.push(`Choose ${rules.spells} spells (${plan.spells.length} chosen).`);
    if (plan.cantrips.some((id) => !rules.cantripPool.some((s) => s.id === id)))
      p.push('A cantrip is not on your class list.');
    if (plan.spells.some((id) => !rules.spellPool.some((s) => s.id === id)))
      p.push(`A spell is not on your list, or above level ${rules.maxLevel}.`);
  }
  if (plan.hp.method === 'roll' && (plan.hp.value < 1 || plan.hp.value > o.hitDie))
    p.push('Invalid HP roll.');
  return p;
}

/** Roll the hit die for HP (seeded). */
export const rollHitDie = (hero: Hero, rng: RandomSource) =>
  roll(`1d${getClass(hero.classId).hitDie}`, rng).total;

/** Walking speed: species, minus heavy armor that's too heavy, plus Unarmored Movement (monk) and Fast Movement (barbarian, no heavy armor). */
export function heroSpeed(
  hero: Pick<Hero, 'speciesId' | 'classId' | 'level' | 'equipment' | 'abilities'>,
): number {
  let speed = getSpecies(hero.speciesId).speed;
  // PHB: Armor. Heavy armor too heavy for the wearer's Strength costs 10 ft.
  if (armorSlows(hero)) speed -= 10;
  if (hero.classId === 'monk' && !hero.equipment.armor && !hero.equipment.shield)
    speed += hero.level >= 6 ? 15 : hero.level >= 2 ? 10 : 0;
  if (
    hero.classId === 'barbarian' &&
    hero.level >= 5 &&
    !/plate|splint|chain-mail|ring/.test(hero.equipment.armor ?? '')
  )
    speed += 10;
  return speed;
}

/** HP gained: die (average or rolled) + Con, at least 1, plus per-level extras, plus retroactive Con. */
export function hpGain(hero: Hero, plan: LevelUpPlan): number {
  const cls = getClass(hero.classId);
  const sp = getSpecies(hero.speciesId);
  const before = abilityModifier(hero.abilities.con);
  const after = abilityModifier(newAbilities(hero, plan).con);
  const die = plan.hp.method === 'roll' ? plan.hp.value : cls.hitDie / 2 + 1;
  const extra = [
    ...sp.traits.flatMap((t) => t.mechanics),
    ...cls.levels[0]!.features.flatMap((f) => f.mechanics),
  ].reduce((n, m) => n + (m.type === 'hpPerLevel' ? m.amount : 0), 0);
  // PHB: an increase to Con raises HP maximum by 1 for every level you already have.
  return Math.max(1, die + after) + extra + (after - before) * hero.level;
}

/** Apply a finished level-up plan. */
export function applyLevelUp(hero: Hero, plan: LevelUpPlan): Hero {
  if (!canLevelUp(hero)) throw new Error(`${hero.name} doesn't have the XP to level up`);
  const problems = planProblems(hero, plan);
  if (problems.length) throw new Error(problems.join(' '));
  const level = hero.level + 1;
  const abilities = newAbilities(hero, plan);
  const gain = hpGain(hero, plan);
  const picks = plan.picks;
  const next: Hero = {
    ...hero,
    level,
    abilities,
    proficiencyBonus: proficiencyBonus(level),
    maxHp: hero.maxHp + gain,
    hp: hero.hp + gain,
    hitDice: {
      ...hero.hitDice,
      total: hero.hitDice.total + 1,
      remaining: hero.hitDice.remaining + 1,
    },
    fightingStyle: picks['fighting-style']?.[0] ?? hero.fightingStyle,
    invocations: [...hero.invocations, ...(picks['invocations'] ?? [])],
    expertise: [...hero.expertise, ...((picks['expertise'] ?? []) as Skill[])],
    skills: [...hero.skills, ...((picks['bonus-skills'] ?? []) as Skill[])],
    choices: {
      ...hero.choices,
      ...Object.fromEntries(
        Object.entries(picks).filter(([k]) =>
          ['pact-boon', 'metamagic', 'hunters-prey'].includes(k),
        ),
      ),
    },
    cantrips: spellRules(hero, level) ? [...plan.cantrips] : hero.cantrips,
    spells: spellRules(hero, level) ? [...plan.spells] : hero.spells,
  };
  next.ac = computeAc(next.classId, abilities, next.equipment, next.fightingStyle);
  next.speed = heroSpeed(next);
  return next;
}

export interface PreviewRow {
  label: string;
  before: string;
  after: string;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** "If you raise Strength": every number on the sheet that changes (docs/mockups/LevelUp.dc.html). */
export function abilityPreview(hero: Hero, ability: Ability, newScore: number): PreviewRow[] {
  const after: Hero = { ...hero, abilities: { ...hero.abilities, [ability]: newScore } };
  const rows: PreviewRow[] = [];
  const add = (label: string, b: string | number, a: string | number) =>
    rows.push({ label, before: String(b), after: String(a) });
  const asCombatant = (h: Hero) => ({ creature: h }) as unknown as Combatant;
  const atkB = attackOptions(asCombatant(hero)).filter((o) => !o.unarmed);
  const atkA = attackOptions(asCombatant(after)).filter((o) => !o.unarmed);
  atkB.forEach((o, i) => {
    const a = atkA[i]!;
    if (
      o.ability === ability ||
      (o.ability === 'dex' && ability === 'str') ||
      (o.ability === 'str' && ability === 'dex')
    ) {
      if (o.toHit !== a.toHit || o.damage[0]!.dice !== a.damage[0]!.dice) {
        add(`${o.name} attack`, signed(o.toHit), signed(a.toHit));
        add(`${o.name} damage`, o.damage[0]!.dice, a.damage[0]!.dice);
      }
    }
  });
  const sn = spellNumbers(hero);
  if (sn && sn.ability === ability) {
    const sa = spellNumbers(after)!;
    add('Spell save DC', sn.dc, sa.dc);
    add('Spell attack', signed(sn.attack), signed(sa.attack));
  }
  if (ability === 'dex') {
    add(
      'Armor Class',
      hero.ac,
      computeAc(hero.classId, after.abilities, hero.equipment, hero.fightingStyle),
    );
    add(
      'Initiative',
      signed(abilityModifier(hero.abilities.dex)),
      signed(abilityModifier(newScore)),
    );
  }
  if (ability === 'con') {
    const d = abilityModifier(newScore) - abilityModifier(hero.abilities.con);
    add('Max HP (retroactive)', hero.maxHp, hero.maxHp + d * hero.level);
    add(
      'HP each future level',
      `${getClass(hero.classId).hitDie / 2 + 1}${signed(abilityModifier(hero.abilities.con))}`,
      `${getClass(hero.classId).hitDie / 2 + 1}${signed(abilityModifier(newScore))}`,
    );
  }
  if ((ability === 'wis' || ability === 'con') && hero.classId === 'monk')
    add(
      'Armor Class',
      hero.ac,
      computeAc(hero.classId, after.abilities, hero.equipment, hero.fightingStyle),
    );
  if (ability === 'con' && hero.classId === 'barbarian')
    add(
      'Armor Class',
      hero.ac,
      computeAc(hero.classId, after.abilities, hero.equipment, hero.fightingStyle),
    );
  const prof = hero.saveProficiencies.includes(ability);
  add(
    `${ABILITY_NAMES[ability]} saves${prof ? ' (proficient)' : ''}`,
    signed(abilityModifier(hero.abilities[ability]) + (prof ? hero.proficiencyBonus : 0)),
    signed(abilityModifier(newScore) + (prof ? hero.proficiencyBonus : 0)),
  );
  const skills = (Object.keys(SKILLS) as Skill[])
    .filter((s) => SKILLS[s] === ability)
    .sort((a, b) => Number(hero.skills.includes(b)) - Number(hero.skills.includes(a)));
  for (const s of skills.slice(0, 3))
    add(
      `${SKILL_LABEL(s)}${hero.skills.includes(s) ? ' (proficient)' : ''}`,
      signed(skillBonus(hero, s)),
      signed(skillBonus(after, s)),
    );
  if (ability === 'wis') {
    const pp = (h: Hero) => 10 + skillBonus(h, 'perception');
    add('Passive Perception (spots ambushes)', pp(hero), pp(after));
  }
  if (ability === 'str')
    add('Carrying capacity', `${15 * hero.abilities.str} lb`, `${15 * newScore} lb`);
  return rows;
}

export { ABILITY_NAMES };
