import { spells } from '../../data';
import type { Effect, LeafEffect } from '../../data/schemas/common';
import type { Spell } from '../../data/schemas/spell';
import { getMonster } from '../creatures';
import { getClass, slotsLeft, spellNumbers } from '../hero';
import { attackRoll, roll, startConcentration, type DiceRoll } from '../../rules';
import {
  classLevel,
  combatSave,
  currentAc,
  dealDamage,
  endConcentrationEffects,
  heroOf,
  say,
  sayAll,
  spendSlot,
  type Ctx,
} from './core';
import {
  CELL_FEET,
  conscious,
  coneCells,
  coverBetween,
  cubeCells,
  distanceFeet,
  hasLineOfSight,
  posKey,
  samePos,
  sphereCells,
} from './grid';
import { applyLeaf, giveCondition, HANDLED_SPECIALS, nextTurnRound, type LeafOpts } from './leaves';
import type { Combatant, Pos } from './types';

export const getSpell = (id: string): Spell => {
  const sp = spells.find((x) => x.id === id);
  if (!sp) throw new Error(`Unknown spell "${id}"`);
  return sp;
};

const specialsIn = (effects: Effect[]): string[] =>
  effects.flatMap((e) =>
    e.type === 'special'
      ? [e.id]
      : e.type === 'attack'
        ? specialsIn(e.onHit as Effect[])
        : e.type === 'save'
          ? specialsIn(e.onFail as Effect[])
          : [],
  );

/** Spells the combat engine can run (everything else is exploration-only for now). */
export function combatReady(sp: Spell): boolean {
  if (sp.utility || !['action', 'bonus', 'reaction'].includes(sp.castingTime)) return false;
  return specialsIn(sp.effects as Effect[]).every((id) => HANDLED_SPECIALS.has(id));
}

export type Targeting =
  | { kind: 'self' }
  | { kind: 'creatures'; count: number; rangeFeet: number; repeat: boolean }
  | {
      kind: 'area';
      shape: 'cone' | 'cube' | 'line' | 'sphere' | 'cylinder' | 'square' | 'aura';
      size: number;
      rangeFeet: number;
    };

export function rangeFeet(sp: Spell): number {
  return sp.range === 'self' ? 0 : sp.range === 'touch' ? CELL_FEET : sp.range.feet;
}

export function targeting(sp: Spell, slotLevel: number): Targeting {
  const extra = Math.max(0, slotLevel - sp.level);
  if (sp.area)
    return { kind: 'area', shape: sp.area.shape, size: sp.area.size, rangeFeet: rangeFeet(sp) };
  if (sp.id === 'magic-missile')
    return { kind: 'creatures', count: 3 + extra, rangeFeet: 120, repeat: true };
  if (sp.id === 'scorching-ray')
    return { kind: 'creatures', count: 3 + extra, rangeFeet: 120, repeat: true };
  if (sp.range === 'self') return { kind: 'self' };
  const count = (sp.targets ?? 1) + (sp.upcast?.targetsPerLevel ?? 0) * extra;
  return { kind: 'creatures', count, rangeFeet: rangeFeet(sp), repeat: false };
}

export interface SpellChoice {
  spell: Spell;
  /** Slot levels it can be cast with now (0 = cantrip). */
  levels: number[];
  /** Why it can't be cast this turn, if not. */
  blocked?: string;
}

