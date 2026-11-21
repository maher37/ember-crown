import { getMonster } from '../creatures';
import { resourceLeft, slotsLeft } from '../hero';
import { hasCondition, isIncapacitated, roll } from '../../rules';
import { applyHit, attackBlocked, attackOptions, makeAttack } from './attacks';
import {
  active,
  addEffect,
  canAct,
  spendResource,
  combatSave,
  currentAc,
  get,
  hasEffect,
  heroOf,
  produce,
  say,
  spendSlot,
  type Ctx,
  isSub,
  chargeWard,
} from './core';
import {
  coneCells,
  conscious,
  coverBetween,
  distanceFeet,
  hasLineOfSight,
  isAdjacent,
  reachable,
  terrainAt,
} from './grid';
import { applyLeaf, nextTurnRound } from './leaves';
import { castSpell, getSpell, spiritAttack } from './spells';
import { silenced } from './zones';
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
  // A breath-weapon monster wades into the nearest heroes on Hard too, so the cone matters [inferred].
  if (s.difficulty === 'medium' || me.recharge) return cost * 10 + t.creature.hp;
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

/** Build this enemy's whole turn: spells first (monsters with Spellcasting), then the rest. */
export function planTurn(ctx: Ctx, me: Combatant): PlanStep[] {
  const breath = breathPlan(ctx, me);
  if (breath) return [breath];
  const spell = casterPlan(ctx, me);
  if (spell.action) return spell.steps;
  return [...spell.steps, ...basePlan(ctx, me)];
}

/**
 * Spellcasting monsters (the cult fanatic Brother Ulric): Hold Person on a dangerous hero (Hard only),
 * Spiritual Weapon from round 2, Inflict Wounds up close, Sacred Flame at range [inferred tactics].
 */
