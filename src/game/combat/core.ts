import { getMonster } from '../creatures';
import { getClass, type Hero } from '../hero';
import {
  abilityModifier,
  adjustForDefenses,
  applyDamage,
  grantTempHp,
  heal as rulesHeal,
  isIncapacitated,
  roll,
  savingThrow,
  SeededRng,
  type Ability,
  type ConditionId,
  type Creature,
  type DamageInstance,
  type DiceRoll,
  type LogEntry,
  type RandomSource,
  type TestResult,
} from '../../rules';
import { conscious } from './grid';
import type { ActiveEffect, CombatState, Combatant, LogLine } from './types';

/**
 * Engine functions take a state and return a new one. Inside, they work on a deep copy (`s`)
 * and the seeded dice (`rng`), which are written back at the end.
 */
export interface Ctx {
  s: CombatState;
  rng: RandomSource;
}

export function produce(state: CombatState, fn: (ctx: Ctx) => void): CombatState {
  const s = structuredClone(state);
  const rng = SeededRng.fromState(s.rngState);
  fn({ s, rng });
  s.rngState = rng.state;
  return s;
}

export const isHero = (c: Creature): c is Hero => c.kind === 'pc' && 'classId' in c;
export const heroOf = (c: Combatant): Hero | null => (isHero(c.creature) ? c.creature : null);
export const classLevel = (c: Combatant, classId: string) => {
  const h = heroOf(c);
  return h && h.classId === classId ? h.level : 0;
};

export function say(s: CombatState, kind: LogLine['kind'], text: string): void {
  s.log.push({ kind, text });
}

/** Turn rules-engine log entries into combat log lines, colored by who acted. */
export function sayAll(s: CombatState, entries: LogEntry[], actor?: Combatant): void {
  for (const e of entries) {
    const kind: LogLine['kind'] =
      e.kind === 'death'
        ? 'head'
        : e.kind === 'damage' || e.kind === 'heal' || e.kind === 'condition'
          ? 'dmg'
          : actor?.side === 'enemy'
            ? 'foe'
            : 'you';
    say(s, /CRITICAL/.test(e.text) ? 'crit' : kind, e.text);
  }
}

export const get = (s: CombatState, id: string): Combatant => {
  const c = s.combatants[id];
  if (!c) throw new Error(`No combatant "${id}"`);
  return c;
};

export const active = (s: CombatState): Combatant => get(s, s.order[s.turnIndex]!);
export const hostiles = (s: CombatState, c: Combatant) =>
  Object.values(s.combatants).filter((o) => o.side !== c.side && conscious(o));
export const allies = (s: CombatState, c: Combatant) =>
  Object.values(s.combatants).filter((o) => o.side === c.side && o.id !== c.id && conscious(o));

export const canAct = (c: Combatant) => conscious(c) && !isIncapacitated(c.creature);

export function effectsWith(c: Combatant, tag: string): ActiveEffect[] {
  return c.effects.filter((e) => e.tag === tag);
}
export const hasEffect = (c: Combatant, tag: string) => c.effects.some((e) => e.tag === tag);

/** Roll the dice part of an effect modifier ("1d4", "-1d4" or a number). */
export function rollMod(value: string | number, rng: RandomSource): DiceRoll {
  if (typeof value === 'number') return roll(String(value), rng);
  const neg = value.startsWith('-');
  const r = roll(neg ? value.slice(1) : value, rng);
  return neg ? { ...r, total: -r.total, text: `−(${r.text})` } : r;
}

/** Dice bonuses from effects such as Bless and Bane for attacks or saves. */
export function diceBonuses(
  c: Combatant,
  kind: 'attack' | 'save',
  rng: RandomSource,
): { label: string; roll: DiceRoll }[] {
  return c.effects.flatMap((e) =>
    e.mod?.[kind] !== undefined ? [{ label: e.name, roll: rollMod(e.mod[kind]!, rng) }] : [],
  );
}

/** Armor Class right now: base AC, Mage Armor, and effects such as Shield or Shield of Faith. */
export function currentAc(c: Combatant): number {
  let ac = c.creature.ac;
  const h = heroOf(c);
  if (hasEffect(c, 'mage-armor') && h && !h.equipment.armor) {
    ac = Math.max(ac, 13 + abilityModifier(h.abilities.dex) + (h.equipment.shield ? 2 : 0));
  }
  if (c.wildShape) ac = getMonster(c.wildShape.monsterId).ac;
  return ac + c.effects.reduce((n, e) => n + (e.mod?.ac ?? 0), 0);
}

