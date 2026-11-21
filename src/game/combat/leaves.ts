import type { Effect, LeafEffect } from '../../data/schemas/common';
import {
  addCondition,
  removeCondition,
  grantTempHp,
  roll,
  stabilize,
  type ConditionId,
  type DiceRoll,
  type RandomSource,
} from '../../rules';
import { getMonster } from '../creatures';
import { hasSubclass, resourceLeft } from '../hero';
import {
  addEffect,
  classLevel,
  combatSave,
  dealDamage,
  endConcentrationEffects,
  effectsWith,
  healCombatant,
  heroOf,
  removeEffect,
  say,
  spendResource,
  type Ctx,
} from './core';
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
  /** The slot level the spell was cast with. */
  slotLevel?: number;
}

/** Dice that always land on their highest face. */
const MAX_DICE: RandomSource = { die: (sides) => sides };

/**
 * PHB: Tempest Domain, Destructive Wrath. When the cleric rolls lightning or thunder damage,
 * Channel Divinity makes it the maximum. Here it's readied first, then used up by the next such roll.
 */
export function wrathDice(ctx: Ctx, source: Combatant | undefined, type: string): RandomSource {
  if (!source || (type !== 'lightning' && type !== 'thunder')) return ctx.rng;
  const e = effectsWith(source, 'destructive-wrath')[0];
  const h = heroOf(source);
  if (!e || !h || resourceLeft(h, 'channel-divinity') <= 0) return ctx.rng;
  removeEffect(source, e);
  spendResource(source, 'channel-divinity');
  say(ctx.s, 'you', `Destructive Wrath: ${source.name}'s ${type} damage is rolled at its maximum`);
  return MAX_DICE;
}

/**
 * PHB: Tempest Domain, Thunderbolt Strike (cleric 6). Lightning damage from the cleric can push a
 * Large or smaller creature up to 10 ft away (always used here [inferred]).
 */
export function thunderbolt(ctx: Ctx, source: Combatant, target: Combatant, type: string): void {
  const h = heroOf(source);
  if (type !== 'lightning' || !h || !hasSubclass(h, 'cleric', 'tempest', 6)) return;
  if (target.creature.dead || target.gone || source.id === target.id) return;
  const size = target.monsterId ? getMonster(target.monsterId).size : 'Medium';
  if (size === 'Huge') return;
  say(ctx.s, 'you', `Thunderbolt Strike hurls ${target.name} back`);
  pushPull(ctx, source, target, 10);
}

export function rollLeafDamage(
  ctx: Ctx,
  e: Extract<LeafEffect, { type: 'damage' }>,
  opts: LeafOpts,
  critical = false,
  source?: Combatant,
): DiceRoll {
  const pre = opts.preRolled?.get(e);
  if (pre) return pre;
  const dice = wrathDice(ctx, source, e.damageType);
  const base = roll(e.dice, dice);
  const extraDice = critical ? roll({ ...base.expr, bonus: 0 }, dice) : null;
  const up = opts.upcastDice ? roll(opts.upcastDice, dice) : null;
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
      const r = rollLeafDamage(ctx, e, opts, critical, source);
      const amount = opts.half ? Math.floor(r.total / 2) : r.total;
      say(
        s,
        'dmg',
        `${label}: ${r.text} ${e.damageType}${opts.half ? ` (halved: ${amount})` : ''}`,
      );
      ctx.lastDamage = dealDamage(ctx, target, [{ amount, type: e.damageType }], {
        critical,
        attacker: source,
      });
      if (amount > 0) thunderbolt(ctx, source, target, e.damageType);
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
  // PHB: Berserker, Mindless Rage (level 6). Can't be charmed or frightened while raging.
  if (
    (id === 'charmed' || id === 'frightened') &&
    classLevel(target, 'barbarian') >= 6 &&
    target.effects.some((e) => e.tag === 'rage')
  ) {
    say(ctx.s, 'you', `${target.name}'s Mindless Rage shrugs off being ${id}`);
    return;
  }
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
export function pushPull(ctx: Ctx, source: Combatant, target: Combatant, feet: number): void {
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
  'summoned-weapon',
  'end-condition',
  'aid',
  'next-hit-bonus',
  'mirror-image',
  'ability-drain',
  'persistent-area',
  'persistent-aura',
  'silence-zone',
  'darkness-zone',
  'damage-per-5ft',
  'summon',
  'revivify',
  'dispel-magic',
  'haste',
  'slowed',
  'flee',
  'heal-half-damage',
  'repeat-action',
  'repeat-bonus-action',
  'suggestion',
  'shillelagh',
  'fly-speed',
  'max-hp-reduction',
]);