function casterPlan(ctx: Ctx, me: Combatant): { steps: PlanStep[]; action: boolean } {
  const { s } = ctx;
  const none = { steps: [] as PlanStep[], action: false };
  const sc = me.monsterId ? getMonster(me.monsterId).spellcasting : undefined;
  const slots = me.monsterSlots;
  if (!sc || !canAct(me) || hasEffect(me, 'turned') || silenced(s, me)) return none;
  const known = Object.values(sc.spells).flat();
  const has = (id: string) => known.includes(id);
  const slot = (n: number) => (slots?.[n] ?? 0) > 0;
  const inRange = Object.values(s.combatants)
    .filter(
      (c) =>
        c.side !== me.side &&
        isTargetable(c) &&
        distanceFeet(me.pos, c.pos) <= 60 &&
        hasLineOfSight(s.map, me.pos, c.pos),
    )
    .sort(
      (a, b) =>
        targetScore(s, me, a, distanceFeet(me.pos, a.pos) / 5) -
        targetScore(s, me, b, distanceFeet(me.pos, b.pos) / 5),
    );
  if (!inRange.length) return none;
  const steps: PlanStep[] = [];
  let bonusSpell = false;
  if (hasEffect(me, 'spiritual-weapon'))
    steps.push({ type: 'spirit-attack', targetId: inRange[0]!.id });
  else if (has('spiritual-weapon') && slot(2) && s.round >= 2) {
    steps.push({
      type: 'cast',
      spellId: 'spiritual-weapon',
      slotLevel: 2,
      targetIds: [inRange[0]!.id],
    });
    bonusSpell = true;
  }
  const adjacent = inRange.find((c) => isAdjacent(c.pos, me.pos));
  // Mages (Maelis): Misty Step away from a melee hero (bonus action) [inferred tactics].
  if (adjacent && !bonusSpell && has('misty-step') && slot(2) && !me.turn.bonusUsed) {
    const away = [...reachable(s, { ...me, effects: [] }, 30).values()]
      .map((v) => v.path.at(-1))
      .filter(
        (p): p is Pos =>
          !!p &&
          !Object.values(s.combatants).some(
            (h) => h.side !== me.side && isTargetable(h) && distanceFeet(h.pos, p) <= 10,
          ),
      )
      .sort((a, b) => nearestHero(s, me, b) - nearestHero(s, me, a))[0];
    if (away) {
      steps.push({ type: 'cast', spellId: 'misty-step', slotLevel: 2, point: away });
      bonusSpell = true;
    }
  }
  // Fireball where it catches at least two heroes and no friends (one on Easy: never) [inferred].
  // Fireballs per fight: one on Medium, two on Hard, none on Easy [inferred tuning, M9].
  const fireballs = me.effects.filter((e) => e.tag === 'cast-fireball').length;
  const fireballCap = s.difficulty === 'hard' ? 2 : s.difficulty === 'medium' ? 1 : 0;
  if (has('fireball') && slot(3) && fireballs < fireballCap && !bonusSpell) {
    let best: { p: Pos; n: number } | null = null;
    for (const h of inRange) {
      const caught = Object.values(s.combatants).filter(
        (c) => !c.gone && !c.creature.dead && distanceFeet(c.pos, h.pos) <= 20,
      );
      if (caught.some((c) => c.side === me.side)) continue;
      const n = caught.filter((c) => isTargetable(c)).length;
      if (!best || n > best.n) best = { p: h.pos, n };
    }
    if (best && best.n >= 2) {
      me.effects.push({
        id: `cast-fireball-${fireballs}`,
        name: 'Fireball cast',
        sourceId: me.id,
        tag: 'cast-fireball',
      });
      steps.push({ type: 'cast', spellId: 'fireball', slotLevel: 3, point: best.p });
      return { steps, action: true };
    }
  }
  if (!bonusSpell && has('magic-missile') && slot(1)) {
    const weak = [...inRange].sort((a, b) => a.creature.hp - b.creature.hp)[0]!;
    if (weak.creature.hp <= 12) {
      steps.push({
        type: 'cast',
        spellId: 'magic-missile',
        slotLevel: 1,
        targetIds: [weak.id, weak.id, weak.id],
      });
      return { steps, action: true };
    }
  }
  if (has('fire-bolt') && (!adjacent || bonusSpell)) {
    steps.push({ type: 'cast', spellId: 'fire-bolt', slotLevel: 0, targetIds: [inRange[0]!.id] });
    return { steps, action: true };
  }
  // Priests (Sister Venna): Spirit Guardians once heroes close in (not on Easy [inferred]).
  if (
    !bonusSpell &&
    s.difficulty !== 'easy' &&
    has('spirit-guardians') &&
    slot(3) &&
    !me.creature.concentration &&
    inRange.some((c) => distanceFeet(c.pos, me.pos) <= 15)
  ) {
    steps.push({ type: 'cast', spellId: 'spirit-guardians', slotLevel: 3 });
    return { steps, action: true };
  }
  // Heal a badly hurt friend next to it (or itself).
  const hurt = Object.values(s.combatants).find(
    (c) =>
      c.side === me.side &&
      conscious(c) &&
      c.creature.hp <= c.creature.maxHp / 2 &&
      distanceFeet(c.pos, me.pos) <= 5,
  );
  if (!bonusSpell && hurt && has('cure-wounds') && slot(1)) {
    steps.push({ type: 'cast', spellId: 'cure-wounds', slotLevel: 1, targetIds: [hurt.id] });
    return { steps, action: true };
  }
  if (!bonusSpell && !adjacent && s.difficulty !== 'easy' && has('guiding-bolt') && slot(1)) {
    steps.push({
      type: 'cast',
      spellId: 'guiding-bolt',
      slotLevel: 1,
      targetIds: [inRange[0]!.id],
    });
    return { steps, action: true };
  }
  if (!adjacent && has('vicious-mockery')) {
    steps.push({
      type: 'cast',
      spellId: 'vicious-mockery',
      slotLevel: 0,
      targetIds: [inRange[0]!.id],
    });
    return { steps, action: true };
  }
  // PHB: Bonus Action casting. After a bonus-action spell, only a cantrip as the action.
  const holdTarget = inRange.find((c) => !hasCondition(c.creature, 'paralyzed') && heroOf(c));
  if (
    !bonusSpell &&
    s.difficulty === 'hard' &&
    has('hold-person') &&
    slot(2) &&
    !me.creature.concentration &&
    holdTarget
  ) {
    steps.push({ type: 'cast', spellId: 'hold-person', slotLevel: 2, targetIds: [holdTarget.id] });
    return { steps, action: true };
  }
  if (!bonusSpell && adjacent && has('inflict-wounds') && slot(1)) {
    steps.push({ type: 'cast', spellId: 'inflict-wounds', slotLevel: 1, targetIds: [adjacent.id] });
    return { steps, action: true };
  }
  if (!adjacent && has('sacred-flame')) {
    steps.push({
      type: 'cast',
      spellId: 'sacred-flame',
      slotLevel: 0,
      targetIds: [inRange[0]!.id],
    });
    return { steps, action: true };
  }
  return { steps, action: false };
}

