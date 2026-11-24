// A hero's actions on their turn: the `act` entry point, movement, attacks, shove and grapple.
// Split across modules (R1): basics.ts (action bookkeeping, Dodge, Hide), featureList.ts (which
// class features are usable), features.ts (using them), items.ts (gear, potions, parley).

import { getMonster } from '../creatures';
import { heroAc } from '../items';
import { deriveEquipment, setLabel, switchSet } from '../loadout';
import { slotsLeft } from '../hero';
import {
  abilityCheck,
  abilityModifier,
  addCondition,
  hasCondition,
  isIncapacitated,
  removeCondition,
  SKILLS,
  type Skill,
} from '../../rules';
import { attackBlocked, attackOptions, makeAttack, type AttackOption } from './attacks';
import {
  active,
  addEffect,
  canAct,
  classLevel,
  get,
  heroOf,
  hostiles,
  produce,
  say,
  type Ctx,
} from './core';
import { conscious, isAdjacent, posKey, reachable } from './grid';
import { nextTurnRound } from './leaves';
import { castProblem, castSpell, type CastRequest } from './spells';
import { continuePlan, resolvePrompt } from './ai';
import { moveAlong, nextTurn, settle, speedNow } from './turn';
import type { CombatState, Combatant, Pos } from './types';
import {
  actionFree,
  dodge,
  hexedOn,
  hide,
  hideProblem,
  offhandWeapons,
  spendAction,
  startAttack,
} from './basics';
import { featureList, type FeatureId, type FeatureInfo } from './featureList';
import { feature } from './features';
import { applyItem, parley } from './items';
import { openBag } from './bag';

export type PlayerAction =
  | { type: 'move'; to: Pos }
  | {
      type: 'attack';
      targetId: string;
      optionId: string;
      smiteLevel?: number;
      stun?: boolean;
      maneuver?: 'trip' | 'push';
    }
  | { type: 'offhand'; targetId: string; optionId: string }
  | ({ type: 'cast' } & CastRequest)
  | { type: 'dash' | 'disengage' | 'dodge' | 'hide' | 'stand' }
  | { type: 'help'; allyId: string }
  | { type: 'shove'; targetId: string; mode: 'prone' | 'push' }
  | { type: 'grapple'; targetId: string }
  | { type: 'feature'; id: FeatureId; targetId?: string }
  | { type: 'end-turn' }
  | { type: 'use-item'; itemId: string; targetId: string }
  | { type: 'parley' }
  /** Pull a beast out of Wix's Clan Gift (Bag of Tricks). */
  | { type: 'bag' }
  /** Switch weapon sets (main and off hand): free, once a turn. */
  | { type: 'swap-weapons' }
  | { type: 'react'; accept: boolean };

export interface ActResult {
  state: CombatState;
  error?: string;
}

/** Do one thing on the active party member's turn (or answer a reaction prompt). */
export function act(state: CombatState, a: PlayerAction): ActResult {
  if (state.outcome) return { state, error: 'The fight is over.' };
  if (state.prompt && a.type !== 'react') return { state, error: 'Answer the reaction first.' };
  if (a.type === 'react') {
    if (!state.prompt) return { state, error: 'Nothing to react to.' };
    return {
      state: produce(state, (ctx) => {
        resolvePrompt(ctx, a.accept);
        settle(ctx.s);
      }),
    };
  }
  const me = state.combatants[state.order[state.turnIndex]!]!;
  if (me.side !== 'party') return { state, error: "It isn't your turn." };
  let error: string | undefined;
  const next = produce(state, (ctx) => {
    const c = active(ctx.s);
    error = perform(ctx, c, a) ?? undefined;
    // A hero knocked out on their own turn (walking into Spirit Guardians, say) can't go on:
    // their turn ends at once.
    const now = active(ctx.s);
    if (!error && !ctx.s.outcome && !ctx.s.prompt && now.id === c.id && !canAct(now)) {
      say(ctx.s, 'info', `${c.name} can't go on; the turn ends.`);
      nextTurn(ctx);
    }
    settle(ctx.s);
  });
  return error ? { state, error } : { state: next };
}

