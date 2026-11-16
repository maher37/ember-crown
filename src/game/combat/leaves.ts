import type { Effect, LeafEffect } from '../../data/schemas/common';
import {
  addCondition,
  grantTempHp,
  roll,
  stabilize,
  type ConditionId,
  type DiceRoll,
} from '../../rules';
import { addEffect, combatSave, dealDamage, healCombatant, say, type Ctx } from './core';
import { blocksMovement, inBounds, occupant, terrainAt } from './grid';
import type { ActiveEffect, CombatState, Combatant, Pos } from './types';

type Duration = Extract<LeafEffect, { type: 'condition' }>['duration'];

/** The round in which `sourceId`'s next turn starts (or ends). */
export function nextTurnRound(s: CombatState, sourceId: string): number {
  const idx = s.order.indexOf(sourceId);
  return idx > s.turnIndex ? s.round : s.round + 1;
}

/** Turn a data duration into an expiry on the source's turns [rounds → 6 seconds each]. */
export function expiryFor(
  s: CombatState,
  sourceId: string,
  d: Duration | undefined,
): ActiveEffect['expires'] {
  if (!d || d === 'instant' || d === 'until-dispelled') return undefined;
  if (d === 'until-start-of-next-turn')
    return { turnOf: sourceId, when: 'start', round: nextTurnRound(s, sourceId) };
  if (d === 'until-end-of-next-turn')
    return { turnOf: sourceId, when: 'end', round: nextTurnRound(s, sourceId) };
  const rounds = 'rounds' in d ? d.rounds : 'minutes' in d ? d.minutes * 10 : d.hours * 600;
  const isOwnTurn = s.order[s.turnIndex] === sourceId;
  return { turnOf: sourceId, when: isOwnTurn ? 'start' : 'end', round: s.round + rounds };
}

export interface LeafOpts {
  /** Save DC for nested saves (spells: the caster's DC). */
  dc?: number;
  spellId?: string;
  spellName?: string;
  /** The effect lasts while the source concentrates on this spell. */
  concentration?: string;
  /** Damage already rolled once for an area (PHB: roll once for all targets). */
  preRolled?: Map<LeafEffect, DiceRoll>;
  /** Halve damage (a successful save against a "half" effect). */
  half?: boolean;
  /** Healing bonus (Disciple of Life) and spellcasting modifier. */
  healBonus?: number;
  mod?: number;
  /** Extra damage dice from casting at a higher level. */
  upcastDice?: string;
  /** Agonizing Blast etc.: flat bonus to this spell's damage. */
  damageBonus?: number;
}

export function rollLeafDamage(
  ctx: Ctx,
  e: Extract<LeafEffect, { type: 'damage' }>,
  opts: LeafOpts,
  critical = false,
): DiceRoll {
  const pre = opts.preRolled?.get(e);
  if (pre) return pre;
  const base = roll(e.dice, ctx.rng);
  const extraDice = critical ? roll({ ...base.expr, bonus: 0 }, ctx.rng) : null;
  const up = opts.upcastDice ? roll(opts.upcastDice, ctx.rng) : null;
  const flat = (e.addModifier ? (opts.mod ?? 0) : 0) + (opts.damageBonus ?? 0);
  const total = Math.max(0, base.total + (extraDice?.total ?? 0) + (up?.total ?? 0) + flat);
  const parts = [
    base.text,
    extraDice && `crit ${extraDice.text}`,
    up && `upcast ${up.text}`,
    flat && `${flat > 0 ? '+' : ''}${flat}`,
  ].filter(Boolean);
  return { ...base, total, text: `${parts.join(', ')} → ${total}` };
}