/** The spells a hero (or caster) could cast on this turn. */
export function spellChoices(c: Combatant): SpellChoice[] {
  const h = heroOf(c);
  if (!h || c.wildShape) return [];
  const left = slotsLeft(h);
  const ids = [...h.cantrips, ...h.spells];
  return ids.flatMap((id) => {
    const sp = spells.find((x) => x.id === id);
    if (!sp || !combatReady(sp) || sp.castingTime === 'reaction') return [];
    const levels =
      sp.level === 0 ? [0] : left.flatMap((n, i) => (n > 0 && i + 1 >= sp.level ? [i + 1] : []));
    let blocked: string | undefined;
    const t = c.turn;
    const isBonus = sp.castingTime === 'bonus';
    if (isBonus ? t.bonusUsed : t.actionUsed && t.extraActions === 0)
      blocked = isBonus ? 'bonus action used' : 'action used';
    // PHB: Bonus Action casting. After a bonus-action spell, only a cantrip with a casting time of 1 action.
    else if (!isBonus && t.bonusSpellCast && sp.level > 0)
      blocked = 'only a cantrip after a bonus-action spell';
    else if (!levels.length) blocked = 'no spell slots left';
    return [{ spell: sp, levels, blocked }];
  });
}

/** Squares an area spell covers when aimed at `point`. */
export function areaCells(ctx: Ctx, caster: Combatant, sp: Spell, point: Pos): Pos[] {
  const a = sp.area!;
  const m = ctx.s.map;
  switch (a.shape) {
    case 'cone':
      return coneCells(m, caster.pos, point, a.size);
    case 'cube':
    case 'square':
      return sp.range === 'self'
        ? cubeCells(m, caster.pos, point, a.size)
        : sphereCells(m, point, Math.floor(a.size / 2));
    case 'line':
      return coneCells(m, caster.pos, point, a.size).filter((p) => {
        const dx = point.x - caster.pos.x;
        const dy = point.y - caster.pos.y;
        const mag = Math.hypot(dx, dy) || 1;
        return Math.abs((p.x - caster.pos.x) * dy - (p.y - caster.pos.y) * dx) / mag <= 0.5;
      });
    case 'aura':
      return sphereCells(m, caster.pos, a.size);
    default:
      return sphereCells(m, point, a.size);
  }
}

/** Creatures in a set of squares. */
export function creaturesIn(ctx: Ctx, cells: Pos[]): Combatant[] {
  const keys = new Set(cells.map(posKey));
  return Object.values(ctx.s.combatants).filter(
    (c) => !c.gone && !c.creature.dead && keys.has(posKey(c.pos)),
  );
}

const METAL = /chain|scale|splint|plate|ring|breastplate/i;
const wearsMetal = (c: Combatant) => {
  const h = heroOf(c);
  if (h) return !!h.equipment.armor && METAL.test(h.equipment.armor);
  return c.monsterId ? METAL.test(getMonster(c.monsterId).acNote ?? '') : false;
};
const isHumanoid = (c: Combatant) =>
  !!heroOf(c) || (c.monsterId ? getMonster(c.monsterId).type === 'humanoid' : false);
const HUMANOID_ONLY = new Set(['hold-person', 'charm-person']);

export interface CastRequest {
  spellId: string;
  slotLevel: number;
  targetIds?: string[];
  point?: Pos;
}

/** Check a cast before doing it. Null if fine, else the reason. */
export function castProblem(ctx: Ctx, caster: Combatant, req: CastRequest): string | null {
  const choice = spellChoices(caster).find((c) => c.spell.id === req.spellId);
  if (!choice) return 'not a spell you can cast in combat';
  if (choice.blocked) return choice.blocked;
  if (!choice.levels.includes(req.slotLevel)) return 'no slot of that level';
  const sp = choice.spell;
  const t = targeting(sp, req.slotLevel);
  if (t.kind === 'creatures') {
    const ids = req.targetIds ?? [];
    if (!ids.length) return 'choose a target';
    if (ids.length > t.count) return `at most ${t.count} target(s)`;
    for (const id of ids) {
      const target = ctx.s.combatants[id];
      if (!target || target.gone || target.creature.dead) return 'invalid target';
      if (distanceFeet(caster.pos, target.pos) > t.rangeFeet)
        return `${target.name} is out of range`;
      if (!hasLineOfSight(ctx.s.map, caster.pos, target.pos)) return `can't see ${target.name}`;
    }
  }
  if (t.kind === 'area' && sp.range !== 'self') {
    if (!req.point) return 'choose where to aim';
    if (distanceFeet(caster.pos, req.point) > t.rangeFeet) return 'out of range';
    if (!hasLineOfSight(ctx.s.map, caster.pos, req.point)) return 'no line of sight';
  }
  if (
    t.kind === 'area' &&
    sp.range === 'self' &&
    sp.area!.shape !== 'aura' &&
    (!req.point || samePos(req.point, caster.pos))
  )
    return 'choose a direction';
  return null;
}

