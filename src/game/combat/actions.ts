import { getMonster } from '../creatures';
import { resourceLeft, slotsLeft, type Hero } from '../hero';
import {
  abilityCheck,
  abilityModifier,
  addCondition,
  hasCondition,
  isIncapacitated,
  removeCondition,
  roll,
  SKILLS,
  type Skill,
} from '../../rules';
import { attackBlocked, attackOptions, makeAttack, type AttackOption } from './attacks';
import {
  active,
  addEffect,
  allies,
  canAct,
  classLevel,
  combatSave,
  get,
  hasEffect,
  healCombatant,
  heroOf,
  hostiles,
  produce,
  say,
  spendResource,
  type Ctx,
} from './core';
import {
  conscious,
  coverBetween,
  distanceFeet,
  isAdjacent,
  posKey,
  reachable,
  terrainAt,
} from './grid';
import { nextTurnRound } from './leaves';
import { castProblem, castSpell, type CastRequest } from './spells';
import { continuePlan, resolvePrompt } from './ai';
import {
  moveAlong,
  nextTurn,
  passivePerception,
  settle,
  speedNow,
  stealthBonus,
  usesExtraAttack,
} from './turn';
import type { CombatState, Combatant, Pos } from './types';

export type FeatureId =
  | 'second-wind'
  | 'action-surge'
  | 'rage'
  | 'reckless'
  | 'bardic-inspiration'
  | 'preserve-life'
  | 'turn-undead'
  | 'wild-shape'
  | 'revert'
  | 'lay-on-hands'
  | 'flurry'
  | 'martial-arts'
  | 'patient-defense'
  | 'step-dash'
  | 'step-disengage'
  | 'cunning-dash'
  | 'cunning-disengage'
  | 'cunning-hide'
  | 'font-create-slot'
  | 'font-make-points';

export type PlayerAction =
  | { type: 'move'; to: Pos }
  | { type: 'attack'; targetId: string; optionId: string; smiteLevel?: number }
  | { type: 'offhand'; targetId: string; optionId: string }
  | ({ type: 'cast' } & CastRequest)
  | { type: 'dash' | 'disengage' | 'dodge' | 'hide' | 'stand' }
  | { type: 'help'; allyId: string }
  | { type: 'shove'; targetId: string; mode: 'prone' | 'push' }
  | { type: 'grapple'; targetId: string }
  | { type: 'feature'; id: FeatureId; targetId?: string }
  | { type: 'end-turn' }
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
    settle(ctx.s);
  });
  return error ? { state, error } : { state: next };
}

/** Uses the action, or an extra one from Action Surge. Returns false if none is left. */
function spendAction(c: Combatant): boolean {
  if (!c.turn.actionUsed) {
    c.turn.actionUsed = true;
    return true;
  }
  if (c.turn.extraActions > 0) {
    c.turn.extraActions -= 1;
    return true;
  }
  return false;
}
const actionFree = (c: Combatant) => !c.turn.actionUsed || c.turn.extraActions > 0;