/** Apply one effect (leaf, or a nested save) from `source` to `target`. */
export function applyLeaf(
  ctx: Ctx,
  source: Combatant,
  target: Combatant,
  e: LeafEffect | Extract<Effect, { type: 'save' }>,
  opts: LeafOpts,
  critical = false,
): void {
  const { s } = ctx;
  const label = opts.spellName ?? 'the effect';
  switch (e.type) {
    case 'save': {
      const dc = e.dc ?? opts.dc ?? 10;
      const r = combatSave(ctx, target, e.ability, dc, {
        against: firstCondition(e.onFail),
        magic: !!opts.spellId,
      });
      if (!r.success) for (const x of e.onFail) applyLeaf(ctx, source, target, x, opts);
      else if (e.onSuccess === 'half')
        for (const x of e.onFail)
          if (x.type === 'damage') applyLeaf(ctx, source, target, x, { ...opts, half: true });
      return;
    }
    case 'damage': {
      const r = rollLeafDamage(ctx, e, opts, critical);
      const amount = opts.half ? Math.floor(r.total / 2) : r.total;
      say(
        s,
        'dmg',
        `${label}: ${r.text} ${e.damageType}${opts.half ? ` (halved: ${amount})` : ''}`,
      );
      dealDamage(ctx, target, [{ amount, type: e.damageType }], { critical, attacker: source });
      return;
    }
    case 'heal': {
      const r = roll(e.dice, ctx.rng);
      const up = opts.upcastDice ? roll(opts.upcastDice, ctx.rng).total : 0;
      const amount = Math.max(
        0,
        r.total + up + (e.addModifier ? (opts.mod ?? 0) : 0) + (opts.healBonus ?? 0),
      );
      say(
        s,
        'you',
        `${label}: ${r.text}${up ? ` + ${up} upcast` : ''}${e.addModifier ? ` + ${opts.mod ?? 0}` : ''}${opts.healBonus ? ` + ${opts.healBonus} Disciple of Life` : ''} = ${amount} healing`,
      );
      healCombatant(ctx, target, amount, label, source);
      return;
    }
    case 'tempHp': {
      const amount = roll(e.dice, ctx.rng).total;
      target.creature = grantTempHp(target.creature, amount);
      say(s, 'you', `${target.name} gains ${amount} temporary HP`);
      return;
    }
    case 'condition': {
      giveCondition(
        ctx,
        source,
        target,
        e.condition,
        e.duration,
        opts.concentration,
        e.repeatSave,
        opts.dc,
      );
      return;
    }
    case 'modifier': {
      const mod: ActiveEffect['mod'] = {};
      if (e.target === 'attack' || e.target === 'save' || e.target === 'damage')
        mod[e.target] = e.value as string | number;
      if (e.target === 'ac') mod.ac = Number(e.value);
      if (e.target === 'speed') {
        addEffect(target, {
          id: `${opts.spellId}-speed`,
          name: label,
          sourceId: source.id,
          tag: 'speed',
          data: { feet: Number(e.value) },
          expires: expiryFor(s, source.id, e.duration),
          concentration: opts.concentration,
        });
        say(s, 'dmg', `${target.name}'s speed drops by ${-Number(e.value)} ft`);
        return;
      }
      if (e.target === 'check') return; // Out-of-combat bonus (Guidance, Pass without Trace).
      addEffect(target, {
        id: `${opts.spellId ?? label}-${e.target}`,
        name: label,
        sourceId: source.id,
        mod,
        expires: expiryFor(s, source.id, e.duration),
        concentration: opts.concentration,
      });
      say(
        s,
        'dmg',
        `${target.name}: ${label} (${e.target} ${typeof e.value === 'number' && e.value > 0 ? '+' : ''}${e.value})`,
      );
      return;
    }
    case 'move': {
      if (e.kind === 'teleport') return;
      pushPull(ctx, source, target, e.kind === 'pull' ? -e.feet : e.feet);
      return;
    }
    case 'special':
      applySpecial(ctx, source, target, e.id, opts);
      return;
  }
}

function firstCondition(effects: LeafEffect[]): ConditionId | undefined {
  const c = effects.find((x) => x.type === 'condition');
  return c?.type === 'condition' ? c.condition : undefined;
}

export function giveCondition(
  ctx: Ctx,
  source: Combatant,
  target: Combatant,
  id: ConditionId,
  duration: Duration | undefined,
  concentration?: string,
  repeatSave?: string,
  dc?: number,
): void {
  if (target.creature.dead) return;
  target.creature = addCondition(target.creature, { id, source: source.id });
  if (id === 'unconscious') target.creature = addCondition(target.creature, { id: 'prone' });
  const timed = duration || concentration || repeatSave;
  if (timed) {
    addEffect(target, {
      id: `cond-${id}-${source.id}`,
      name: id,
      sourceId: source.id,
      tag: 'condition',
      data: { condition: id, ...(repeatSave ? { repeatSave, dc: dc ?? 10 } : {}) },
      expires: expiryFor(ctx.s, source.id, duration),
      concentration,
    });
  }
  say(ctx.s, 'dmg', `${target.name} is ${id}`);
}

/** Push (positive) or pull (negative) a target in a straight line, stopping at obstacles. */
function pushPull(ctx: Ctx, source: Combatant, target: Combatant, feet: number): void {
  const steps = Math.abs(feet) / 5;
  const dir = Math.sign(feet);
  const dx = Math.sign(target.pos.x - source.pos.x) * dir;
  const dy = Math.sign(target.pos.y - source.pos.y) * dir;
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const n: Pos = { x: target.pos.x + dx, y: target.pos.y + dy };
    if (!inBounds(ctx.s.map, n) || blocksMovement(terrainAt(ctx.s.map, n)) || occupant(ctx.s, n))
      break;
    target.pos = n;
    moved += 5;
  }
  if (moved) say(ctx.s, 'dmg', `${target.name} is ${dir > 0 ? 'pushed' : 'pulled'} ${moved} ft`);
}