/** A ready area action (Fire Breath) that catches at least two heroes, or one on Easy [inferred]. */
function breathPlan(ctx: Ctx, me: Combatant): PlanStep | null {
  const { s } = ctx;
  if (!me.monsterId || !me.recharge || !canAct(me) || hasEffect(me, 'turned')) return null;
  const m = getMonster(me.monsterId);
  for (const a of m.actions) {
    if (!a.area || !me.recharge[a.id]) continue;
    let best: { point: Pos; n: number } | null = null;
    for (const h of Object.values(s.combatants)) {
      if (h.side === me.side || !isTargetable(h)) continue;
      const cells = coneCells(s.map, me.pos, h.pos, a.area.size);
      const caught = Object.values(s.combatants).filter(
        (c) => !c.gone && !c.creature.dead && cells.some((p) => p.x === c.pos.x && p.y === c.pos.y),
      );
      // Only heroes still standing count: breathing on the fallen would be cruel [inferred].
      const n =
        caught.filter((c) => c.side !== me.side && isTargetable(c)).length -
        caught.filter((c) => c.side === me.side).length;
      if (!best || n > best.n) best = { point: h.pos, n };
    }
    if (best && best.n >= (s.difficulty === 'easy' ? 1 : 2))
      return { type: 'area-action', actionId: a.id, point: best.point };
    if (best && best.n >= 1 && s.round >= 3)
      return { type: 'area-action', actionId: a.id, point: best.point };
  }
  return null;
}

/** MM: a monster's area action (a cone of fire). One damage roll for everyone (PHB: Areas of Effect). */
function areaAction(ctx: Ctx, me: Combatant, actionId: string, point: Pos): void {
  const { s, rng } = ctx;
  const a = getMonster(me.monsterId!).actions.find((x) => x.id === actionId)!;
  me.turn.actionUsed = true;
  me.recharge = { ...me.recharge, [a.id]: false };
  say(s, 'foe', `${me.name} uses ${a.name}!`);
  const cells = coneCells(s.map, me.pos, point, a.area!.size);
  const caught = Object.values(s.combatants).filter(
    (c) =>
      c.id !== me.id &&
      !c.gone &&
      !c.creature.dead &&
      cells.some((p) => p.x === c.pos.x && p.y === c.pos.y),
  );
  for (const e of a.effects) {
    if (e.type !== 'save') continue;
    const preRolled = new Map();
    for (const x of e.onFail) if (x.type === 'damage') preRolled.set(x, roll(x.dice, rng));
    for (const t of caught) {
      const r = combatSave(ctx, t, e.ability, e.dc ?? 10);
      if (!r.success) for (const x of e.onFail) applyLeaf(ctx, me, t, x, { preRolled });
      else if (e.onSuccess === 'half')
        for (const x of e.onFail)
          if (x.type === 'damage') applyLeaf(ctx, me, t, x, { preRolled, half: true });
    }
  }
  if (!caught.length) say(s, 'info', `${a.name} catches no one`);
}

