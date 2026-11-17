// Healing outside a fight (playtest feedback): healing spells and Lay on Hands between battles.
import { spells } from '../data';
import { roll, type RandomSource } from '../rules';
import { resourceLeft, slotsLeft, spellNumbers, type Hero } from './hero';
import type { GameState } from './save';

/** Healing spells this hero knows, with the slot levels they could use now. */
export function healingSpells(h: Hero) {
  return h.spells.flatMap((id) => {
    const sp = spells.find((s) => s.id === id);
    if (!sp || !sp.effects.some((e) => e.type === 'heal')) return [];
    const levels = slotsLeft(h).flatMap((n, i) => (n > 0 && i + 1 >= sp.level ? [i + 1] : []));
    return [{ spell: sp, levels, group: (sp.targets ?? 1) > 1 }];
  });
}

/** A woken hero: back from 0 HP, no longer unconscious. */
const healHero = (h: Hero, amount: number): Hero => {
  if (h.dead || amount <= 0) return h;
  const hp = Math.min(h.maxHp, h.hp + amount);
  return {
    ...h,
    hp,
    stable: false,
    deathSaves: { successes: 0, failures: 0 },
    conditions: h.hp === 0 ? h.conditions.filter((c) => c.id !== 'unconscious') : h.conditions,
  };
};

/**
 * Cast a healing spell between fights (PHB rules as in combat): dice + spellcasting modifier,
 * upcast dice, Disciple of Life (+2 + slot level) and Blessed Healer (cleric 6).
 * Group spells (Prayer of Healing, Mass Healing Word) heal the whole party.
 */
export function castHealing(
  g: GameState,
  casterId: string,
  spellId: string,
  slotLevel: number,
  targetId: string,
  rng: RandomSource,
): { game: GameState; log: string[] } | { error: string } {
  const caster = g.party.find((h) => h.id === casterId);
  if (!caster || caster.dead || caster.hp === 0) return { error: 'They can’t cast right now.' };
  const choice = healingSpells(caster).find((x) => x.spell.id === spellId);
  if (!choice) return { error: `${caster.name} doesn't know that healing spell.` };
  if (!choice.levels.includes(slotLevel)) return { error: 'No spell slot of that level left.' };
  const sp = choice.spell;
  const heal = sp.effects.find((e) => e.type === 'heal')!;
  if (heal.type !== 'heal') return { error: 'Not a healing spell.' };
  const mod = spellNumbers(caster)?.mod ?? 0;
  const extra = slotLevel - sp.level;
  const life = caster.classId === 'cleric' ? 2 + slotLevel : 0;
  const targets = choice.group
    ? g.party.filter((h) => !h.dead)
    : g.party.filter((h) => h.id === targetId && !h.dead);
  if (!targets.length) return { error: 'Choose someone who is still alive.' };
  const log = [`${caster.name} casts ${sp.name}${extra ? ` at level ${slotLevel}` : ''}.`];
  let party = g.party.map((h) => {
    if (!targets.includes(h)) return h;
    const r = roll(heal.dice, rng);
    const up =
      extra && sp.upcast?.dicePerLevel
        ? roll(`${extra}${sp.upcast.dicePerLevel.slice(1)}`, rng).total
        : 0;
    const amount = Math.max(0, r.total + up + (heal.addModifier ? mod : 0) + life);
    log.push(
      `${h.name}: ${r.text}${up ? ` + ${up} upcast` : ''} + ${mod}${life ? ` + ${life} Disciple of Life` : ''} = ${amount} → ${Math.min(h.maxHp, h.hp + amount)}/${h.maxHp} HP`,
    );
    return healHero(h, amount);
  });
  party = party.map((h) => {
    if (h.id !== caster.id) return h;
    const used = [...h.slotsUsed];
    while (used.length < slotLevel) used.push(0);
    used[slotLevel - 1] = (used[slotLevel - 1] ?? 0) + 1;
    let out = { ...h, slotsUsed: used };
    // PHB: Blessed Healer (Life cleric 6): healing someone else heals you 2 + slot level.
    if (
      caster.classId === 'cleric' &&
      caster.level >= 6 &&
      targets.some((t) => t.id !== caster.id)
    ) {
      out = healHero(out, 2 + slotLevel);
      log.push(`Blessed Healer: ${caster.name} regains ${2 + slotLevel} HP.`);
    }
    return out;
  });
  return { game: { ...g, party }, log };
}

/** PHB: Lay on Hands. Spend points from the pool to heal (as much as the target needs). */
export function layOnHands(
  g: GameState,
  paladinId: string,
  targetId: string,
): { game: GameState; log: string[] } | { error: string } {
  const p = g.party.find((h) => h.id === paladinId);
  const t = g.party.find((h) => h.id === targetId);
  if (!p || !t || t.dead) return { error: 'Choose someone who is still alive.' };
  const pool = resourceLeft(p, 'lay-on-hands');
  const amount = Math.min(pool, t.maxHp - t.hp);
  if (amount <= 0)
    return {
      error: pool ? `${t.name} is already at full health.` : 'The pool is empty until a long rest.',
    };
  const party = g.party.map((h) => {
    let out = h;
    if (h.id === targetId) out = healHero(out, amount);
    if (h.id === paladinId)
      out = {
        ...out,
        resourcesUsed: {
          ...out.resourcesUsed,
          'lay-on-hands': (out.resourcesUsed['lay-on-hands'] ?? 0) + amount,
        },
      };
    return out;
  });
  return {
    game: { ...g, party },
    log: [
      `${p.name} lays on hands: ${t.name} regains ${amount} HP (${pool - amount} left in the pool).`,
    ],
  };
}