/** Cast a spell (the caller has already checked `castProblem`). */
export function castSpell(ctx: Ctx, caster: Combatant, req: CastRequest): void {
  const { s, rng } = ctx;
  const sp = getSpell(req.spellId);
  const h = heroOf(caster);
  const nums = h ? spellNumbers(h)! : monsterSpellNumbers(caster);
  const lvl = req.slotLevel;
  const t = caster.turn;

  // Action economy and the slot.
  if (sp.castingTime === 'bonus') {
    t.bonusUsed = true;
    if (sp.level > 0) t.bonusSpellCast = true;
  } else if (sp.castingTime === 'action') {
    if (t.actionUsed) t.extraActions -= 1;
    t.actionUsed = true;
  }
  if (lvl > 0) spendSlot(caster, lvl);
  caster.effects = caster.effects.filter((e) => e.tag !== 'hidden');
  say(
    s,
    caster.side === 'party' ? 'you' : 'foe',
    `${caster.name} casts ${sp.name}${lvl > sp.level ? ` at level ${lvl}` : ''}`,
  );

  // PHB: Concentration. A new concentration spell ends the old one.
  if (sp.concentration) {
    const old = caster.creature.concentration;
    const r = startConcentration(caster.creature, sp.id);
    caster.creature = r.creature;
    if (old && old !== sp.id) endConcentrationEffects(s, caster.id, old);
  }

  const extra = Math.max(0, lvl - sp.level);
  const perLevel = sp.upcast?.dicePerLevel;
  const upcastDice = perLevel && extra ? multiplyDice(perLevel, extra) : undefined;
  const heals = (sp.effects as Effect[]).some((e) => e.type === 'heal');
  // PHB: Life Domain, Disciple of Life (+2 + the spell's level to healing spells of 1st level or higher).
  const healBonus = heals && lvl > 0 && h?.classId === 'cleric' ? 2 + lvl : 0;
  // PHB: Eldritch Invocations, Agonizing Blast (+Cha to Eldritch Blast damage).
  const damageBonus =
    sp.id === 'eldritch-blast' && h?.invocations.includes('agonizing-blast') ? nums.mod : 0;
  const effects = scaleCantrip(sp, h?.level ?? 1);
  const opts: LeafOpts = {
    dc: nums.dc,
    spellId: sp.id,
    spellName: sp.name,
    concentration: sp.concentration ? sp.id : undefined,
    mod: nums.mod,
    healBonus,
    upcastDice,
    damageBonus,
  };

  if (sp.id === 'magic-missile') return magicMissile(ctx, caster, req.targetIds ?? [], opts);
  if (specialsIn(effects).includes('hp-pool-condition'))
    return hpPool(ctx, caster, sp, req, upcastDice);

  const tg = targeting(sp, lvl);
  let targets: Combatant[];
  if (tg.kind === 'self') targets = [caster];
  else if (tg.kind === 'creatures')
    targets = (req.targetIds ?? []).map((id) => s.combatants[id]!).filter(Boolean);
  else {
    targets = creaturesIn(ctx, areaCells(ctx, caster, sp, req.point ?? caster.pos)).filter(
      (c) => !(sp.area!.shape !== 'sphere' && c.id === caster.id),
    );
    if (sp.area!.shape === 'aura') targets = targets.filter((c) => c.side !== caster.side);
    // PHB: Evocation, Sculpt Spells. Up to 1 + the spell's level allies are spared.
    if (classLevel(caster, 'wizard') >= 2 && sp.school === 'evocation') {
      const spared = targets.filter((c) => c.side === caster.side).slice(0, 1 + lvl);
      if (spared.length)
        say(s, 'you', `Sculpt Spells shields ${spared.map((c) => c.name).join(', ')}`);
      targets = targets.filter((c) => !spared.includes(c));
    }
    if (!targets.length) say(s, 'info', `${sp.name} catches no one`);
  }

  // PHB: Damage rolls for an area are rolled once for every creature in it.
  const preRolled = new Map<LeafEffect, DiceRoll>();
  if (tg.kind === 'area')
    for (const e of effects)
      if (e.type === 'save')
        for (const x of e.onFail) if (x.type === 'damage') preRolled.set(x, rollArea(ctx, x, opts));

  for (const target of targets) {
    if (HUMANOID_ONLY.has(sp.id) && !isHumanoid(target)) {
      say(s, 'info', `${sp.name} has no effect on ${target.name} (not a humanoid)`);
      continue;
    }
    for (const e of effects) {
      if (e.type === 'attack') {
        const adv = sp.id === 'shocking-grasp' && wearsMetal(target) ? ['metal armor'] : [];
        const r = attackRoll(caster.creature, { ...target.creature, ac: currentAc(target) }, rng, {
          attackBonus: nums.attack,
          melee: e.kind === 'melee',
          within5ft: distanceFeet(caster.pos, target.pos) <= 5,
          cover: coverOf(ctx, caster, target),
          advantage: adv,
          label: sp.name,
        });
        sayAll(s, [r.log], caster);
        if (r.hit) for (const x of e.onHit) applyLeaf(ctx, caster, target, x, opts, r.critical);
      } else if (e.type === 'save') {
        const cover =
          specialsIn(effects).includes('ignores-cover') || tg.kind === 'area'
            ? 'none'
            : coverOf(ctx, caster, target);
        const condition = e.onFail.find((x) => x.type === 'condition');
        const res = combatSave(ctx, target, e.ability, nums.dc, {
          magic: true,
          cover,
          against: condition?.type === 'condition' ? condition.condition : undefined,
        });
        const leafOpts = { ...opts, preRolled };
        if (!res.success) for (const x of e.onFail) applyLeaf(ctx, caster, target, x, leafOpts);
        else if (e.onSuccess === 'half')
          for (const x of e.onFail)
            if (x.type === 'damage') applyLeaf(ctx, caster, target, x, { ...leafOpts, half: true });
        // Potent Cantrip (wizard 6) would go here.
      } else applyLeaf(ctx, caster, target, e, { ...opts, preRolled });
    }
  }
}

