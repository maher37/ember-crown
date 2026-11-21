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
  const armorIds = ids(d.armor);
  for (const c of d.classes) {
    const kit = c.startingKit;
    if (kit.armor && !armorIds.has(kit.armor))
      errors.push(`class ${c.id}: unknown kit armor "${kit.armor}"`);
    for (const w of kit.weapons)
      if (!weaponIds.has(w)) errors.push(`class ${c.id}: unknown kit weapon "${w}"`);
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

  // Encounters: real monsters, enemies and the party on walkable ground, inside the map.
  for (const e of d.encounters) {
    const walkable = (x: number, y: number) => {
      const ch = e.map.terrain[y]?.[x];
      return ch !== undefined && ch !== 'T' && ch !== 'r';
    };
    for (const en of e.enemies) {
      if (!monsterIds.has(en.monster))
        errors.push(`encounter ${e.id}: unknown monster "${en.monster}"`);
      if (!walkable(...en.pos)) errors.push(`encounter ${e.id}: ${en.id} starts on blocked ground`);
    }
    for (const p of e.partyStart)
      if (!walkable(...p)) errors.push(`encounter ${e.id}: a party start is on blocked ground`);
    const cells = [...e.partyStart, ...e.enemies.map((x) => x.pos)].map((c) => c.join(','));
    if (new Set(cells).size !== cells.length)
      warnings.push(`encounter ${e.id}: two creatures share a starting square`);
  }
  // Loadouts name real classes and spells the class can cast.
  for (const l of d.loadouts) {
    if (!classIds.has(l.classId)) errors.push(`loadout: unknown class "${l.classId}"`);
    for (const id of [...l.cantrips, ...l.spells]) {
      const sp = d.spells.find((s) => s.id === id);
      if (!sp) errors.push(`loadout ${l.classId}: unknown spell "${id}"`);
      else if (!sp.classes.includes(l.classId as never))
        errors.push(`loadout ${l.classId}: ${id} is not a ${l.classId} spell`);
    }
  }

  // Road tables name real encounters.
  const encIds = ids(d.encounters);
  for (const [region, table] of Object.entries(d.roadTables))
    for (const id of table)
      if (id && !encIds.has(id)) errors.push(`road table ${region}: unknown encounter "${id}"`);

  // Quests chain to real quests.
  const questIds = ids(d.quests);
  for (const q of d.quests)
    if (q.next && !questIds.has(q.next))
      errors.push(`quest ${q.id}: unknown next quest "${q.next}"`);
  // Quest steps point at real places on the world map.
  const placeIds = ids(d.places);
  for (const q of d.quests)
    for (const st of q.steps)
      if (st.place && !placeIds.has(st.place))
        errors.push(`quest ${q.id} step ${st.id}: unknown place "${st.place}"`);

  // Shops, bounties and finds point at real items, quests, places, fights and shops.
  const sellable = new Set([...itemIds, ...weaponIds, ...ids(d.armor), ...ids(d.gear)]);
  const shopIds = ids(d.shops);
  for (const sh of d.shops)
    for (const it of sh.items)
      if (!sellable.has(it.id)) errors.push(`shop ${sh.id}: unknown item "${it.id}"`);
  for (const b of d.bounties) {
    if (!questIds.has(b.quest)) errors.push(`bounty ${b.quest}: unknown quest`);
    if (!placeIds.has(b.place)) errors.push(`bounty ${b.quest}: unknown place "${b.place}"`);
    if (b.encounter && !encIds.has(b.encounter))
      errors.push(`bounty ${b.quest}: unknown encounter "${b.encounter}"`);
    if (b.encounter && !b.rewardGp) errors.push(`bounty ${b.quest}: a fight needs a reward`);
  }
  for (const f of d.finds) {
    if (!placeIds.has(f.place)) errors.push(`find ${f.id}: unknown place "${f.place}"`);
    for (const it of f.loot.items)
      if (!sellable.has(it.id)) errors.push(`find ${f.id}: unknown item "${it.id}"`);
    if (f.startsQuest && !questIds.has(f.startsQuest))
      errors.push(`find ${f.id}: unknown quest "${f.startsQuest}"`);
    if (f.completes) {
      const q = d.quests.find((x) => x.id === f.completes!.quest);
      if (!q?.steps.some((s) => s.id === f.completes!.step))
        errors.push(`find ${f.id}: unknown quest step ${f.completes.quest}/${f.completes.step}`);
    }
    if (f.shop && !shopIds.has(f.shop)) errors.push(`find ${f.id}: unknown shop "${f.shop}"`);
    if (f.kind === 'merchant' && !f.shop) errors.push(`find ${f.id}: a merchant needs a shop`);
  }
  if (new Set(d.finds.map((f) => f.id)).size !== d.finds.length) errors.push('finds: duplicate id');

  // Magic weapons point at real weapons.
  for (const i of d.magicItems) {
    const bw = i.baseWeapon;
    if (bw === undefined || bw === 'any') continue;
    for (const w of Array.isArray(bw) ? bw : [bw])
      if (!weaponIds.has(w)) errors.push(`item ${i.id}: unknown base weapon "${w}"`);
  }

  return { errors, warnings: warnings.filter((w) => !KNOWN_QUIRKS.has(w)) };
}