/** The creature as the rules see it for damage: Wild Shape stats, Rage resistance. */
function damageView(c: Combatant): Creature {
  const extra = hasEffect(c, 'rage') ? (['bludgeoning', 'piercing', 'slashing'] as const) : [];
  const d = c.creature.defenses;
  return {
    ...c.creature,
    defenses: { ...d, resistances: [...new Set([...d.resistances, ...extra])] },
  };
}

/** Apply damage with every consequence. Returns the damage actually taken. */
export function dealDamage(
  ctx: Ctx,
  target: Combatant,
  instances: DamageInstance[],
  opts: { critical?: boolean; melee?: boolean; attacker?: Combatant } = {},
): number {
  const { s, rng } = ctx;
  if (target.creature.dead || target.gone) return 0;
  let parts = instances;

  // PHB: Wild Shape. Damage comes off the beast's HP first; any left over carries to the druid.
  if (target.wildShape) {
    const beast = getMonster(target.wildShape.monsterId);
    const beastDefenses = {
      resistances: beast.resistances,
      vulnerabilities: beast.vulnerabilities,
      immunities: beast.immunities,
    };
    let taken = 0;
    for (const i of instances) taken += adjustForDefenses(i.amount, i.type, beastDefenses).amount;
    const left = target.wildShape.hp - taken;
    if (left > 0) {
      target.wildShape.hp = left;
      say(
        s,
        'dmg',
        `${target.name} (wolf form) takes ${taken} damage (${left}/${target.wildShape.maxHp} beast HP)`,
      );
      return taken;
    }
    say(s, 'dmg', `${target.name}'s beast form drops; ${-left} damage carries over`);
    target.wildShape = undefined;
    if (left === 0) return taken;
    parts = [{ amount: -left, type: instances[0]!.type }];
  }

  const before = target.creature;
  const out = applyDamage(damageView(target), parts, rng, {
    critical: opts.critical,
    melee: opts.melee,
  });
  // Keep the real defenses (Rage resistance is not permanent).
  target.creature = { ...out.creature, defenses: before.defenses };
  sayAll(s, out.log, opts.attacker);
  if (before.concentration && !target.creature.concentration)
    endConcentrationEffects(s, target.id, before.concentration);

  // Warlock: Dark One's Blessing. Dropping a hostile creature to 0 HP grants temporary HP.
  const killer = opts.attacker;
  if (killer && before.hp > 0 && target.creature.hp === 0 && target.side !== killer.side) {
    const lvl = classLevel(killer, 'warlock');
    if (lvl) {
      const amount = Math.max(1, abilityModifier(killer.creature.abilities.cha) + lvl);
      killer.creature = grantTempHp(killer.creature, amount);
      say(s, 'you', `Dark One's Blessing: ${killer.name} gains ${amount} temporary HP`);
    }
  }
  if (target.creature.hp === 0) {
    target.effects = target.effects.filter((e) => e.tag !== 'rage' && e.tag !== 'hidden');
  }
  // PHB: Sleep. A sleeping creature wakes when it takes damage. Turn Undead also ends.
  if (out.damageTaken > 0) {
    for (const e of target.effects.filter((x) => x.data?.wakeOnDamage || x.tag === 'turned')) {
      removeEffect(target, e);
      if (e.data?.wakeOnDamage && target.creature.hp > 0) say(s, 'dmg', `${target.name} wakes up`);
    }
  }
  return out.damageTaken;
}

/** Remove every effect that depended on `casterId` concentrating on `spellId`. */
export function endConcentrationEffects(s: CombatState, casterId: string, spellId: string): void {
  for (const c of Object.values(s.combatants)) {
    const ending = c.effects.filter((e) => e.sourceId === casterId && e.concentration === spellId);
    for (const e of ending) removeEffect(c, e);
  }
}

/** Remove an effect, and the condition it was holding in place. */
export function removeEffect(c: Combatant, e: ActiveEffect): void {
  c.effects = c.effects.filter((x) => x !== e);
  if (e.tag === 'condition' && e.data?.condition) {
    const id = String(e.data.condition) as ConditionId;
    const stillHeld = c.effects.some((x) => x.tag === 'condition' && x.data?.condition === id);
    if (!stillHeld)
      c.creature = { ...c.creature, conditions: c.creature.conditions.filter((x) => x.id !== id) };
  }
}

