// PHB: Preparing spells. Clerics, druids and paladins choose their prepared spells from their whole
// class list when they finish a long rest. Bards, rangers, sorcerers and warlocks know a fixed list
// that changes when they gain a level. (Owner's choice: official rules, Nov 20.)
import { spells as allSpells } from '../data';
import { getClass, type Hero } from './hero';
import { spellRules } from './levelup';

export type SpellChange = 'after-long-rest' | 'at-level-up' | 'spellbook';

/** How this hero changes their spells, or null for a non-caster. */
export function spellChange(hero: Pick<Hero, 'classId'>): SpellChange | null {
  const sc = getClass(hero.classId).spellcasting;
  if (!sc) return null;
  // Wizards: the whole spellbook is ready in this game (Rules_Scope, M5 simplification), and
  // new spells go into it at level-up.
  return sc.style === 'prepared'
    ? 'after-long-rest'
    : sc.style === 'spellbook'
      ? 'spellbook'
      : 'at-level-up';
}

const levelOf = (id: string) => allSpells.find((s) => s.id === id)?.level ?? 0;

/** Why this list can't be prepared now, or null if it can. */
export function prepareProblem(hero: Hero, spellIds: string[]): string | null {
  if (spellChange(hero) !== 'after-long-rest')
    return `${hero.name} doesn't prepare spells each day (they change at level-up).`;
  if (!hero.canPrepare)
    return `${hero.name} can change prepared spells after a long rest (until the next fight).`;
  const rules = spellRules(hero, hero.level)!;
  const pool = new Set(rules.spellPool.map((s) => s.id));
  const bad = spellIds.find((id) => !pool.has(id));
  if (bad) return `${hero.name} can't prepare that spell.`;
  if (new Set(spellIds).size !== spellIds.length) return 'A spell is listed twice.';
  if (spellIds.length > rules.spells)
    return `${hero.name} can prepare ${rules.spells} spells (ability modifier + level).`;
  return null;
}

/** Swap the hero's leveled spells for `spellIds`; cantrips stay as they are. */
export function prepareSpells(hero: Hero, spellIds: string[]): Hero {
  return { ...hero, spells: [...hero.spells.filter((id) => levelOf(id) === 0), ...spellIds] };
}
