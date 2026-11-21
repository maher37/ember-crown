import { spells } from '../../data';
import type { Effect, LeafEffect } from '../../data/schemas/common';
import type { Spell } from '../../data/schemas/spell';
import { getMonster, monsterToCreature } from '../creatures';
import { makeCombatant } from './turn';
import { addZone, around, makeZone, silenced } from './zones';
import {
  domainSpellsOf,
  getClass,
  hasSubclass,
  resourceLeft,
  slotsLeft,
  spellNumbers,
} from '../hero';
import { abilityModifier, attackRoll, roll, startConcentration, type DiceRoll } from '../../rules';
import {
  classLevel,
  combatSave,
  currentAc,
  dealDamage,
  endConcentrationEffects,
  heroOf,
  say,
  sayAll,
  healCombatant,
  spendResource,
  spendSlot,
  type Ctx,
  isSub,
  chargeWard,
} from './core';
import {
  blocksMovement,
  inBounds,
  occupant,
  terrainAt,
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
import {
  applyLeaf,
  giveCondition,
  HANDLED_SPECIALS,
  nextTurnRound,
  wrathDice,
  type LeafOpts,
} from './leaves';
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
  /** Misty Step: pick an empty square. */
  | { kind: 'point'; rangeFeet: number }
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

export type Metamagic = 'quickened' | 'twinned' | 'careful' | 'distant';
export const METAMAGIC_NAMES: Record<Metamagic, string> = {
  quickened: 'Quickened',
  twinned: 'Twinned',
  careful: 'Careful',
  distant: 'Distant',
};

/** PHB: Metamagic costs. Twinned costs the spell's level (1 for a cantrip). */
export function metamagicCost(slotLevel: number, mm: Metamagic): number {
  if (mm === 'quickened') return 2;
  if (mm === 'twinned') return Math.max(1, slotLevel);
  return 1;
}

/** Does this Metamagic option make sense for this spell? Null if yes, else why not. */
export function metamagicFits(sp: Spell, slotLevel: number, mm: Metamagic): string | null {
  const t = targeting(sp, slotLevel);
  if (mm === 'quickened') return sp.castingTime === 'action' ? null : 'only for 1-action spells';
  if (mm === 'twinned')
    return t.kind === 'creatures' && t.count === 1 && !t.repeat && sp.range !== 'self'
      ? null
      : 'only for single-target spells';
  if (mm === 'careful')
    return t.kind === 'area' && sp.effects.some((e) => e.type === 'save')
      ? null
      : 'only for area spells with a save';
  return sp.range === 'self' ? 'only for spells with a range' : null;
}

export function targeting(
  sp: Spell,
  slotLevel: number,
  mm?: Metamagic,
  casterLevel = 1,
): Targeting {
  const t = baseTargeting(sp, slotLevel, casterLevel);
  // PHB: Distant Spell doubles the range (touch becomes 30 ft); Twinned adds a second target.
  if (mm === 'distant' && t.kind !== 'self')
    return { ...t, rangeFeet: sp.range === 'touch' ? 30 : t.rangeFeet * 2 };
  if (mm === 'twinned' && t.kind === 'creatures') return { ...t, count: t.count + 1 };
  return t;
}

/** PHB: Eldritch Blast. More beams at character levels 5, 11 and 17 (each its own attack). */
export const eldritchBeams = (casterLevel: number) =>
  1 + (casterLevel >= 5 ? 1 : 0) + (casterLevel >= 11 ? 1 : 0) + (casterLevel >= 17 ? 1 : 0);

function baseTargeting(sp: Spell, slotLevel: number, casterLevel = 1): Targeting {
  const extra = Math.max(0, slotLevel - sp.level);
  if (sp.id === 'eldritch-blast' && eldritchBeams(casterLevel) > 1)
    return { kind: 'creatures', count: eldritchBeams(casterLevel), rangeFeet: 120, repeat: true };
  if (sp.area)
    return { kind: 'area', shape: sp.area.shape, size: sp.area.size, rangeFeet: rangeFeet(sp) };
  if (sp.id === 'magic-missile')
    return { kind: 'creatures', count: 3 + extra, rangeFeet: 120, repeat: true };
  if (sp.id === 'scorching-ray')
    return { kind: 'creatures', count: 3 + extra, rangeFeet: 120, repeat: true };
  // PHB: Conjure Animals. Pick an empty square for the beasts.
  if (sp.effects.some((e) => e.type === 'special' && e.id === 'summon'))
    return { kind: 'point', rangeFeet: rangeFeet(sp) };
  const tele = sp.effects.find((e) => e.type === 'move' && e.kind === 'teleport');
  if (tele && tele.type === 'move') return { kind: 'point', rangeFeet: tele.feet ?? 30 };
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
export function spellChoices(c: Combatant, mm?: Metamagic): SpellChoice[] {
  const h = heroOf(c);
  if (!h || c.wildShape) return [];
  const left = slotsLeft(h);
  // PHB: Domain Spells are always prepared.
  const ids = [...new Set([...h.cantrips, ...h.spells, ...domainSpellsOf(h)])];
  return ids.flatMap((id) => {
    const sp = spells.find((x) => x.id === id);
    if (!sp || !combatReady(sp) || sp.castingTime === 'reaction') return [];
    const levels =
      sp.level === 0 ? [0] : left.flatMap((n, i) => (n > 0 && i + 1 >= sp.level ? [i + 1] : []));
    let blocked: string | undefined;
    const t = c.turn;
    const isBonus =
      sp.castingTime === 'bonus' || (mm === 'quickened' && sp.castingTime === 'action');
    if (isBonus ? t.bonusUsed : t.actionUsed && t.extraActions === 0)
      blocked = isBonus ? 'bonus action used' : 'action used';
    // PHB: Bonus Action casting. After a bonus-action spell, only a cantrip with a casting time of 1 action.
    else if (!isBonus && t.bonusSpellCast && sp.level > 0)
      blocked = 'only a cantrip after a bonus-action spell';
    else if (isBonus && t.actionSpellCast) blocked = 'not after a levelled action spell';
    else if (mm) {
      const h2 = heroOf(c)!;
      const lvl0 = sp.level === 0 ? 0 : (levels[0] ?? sp.level);
      blocked =
        metamagicFits(sp, lvl0, mm) ??
        (resourceLeft(h2, 'sorcery-points') < metamagicCost(lvl0, mm)
          ? 'not enough sorcery points'
          : undefined);
    } else if (!levels.length) blocked = 'no spell slots left';
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
  /** Sorcerer Metamagic applied to this cast. */
  metamagic?: Metamagic;
}

/** Check a cast before doing it. Null if fine, else the reason. */
export function castProblem(ctx: Ctx, caster: Combatant, req: CastRequest): string | null {
  const choice = spellChoices(caster, req.metamagic).find((c) => c.spell.id === req.spellId);
  if (!choice) return 'not a spell you can cast in combat';
  if (choice.blocked) return choice.blocked;
  if (!choice.levels.includes(req.slotLevel)) return 'no slot of that level';
  const sp = choice.spell;
  const t = targeting(sp, req.slotLevel, req.metamagic, heroOf(caster)?.level ?? 1);
  // PHB: Silence. No spells with a verbal component inside it.
  if (silenced(ctx.s, caster) && /\bV\b/.test(sp.components ?? 'V'))
    return "you can't speak inside the Silence";
  if (req.metamagic) {
    const h = heroOf(caster);
    if (!h?.choices['metamagic']?.includes(req.metamagic)) return "you don't know that Metamagic";
    const why = metamagicFits(sp, req.slotLevel, req.metamagic);
    if (why) return why;
    if (resourceLeft(h, 'sorcery-points') < metamagicCost(req.slotLevel, req.metamagic))
      return 'not enough sorcery points';
    if (
      req.metamagic === 'twinned' &&
      new Set(req.targetIds ?? []).size !== (req.targetIds ?? []).length
    )
      return 'twin two different creatures';
  }
  if (t.kind === 'creatures') {
    const ids = req.targetIds ?? [];
    if (!ids.length) return 'choose a target';
    if (ids.length > t.count) return `at most ${t.count} target(s)`;
    for (const id of ids) {
      const target = ctx.s.combatants[id];
      const revive = specialsIn(sp.effects as Effect[]).includes('revivify');
      if (!target || target.gone) return 'invalid target';
      if (revive && (!target.creature.dead || target.side !== caster.side))
        return 'Revivify needs a fallen ally';
      if (!revive && target.creature.dead) return 'invalid target';
      if (distanceFeet(caster.pos, target.pos) > t.rangeFeet)
        return `${target.name} is out of range`;
      if (!hasLineOfSight(ctx.s.map, caster.pos, target.pos)) return `can't see ${target.name}`;
    }
  }
  if (t.kind === 'point') {
    const p = req.point;
    if (!p) return 'choose where to go';
    if (distanceFeet(caster.pos, p) > t.rangeFeet) return 'out of range';
    if (!hasLineOfSight(ctx.s.map, caster.pos, p)) return 'no line of sight';
    if (!isOpen(ctx.s, p)) return 'that space is not free';
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

  // Action economy and the slot. PHB: Quickened Spell turns a 1-action spell into a bonus action.
  const mm = req.metamagic;
  const castingTime = mm === 'quickened' && sp.castingTime === 'action' ? 'bonus' : sp.castingTime;
  if (castingTime === 'bonus') {
    t.bonusUsed = true;
    if (sp.level > 0) t.bonusSpellCast = true;
  } else if (castingTime === 'action') {
    if (t.actionUsed) t.extraActions -= 1;
    t.actionUsed = true;
    if (sp.level > 0) t.actionSpellCast = true;
  }
  if (mm) spendResource(caster, 'sorcery-points', metamagicCost(lvl, mm));
  if (lvl > 0) spendSlot(caster, lvl);
  if (sp.school === 'abjuration') chargeWard(s, caster, lvl);
  caster.effects = caster.effects.filter((e) => e.tag !== 'hidden');
  say(
    s,
    caster.side === 'party' ? 'you' : 'foe',
    `${caster.name} casts ${sp.name}${lvl > sp.level ? ` at level ${lvl}` : ''}${mm ? ` (${METAMAGIC_NAMES[mm]} Spell)` : ''}`,
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
  const healBonus = heals && lvl > 0 && h && hasSubclass(h, 'cleric', 'life') ? 2 + lvl : 0;
  // PHB: Eldritch Invocations, Agonizing Blast (+Cha to Eldritch Blast damage).
  const firesFire = (sp.effects as Effect[]).some((e) =>
    e.type === 'save'
      ? e.onFail.some((x) => x.type === 'damage' && x.damageType === 'fire')
      : e.type === 'attack'
        ? e.onHit.some((x) => x.type === 'damage' && x.damageType === 'fire')
        : e.type === 'damage' && e.damageType === 'fire',
  );
  const damageBonus =
    (sp.id === 'eldritch-blast' && h?.invocations.includes('agonizing-blast') ? nums.mod : 0) +
    // PHB: Draconic Bloodline, Elemental Affinity (level 6, red: fire). +Cha to one damage roll.
    (firesFire && h && classLevel(caster, 'sorcerer') >= 6 ? nums.mod : 0) +
    // Story_Bible §9: Corin's ember bargain "stronger fire spells" [inferred: +2].
    (firesFire && h?.origin === 'corin' && s.flags['ember_fire'] ? 2 : 0);
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
    slotLevel: lvl,
  };

  if (sp.id === 'magic-missile') return magicMissile(ctx, caster, req.targetIds ?? [], opts);
  if (specialsIn(effects).includes('hp-pool-condition'))
    return hpPool(ctx, caster, sp, req, upcastDice);

  const tg = targeting(sp, lvl, mm, h?.level ?? 1);
  // Lasting areas: Spirit Guardians, Moonbeam, Flaming Sphere, Hunger of Hadar, Spike Growth,
  // Silence, Darkness. They do nothing on the turn they're cast (PHB) [except as written].
  const lasting = specialsIn(effects).find((x) =>
    [
      'persistent-area',
      'persistent-aura',
      'silence-zone',
      'darkness-zone',
      'damage-per-5ft',
    ].includes(x),
  );
  if (lasting) {
    const at = req.point ?? (req.targetIds?.[0] ? s.combatants[req.targetIds[0]]!.pos : caster.pos);
    const cells =
      tg.kind === 'area'
        ? areaCells(ctx, caster, sp, at)
        : around(s, at, sp.id === 'flaming-sphere' ? 5 : 5);
    const zone = makeZone(caster, sp, cells, { dc: nums.dc, slotLevel: lvl, upcastDice });
    if (zone) addZone(ctx, zone);
    return;
  }
  // PHB: Conjure Animals. Two wolves appear and fight on your side [inferred: the DM picks two wolves].
  if (tg.kind === 'point' && specialsIn(effects).includes('summon')) {
    summonWolves(ctx, caster, req.point!, sp.id);
    return;
  }
  // PHB: Misty Step. Teleport to an unoccupied space you can see.
  if (tg.kind === 'point') {
    caster.pos = req.point!;
    say(
      s,
      caster.side === 'party' ? 'you' : 'foe',
      `${caster.name} vanishes in silver mist and reappears`,
    );
    return;
  }
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
    if (isSub(caster, 'wizard', 'evocation', 2) && sp.school === 'evocation') {
      const spared = targets.filter((c) => c.side === caster.side).slice(0, 1 + lvl);
      if (spared.length)
        say(s, 'you', `Sculpt Spells shields ${spared.map((c) => c.name).join(', ')}`);
      targets = targets.filter((c) => !spared.includes(c));
    }
    if (!targets.length) say(s, 'info', `${sp.name} catches no one`);
  }
  // PHB: Careful Spell. Up to Cha modifier (min 1) allies automatically succeed on the save.
  const careful = new Set<string>();
  if (mm === 'careful' && h)
    for (const c of targets
      .filter((x) => x.side === caster.side)
      .slice(0, Math.max(1, abilityModifier(h.abilities.cha))))
      careful.add(c.id);

  // PHB: Damage rolls for an area are rolled once for every creature in it.
  const preRolled = new Map<LeafEffect, DiceRoll>();
  if (tg.kind === 'area')
    for (const e of effects)
      if (e.type === 'save')
        for (const x of e.onFail)
          if (x.type === 'damage') preRolled.set(x, rollArea(ctx, x, opts, caster));

  for (const target of targets) {
    if (HUMANOID_ONLY.has(sp.id) && !isHumanoid(target)) {
      say(s, 'info', `${sp.name} has no effect on ${target.name} (not a humanoid)`);
      continue;
    }
    for (const e of effects) {
      if (e.type === 'attack') {
        // A ray or beam aimed at something already dead goes nowhere.
        if (target.creature.dead) continue;
        const adv = sp.id === 'shocking-grasp' && wearsMetal(target) ? ['metal armor'] : [];
        const swing = () =>
          attackRoll(caster.creature, { ...target.creature, ac: currentAc(target) }, rng, {
            attackBonus: nums.attack,
            melee: e.kind === 'melee',
            within5ft: distanceFeet(caster.pos, target.pos) <= 5,
            cover: coverOf(ctx, caster, target),
            advantage: adv,
            label: sp.name,
          });
        let r = swing();
        // Kind dice (owner's choice, a setting): a party spell that misses is rerolled half the
        // time, and only the roll that counts is logged.
        if (!r.hit && kindDice(s, caster) && rng.die(2) === 1) r = swing();
        sayAll(s, [r.log], caster);
        if (r.hit) {
          for (const x of e.onHit) applyLeaf(ctx, caster, target, x, opts, r.critical);
          // PHB: Hex. +1d6 necrotic whenever the caster hits the cursed creature with an attack,
          // spell attacks included (each Eldritch Blast beam).
          for (const [tag, dice, label] of [
            ['hex-target', '1d6', 'Hex'],
            // PHB: Bestow Curse. +1d8 necrotic from the curser's attacks and spells.
            ['cursed', '1d8', 'Bestow Curse'],
          ] as const)
            if (
              target.effects.some((x) => x.tag === tag && x.sourceId === caster.id) &&
              !target.creature.dead
            )
              applyLeaf(
                ctx,
                caster,
                target,
                { type: 'damage', dice, damageType: 'necrotic' },
                { ...opts, spellName: label, damageBonus: 0, upcastDice: undefined },
                r.critical,
              );
        }
      } else if (e.type === 'save') {
        const cover =
          specialsIn(effects).includes('ignores-cover') || tg.kind === 'area'
            ? 'none'
            : coverOf(ctx, caster, target);
        const condition = e.onFail.find((x) => x.type === 'condition');
        const res = careful.has(target.id)
          ? (say(s, 'you', `${target.name} is spared by Careful Spell (automatic success)`),
            {
              success: true,
            })
          : kindSave(ctx, caster, target, () =>
              combatSave(ctx, target, e.ability, nums.dc, {
                magic: true,
                cover,
                against: condition?.type === 'condition' ? condition.condition : undefined,
              }),
            );
        const leafOpts = { ...opts, preRolled };
        if (!res.success) for (const x of e.onFail) applyLeaf(ctx, caster, target, x, leafOpts);
        else if (e.onSuccess === 'half') {
          for (const x of e.onFail)
            if (x.type === 'damage') applyLeaf(ctx, caster, target, x, { ...leafOpts, half: true });
        }
        // PHB: Evocation, Potent Cantrip (level 6). A cantrip save still deals half damage.
        else if (sp.level === 0 && isSub(caster, 'wizard', 'evocation', 6)) {
          for (const x of e.onFail)
            if (x.type === 'damage') applyLeaf(ctx, caster, target, x, { ...leafOpts, half: true });
        }
      } else applyLeaf(ctx, caster, target, e, { ...opts, preRolled });
    }
  }
  // PHB: Life Domain, Blessed Healer (level 6). Healing someone else with a slot heals you 2 + level.
  if (
    heals &&
    lvl > 0 &&
    !!heroOf(caster) &&
    hasSubclass(heroOf(caster)!, 'cleric', 'life', 6) &&
    targets.some((t) => t.id !== caster.id)
  ) {
    say(s, 'you', `Blessed Healer: ${caster.name} also regains ${2 + lvl} HP`);
    healCombatant(ctx, caster, 2 + lvl, 'Blessed Healer', caster);
  }
}

/** Put two conjured wolves next to `point`, acting right after their summoner. */
function summonWolves(ctx: Ctx, caster: Combatant, point: Pos, spellId: string): void {
  const { s } = ctx;
  const wolf = getMonster('wolf');
  const spots = [point, ...around(s, point, 10)].filter((p) => isOpen(s, p)).slice(0, 2);
  spots.forEach((p, i) => {
    const id = `${caster.id}-wolf-${i + 1}`;
    const c = makeCombatant(
      id,
      `Spirit wolf ${i + 1}`,
      `W${i + 1}`,
      caster.side,
      p,
      monsterToCreature(wolf, id, `Spirit wolf ${i + 1}`),
      wolf.speed.walk,
    );
    c.monsterId = 'wolf';
    c.initiative = caster.initiative;
    c.summon = { casterId: caster.id, spellId };
    s.combatants[id] = c;
    const at = s.order.indexOf(caster.id);
    s.order = [...s.order.slice(0, at + 1 + i), id, ...s.order.slice(at + 1 + i)];
    if (s.turnIndex > at) s.turnIndex += 1;
  });
  say(s, caster.side === 'party' ? 'you' : 'foe', `${spots.length} spirit wolves answer the call`);
}

/** An empty, walkable square (no creature, no wall). */
function isOpen(s: Ctx['s'], p: Pos): boolean {
  if (!inBounds(s.map, p) || blocksMovement(terrainAt(s.map, p))) return false;
  return !occupant(s, p);
}

/** PHB: Spiritual Weapon. A bonus action: the weapon strikes (melee spell attack, 1d8 + modifier force). */
export function spiritAttack(ctx: Ctx, caster: Combatant, target: Combatant): void {
  const { s, rng } = ctx;
  const eff = caster.effects.find((e) => e.tag === 'spiritual-weapon');
  const h = heroOf(caster);
  const nums = h ? spellNumbers(h)! : monsterSpellNumbers(caster);
  caster.turn.bonusUsed = true;
  const r = attackRoll(caster.creature, { ...target.creature, ac: currentAc(target) }, rng, {
    attackBonus: nums.attack,
    melee: true,
    within5ft: true,
    label: 'Spiritual Weapon',
  });
  sayAll(s, [r.log], caster);
  if (r.hit)
    applyLeaf(
      ctx,
      caster,
      target,
      {
        type: 'damage',
        dice: String(eff?.data?.dice ?? '1d8'),
        damageType: 'force',
        addModifier: true,
      },
      { mod: nums.mod, spellName: 'Spiritual Weapon' },
      r.critical,
    );
}

/** The spell numbers for any caster (hero or monster). */
export function casterNumbers(c: Combatant) {
  const h = heroOf(c);
  return h ? spellNumbers(h)! : monsterSpellNumbers(c);
}

function coverOf(ctx: Ctx, from: Combatant, to: Combatant): 'none' | 'half' {
  const c = coverBetween(ctx.s, from.pos, to.pos, [from.id, to.id]);
  return c === 'total' ? 'none' : c;
}

function rollArea(
  ctx: Ctx,
  e: Extract<LeafEffect, { type: 'damage' }>,
  opts: LeafOpts,
  caster: Combatant,
): DiceRoll {
  const dice = wrathDice(ctx, caster, e.damageType);
  const base = roll(e.dice, dice);
  const up = opts.upcastDice ? roll(opts.upcastDice, dice) : null;
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

/** Kind dice is on, and this is a hero's spell (never a monster's). */
function kindDice(s: Ctx['s'], caster: Combatant): boolean {
  return !!s.flags?.['kind_dice'] && caster.side === 'party' && !!heroOf(caster);
}

/**
 * Kind dice for saving throws against a hero's spell: a save that succeeds is made again half
 * the time. combatSave logs as it goes, so the first try's log line is taken back out.
 */
function kindSave<T extends { success: boolean }>(
  ctx: Ctx,
  caster: Combatant,
  target: Combatant,
  save: () => T,
): T {
  const before = ctx.s.log.length;
  const r = save();
  if (!r.success || target.side === caster.side || !kindDice(ctx.s, caster) || ctx.rng.die(2) !== 1)
    return r;
  ctx.s.log.splice(before);
  return save();
}