export function healCombatant(
  ctx: Ctx,
  target: Combatant,
  amount: number,
  source: string,
  healer?: Combatant,
): number {
  if (hasEffect(target, 'no-healing')) {
    say(ctx.s, 'info', `${target.name} can't regain hit points right now (${source})`);
    return 0;
  }
  const out = rulesHeal(target.creature, amount, source);
  target.creature = out.creature;
  sayAll(ctx.s, out.log, healer);
  return out.healed;
}

/**
 * A saving throw in combat: Bless/Bane dice, Dodge and Danger Sense (Dex), species and monster
 * advantages, and cover for Dex saves.
 */
export function combatSave(
  ctx: Ctx,
  target: Combatant,
  ability: Ability,
  dc: number,
  opts: { against?: ConditionId; magic?: boolean; cover?: 'none' | 'half'; label?: string } = {},
): TestResult {
  const adv: string[] = [];
  const dis: string[] = [];
  const h = heroOf(target);
  if (ability === 'dex' && hasEffect(target, 'dodge')) adv.push('Dodge');
  // PHB: Barbarian, Danger Sense (Dex saves against effects it can see).
  if (
    ability === 'dex' &&
    classLevel(target, 'barbarian') >= 2 &&
    !target.creature.conditions.some((c) => c.id === 'blinded')
  )
    adv.push('Danger Sense');
  if (ability === 'str' && hasEffect(target, 'rage')) adv.push('Rage');
  if (h) {
    const species = h.speciesId;
    if (opts.against === 'charmed' && (species === 'high-elf' || species === 'half-elf'))
      adv.push('Fey Ancestry');
    if (opts.against === 'frightened' && species === 'lightfoot-halfling') adv.push('Brave');
    if (opts.magic && species === 'rock-gnome' && ['int', 'wis', 'cha'].includes(ability))
      adv.push('Gnome Cunning');
  } else if (target.monsterId && (opts.against === 'charmed' || opts.against === 'frightened')) {
    if (getMonster(target.monsterId).traits.some((t) => t.id === 'dark-devotion'))
      adv.push('Dark Devotion');
  }
  const bonuses = opts.cover === 'half' && ability === 'dex' ? [{ label: 'cover', value: 2 }] : [];
  const r = savingThrow(target.creature, ability, dc, ctx.rng, {
    advantage: adv,
    disadvantage: dis,
    bonuses,
    diceBonuses: diceBonuses(target, 'save', ctx.rng),
    label: opts.label,
  });
  let result = r;
  // Bardic Inspiration: spent automatically when it turns a failed save into a success [inferred].
  if (!r.success && !r.autoFail && target.inspiration && r.total + target.inspiration >= dc) {
    const die = roll(`1d${target.inspiration}`, ctx.rng);
    if (r.total + die.total >= dc) {
      result = { ...r, total: r.total + die.total, success: true };
      say(ctx.s, 'you', `${target.name} uses Bardic Inspiration: ${die.text} → save succeeds`);
      target.inspiration = undefined;
    }
  }
  sayAll(ctx.s, [r.log], target);
  return result;
}

/** Hero class resource helpers (uses spent are stored on the hero, max comes from class data). */
export function spendResource(c: Combatant, id: string, n = 1): void {
  const h = heroOf(c);
  if (!h) return;
  c.creature = {
    ...h,
    resourcesUsed: { ...h.resourcesUsed, [id]: (h.resourcesUsed[id] ?? 0) + n },
  };
}

export function spendSlot(c: Combatant, level: number): void {
  const h = heroOf(c);
  if (!h) return;
  const used = [...h.slotsUsed];
  while (used.length < level) used.push(0);
  used[level - 1] = (used[level - 1] ?? 0) + 1;
  c.creature = { ...h, slotsUsed: used };
}

export const hasFeature = (c: Combatant, featureId: string): boolean => {
  const h = heroOf(c);
  if (!h) return false;
  return getClass(h.classId)
    .levels.slice(0, h.level)
    .some((l) => l.features.some((f) => f.id === featureId));
};

export function addEffect(c: Combatant, e: ActiveEffect): void {
  c.effects.push(e);
}

export { canAct as able, conscious };