function perform(ctx: Ctx, c: Combatant, a: PlayerAction): string | null | undefined {
  const { s } = ctx;
  if (!canAct(c)) return `${c.name} can't act.`;
  switch (a.type) {
    case 'end-turn':
      say(s, 'info', `${c.name} ends the turn.`);
      nextTurn(ctx);
      return null;
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
      if (!spendAction(c)) return 'No action left.';
      c.turn.movement += speedNow(c);
      say(s, 'you', `${c.name} dashes (+${speedNow(c)} ft)`);
      return null;
    case 'disengage':
      if (!spendAction(c)) return 'No action left.';
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
  makeAttack(ctx, c, target, opt, { smiteLevel: a.smiteLevel });
  return null;
}

/** Spend one attack of the Attack action, starting a new action if needed. */
function startAttack(c: Combatant): boolean {
  if (c.turn.attacksLeft > 0) {
    c.turn.attacksLeft -= 1;
    return true;
  }
  if (!spendAction(c)) return false;
  c.turn.attacksLeft = usesExtraAttack(c) - 1;
  return true;
}

/** Light melee weapons a hero carries two of (or two different ones). */
export function offhandWeapons(c: Combatant): string[] {
  const h = heroOf(c);
  if (!h) return [];
  const light = attackOptions(c).filter((o) => o.light && o.kind === 'melee' && o.weaponId);
  const counts = new Map<string, number>();
  for (const w of h.equipment.weapons) counts.set(w, (counts.get(w) ?? 0) + 1);
  return light
    .filter((o) => (o.id === c.turn.lightWeaponUsed ? (counts.get(o.id) ?? 0) > 1 : true))
    .map((o) => o.id);
}

export function dodge(s: CombatState, c: Combatant): void {
  // PHB: Dodge. Attacks against you have disadvantage; advantage on Dex saves.
  addEffect(c, {
    id: 'dodge',
    name: 'Dodge',
    sourceId: c.id,
    tag: 'dodge',
    expires: { turnOf: c.id, when: 'start', round: nextTurnRound(s, c.id) },
  });
  say(s, c.side === 'party' ? 'you' : 'foe', `${c.name} takes the Dodge action`);
}

/**
 * Hiding needs somewhere to hide: brush, or at least half cover from every enemy that is
 * still up [inferred grid version of "heavily obscured or out of sight"].
 */
export function hideProblem(s: CombatState, c: Combatant): string | null {
  if (terrainAt(s.map, c.pos) === 'brush') return null;
  const exposed = hostiles(s, c).some(
    (h) => coverBetween(s, h.pos, c.pos, [h.id, c.id]) === 'none',
  );
  return exposed ? 'Nowhere to hide: stand in brush or behind cover.' : null;
}

/** PHB: Hide. Stealth against each enemy's passive Perception. */
export function hide(ctx: Ctx, c: Combatant): void {
  const { s, rng } = ctx;
  const bonus = stealthBonus(c);
  const r = abilityCheck(c.creature, 'dex', 0, rng, {
    label: 'Stealth',
    bonuses: [{ label: 'skill', value: bonus - abilityModifier(c.creature.abilities.dex) }],
  });
  const best = Math.max(0, ...hostiles(s, c).map(passivePerception));
  const ok = r.total >= best;
  say(
    s,
    c.side === 'party' ? 'you' : 'foe',
    `${c.name} tries to hide: Stealth ${r.roll.dice.join('/')} + ${bonus} = ${r.total} vs passive Perception ${best} → ${ok ? 'HIDDEN' : 'SEEN'}`,
  );
  if (ok) addEffect(c, { id: 'hidden', name: 'Hidden', sourceId: c.id, tag: 'hidden' });
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
    bonuses: [
      { label: 'skill', value: bonus(c, 'athletics') - abilityModifier(c.creature.abilities.str) },
    ],
  });
  const skill: Skill =
    bonus(target, 'acrobatics') > bonus(target, 'athletics') ? 'acrobatics' : 'athletics';
  const ab = SKILLS[skill];
  const theirs = abilityCheck(target.creature, ab, 0, rng, {
    label: skill === 'acrobatics' ? 'Acrobatics' : 'Athletics',
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

// ── Class features through level 2 ──

export interface FeatureInfo {
  id: FeatureId;
  name: string;
  cost: 'action' | 'bonus' | 'free';
  detail: string;
  /** Needs a target: an ally or an enemy. */
  target?: 'ally' | 'enemy';
  blocked?: string;
}

const left = (c: Combatant, id: string) => resourceLeft(heroOf(c)!, id);

/** The class features a hero can use in combat right now. */
export function featureList(c: Combatant): FeatureInfo[] {
  const h = heroOf(c);
  if (!h) return [];
  const out: FeatureInfo[] = [];
  const t = c.turn;
  const bonus = (b?: string) => b ?? (t.bonusUsed ? 'bonus action used' : undefined);
  const action = (b?: string) => b ?? (actionFree(c) ? undefined : 'action used');
  const lvl = (cls: string) => (h.classId === cls ? h.level : 0);
  const res = (id: string, n = 1) => (left(c, id) >= n ? undefined : 'none left');

  if (lvl('fighter')) {
    out.push({
      id: 'second-wind',
      name: 'Second Wind',
      cost: 'bonus',
      detail: `heal 1d10+${h.level} · ${left(c, 'second-wind')} left`,
      blocked: bonus(res('second-wind')),
    });
    if (h.level >= 2)
      out.push({
        id: 'action-surge',
        name: 'Action Surge',
        cost: 'free',
        detail: `extra action · ${left(c, 'action-surge')} left`,
        blocked: res('action-surge'),
      });
  }
  if (lvl('barbarian')) {
    const raging = hasEffect(c, 'rage');
    out.push({
      id: 'rage',
      name: raging ? 'Raging' : 'Rage',
      cost: 'bonus',
      detail: `+2 damage, resist weapons · ${left(c, 'rage')} left`,
      blocked: raging
        ? 'already raging'
        : h.equipment.armor && /plate|splint|chain-mail|ring/.test(h.equipment.armor)
          ? 'not in heavy armor'
          : bonus(res('rage')),
    });
    if (h.level >= 2)
      out.push({
        id: 'reckless',
        name: 'Reckless Attack',
        cost: 'free',
        detail: 'advantage now; enemies get advantage on you',
        blocked: t.attacked
          ? 'only before your first attack'
          : hasEffect(c, 'reckless')
            ? 'already reckless'
            : undefined,
      });
  }
  if (lvl('bard'))
    out.push({
      id: 'bardic-inspiration',
      name: 'Bardic Inspiration',
      cost: 'bonus',
      detail: `give an ally a d${h.level >= 5 ? 8 : 6} · ${left(c, 'bardic-inspiration')} left`,
      target: 'ally',
      blocked: bonus(res('bardic-inspiration')),
    });
  if (lvl('cleric') >= 2) {
    out.push({
      id: 'preserve-life',
      name: 'Preserve Life',
      cost: 'action',
      detail: `share ${5 * h.level} HP of healing · Channel Divinity ${left(c, 'channel-divinity')}`,
      blocked: action(res('channel-divinity')),
    });
    out.push({
      id: 'turn-undead',
      name: 'Turn Undead',
      cost: 'action',
      detail: 'undead within 30 ft flee',
      blocked: action(res('channel-divinity')),
    });
  }
  if (lvl('druid') >= 2) {
    if (c.wildShape)
      out.push({
        id: 'revert',
        name: 'Leave beast form',
        cost: 'bonus',
        detail: 'return to your normal form',
        blocked: bonus(),
      });
    else
      out.push({
        id: 'wild-shape',
        name: 'Wild Shape: Wolf',
        cost: 'action',
        detail: `become a wolf (11 HP) · ${left(c, 'wild-shape')} left`,
        blocked: action(res('wild-shape')),
      });
  }
  if (lvl('paladin'))
    out.push({
      id: 'lay-on-hands',
      name: 'Lay on Hands',
      cost: 'action',
      detail: `heal by touch · ${left(c, 'lay-on-hands')} HP in pool`,
      target: 'ally',
      blocked: action(res('lay-on-hands')),
    });
  if (lvl('monk')) {
    const monkHit = t.attacked;
    out.push({
      id: 'martial-arts',
      name: 'Martial Arts strike',
      cost: 'bonus',
      detail: 'unarmed strike after attacking',
      target: 'enemy',
      blocked: bonus(monkHit ? undefined : 'attack first'),
    });
    if (h.level >= 2) {
      out.push({
        id: 'flurry',
        name: 'Flurry of Blows',
        cost: 'bonus',
        detail: `two unarmed strikes · 1 ki (${left(c, 'ki')} left)`,
        target: 'enemy',
        blocked: bonus(monkHit ? res('ki') : 'attack first'),
      });
      out.push({
        id: 'patient-defense',
        name: 'Patient Defense',
        cost: 'bonus',
        detail: 'Dodge · 1 ki',
        blocked: bonus(res('ki')),
      });
      out.push({
        id: 'step-dash',
        name: 'Step of the Wind: Dash',
        cost: 'bonus',
        detail: '1 ki',
        blocked: bonus(res('ki')),
      });
      out.push({
        id: 'step-disengage',
        name: 'Step of the Wind: Disengage',
        cost: 'bonus',
        detail: '1 ki',
        blocked: bonus(res('ki')),
      });
    }
  }
  if (lvl('rogue') >= 2) {
    out.push({
      id: 'cunning-dash',
      name: 'Cunning Action: Dash',
      cost: 'bonus',
      detail: 'bonus-action Dash',
      blocked: bonus(),
    });
    out.push({
      id: 'cunning-disengage',
      name: 'Cunning Action: Disengage',
      cost: 'bonus',
      detail: 'bonus-action Disengage',
      blocked: bonus(),
    });
    out.push({
      id: 'cunning-hide',
      name: 'Cunning Action: Hide',
      cost: 'bonus',
      detail: 'bonus-action Hide',
      blocked: bonus(),
    });
  }
  if (lvl('sorcerer') >= 2) {
    out.push({
      id: 'font-create-slot',
      name: 'Font of Magic: make a slot',
      cost: 'bonus',
      detail: `2 sorcery points → 1st-level slot (${left(c, 'sorcery-points')} pts)`,
      blocked: bonus(res('sorcery-points', 2)),
    });
    out.push({
      id: 'font-make-points',
      name: 'Font of Magic: make points',
      cost: 'bonus',
      detail: 'spend a slot for sorcery points',
      blocked: bonus(slotsLeft(h).some((n) => n > 0) ? undefined : 'no slots'),
    });
  }
  return out;
}

function feature(
  ctx: Ctx,
  c: Combatant,
  id: FeatureId,
  targetId?: string,
): string | null | undefined {
  const { s, rng } = ctx;
  const info = featureList(c).find((f) => f.id === id);
  if (!info) return "You don't have that feature.";
  if (info.blocked) return `${info.name}: ${info.blocked}.`;
  const h = heroOf(c) as Hero;
  const target = targetId ? s.combatants[targetId] : undefined;
  if (info.target && !target) return 'Choose a target.';
  if (info.cost === 'bonus') c.turn.bonusUsed = true;
  if (info.cost === 'action' && !spendAction(c)) return 'No action left.';
  const me = (text: string) => say(s, 'you', text);

  switch (id) {
    case 'second-wind': {
      // PHB: Second Wind. Regain 1d10 + fighter level HP.
      spendResource(c, 'second-wind');
      const r = roll(`1d10+${h.level}`, rng);
      me(`Second Wind: ${r.text}`);
      healCombatant(ctx, c, r.total, 'Second Wind', c);
      return null;
    }
    case 'action-surge':
      spendResource(c, 'action-surge');
      c.turn.extraActions += 1;
      me(`Action Surge! ${c.name} gains one extra action.`);
      return null;
    case 'rage':
      spendResource(c, 'rage');
      addEffect(c, {
        id: 'rage',
        name: 'Rage',
        sourceId: c.id,
        tag: 'rage',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      me(`${c.name} flies into a rage!`);
      return null;
    case 'reckless':
      addEffect(c, {
        id: 'reckless',
        name: 'Reckless Attack',
        sourceId: c.id,
        tag: 'reckless',
        expires: { turnOf: c.id, when: 'start', round: s.round + 1 },
      });
      me(`${c.name} attacks recklessly`);
      return null;
    case 'bardic-inspiration': {
      if (!target || target.side !== c.side || target.id === c.id)
        return 'Choose another party member.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far away (60 ft).';
      spendResource(c, 'bardic-inspiration');
      target.inspiration = h.level >= 5 ? 8 : 6;
      me(`${c.name} inspires ${target.name} (d${target.inspiration})`);
      return null;
    }
    case 'preserve-life': {
      // PHB: Preserve Life. Share 5 × cleric level HP among creatures within 30 ft, each up to half its max.
      spendResource(c, 'channel-divinity');
      let pool = 5 * h.level;
      const hurt = [
        c,
        ...allies(s, c),
        ...Object.values(s.combatants).filter(
          (x) => x.side === c.side && !x.creature.dead && x.creature.hp === 0,
        ),
      ]
        .filter((x, i, arr) => arr.indexOf(x) === i && distanceFeet(c.pos, x.pos) <= 30)
        .sort((a, b) => a.creature.hp / a.creature.maxHp - b.creature.hp / b.creature.maxHp);
      me(`${c.name} channels Preserve Life (${pool} HP)`);
      for (const x of hurt) {
        const cap = Math.max(0, Math.floor(x.creature.maxHp / 2) - x.creature.hp);
        const amount = Math.min(cap, pool);
        if (amount > 0) {
          healCombatant(ctx, x, amount, 'Preserve Life', c);
          pool -= amount;
        }
      }
      return null;
    }
    case 'turn-undead': {
      spendResource(c, 'channel-divinity');
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
      me(`${c.name} presents a holy symbol: Turn Undead (DC ${dc})`);
      for (const u of hostiles(s, c).filter(
        (x) =>
          x.monsterId &&
          getMonster(x.monsterId).type === 'undead' &&
          distanceFeet(x.pos, c.pos) <= 30,
      )) {
        const r = combatSave(ctx, u, 'wis', dc, { against: 'frightened', magic: true });
        if (!r.success)
          addEffect(u, {
            id: 'turned',
            name: 'Turned',
            sourceId: c.id,
            tag: 'turned',
            expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
          });
      }
      return null;
    }
    case 'wild-shape': {
      // PHB: Wild Shape (v1: wolf only [inferred simplification]).
      spendResource(c, 'wild-shape');
      const wolf = getMonster('wolf');
      c.wildShape = { monsterId: 'wolf', hp: wolf.hp, maxHp: wolf.hp };
      if (c.creature.concentration)
        me(`${c.name} keeps concentrating on ${c.creature.concentration}`);
      c.turn.movement = Math.max(
        c.turn.movement,
        wolf.speed.walk - (speedNow({ ...c, wildShape: undefined }) - c.turn.movement),
      );
      me(`${c.name} becomes a wolf!`);
      return null;
    }
    case 'revert':
      c.wildShape = undefined;
      me(`${c.name} returns to their own form`);
      return null;
    case 'lay-on-hands': {
      if (!target || target.side !== c.side) return 'Choose a party member.';
      if (distanceFeet(c.pos, target.pos) > 5) return 'You must touch them (5 ft).';
      const need = target.creature.maxHp - target.creature.hp;
      const amount = Math.min(need, left(c, 'lay-on-hands'));
      if (amount <= 0) return `${target.name} is not hurt.`;
      spendResource(c, 'lay-on-hands', amount);
      healCombatant(ctx, target, amount, 'Lay on Hands', c);
      return null;
    }
    case 'martial-arts':
    case 'flurry': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      const unarmed = attackOptions(c).find((o) => o.unarmed)!;
      const blocked = attackBlocked(ctx, c, target, unarmed);
      if (blocked) return blocked;
      if (id === 'flurry') spendResource(c, 'ki');
      const n = id === 'flurry' ? 2 : 1;
      for (let i = 0; i < n && conscious(target); i++) makeAttack(ctx, c, target, unarmed);
      return null;
    }
    case 'patient-defense':
      spendResource(c, 'ki');
      dodge(s, c);
      return null;
    case 'step-dash':
    case 'cunning-dash':
      if (id === 'step-dash') spendResource(c, 'ki');
      c.turn.movement += speedNow(c);
      me(`${c.name} dashes (bonus action)`);
      return null;
    case 'step-disengage':
    case 'cunning-disengage':
      if (id === 'step-disengage') spendResource(c, 'ki');
      c.turn.disengaged = true;
      me(`${c.name} disengages (bonus action)`);
      return null;
    case 'cunning-hide': {
      const why = hideProblem(s, c);
      if (why) {
        c.turn.bonusUsed = false;
        return why;
      }
      hide(ctx, c);
      return null;
    }
    case 'font-create-slot': {
      // PHB: Font of Magic. 2 sorcery points make a 1st-level slot.
      spendResource(c, 'sorcery-points', 2);
      const hero = heroOf(c)!;
      const used = [...hero.slotsUsed];
      used[0] = (used[0] ?? 0) - 1;
      c.creature = { ...hero, slotsUsed: used };
      me(`${c.name} shapes 2 sorcery points into a 1st-level spell slot`);
      return null;
    }
    case 'font-make-points': {
      const hero = heroOf(c)!;
      const lvlIdx = slotsLeft(hero).findIndex((n) => n > 0);
      const used = [...hero.slotsUsed];
      used[lvlIdx] = (used[lvlIdx] ?? 0) + 1;
      const spent = hero.resourcesUsed['sorcery-points'] ?? 0;
      c.creature = {
        ...hero,
        slotsUsed: used,
        resourcesUsed: {
          ...hero.resourcesUsed,
          'sorcery-points': Math.max(0, spent - (lvlIdx + 1)),
        },
      };
      me(`${c.name} turns a level-${lvlIdx + 1} slot into ${lvlIdx + 1} sorcery point(s)`);
      return null;
    }
  }
}

/** Everyone the active hero could attack with each option right now. */
export function targetsFor(state: CombatState, c: Combatant, opt: AttackOption): string[] {
  const ctx = { s: state, rng: { die: () => 1 } };
  return hostiles(state, c)
    .filter((t) => !attackBlocked(ctx, c, t, opt))
    .map((t) => t.id);
}

export { continuePlan, get, isIncapacitated };
