import { getMonster } from '../creatures';
import { getClass, hasSubclass, resourceLeft, type Hero } from '../hero';
import { itemMods } from '../items';
import {
  abilityModifier,
  adjustForDefenses,
  DAMAGE_TYPES,
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
  type DamageType,
  type DiceRoll,
  type LogEntry,
  type RandomSource,
  type TestResult,
} from '../../rules';
import { conscious, distanceFeet } from './grid';
import { hasBeacon } from './wards';
import { fx } from './fx';
import { relentless } from './beastMoves';
import type { ActiveEffect, CombatState, Combatant, LogLine } from './types';

/**
 * Engine functions take a state and return a new one. Inside, they work on a deep copy (`s`)
 * and the seeded dice (`rng`), which are written back at the end.
 */
export interface Ctx {
  s: CombatState;
  rng: RandomSource;
  /** Damage dealt by the last damage effect (Vampiric Touch, Life Drain). */
  lastDamage?: number;
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
/** Is this combatant a hero of this subclass, at this class level or more? (D4, D29) */
export const isSub = (c: Combatant, classId: string, subclassId: string, level = 1) => {
  const h = heroOf(c);
  return !!h && hasSubclass(h, classId, subclassId, level);
};
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
  const extra: DamageType[] = hasEffect(c, 'rage') ? ['bludgeoning', 'piercing', 'slashing'] : [];
  // PHB: Totem Warrior (Bear). While raging, resistance to all damage except psychic.
  if (hasEffect(c, 'rage') && isSub(c, 'barbarian', 'totem-bear', 3))
    extra.push(...DAMAGE_TYPES.filter((t) => t !== 'psychic'));
  // Potion of Resistance and similar: resistance to one damage type while the effect lasts.
  for (const e of effectsWith(c, 'resistance')) extra.push(String(e.data?.type) as DamageType);
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
      fxDamage(s, target, instances, taken, !!opts.critical);
      say(
        s,
        'dmg',
        `${target.name} (wolf form) takes ${taken} damage (${left}/${target.wildShape.maxHp} beast HP)`,
      );
      return taken;
    }
    say(s, 'dmg', `${target.name}'s beast form drops; ${-left} damage carries over`);
    fxDamage(s, target, instances, target.wildShape.hp, !!opts.critical);
    target.wildShape = undefined;
    if (left === 0) return taken;
    parts = [{ amount: -left, type: instances[0]!.type }];
  }

  const before = target.creature;
  // A brawl (PHB: Knocking a Creature Out): everyone pulls their punches [inferred: ranged and spells too].
  const knockOut = s.nonlethal;
  // House rule (Rules_Scope §7, M7): in a brawl, a blow never does more than the HP left, so
  // massive damage can't kill anyone.
  if (knockOut && target.creature.hp > 0) {
    let room = target.creature.hp + target.creature.tempHp;
    parts = parts.map((p) => {
      const amount = Math.min(p.amount, Math.max(0, room));
      room -= amount;
      return { ...p, amount };
    });
  }
  // PHB: Abjuration, Arcane Ward (and Projected Ward at 6th level, for an ally within 30 ft):
  // the ward takes the damage first. It works like extra temporary HP in front of the real ones.
  const warder = wardFor(s, target);
  const wardHp = warder ? ((warder.creature as Hero).arcaneWard ?? 0) : 0;
  const view = damageView(target);
  const out = applyDamage(wardHp ? { ...view, tempHp: view.tempHp + wardHp } : view, parts, rng, {
    critical: opts.critical,
    melee: knockOut || opts.melee,
    knockOut,
  });
  let after = out.creature;
  let wardLeft = wardHp;
  if (wardHp) {
    const used = Math.min(wardHp, view.tempHp + wardHp - out.creature.tempHp);
    wardLeft = wardHp - used;
    after = { ...after, tempHp: Math.max(0, after.tempHp - wardLeft) };
    if (used > 0)
      say(
        s,
        'you',
        `${warder!.id === target.id ? '' : `${warder!.name}'s `}Arcane Ward absorbs ${used} (${wardLeft} left)`,
      );
  }
  // Keep the real defenses (Rage resistance is not permanent).
  target.creature = { ...after, defenses: before.defenses };
  fxDamage(s, target, parts, out.damageTaken, !!opts.critical, view);
  if (warder && wardLeft !== wardHp) {
    warder.creature = { ...warder.creature, arcaneWard: wardLeft } as Hero;
    if (warder.id !== target.id) warder.reactionUsed = true;
  }
  // Finale (homebrew): Shard-Bound. Damage to a crown shard is also dealt to the ember-wraith.
  if (
    out.damageTaken > 0 &&
    target.monsterId &&
    getMonster(target.monsterId).traits.some((t) => t.id === 'shard')
  ) {
    for (const w of Object.values(s.combatants)) {
      if (w.creature.dead || !w.monsterId) continue;
      if (!getMonster(w.monsterId).traits.some((t) => t.id === 'shard-bound')) continue;
      say(s, 'dmg', `The shard cracks, and ${w.name} shudders`);
      dealDamage(ctx, w, [{ amount: out.damageTaken, type: 'force' }], { attacker: opts.attacker });
    }
  }
  // MM: Zombie, Undead Fortitude. Dropped to 0 by anything but radiant damage or a critical hit:
  // a Con save (DC 5 + the damage taken) leaves it at 1 HP instead.
  if (
    before.hp > 0 &&
    target.creature.hp === 0 &&
    target.monsterId &&
    !opts.critical &&
    !parts.some((p) => p.type === 'radiant' && p.amount > 0) &&
    getMonster(target.monsterId).traits.some((t) => t.id === 'undead-fortitude')
  ) {
    const r = combatSave(ctx, target, 'con', 5 + out.damageTaken, {
      label: 'Con (Undead Fortitude)',
    });
    if (r.success) {
      target.creature = {
        ...target.creature,
        hp: 1,
        dead: false,
        conditions: target.creature.conditions.filter(
          (c) => c.id !== 'unconscious' && c.id !== 'prone',
        ),
      };
      say(s, 'foe', `${target.name} refuses to stay down (Undead Fortitude)`);
      return out.damageTaken;
    }
  }
  // SRD: Boar, Relentless.
  if (before.hp > 0 && target.creature.hp === 0 && relentless(ctx, target, out.damageTaken))
    return out.damageTaken;
  sayAll(s, out.log, opts.attacker);
  if (before.concentration && !target.creature.concentration)
    endConcentrationEffects(s, target.id, before.concentration);

  // Warlock: Dark One's Blessing. Dropping a hostile creature to 0 HP grants temporary HP.
  const killer = opts.attacker;
  if (killer && before.hp > 0 && target.creature.hp === 0 && target.side !== killer.side) {
    const lvl = classLevel(killer, 'warlock');
    if (lvl && isSub(killer, 'warlock', 'fiend')) {
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

/**
 * M11: one floating number per damage type (a flaming sword shows its fire apart), in the
 * type's colour. The numbers add up to the damage actually taken.
 */
function fxDamage(
  s: CombatState,
  target: Combatant,
  parts: DamageInstance[],
  taken: number,
  critical: boolean,
  view?: Creature,
): void {
  const live = parts.filter((p) => p.amount > 0);
  if (!live.length) return;
  if (live.length === 1 || !view) {
    fx(s, {
      type: 'damage',
      targetId: target.id,
      amount: taken,
      damageType: live[0]!.type,
      critical,
    });
    return;
  }
  let left = taken;
  live.forEach((p, i) => {
    const amount =
      i === live.length - 1
        ? left
        : Math.min(left, adjustForDefenses(p.amount, p.type, view.defenses).amount);
    left -= amount;
    if (amount > 0 || i === 0)
      fx(s, { type: 'damage', targetId: target.id, amount, damageType: p.type, critical });
  });
}

/**
 * PHB: Invisibility. The spell ends for a target that attacks or casts a spell. When no one is
 * left invisible from it, the caster stops concentrating on it.
 */
export function breakInvisibility(s: CombatState, c: Combatant): void {
  const held = c.effects.filter(
    (e) =>
      e.tag === 'condition' &&
      e.data?.condition === 'invisible' &&
      e.concentration === 'invisibility',
  );
  for (const e of held) {
    removeEffect(c, e);
    say(s, 'info', `${c.name} is visible again (Invisibility ends on attacking or casting)`);
    const caster = s.combatants[e.sourceId];
    const left = Object.values(s.combatants).some((o) =>
      o.effects.some((x) => x.sourceId === e.sourceId && x.concentration === 'invisibility'),
    );
    if (caster && !left && caster.creature.concentration === 'invisibility')
      caster.creature = { ...caster.creature, concentration: null };
  }
}

/** Remove every effect that depended on `casterId` concentrating on `spellId`. */
export function endConcentrationEffects(s: CombatState, casterId: string, spellId: string): void {
  for (const c of Object.values(s.combatants)) {
    const ending = c.effects.filter((e) => e.sourceId === casterId && e.concentration === spellId);
    for (const e of ending) {
      removeEffect(c, e);
      // PHB: Haste. When it ends, the target can't move or act until after its next turn.
      if (e.tag === 'hasted' && !c.creature.dead) {
        c.effects.push({
          id: 'lethargy',
          name: 'Haste lethargy',
          sourceId: casterId,
          tag: 'skip-turn',
          expires: { turnOf: c.id, when: 'end', round: s.round + 1 },
        });
        say(s, 'dmg', `A wave of lethargy sweeps over ${c.name}`);
      }
    }
    // Conjured creatures vanish.
    if (c.summon && c.summon.casterId === casterId && c.summon.spellId === spellId && !c.gone) {
      c.gone = true;
      say(s, 'info', `${c.name} fades away`);
    }
  }
  // Lasting areas (Spirit Guardians, Moonbeam...) end too.
  const zones = s.zones.filter((z) => z.casterId === casterId && z.spellId === spellId);
  if (zones.length) {
    s.zones = s.zones.filter((z) => !zones.includes(z));
    const dark = new Set(
      s.zones
        .filter((z) => z.kind === 'darkness')
        .flatMap((z) => (z.cells ?? []).map((p) => `${p.x},${p.y}`)),
    );
    s.map = { ...s.map, dark: [...dark] };
    for (const z of zones) say(s, 'info', `${z.name} fades`);
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
  if (out.healed > 0) fx(ctx.s, { type: 'heal', targetId: target.id, amount: out.healed });
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
  // PHB: Beacon of Hope. Advantage on Wisdom saving throws.
  if (ability === 'wis' && hasBeacon(target)) adv.push('Beacon of Hope');
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
  const itemSave = h ? itemMods(h).save : 0;
  if (itemSave) bonuses.push({ label: 'items', value: itemSave });
  // PHB: Paladin, Aura of Protection (level 6). Allies within 10 ft add the paladin's Cha (min +1).
  const aura = Object.values(ctx.s.combatants)
    .filter(
      (p) =>
        p.side === target.side &&
        classLevel(p, 'paladin') >= 6 &&
        conscious(p) &&
        distanceFeet(p.pos, target.pos) <= 10,
    )
    .map((p) => Math.max(1, abilityModifier(p.creature.abilities.cha)))
    .sort((a, b) => b - a)[0];
  if (aura) bonuses.push({ label: 'Aura of Protection', value: aura });
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
  // PHB: Fiend warlock, Dark One's Own Luck (level 6). Add a d10 to a failed save, once per rest
  // [used automatically when it can turn the failure into a success].
  if (
    !result.success &&
    !result.autoFail &&
    h &&
    resourceLeft(h, 'dark-ones-own-luck') > 0 &&
    result.total + 10 >= dc
  ) {
    const die = roll('1d10', ctx.rng);
    spendResource(target, 'dark-ones-own-luck');
    const total = result.total + die.total;
    say(
      ctx.s,
      'you',
      `${target.name} calls on the Dark One's luck: ${die.text} → ${total} ${total >= dc ? '(saved)' : '(still fails)'}`,
    );
    if (total >= dc) result = { ...result, total, success: true };
  }
  fx(ctx.s, { type: 'save', targetId: target.id, success: result.success, ability });
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
  if (!h) {
    // Monsters with Spellcasting track their own slots for the fight.
    if (c.monsterSlots && c.monsterSlots[level] !== undefined)
      c.monsterSlots = { ...c.monsterSlots, [level]: Math.max(0, c.monsterSlots[level]! - 1) };
    return;
  }
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

/** Whose Arcane Ward protects this creature: its own, or (Projected Ward) an abjurer's nearby. */
function wardFor(s: CombatState, target: Combatant): Combatant | null {
  const own = heroOf(target);
  if (own && (own.arcaneWard ?? 0) > 0) return target;
  if (target.side !== 'party') return null;
  return (
    Object.values(s.combatants).find((o) => {
      const h = heroOf(o);
      return (
        o.id !== target.id &&
        o.side === target.side &&
        !!h &&
        hasSubclass(h, 'wizard', 'abjuration', 6) &&
        (h.arcaneWard ?? 0) > 0 &&
        !o.reactionUsed &&
        conscious(o) &&
        !isIncapacitated(o.creature) &&
        distanceFeet(o.pos, target.pos) <= 30
      );
    }) ?? null
  );
}

/**
 * PHB: Abjuration, Arcane Ward. Casting an abjuration spell of 1st level or higher makes the ward
 * (2 × wizard level + Int modifier HP) the first time after a long rest, and later heals it by
 * twice the spell's level.
 */
export function chargeWard(s: CombatState, caster: Combatant, spellLevel: number): void {
  const h = heroOf(caster);
  if (!h || spellLevel < 1 || !hasSubclass(h, 'wizard', 'abjuration', 2)) return;
  const max = 2 * h.level + abilityModifier(h.abilities.int);
  const now = h.arcaneWard;
  const next = now === undefined ? max : Math.min(max, now + 2 * spellLevel);
  caster.creature = { ...h, arcaneWard: next };
  say(
    s,
    'you',
    now === undefined
      ? `An Arcane Ward shimmers around ${caster.name} (${next} HP)`
      : `${caster.name}'s Arcane Ward strengthens (${next}/${max} HP)`,
  );
}