function basePlan(ctx: Ctx, me: Combatant): PlanStep[] {
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
      // MM: Multiattack. Every melee attack in the list, at the same target (the next one if it drops).
      const multi = me.monsterId ? getMonster(me.monsterId).multiattack : undefined;
      const hits = multi?.length
        ? multi.flatMap((id) => {
            const opt = opts.find((x) => x.id === id && x.kind === 'melee');
            return opt ? [opt] : [];
          })
        : [melee];
      return [
        ...steps,
        ...(hits.length ? hits : [melee]).map((opt): PlanStep => ({
          type: 'attack',
          targetId: target.id,
          optionId: opt.id,
        })),
      ];
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
    } else if (step.type === 'cast') {
      const targets = (step.targetIds ?? []).map((id) => s.combatants[id]);
      const healing = step.spellId === 'cure-wounds';
      const ok = targets.every((t) => t && (healing ? conscious(t) : isTargetable(t)));
      // PHB: Counterspell. A party caster within 60 ft may stop the spell.
      if (ok && !step.asked && !step.countered) {
        step.asked = true;
        const reactor = Object.values(s.combatants).find((p) => {
          const h = heroOf(p);
          return (
            h &&
            p.side !== me.side &&
            h.spells.includes('counterspell') &&
            slotsLeft(h).some((n, i) => i >= 2 && n > 0) &&
            !p.reactionUsed &&
            canAct(p) &&
            distanceFeet(p.pos, me.pos) <= 60 &&
            hasLineOfSight(s.map, p.pos, me.pos)
          );
        });
        if (reactor) {
          s.prompt = {
            kind: 'counterspell',
            reactorId: reactor.id,
            casterId: me.id,
            spellId: step.spellId,
          };
          return;
        }
      }
      if (step.countered) {
        const sp = getSpell(step.spellId);
        if (sp.castingTime === 'bonus') me.turn.bonusUsed = true;
        else me.turn.actionUsed = true;
        if (step.slotLevel > 0) spendSlot(me, step.slotLevel);
        say(s, 'foe', `${me.name}'s ${sp.name} fizzles (countered)`);
      } else if (ok) castSpell(ctx, me, step);
      plan.steps.shift();
    } else if (step.type === 'area-action') {
      areaAction(ctx, me, step.actionId, step.point);
      plan.steps.shift();
    } else if (step.type === 'spirit-attack') {
      const t = s.combatants[step.targetId];
      if (t && isTargetable(t) && distanceFeet(me.pos, t.pos) <= 60) spiritAttack(ctx, me, t);
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
      giantKiller(ctx, me, target);
      return false;
    }
    // PHB: Lore bard, Cutting Words. Reaction: subtract a Bardic Inspiration die from the roll.
    const bard = Object.values(s.combatants).find((p) => {
      const bh = heroOf(p);
      return (
        bh &&
        p.side !== me.side &&
        isSub(p, 'bard', 'lore', 3) &&
        resourceLeft(bh, 'bardic-inspiration') > 0 &&
        !p.reactionUsed &&
        canAct(p) &&
        distanceFeet(p.pos, me.pos) <= 60 &&
        r.natural !== 20 &&
        r.total - (bh.level >= 5 ? 8 : 6) < currentAc(target!)
      );
    });
    if (bard) {
      s.prompt = {
        kind: 'cutting-words',
        reactorId: bard.id,
        attackerId: me.id,
        targetId: target.id,
        total: r.total,
      };
      return true;
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
    if (r.natural !== 20 && r.total < currentAc(target)) {
      say(
        s,
        'you',
        target.effects.some((e) => e.name === 'Shield')
          ? `The attack glances off ${target.name}'s Shield (${r.total} vs AC ${currentAc(target)}) → MISS`
          : `The attack falls short of ${target.name} (${r.total} vs AC ${currentAc(target)}) → MISS`,
      );
      giantKiller(ctx, me, target);
      return false;
    }
    const hpBefore = target.creature.hp + target.creature.tempHp;
    applyHit(ctx, me, target, opt, r.critical);
    giantKiller(ctx, me, target);
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

/** PHB: Hunter, Giant Killer. A Large or bigger attacker within 5 ft gets a reaction attack [used automatically]. */
function giantKiller(ctx: Ctx, me: Combatant, target: Combatant): void {
  const h = heroOf(target);
  if (!h?.choices['hunters-prey']?.includes('giant-killer') || !me.monsterId) return;
  if (!['Large', 'Huge'].includes(getMonster(me.monsterId).size)) return;
  if (target.reactionUsed || !canAct(target) || !conscious(me) || !isAdjacent(me.pos, target.pos))
    return;
  const opt = meleeOption(target);
  if (!opt) return;
  target.reactionUsed = true;
  say(ctx.s, 'you', `${target.name} strikes back (Giant Killer)`);
  makeAttack(ctx, target, me, opt);
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
      chargeWard(s, reactor, lvl);
    }
  } else if (p.kind === 'counterspell') {
    if (accept && step?.type === 'cast') {
      const h = heroOf(reactor)!;
      const lvl = slotsLeft(h).findIndex((n, i) => i >= 2 && n > 0) + 1;
      spendSlot(reactor, lvl);
      reactor.reactionUsed = true;
      step.countered = true;
      say(s, 'you', `${reactor.name} casts Counterspell (level ${lvl} slot)!`);
    }
  } else if (p.kind === 'cutting-words') {
    if (accept && step?.type === 'attack' && step.roll) {
      const h = heroOf(reactor)!;
      spendResource(reactor, 'bardic-inspiration');
      reactor.reactionUsed = true;
      const sides = h.level >= 5 ? 8 : 6;
      const d = ctx.rng.die(sides);
      step.roll = { ...step.roll, total: step.roll.total - d };
      say(
        s,
        'you',
        `${reactor.name} heckles with Cutting Words: d${sides} (${d}) → the attack is now ${step.roll.total}`,
      );
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

function nearestHero(s: CombatState, me: Combatant, p: Pos): number {
  return Math.min(
    ...Object.values(s.combatants)
      .filter((c) => c.side !== me.side && isTargetable(c))
      .map((c) => distanceFeet(c.pos, p)),
  );
}