function perform(ctx: Ctx, c: Combatant, a: PlayerAction): string | null | undefined {
  const { s } = ctx;
  // Ending the turn is always allowed, even for a hero who just dropped (balance-sim bug, M10).
  if (a.type === 'end-turn') {
    say(s, 'info', `${c.name} ends the turn.`);
    nextTurn(ctx);
    return null;
  }
  if (!canAct(c)) return `${c.name} can't act.`;
  switch (a.type) {
    case 'move': {
      const routes = reachable(
        s,
        c,
        c.turn.movement * (hasCondition(c.creature, 'prone') ? 0.5 : 1),
      );
      const route = routes.get(posKey(a.to));
      if (!route || !route.path.length) return "You can't move there.";
      const r = moveAlong(ctx, c, route.path);
      if (r.result === 'stopped') say(s, 'info', `${c.name}'s movement is cut short.`);
      afterSomething(ctx);
      return null;
    }
    case 'attack':
    case 'offhand':
      return doAttack(ctx, c, a);
    case 'cast': {
      const problem = castProblem(ctx, c, a);
      if (problem) return problem;
      if (c.wildShape) return "Beasts can't cast spells.";
      castSpell(ctx, c, a);
      afterSomething(ctx);
      return null;
    }
    case 'dash':
      if (!spendAction(c, true)) return 'No action left.';
      c.turn.movement += speedNow(c);
      say(s, 'you', `${c.name} dashes (+${speedNow(c)} ft)`);
      return null;
    case 'disengage':
      if (!spendAction(c, true)) return 'No action left.';
      c.turn.disengaged = true;
      say(s, 'you', `${c.name} disengages`);
      return null;
    case 'dodge':
      if (!spendAction(c)) return 'No action left.';
      dodge(s, c);
      return null;
    case 'hide': {
      if (!actionFree(c)) return 'No action left.';
      const why = hideProblem(s, c);
      if (why) return why;
      spendAction(c);
      hide(ctx, c);
      return null;
    }
    case 'stand': {
      if (!hasCondition(c.creature, 'prone')) return "You're already standing.";
      // PHB: Being Prone. Standing up costs half your speed.
      const cost = Math.ceil(speedNow(c) / 2);
      if (c.turn.movement < cost) return 'Not enough movement left to stand.';
      c.turn.movement -= cost;
      c.creature = removeCondition(c.creature, 'prone');
      say(s, 'you', `${c.name} stands up`);
      return null;
    }
    case 'help': {
      const ally = s.combatants[a.allyId];
      if (!ally || ally.side !== c.side || ally.id === c.id) return 'Choose an ally to help.';
      if (!spendAction(c)) return 'No action left.';
      // PHB: Help. The ally's next attack (before your next turn) has advantage.
      addEffect(ally, {
        id: `help-${c.id}`,
        name: 'Help',
        sourceId: c.id,
        tag: 'help',
        expires: { turnOf: c.id, when: 'start', round: nextTurnRound(s, c.id) },
      });
      say(s, 'you', `${c.name} helps ${ally.name}: advantage on the next attack`);
      return null;
    }
    case 'shove':
    case 'grapple':
      return shoveOrGrapple(ctx, c, a);
    case 'feature':
      return feature(ctx, c, a.id, a.targetId);
    case 'use-item':
      return applyItem(ctx, c, a.itemId, a.targetId);
    case 'bag':
      return openBag(ctx, c);
    case 'parley':
      return parley(ctx, c);
    case 'swap-weapons': {
      // PHB: you can draw or stow a weapon for free once a turn; we let that switch the whole set
      // [inferred: like Baldur's Gate's weapon sets].
      const h = heroOf(c);
      if (!h) return 'Only heroes switch weapon sets.';
      const lo = h.equipment.loadout;
      if (!lo) return 'No second weapon set.';
      if (c.turn.swappedWeapons) return 'Already switched weapons this turn.';
      c.turn.swappedWeapons = true;
      const next = { ...h, equipment: deriveEquipment(switchSet(lo)) };
      next.ac = heroAc(next);
      c.creature = next;
      say(
        s,
        'you',
        `${c.name} switches to ${setLabel(next.equipment.loadout!, next.equipment.loadout!.active)}`,
      );
      return null;
    }
  }
}

function afterSomething(ctx: Ctx): void {
  void ctx;
}

