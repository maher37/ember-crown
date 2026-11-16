import { abilityModifier, parseDice } from '../rules';
import type { GameData } from './index';
import { crProficiency } from './schemas/monster';
import type { Effect } from './schemas/common';

/**
 * Stat-block numbers that break the usual formula in the source books as remembered (the
 * books really do say this). They stay in the data but don't raise warnings. Still verify them.
 */
export const KNOWN_QUIRKS = new Set([
  "monster veteran: heavy-crossbow damage bonus 1 doesn't match its Str or Dex modifier",
  'monster ghoul: bite to-hit +2, expected +3 (Str) or +4 (Dex) at proficiency +2',
  'monster ghast: bite to-hit +3, expected +5 (Str) or +5 (Dex) at proficiency +2',
]);

/**
 * Checks that span files: ids that point at other records, and numbers that should agree
 * with each other. `errors` must be empty; `warnings` are listed for the owner to look at.
 */
export function crossCheck(d: GameData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const spellIds = ids(d.spells);
  const monsterIds = ids(d.monsters);
  const weaponIds = ids(d.weapons);
  const itemIds = ids(d.magicItems);
  const classIds = ids(d.classes);

  // Unique ids in every list.
  for (const [name, list] of Object.entries({
    species: d.species,
    backgrounds: d.backgrounds,
    classes: d.classes,
    spells: d.spells,
    monsters: d.monsters,
    foes: d.foes,
    weapons: d.weapons,
    armor: d.armor,
    magicItems: d.magicItems,
  })) {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) errors.push(`${name}: duplicate id "${x.id}"`);
      seen.add(x.id);
    }
  }

  // Species traits that grant spells or weapons.
  for (const s of d.species)
    for (const t of s.traits)
      for (const m of t.mechanics) {
        if (m.type === 'spell' && !spellIds.has(m.spell))
          errors.push(`species ${s.id}: unknown spell "${m.spell}"`);
        if (m.type === 'weapons')
          for (const w of m.weapons)
            if (!weaponIds.has(w)) errors.push(`species ${s.id}: unknown weapon "${w}"`);
      }

  // Spells name real classes; every class with spellcasting has spells at levels it can cast.
  for (const sp of d.spells)
    for (const c of sp.classes)
      if (!classIds.has(c)) errors.push(`spell ${sp.id}: unknown class "${c}"`);
  for (const c of d.classes) {
    if (!c.spellcasting) continue;
    const list = d.spells.filter((s) => s.classes.includes(c.id as never));
    if (c.spellcasting.cantripsKnown.some((n) => n > 0) && !list.some((s) => s.level === 0))
      errors.push(`class ${c.id}: knows cantrips but has none on its list`);
    if (!list.some((s) => s.level === 1))
      errors.push(`class ${c.id}: no 1st-level spells on its list`);
  }
  for (const c of d.classes) {
    const res = ids(c.resources);
    for (const l of c.levels)
      for (const f of l.features)
        if (f.uses && !res.has(f.uses))
          errors.push(`class ${c.id}: feature ${f.id} uses unknown resource "${f.uses}"`);
  }

  // Monsters: spell ids, consistency of HP and attack numbers.
  for (const m of d.monsters) {
    for (const list of Object.values(m.spellcasting?.spells ?? {}))
      for (const s of list)
        if (!spellIds.has(s)) errors.push(`monster ${m.id}: unknown spell "${s}"`);
    if (m.hitDice) {
      const e = parseDice(m.hitDice);
      const avg = Math.floor((e.count * (e.sides + 1)) / 2) + e.bonus;
      if (avg !== m.hp)
        warnings.push(`monster ${m.id}: HP ${m.hp} but hit dice ${m.hitDice} average ${avg}`);
      const conBonus = e.count * abilityModifier(m.abilities.con);
      if (conBonus !== e.bonus)
        warnings.push(
          `monster ${m.id}: hit dice bonus ${e.bonus} but ${e.count} × Con modifier = ${conBonus}`,
        );
    }
    const prof = crProficiency(m.cr);
    const best = Math.max(abilityModifier(m.abilities.str), abilityModifier(m.abilities.dex));
    for (const a of m.actions)
      for (const e of a.effects as Effect[]) {
        if (e.type !== 'attack' || e.toHit === undefined) continue;
        const str = abilityModifier(m.abilities.str) + prof;
        const dex = abilityModifier(m.abilities.dex) + prof;
        if (e.toHit !== str && e.toHit !== dex)
          warnings.push(
            `monster ${m.id}: ${a.id} to-hit +${e.toHit}, expected +${str} (Str) or +${dex} (Dex) at proficiency +${prof}`,
          );
        const first = e.onHit[0];
        if (first?.type === 'damage') {
          const bonus = parseDice(first.dice).bonus;
          if (bonus !== 0 && bonus !== best && bonus !== abilityModifier(m.abilities.str))
            warnings.push(
              `monster ${m.id}: ${a.id} damage bonus ${bonus} doesn't match its Str or Dex modifier`,
            );
        }
      }
  }

  // Named foes and their rewards.
  for (const f of d.foes) {
    if (!monsterIds.has(f.base)) errors.push(`foe ${f.id}: unknown base monster "${f.base}"`);
    for (const c of f.companions)
      if (!monsterIds.has(c.monster)) errors.push(`foe ${f.id}: unknown companion "${c.monster}"`);
    for (const r of f.reward)
      if (!itemIds.has(r)) errors.push(`foe ${f.id}: unknown reward item "${r}"`);
  }

  // Magic weapons point at real weapons.
  for (const i of d.magicItems) {
    const bw = i.baseWeapon;
    if (bw === undefined || bw === 'any') continue;
    for (const w of Array.isArray(bw) ? bw : [bw])
      if (!weaponIds.has(w)) errors.push(`item ${i.id}: unknown base weapon "${w}"`);
  }

  return { errors, warnings: warnings.filter((w) => !KNOWN_QUIRKS.has(w)) };
}
