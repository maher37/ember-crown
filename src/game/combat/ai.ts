import { getMonster } from '../creatures';
import { slotsLeft } from '../hero';
import { hasCondition, isIncapacitated } from '../../rules';
import { applyHit, attackBlocked, attackOptions, makeAttack } from './attacks';
import {
  active,
  addEffect,
  canAct,
  combatSave,
  currentAc,
  get,
  hasEffect,
  heroOf,
  produce,
  say,
  spendSlot,
  type Ctx,
} from './core';
import {
  conscious,
  coverBetween,
  distanceFeet,
  hasLineOfSight,
  isAdjacent,
  reachable,
  terrainAt,
} from './grid';
import { nextTurnRound } from './leaves';
import { castSpell } from './spells';
import { meleeOption, moveAlong, nextTurn, settle, speedNow } from './turn';
import type { CombatState, Combatant, EnemyPlan, PlanStep, Pos } from './types';

/**
 * Run the active enemy's turn (pausing if a party member gets a reaction prompt). The UI
 * calls this once per enemy turn so the log can be followed.
 */
export function advance(state: CombatState): CombatState {
  if (state.outcome || state.prompt) return state;
  const actor = state.combatants[state.order[state.turnIndex]!]!;
  if (actor.side !== 'enemy') return state;
  return produce(state, (ctx) => {
    if (!ctx.s.plan) {
      ctx.s.plan = { actorId: actor.id, steps: [], declined: [], flee: false };
      ctx.s.plan.steps = planTurn(ctx, active(ctx.s));
    }
    finishOrPause(ctx);
  });
}

function finishOrPause(ctx: Ctx): void {
  continuePlan(ctx);
  settle(ctx.s);
  if (!ctx.s.prompt && !ctx.s.plan && !ctx.s.outcome) nextTurn(ctx);
}

const isTargetable = (c: Combatant) => conscious(c) && !hasCondition(c.creature, 'unconscious');
const HEALERS = new Set(['cleric', 'druid', 'bard', 'wizard', 'sorcerer']);

/** How much the enemy wants to go after this hero (lower = more). Depends on difficulty. */
function targetScore(s: CombatState, me: Combatant, t: Combatant, cost: number): number {
  const h = heroOf(t);
  if (s.difficulty === 'easy') return cost;
  if (s.difficulty === 'medium') return cost * 10 + t.creature.hp;
  // Hard: focus fire, go after healers and casters, gang up for Pack Tactics.
  const healer = h && HEALERS.has(h.classId) ? 8 : 0;
  const wounded = t.creature.hp < t.creature.maxHp ? 4 : 0;
  const ganged = Object.values(s.combatants).some(
    (o) => o.side === me.side && o.id !== me.id && conscious(o) && isAdjacent(o.pos, t.pos),
  )
    ? 3
    : 0;
  return t.creature.hp + cost * 0.3 - healer - wounded - ganged;
}