function doAttack(
  ctx: Ctx,
  c: Combatant,
  a: Extract<PlayerAction, { type: 'attack' | 'offhand' }>,
): string | null {
  const { s } = ctx;
  const target = s.combatants[a.targetId];
  if (!target || target.side === c.side) return 'Choose an enemy to attack.';
  const opt = attackOptions(c).find((o) => o.id === a.optionId);
  if (!opt) return 'Unknown attack.';
  const blocked = attackBlocked(ctx, c, target, opt);
  if (blocked) return blocked;
  if (a.type === 'offhand') {
    // PHB: Two-Weapon Fighting. After attacking with a light melee weapon, attack with a
    // different light melee weapon as a bonus action.
    if (c.turn.bonusUsed) return 'Bonus action used.';
    if (!c.turn.lightWeaponUsed) return 'Attack with a light melee weapon first.';
    if (!opt.light || opt.kind !== 'melee' || !offhandWeapons(c).includes(opt.id))
      return 'You need a second light weapon.';
    c.turn.bonusUsed = true;
    makeAttack(ctx, c, target, opt, { offhand: true });
    return null;
  }
  if (
    a.smiteLevel &&
    (classLevel(c, 'paladin') < 2 || (slotsLeft(heroOf(c)!)[a.smiteLevel - 1] ?? 0) < 1)
  )
    return 'No slot for Divine Smite.';
  if (!startAttack(c)) return 'No attacks left this turn.';
  c.turn.attacked = true;
  if (opt.light && opt.kind === 'melee') c.turn.lightWeaponUsed = opt.id;
  makeAttack(ctx, c, target, opt, {
    smiteLevel: a.smiteLevel,
    stun: a.type === 'attack' ? a.stun : undefined,
    maneuver: a.type === 'attack' ? a.maneuver : undefined,
  });
  return null;
}

/** PHB: Shoving a Creature / Grappling. Athletics against Athletics or Acrobatics. */
function shoveOrGrapple(
  ctx: Ctx,
  c: Combatant,
  a: Extract<PlayerAction, { type: 'shove' | 'grapple' }>,
): string | null {
  const { s, rng } = ctx;
  const target = s.combatants[a.targetId];
  if (!target || target.side === c.side || !conscious(target)) return 'Choose an enemy.';
  if (!isAdjacent(c.pos, target.pos)) return 'Too far away: you must be next to it.';
  if (!startAttack(c)) return 'No attacks left this turn.';
  c.turn.attacked = true;
  const bonus = (x: Combatant, skill: Skill) => {
    const h = heroOf(x);
    const mod = abilityModifier(x.creature.abilities[SKILLS[skill]]);
    if (h)
      return (
        mod +
        (h.expertise.includes(skill) ? 2 : h.skills.includes(skill) ? 1 : 0) * h.proficiencyBonus
      );
    return x.monsterId ? (getMonster(x.monsterId).skills[skill] ?? mod) : mod;
  };
  const mine = abilityCheck(c.creature, 'str', 0, rng, {
    label: 'Athletics',
    disadvantage: hexedOn(c, 'str') ? ['Hex'] : [],
    bonuses: [
      { label: 'skill', value: bonus(c, 'athletics') - abilityModifier(c.creature.abilities.str) },
    ],
  });
  const skill: Skill =
    bonus(target, 'acrobatics') > bonus(target, 'athletics') ? 'acrobatics' : 'athletics';
  const ab = SKILLS[skill];
  const theirs = abilityCheck(target.creature, ab, 0, rng, {
    label: skill === 'acrobatics' ? 'Acrobatics' : 'Athletics',
    // PHB: Hex. Disadvantage on checks with the cursed ability.
    disadvantage: hexedOn(target, ab) ? ['Hex'] : [],
    bonuses: [
      {
        label: 'skill',
        value: bonus(target, skill) - abilityModifier(target.creature.abilities[ab]),
      },
    ],
  });
  const win = mine.total > theirs.total;
  const verb = a.type === 'grapple' ? 'grapple' : 'shove';
  say(
    s,
    'you',
    `${c.name} tries to ${verb} ${target.name}: Athletics ${mine.total} vs ${skill} ${theirs.total} → ${win ? 'SUCCESS' : 'FAIL'}`,
  );
  if (!win) return null;
  if (a.type === 'grapple') {
    target.creature = addCondition(target.creature, { id: 'grappled', source: c.id });
    say(s, 'dmg', `${target.name} is grappled`);
  } else if (a.mode === 'prone') {
    target.creature = addCondition(target.creature, { id: 'prone' });
    say(s, 'dmg', `${target.name} is knocked prone`);
  } else {
    const n = {
      x: target.pos.x + Math.sign(target.pos.x - c.pos.x),
      y: target.pos.y + Math.sign(target.pos.y - c.pos.y),
    };
    const free = reachable(s, target, 5).has(posKey(n));
    if (free) {
      target.pos = n;
      say(s, 'dmg', `${target.name} is pushed 5 ft`);
    }
  }
  return null;
}

/** Everyone the active hero could attack with each option right now. */
export function targetsFor(state: CombatState, c: Combatant, opt: AttackOption): string[] {
  const ctx = { s: state, rng: { die: () => 1 } };
  return hostiles(state, c)
    .filter((t) => !attackBlocked(ctx, c, t, opt))
    .map((t) => t.id);
}

export { continuePlan, get, isIncapacitated };

export { featureList, offhandWeapons, hideProblem, type FeatureId, type FeatureInfo };
export { dodge, hide };