/** Effects that come from spells, for Dispel Magic. */
const SPELL_TAGS = new Set([
  'mage-armor',
  'sanctuary',
  'agathys',
  'mirror-image',
  'spiritual-weapon',
  'next-hit',
  'aid',
  'hasted',
  'slowed',
  'outlined',
  'hex-target',
  'hunters-mark-target',
  'divine-favor',
  'flying',
  'shillelagh',
  'heated',
  'call-lightning',
  'heat-metal',
  'vampiric-touch',
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
      // PHB: Hex. The warlock also picks an ability: the target has disadvantage on its checks.
      const hexAbility = tag === 'hex-target' ? hexAbilityOf(source) : undefined;
      addEffect(holder, {
        id: tag,
        name,
        sourceId: source.id,
        tag,
        concentration: opts.concentration,
        ...(hexAbility ? { data: { ability: hexAbility } } : {}),
      });
      say(
        s,
        'you',
        tag === 'divine-favor'
          ? `${source.name}'s weapon glows with divine power`
          : `${target.name} is marked by ${name}${hexAbility ? ` (disadvantage on ${ABILITY_LONG[hexAbility]} checks)` : ''}`,
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
    case 'summoned-weapon': {
      // PHB: Spiritual Weapon. Lasts 1 minute; +1d8 for every two slot levels above 2nd.
      const extra = Math.floor(Math.max(0, (opts.slotLevel ?? 2) - 2) / 2);
      source.effects = source.effects.filter((e) => e.tag !== 'spiritual-weapon');
      addEffect(source, {
        id: 'spiritual-weapon',
        name: 'Spiritual Weapon',
        sourceId: source.id,
        tag: 'spiritual-weapon',
        data: { dice: `${1 + extra}d8` },
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      return;
    }
    case 'end-condition': {
      // PHB: Lesser Restoration. Ends blinded, deafened, paralyzed or poisoned.
      const ended = (['paralyzed', 'poisoned', 'blinded', 'deafened'] as const).find((cid) =>
        target.creature.conditions.some((x) => x.id === cid),
      );
      if (!ended) return void say(s, 'info', `${target.name} has nothing for ${name} to cure`);
      target.creature = removeCondition(target.creature, ended);
      target.effects = target.effects.filter((e) => e.data?.condition !== ended);
      say(s, 'you', `${name} ends ${target.name}'s ${ended} condition`);
      return;
    }
    case 'aid': {
      // PHB: Aid. +5 maximum and current HP (+5 more per slot level above 2nd).
      if (target.effects.some((e) => e.tag === 'aid')) return;
      const amount = 5 * (1 + Math.max(0, (opts.slotLevel ?? 2) - 2));
      addEffect(target, {
        id: 'aid',
        name: 'Aid',
        sourceId: source.id,
        tag: 'aid',
        data: { amount },
      });
      target.creature = {
        ...target.creature,
        maxHp: target.creature.maxHp + amount,
        hp: target.creature.dead ? 0 : target.creature.hp + amount,
      };
      say(s, 'you', `${target.name} is bolstered by Aid (+${amount} HP)`);
      return;
    }
    case 'next-hit-bonus': {
      // PHB: Branding Smite. The next weapon hit deals +2d6 radiant (+1d6 per slot level above 2nd).
      const n = 2 + Math.max(0, (opts.slotLevel ?? 2) - 2);
      addEffect(source, {
        id: 'branding-smite',
        name,
        sourceId: source.id,
        tag: 'next-hit',
        concentration: opts.concentration,
        data: { dice: `${n}d6`, type: 'radiant' },
      });
      say(s, 'you', `${source.name}'s weapon brands with light`);
      return;
    }
    case 'mirror-image':
      addEffect(target, {
        id: 'mirror-image',
        name: 'Mirror Image',
        sourceId: source.id,
        tag: 'mirror-image',
        data: { images: 3 },
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      say(s, 'you', `Three illusory copies of ${target.name} shimmer into being`);
      return;
    case 'ability-drain': {
      // MM: Shadow, Strength Drain. Strength drops by 1d4; at 0 the target dies.
      // [inferred] It returns when the fight ends (RAW: after a short or long rest).
      if (target.creature.dead) return;
      const d = ctx.rng.die(4);
      const str = Math.max(0, target.creature.abilities.str - d);
      const lost = target.creature.abilities.str - str;
      target.creature = { ...target.creature, abilities: { ...target.creature.abilities, str } };
      const prev = target.effects.find((e) => e.tag === 'str-drain');
      if (prev) prev.data = { amount: Number(prev.data?.amount ?? 0) + lost };
      else
        addEffect(target, {
          id: 'str-drain',
          name: 'Strength drained',
          sourceId: source.id,
          tag: 'str-drain',
          data: { amount: lost },
        });
      say(s, 'dmg', `${target.name}'s Strength drains away: d4 (${d}) → Str ${str}`);
      if (str === 0) {
        target.creature = { ...target.creature, hp: 0, dead: true };
        say(s, 'crit', `${target.name} fades into shadow and dies`);
      }
      return;
    }
    case 'persistent-area':
    case 'persistent-aura':
    case 'silence-zone':
    case 'darkness-zone':
    case 'damage-per-5ft':
    case 'summon':
      return; // Handled by castSpell (zones.ts, conjured wolves).
    case 'revivify':
      // PHB: Revivify. A creature that died within the last minute returns with 1 HP.
      if (!target.creature.dead) return;
      target.creature = {
        ...target.creature,
        dead: false,
        hp: 1,
        stable: false,
        deathSaves: { successes: 0, failures: 0 },
        conditions: target.creature.conditions.filter((c) => c.id !== 'unconscious'),
      };
      say(s, 'you', `${target.name} gasps back to life with 1 HP`);
      return;
    case 'dispel-magic': {
      // PHB: Dispel Magic. Spells of 3rd level or lower on the target end (all of ours are).
      const ending = target.effects.filter((e) => e.concentration || SPELL_TAGS.has(e.tag ?? ''));
      for (const e of ending) target.effects = target.effects.filter((x) => x !== e);
      for (const e of ending)
        if (e.tag === 'condition' && e.data?.condition)
          target.creature = removeCondition(
            target.creature,
            String(e.data.condition) as ConditionId,
          );
      const own = target.creature.concentration;
      if (own) {
        target.creature = { ...target.creature, concentration: null };
        endConcentrationEffects(s, target.id, own);
      }
      say(
        s,
        'you',
        ending.length || own
          ? `The magic on ${target.name} unravels`
          : `${name} finds nothing to dispel on ${target.name}`,
      );
      return;
    }
    case 'haste':
      addEffect(target, {
        id: 'hasted',
        name: 'Haste',
        sourceId: source.id,
        tag: 'hasted',
        concentration: opts.concentration,
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      say(s, 'you', `${target.name} blurs with speed (Haste)`);
      return;
    case 'slowed':
      addEffect(target, {
        id: 'slowed',
        name: 'Slow',
        sourceId: source.id,
        tag: 'slowed',
        concentration: opts.concentration,
        data: { repeatSave: 'wis', dc: opts.dc ?? 10 },
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      return;
    case 'flee':
      // PHB: Fear. The frightened creature must Dash away from you each turn [repeat Wis save at
      // the end of each of its turns: inferred, RAW only once out of sight].
      addEffect(target, {
        id: 'feared',
        name: 'Fear',
        sourceId: source.id,
        tag: 'turned',
        concentration: opts.concentration,
        data: { repeatSave: 'wis', dc: opts.dc ?? 10 },
      });
      return;
    case 'heal-half-damage': {
      // PHB: Vampiric Touch. You regain half the necrotic damage dealt; repeat as an action.
      const healed = Math.floor((ctx.lastDamage ?? 0) / 2);
      if (healed) healCombatant(ctx, source, healed, 'Vampiric Touch', source);
      if (!source.effects.some((e) => e.tag === 'vampiric-touch'))
        addEffect(source, {
          id: 'vampiric-touch',
          name: 'Vampiric Touch',
          sourceId: source.id,
          tag: 'vampiric-touch',
          concentration: opts.concentration,
          data: { dice: opts.upcastDice ? `3d6+${opts.upcastDice}` : '3d6' },
        });
      return;
    }
    case 'repeat-action':
      // PHB: Call Lightning. Call down another bolt as an action on later turns.
      if (!source.effects.some((e) => e.tag === 'call-lightning'))
        addEffect(source, {
          id: 'call-lightning',
          name: 'Call Lightning',
          sourceId: source.id,
          tag: 'call-lightning',
          concentration: opts.concentration,
          data: { dice: opts.upcastDice ? `3d10+${opts.upcastDice}` : '3d10', dc: opts.dc ?? 10 },
        });
      return;
    case 'repeat-bonus-action':
      // PHB: Heat Metal. Burn the same creature again as a bonus action.
      addEffect(target, {
        id: 'heated',
        name: 'Heat Metal',
        sourceId: source.id,
        tag: 'heated',
        concentration: opts.concentration,
      });
      addEffect(source, {
        id: 'heat-metal',
        name: 'Heat Metal',
        sourceId: source.id,
        tag: 'heat-metal',
        concentration: opts.concentration,
        data: { targetId: target.id, dice: opts.upcastDice ? `2d8+${opts.upcastDice}` : '2d8' },
      });
      return;
    case 'suggestion':
      // PHB: Suggestion, simplified to "stop fighting": it stops acting until it is hurt [inferred].
      addEffect(target, {
        id: 'suggestion',
        name: 'Suggestion',
        sourceId: source.id,
        tag: 'skip-turn',
        concentration: opts.concentration,
        data: { wakeOnDamage: 1 },
      });
      say(s, 'dmg', `${target.name} lowers its weapon and wanders off, convinced`);
      return;
    case 'shillelagh':
      // PHB: Shillelagh. Club or quarterstaff: Wis for attack and damage, d8, magical; 1 minute.
      addEffect(target, {
        id: 'shillelagh',
        name: 'Shillelagh',
        sourceId: source.id,
        tag: 'shillelagh',
        expires: { turnOf: source.id, when: 'start', round: s.round + 10 },
      });
      say(s, 'you', `${target.name}'s staff sprouts leaves and hardens (Shillelagh)`);
      return;
    case 'fly-speed':
      addEffect(target, {
        id: 'flying',
        name: 'Fly',
        sourceId: source.id,
        tag: 'flying',
        concentration: opts.concentration,
      });
      say(s, 'you', `${target.name} rises into the air (Fly: 60 ft)`);
      return;
    case 'max-hp-reduction': {
      // MM: Life Drain. The target's hit point maximum drops by the damage taken until a long rest.
      const lost = ctx.lastDamage ?? 0;
      if (!lost || target.creature.dead) return;
      const maxHp = Math.max(0, target.creature.maxHp - lost);
      const prev = Number((target.creature as { maxHpDrain?: number }).maxHpDrain ?? 0);
      target.creature = {
        ...target.creature,
        maxHp,
        hp: Math.min(target.creature.hp, maxHp),
        maxHpDrain: prev + lost,
      } as unknown as typeof target.creature;
      say(s, 'dmg', `${target.name}'s hit point maximum drops by ${lost} (until a long rest)`);
      if (maxHp === 0) {
        target.creature = { ...target.creature, dead: true, hp: 0 };
        say(s, 'crit', `${target.name} is drained to nothing and dies`);
      }
      return;
    }
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

export const ABILITY_LONG: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** The ability a warlock's Hex curses: their remembered pick (the sheet), else Strength. */
export function hexAbilityOf(c: Combatant): string {
  const h = c.creature as { choices?: Record<string, string[]> };
  return h.choices?.['hex-ability']?.[0] ?? 'str';
}