/** Build this enemy's whole turn. */
export function planTurn(ctx: Ctx, me: Combatant): PlanStep[] {
  const { s } = ctx;
  const plan = s.plan as EnemyPlan;
  const heroes = Object.values(s.combatants).filter((c) => c.side !== me.side && isTargetable(c));
  if (!heroes.length || !canAct(me)) return [];
  const opts = attackOptions(me);
  const melee = opts.filter((o) => o.kind === 'melee').sort((a, b) => b.toHit - a.toHit)[0];
  const ranged = opts.find((o) => o.kind === 'ranged');
  const nimble =
    !!me.monsterId && getMonster(me.monsterId).traits.some((t) => t.id === 'nimble-escape');
  const routes = reachable(s, me, me.turn.movement);
  const adjacentHeroes = heroes.filter((h) => isAdjacent(h.pos, me.pos));
  const nearest = (from: Pos) => Math.min(...heroes.map((h) => distanceFeet(h.pos, from)));

  // Turned undead run away.
  if (hasEffect(me, 'turned')) return fleeSteps(ctx, me, plan, nimble, routes, nearest, false);

  // Morale: the last enemy standing, badly hurt, runs for it [inferred].
  const friends = Object.values(s.combatants).filter((c) => c.side === me.side && isTargetable(c));
  if (friends.length === 1 && me.creature.hp <= me.creature.maxHp / 2 && s.round >= 2)
    return fleeSteps(ctx, me, plan, nimble, routes, nearest, true);

  const shootCells = (target: Combatant) =>
    [...routes.entries()]
      .map(([k, v]) => ({ k, v, p: v.path.at(-1) ?? me.pos }))
      .filter(
        ({ p }) =>
          nearest(p) >= 10 &&
          hasLineOfSight(s.map, p, target.pos) &&
          ranged?.range &&
          distanceFeet(p, target.pos) <= ranged.range[0],
      )
      .map(({ v, p }) => ({
        path: v.path,
        p,
        score:
          (terrainAt(s.map, p) === 'brush' ? 6 : 0) +
          (coverBetween(s, target.pos, p, [target.id, me.id]) === 'half' ? 4 : 0) +
          nearest(p) / 10 -
          v.cost / 20,
      }))
      .sort((a, b) => b.score - a.score);
  const pick = (cands: { t: Combatant; cost: number }[]) =>
    cands.sort((a, b) => targetScore(s, me, a.t, a.cost) - targetScore(s, me, b.t, b.cost))[0]?.t;

  // Archers keep their distance (goblins: Nimble Escape lets them Disengage as a bonus action).
  if (me.tactic === 'ranged' && ranged) {
    const target = pick(heroes.map((t) => ({ t, cost: distanceFeet(me.pos, t.pos) })));
    if (target) {
      const steps: PlanStep[] = [];
      const inPlace =
        !adjacentHeroes.length &&
        hasLineOfSight(s.map, me.pos, target.pos) &&
        distanceFeet(me.pos, target.pos) <= ranged.range![0];
      if (inPlace) {
        if (nimble && terrainAt(s.map, me.pos) === 'brush' && !hasEffect(me, 'hidden'))
          steps.push({ type: 'bonus', what: 'hide' });
        return [...steps, { type: 'attack', targetId: target.id, optionId: ranged.id }];
      }
      const spot = shootCells(target)[0];
      if (spot) {
        if (adjacentHeroes.length && nimble) steps.push({ type: 'bonus', what: 'disengage' });
        return [
          ...steps,
          { type: 'move', path: spot.path },
          { type: 'attack', targetId: target.id, optionId: ranged.id },
        ];
      }
    }
  }

  // Melee: reach a target this turn and hit it.
  if (melee) {
    const options: { t: Combatant; cost: number; path: Pos[] }[] = [];
    for (const t of heroes) {
      if (distanceFeet(me.pos, t.pos) <= melee.reach) {
        options.push({ t, cost: 0, path: [] });
        continue;
      }
      let best: { cost: number; path: Pos[] } | null = null;
      for (const v of routes.values()) {
        const p = v.path.at(-1);
        if (p && distanceFeet(p, t.pos) <= melee.reach && (!best || v.cost < best.cost)) best = v;
      }
      if (best) options.push({ t, cost: best.cost, path: best.path });
    }
    const target = pick(options.map((o) => ({ t: o.t, cost: o.cost })));
    if (target) {
      const o = options.find((x) => x.t === target)!;
      const steps: PlanStep[] = o.path.length ? [{ type: 'move', path: o.path }] : [];
      return [...steps, { type: 'attack', targetId: target.id, optionId: melee.id }];
    }
  }

  // Can't reach anyone: shoot if possible, else dash closer.
  if (ranged) {
    const target = pick(
      heroes
        .filter(
          (t) =>
            hasLineOfSight(s.map, me.pos, t.pos) && distanceFeet(me.pos, t.pos) <= ranged.range![1],
        )
        .map((t) => ({ t, cost: distanceFeet(me.pos, t.pos) })),
    );
    if (target && !adjacentHeroes.length)
      return [{ type: 'attack', targetId: target.id, optionId: ranged.id }];
  }
  const far = reachable(s, me, me.turn.movement + speedNow(me));
  const goal = pick(heroes.map((t) => ({ t, cost: distanceFeet(me.pos, t.pos) })))!;
  let best: Pos[] = [];
  let bestD = distanceFeet(me.pos, goal.pos);
  for (const v of far.values()) {
    const p = v.path.at(-1);
    if (p && distanceFeet(p, goal.pos) < bestD) {
      bestD = distanceFeet(p, goal.pos);
      best = v.path;
    }
  }
  return best.length
    ? [
        { type: 'action', what: 'dash' },
        { type: 'move', path: best },
      ]
    : [{ type: 'action', what: 'dodge' }];
}