function coverOf(ctx: Ctx, from: Combatant, to: Combatant): 'none' | 'half' {
  const c = coverBetween(ctx.s, from.pos, to.pos, [from.id, to.id]);
  return c === 'total' ? 'none' : c;
}

function rollArea(ctx: Ctx, e: Extract<LeafEffect, { type: 'damage' }>, opts: LeafOpts): DiceRoll {
  const base = roll(e.dice, ctx.rng);
  const up = opts.upcastDice ? roll(opts.upcastDice, ctx.rng) : null;
  const total = base.total + (up?.total ?? 0);
  return { ...base, total, text: up ? `${base.text}, upcast ${up.text} → ${total}` : base.text };
}

function multiplyDice(dice: string, times: number): string {
  const m = /^(\d*)d(\d+)$/.exec(dice);
  if (!m) return dice;
  return `${Number(m[1] || 1) * times}d${m[2]}`;
}

/** Cantrips get stronger at level 5 (PHB: cantrip damage at higher levels). */
function scaleCantrip(sp: Spell, level: number): Effect[] {
  const effects = sp.effects as Effect[];
  if (!sp.cantripAt5 || level < 5) return effects;
  const swap = (e: Effect): Effect => {
    if (e.type === 'damage') return { ...e, dice: sp.cantripAt5! };
    if (e.type === 'attack')
      return { ...e, onHit: e.onHit.map((x) => swap(x as Effect) as typeof x) };
    if (e.type === 'save')
      return { ...e, onFail: e.onFail.map((x) => swap(x as Effect) as typeof x) };
    return e;
  };
  let done = false;
  return effects.map((e) => (done ? e : ((done = true), swap(e))));
}

