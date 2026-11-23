// D34: casting between fights. On the Prepare screen, casters can cast chosen buffs (and Hex or
// Hunter's Mark on a foe they can see) just before a fight; the spells carry into it.
import { spells } from '../data';
import type { Spell } from '../data/schemas/spell';
import { combatReady } from './combat/spells';
import { domainSpellsOf, slotsLeft, type Hero } from './hero';

/** One spell cast just before a fight. */
export interface Precast {
  casterId: string;
  spellId: string;
  slotLevel: number;
  /** Allies (or, for Hex and Hunter's Mark, one foe). Empty for self spells. */
  targetIds: string[];
}

/** Spells aimed at a foe: they need the enemy in sight before the fight (D34). */
export const FOE_SPELLS = new Set(['hex', 'hunters-mark']);

export type PrecastTarget = { kind: 'self' } | { kind: 'allies'; count: number } | { kind: 'foe' };

/** Who a spell cast before the fight can be aimed at, at this slot level. */
export function precastTarget(sp: Spell, slotLevel: number): PrecastTarget {
  if (FOE_SPELLS.has(sp.id)) return { kind: 'foe' };
  // Beacon of Hope reaches every ally within 30 ft of the caster: no one to pick.
  if (sp.range === 'self' || sp.id === 'beacon-of-hope') return { kind: 'self' };
  const extra = Math.max(0, slotLevel - sp.level);
  return { kind: 'allies', count: (sp.targets ?? 1) + (sp.upcast?.targetsPerLevel ?? 0) * extra };
}

/** Can this hero cast anything at all right now (awake and alive)? */
const canCast = (h: Hero) => !h.dead && h.hp > 0;

/**
 * The before-fight spells a hero knows, with the slot levels they have left for each.
 * `foesInSight` is false when the enemy hides until the fight (an ambush on the road, or a scout
 * who was spotted) [inferred: then there's no one to Hex].
 */
export function precastSpells(h: Hero, foesInSight: boolean): { spell: Spell; levels: number[] }[] {
  if (!canCast(h)) return [];
  const left = slotsLeft(h);
  const known = new Set([...h.spells, ...domainSpellsOf(h)]);
  return spells
    .filter((sp) => sp.beforeFight && known.has(sp.id) && combatReady(sp))
    .filter((sp) => foesInSight || !FOE_SPELLS.has(sp.id))
    .map((sp) => ({
      spell: sp,
      levels: left.flatMap((n, i) => (n > 0 && i + 1 >= sp.level ? [i + 1] : [])),
    }))
    .filter((x) => x.levels.length > 0);
}

/** Allies a before-fight spell can go on: Mage Armor only on someone without armor (PHB). */
export function allyCanTake(sp: Spell, h: Hero): boolean {
  if (h.dead) return false;
  if (sp.id === 'mage-armor') return !h.equipment.armor;
  return true;
}

/**
 * Problems with a list of before-fight casts, or an empty list if it's fine: enough slots for
 * every cast, and only one concentration spell per caster (PHB: Concentration).
 */
export function precastProblems(party: Hero[], list: Precast[]): string[] {
  const out: string[] = [];
  for (const h of party) {
    const mine = list.filter((p) => p.casterId === h.id);
    if (!mine.length) continue;
    const left = slotsLeft(h);
    const used: number[] = [];
    for (const p of mine) used[p.slotLevel - 1] = (used[p.slotLevel - 1] ?? 0) + 1;
    used.forEach((n, i) => {
      if (n > (left[i] ?? 0)) out.push(`${h.name} doesn't have ${n} level-${i + 1} slots left`);
    });
    const conc = mine.filter((p) => spells.find((s) => s.id === p.spellId)?.concentration);
    if (conc.length > 1)
      out.push(
        `${h.name} can concentrate on only one spell (${conc.map((p) => name(p)).join(', ')})`,
      );
  }
  return out;
}

const name = (p: Precast) => spells.find((s) => s.id === p.spellId)?.name ?? p.spellId;

/** The hero as they'll be after the chosen casts (their slots spent), for the Prepare screen. */
export function afterCasts(h: Hero, list: Precast[]): Hero {
  const used = [...h.slotsUsed];
  for (const p of list)
    if (p.casterId === h.id) used[p.slotLevel - 1] = (used[p.slotLevel - 1] ?? 0) + 1;
  return { ...h, slotsUsed: used };
}