function fleeSteps(
  ctx: Ctx,
  me: Combatant,
  plan: EnemyPlan,
  nimble: boolean,
  routes: ReturnType<typeof reachable>,
  nearest: (p: Pos) => number,
  leave: boolean,
): PlanStep[] {
  const { s } = ctx;
  const far = reachable(s, me, me.turn.movement * 2);
  let best: Pos[] = [];
  let score = -Infinity;
  for (const v of far.values()) {
    const p = v.path.at(-1);
    if (!p) continue;
    const edge = p.x === 0 || p.y === 0 || p.x === s.map.width - 1 || p.y === s.map.height - 1;
    const sc = nearest(p) + (edge && leave ? 100 : 0) - v.cost / 10;
    if (sc > score) {
      score = sc;
      best = v.path;
    }
  }
  void routes;
  plan.flee = leave;
  if (leave) say(s, 'foe', `${me.name} panics and tries to flee!`);
  const steps: PlanStep[] = [];
  if (nimble) steps.push({ type: 'bonus', what: 'disengage' });
  steps.push({ type: 'action', what: 'dash' });
  if (best.length) steps.push({ type: 'move', path: best });
  return steps;
}

/** Carry out the plan until it ends or a party member must decide on a reaction. */
export function continuePlan(ctx: Ctx): void {
  const { s } = ctx;
  const plan = s.plan;
  if (!plan) return;
  const me = get(s, plan.actorId);
  while (plan.steps.length && !s.prompt && !s.outcome) {
    if (!canAct(me)) {
      plan.steps = [];
      break;
    }
    const step = plan.steps[0]!;
    if (step.type === 'bonus') {
      me.turn.bonusUsed = true;
      if (step.what === 'disengage') {
        me.turn.disengaged = true;
        say(s, 'foe', `${me.name} disengages (Nimble Escape)`);
      } else if (step.what === 'dash') me.turn.movement += speedNow(me);
      else {
        const why = hideCheck(ctx, me);
        if (why) say(s, 'foe', why);
      }
      plan.steps.shift();
    } else if (step.type === 'action') {
      me.turn.actionUsed = true;
      if (step.what === 'dash') {
        me.turn.movement += speedNow(me);
        say(s, 'foe', `${me.name} dashes`);
      } else {
        addEffect(me, {
          id: 'dodge',
          name: 'Dodge',
          sourceId: me.id,
          tag: 'dodge',
          expires: { turnOf: me.id, when: 'start', round: nextTurnRound(s, me.id) },
        });
        say(s, 'foe', `${me.name} takes the Dodge action`);
      }
      plan.steps.shift();
    } else if (step.type === 'move') {
      const r = moveAlong(ctx, me, step.path, plan.declined);
      if (r.result === 'paused') {
        step.path = r.rest;
        return;
      }
      plan.steps.shift();
      if (r.result === 'stopped') plan.steps = [];
      if (
        plan.flee &&
        (me.pos.x === 0 ||
          me.pos.y === 0 ||
          me.pos.x === s.map.width - 1 ||
          me.pos.y === s.map.height - 1)
      ) {
        me.gone = true;
        say(s, 'head', `${me.name} flees into the trees!`);
        plan.steps = [];
      }
    } else if (step.type === 'attack') {
      if (attackStep(ctx, me, step)) return;
      plan.steps.shift();
    }
  }
  if (!s.prompt) s.plan = null;
}