function monsterSpellNumbers(c: Combatant) {
  const sc = c.monsterId ? getMonster(c.monsterId).spellcasting : undefined;
  return {
    ability: sc?.ability ?? 'wis',
    mod: (sc?.attackBonus ?? 2) - 2,
    attack: sc?.attackBonus ?? 2,
    dc: sc?.dc ?? 10,
  };
}

// PHB: Magic Missile. Darts always hit; all darts use one damage roll [inferred: Sage Advice].
function magicMissile(ctx: Ctx, caster: Combatant, targetIds: string[], opts: LeafOpts): void {
  const r = roll('1d4+1', ctx.rng);
  say(ctx.s, 'you', `Magic Missile: ${targetIds.length} darts, each ${r.text} force`);
  for (const id of targetIds) {
    const target = ctx.s.combatants[id];
    if (!target || target.creature.dead) continue;
    if (target.effects.some((e) => e.name === 'Shield')) {
      say(ctx.s, 'info', `${target.name}'s Shield stops a dart`);
      continue;
    }
    dealDamage(ctx, target, [{ amount: r.total, type: 'force' }], { attacker: caster });
  }
  void opts;
}

/**
 * PHB: Sleep and Color Spray. Roll a pool of HP; creatures in the area are affected from the
 * lowest current HP up while the pool lasts.
 */
function hpPool(
  ctx: Ctx,
  caster: Combatant,
  sp: Spell,
  req: CastRequest,
  upcastDice?: string,
): void {
  const { s, rng } = ctx;
  const isSleep = sp.id === 'sleep';
  const pool = roll(isSleep ? '5d8' : '6d10', rng);
  const up = upcastDice ? roll(upcastDice, rng).total : 0;
  let left = pool.total + up;
  say(
    s,
    'you',
    `${sp.name}: ${pool.text}${up ? ` + ${up} upcast` : ''} = ${left} HP worth of creatures`,
  );
  const cells = areaCells(ctx, caster, sp, req.point ?? caster.pos);
  const candidates = creaturesIn(ctx, cells)
    .filter((c) => c.id !== caster.id && conscious(c))
    .filter((c) => !(isSleep && c.monsterId && getMonster(c.monsterId).type === 'undead'))
    .filter(
      (c) => !(isSleep && heroOf(c) && ['high-elf', 'half-elf'].includes(heroOf(c)!.speciesId)),
    )
    .filter((c) => !(!isSleep && c.creature.conditions.some((x) => x.id === 'blinded')))
    .sort((a, b) => a.creature.hp - b.creature.hp);
  for (const c of candidates) {
    if (c.creature.hp > left) break;
    left -= c.creature.hp;
    if (isSleep) {
      giveCondition(ctx, caster, c, 'unconscious', { minutes: 1 });
      const eff = c.effects.find(
        (e) => e.tag === 'condition' && e.data?.condition === 'unconscious',
      );
      if (eff) eff.data = { ...eff.data, wakeOnDamage: 1 };
    } else {
      giveCondition(ctx, caster, c, 'blinded', 'until-end-of-next-turn');
      const eff = c.effects.find((e) => e.tag === 'condition' && e.data?.condition === 'blinded');
      if (eff) eff.expires = { turnOf: caster.id, when: 'end', round: nextTurnRound(s, caster.id) };
    }
  }
}

export const spellClassAbility = (classId: string) => getClass(classId).spellcasting?.ability;