/** Named behaviors from the data (`{ "type": "special", "id": ... }`). */
export const HANDLED_SPECIALS = new Set([
  'no-reactions',
  'no-healing',
  'next-attack-advantage',
  'disadvantage-next-attack',
  'outlined',
  'stabilize',
  'mage-armor',
  'retaliate-cold',
  'bonus-damage-on-hit',
  'advantage-vs-metal-armor',
  'ignores-cover',
  'hp-pool-condition',
  'magic-missile',
  'blocks-magic-missile',
  'flee-with-reaction',
  'command',
  'sanctuary',
  'multiple-rays',
  'save-or-prone',
  'swarm-half-damage',
]);

function applySpecial(
  ctx: Ctx,
  source: Combatant,
  target: Combatant,
  id: string,
  opts: LeafOpts,
): void {
  const { s } = ctx;
  const name = opts.spellName ?? id;
  const until = (when: 'start' | 'end') => ({
    turnOf: source.id,
    when,
    round: nextTurnRound(s, source.id),
  });
  switch (id) {
    case 'no-reactions':
      target.reactionUsed = true;
      say(s, 'dmg', `${target.name} can't take reactions until its next turn`);
      return;
    case 'no-healing':
      addEffect(target, {
        id: 'no-healing',
        name,
        sourceId: source.id,
        tag: 'no-healing',
        expires: until('start'),
      });
      return;
    case 'next-attack-advantage':
      addEffect(target, {
        id: 'guided',
        name,
        sourceId: source.id,
        tag: 'advantage-next-attack-against',
        expires: until('end'),
      });
      return;
    case 'disadvantage-next-attack':
      addEffect(target, {
        id: 'mocked',
        name,
        sourceId: source.id,
        tag: 'disadvantage-next-attack',
        expires: { turnOf: target.id, when: 'end', round: nextTurnRound(s, target.id) },
      });
      return;
    case 'outlined':
      addEffect(target, {
        id: 'outlined',
        name,
        sourceId: source.id,
        tag: 'outlined',
        concentration: opts.concentration,
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      say(s, 'dmg', `${target.name} is outlined in light`);
      return;
    case 'stabilize':
      if (target.creature.hp === 0 && !target.creature.dead) {
        target.creature = stabilize(target.creature);
        say(s, 'you', `${target.name} is stable`);
      }
      return;
    case 'mage-armor':
      addEffect(target, {
        id: 'mage-armor',
        name: 'Mage Armor',
        sourceId: source.id,
        tag: 'mage-armor',
      });
      say(s, 'you', `${target.name} is warded by Mage Armor`);
      return;
    case 'retaliate-cold':
      addEffect(target, {
        id: 'agathys',
        name: 'Armor of Agathys',
        sourceId: source.id,
        tag: 'agathys',
        data: { cold: 5 },
      });
      return;
    case 'bonus-damage-on-hit': {
      const tag =
        opts.spellId === 'hex'
          ? 'hex-target'
          : opts.spellId === 'hunters-mark'
            ? 'hunters-mark-target'
            : 'divine-favor';
      const holder = tag === 'divine-favor' ? source : target;
      addEffect(holder, {
        id: tag,
        name,
        sourceId: source.id,
        tag,
        concentration: opts.concentration,
      });
      say(
        s,
        'you',
        tag === 'divine-favor'
          ? `${source.name}'s weapon glows with divine power`
          : `${target.name} is marked by ${name}`,
      );
      return;
    }
    case 'flee-with-reaction':
      if (!target.reactionUsed && !target.creature.dead && target.creature.hp > 0) {
        target.reactionUsed = true;
        pushPull(ctx, source, target, Math.min(target.speed, 30));
      }
      return;
    case 'command':
      // Simplified to "Halt!": the target loses its next turn [inferred simplification].
      addEffect(target, {
        id: 'commanded',
        name: 'Command: Halt',
        sourceId: source.id,
        tag: 'skip-turn',
        expires: { turnOf: target.id, when: 'end', round: nextTurnRound(s, target.id) },
      });
      say(s, 'dmg', `${target.name} obeys: "Halt!" and loses its next turn`);
      return;
    case 'sanctuary':
      addEffect(target, {
        id: 'sanctuary',
        name: 'Sanctuary',
        sourceId: source.id,
        tag: 'sanctuary',
        data: { dc: opts.dc ?? 10 },
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      say(s, 'you', `${target.name} is warded by Sanctuary`);
      return;
    case 'save-or-prone':
    case 'swarm-half-damage':
    case 'ignores-cover':
    case 'advantage-vs-metal-armor':
    case 'blocks-magic-missile':
    case 'multiple-rays':
    case 'hp-pool-condition':
    case 'magic-missile':
      return; // Handled by the spell / attack code itself.
    default:
      say(s, 'info', `(${name}: "${id}" has no combat effect yet)`);
  }
}