/** Returns true if the attack paused for a prompt. */
function attackStep(ctx: Ctx, me: Combatant, step: Extract<PlanStep, { type: 'attack' }>): boolean {
  const { s } = ctx;
  let target = s.combatants[step.targetId];
  const opt = attackOptions(me).find((o) => o.id === step.optionId);
  if (!opt) return false;
  if (!target || !isTargetable(target) || attackBlocked(ctx, me, target, opt)) {
    target = Object.values(s.combatants).find(
      (c) => c.side !== me.side && isTargetable(c) && !attackBlocked(ctx, me, c, opt),
    );
    if (!target) return false;
    step.targetId = target.id;
  }
  if (!step.phase) {
    me.turn.actionUsed = true;
    // PHB: Sanctuary. The attacker must pass a Wis save or choose a new target.
    const sanct = target.effects.find((e) => e.tag === 'sanctuary');
    if (sanct) {
      const r = combatSave(ctx, me, 'wis', Number(sanct.data?.dc ?? 10), {
        magic: true,
        label: 'Wis (Sanctuary)',
      });
      if (!r.success) {
        const other = Object.values(s.combatants).find(
          (c) =>
            c.side !== me.side &&
            c.id !== target!.id &&
            isTargetable(c) &&
            !attackBlocked(ctx, me, c, opt) &&
            !hasEffect(c, 'sanctuary'),
        );
        if (!other) {
          say(s, 'foe', `${me.name} can't bring itself to attack ${target.name}`);
          return false;
        }
        target = other;
        step.targetId = other.id;
      }
    }
    // Fighting Style: Protection. A party member with a shield next to the target may react.
    const protector = Object.values(s.combatants).find((p) => {
      const h = heroOf(p);
      return (
        h &&
        p.id !== target!.id &&
        p.side !== me.side &&
        h.fightingStyle === 'protection' &&
        h.equipment.shield &&
        !p.reactionUsed &&
        canAct(p) &&
        isAdjacent(p.pos, target!.pos)
      );
    });
    step.phase = 'protected';
    if (protector) {
      s.prompt = {
        kind: 'protection',
        reactorId: protector.id,
        attackerId: me.id,
        targetId: target.id,
      };
      return true;
    }
  }
  if (step.phase === 'protected') {
    const r = makeAttack(ctx, me, target, opt, {
      rollOnly: true,
      disadvantage: step.disadvantage ? ['Protection'] : [],
    });
    step.roll = r;
    step.phase = 'rolled';
    if (!r.hit) {
      step.phase = 'done';
      return false;
    }
    // Shield: a caster who knows it may raise their AC by 5 against this hit.
    const h = heroOf(target);
    if (
      h &&
      h.spells.includes('shield') &&
      slotsLeft(h).some((n) => n > 0) &&
      !target.reactionUsed &&
      canAct(target) &&
      r.natural !== 20 &&
      r.total < currentAc(target) + 5
    ) {
      s.prompt = { kind: 'shield', reactorId: target.id, attackerId: me.id, total: r.total };
      return true;
    }
  }
  if (step.phase === 'rolled') {
    const r = step.roll!;
    step.phase = 'done';
    if (
      target.effects.some((e) => e.name === 'Shield') &&
      r.natural !== 20 &&
      r.total < currentAc(target)
    ) {
      say(
        s,
        'you',
        `The attack glances off ${target.name}'s Shield (${r.total} vs AC ${currentAc(target)}) → MISS`,
      );
      return false;
    }
    const hpBefore = target.creature.hp + target.creature.tempHp;
    applyHit(ctx, me, target, opt, r.critical);
    const damaged = target.creature.hp + target.creature.tempHp < hpBefore;
    // Hellish Rebuke: a warlock who was just damaged may answer with fire.
    const h = heroOf(target);
    if (
      damaged &&
      h &&
      h.spells.includes('hellish-rebuke') &&
      slotsLeft(h).some((n) => n > 0) &&
      !target.reactionUsed &&
      !target.creature.dead &&
      !isIncapacitated(target.creature) &&
      conscious(me) &&
      distanceFeet(target.pos, me.pos) <= 60
    ) {
      s.prompt = { kind: 'hellish-rebuke', reactorId: target.id, attackerId: me.id };
      return true;
    }
  }
  return false;
}

function hideCheck(ctx: Ctx, me: Combatant): string | null {
  const { s } = ctx;
  if (terrainAt(s.map, me.pos) !== 'brush') return `${me.name} has nowhere to hide`;
  // Lazy import avoided: inline the same rule as actions.hide (Stealth vs passive Perception).
  const best = Math.max(
    ...Object.values(s.combatants)
      .filter((c) => c.side !== me.side && conscious(c))
      .map(
        (c) =>
          10 +
          Math.floor((c.creature.abilities.wis - 10) / 2) +
          (heroOf(c)?.skills.includes('perception') ? heroOf(c)!.proficiencyBonus : 0),
      ),
  );
  const bonus = me.monsterId ? (getMonster(me.monsterId).skills.stealth ?? 0) : 0;
  const d = ctx.rng.die(20);
  const total = d + bonus;
  say(
    s,
    'foe',
    `${me.name} hides (Nimble Escape): Stealth d20 (${d}) + ${bonus} = ${total} vs passive Perception ${best} → ${total >= best ? 'HIDDEN' : 'SEEN'}`,
  );
  if (total >= best)
    addEffect(me, { id: 'hidden', name: 'Hidden', sourceId: me.id, tag: 'hidden' });
  return null;
}

/** Answer the waiting reaction prompt, then let the enemy's turn carry on. */
export function resolvePrompt(ctx: Ctx, accept: boolean): void {
  const { s } = ctx;
  const p = s.prompt!;
  s.prompt = null;
  const reactor = get(s, p.reactorId);
  const step = s.plan?.steps[0];
  if (p.kind === 'opportunity-attack') {
    s.plan?.declined.push(reactor.id);
    if (accept) {
      reactor.reactionUsed = true;
      const opt = meleeOption(reactor);
      say(s, 'you', `${reactor.name} takes an opportunity attack!`);
      if (opt) makeAttack(ctx, reactor, get(s, p.targetId), opt, { opportunity: true });
    }
  } else if (p.kind === 'protection') {
    if (accept && step?.type === 'attack') {
      reactor.reactionUsed = true;
      step.disadvantage = true;
      say(s, 'you', `${reactor.name} raises a shield to protect ${get(s, p.targetId).name}`);
    }
  } else if (p.kind === 'shield') {
    if (accept) {
      const h = heroOf(reactor)!;
      const lvl = slotsLeft(h).findIndex((n) => n > 0) + 1;
      spendSlot(reactor, lvl);
      reactor.reactionUsed = true;
      // PHB: Shield. +5 AC until the start of your next turn, including against the triggering attack.
      addEffect(reactor, {
        id: 'shield',
        name: 'Shield',
        sourceId: reactor.id,
        mod: { ac: 5 },
        expires: { turnOf: reactor.id, when: 'start', round: nextTurnRound(s, reactor.id) },
      });
      say(s, 'you', `${reactor.name} casts Shield (+5 AC)`);
    }
  } else if (p.kind === 'hellish-rebuke') {
    if (accept) {
      const h = heroOf(reactor)!;
      const lvl = slotsLeft(h).findIndex((n) => n > 0) + 1;
      reactor.reactionUsed = true;
      castSpell(ctx, reactor, {
        spellId: 'hellish-rebuke',
        slotLevel: lvl,
        targetIds: [p.attackerId],
      });
    }
  }
  if (s.plan) finishOrPause(ctx);
}
