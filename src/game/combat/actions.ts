import { gear } from '../../data';
import { getMonster } from '../creatures';
import { getItem } from '../items';
import { casterNumbers, spiritAttack } from './spells';
import { resourceLeft, skillBonus, slotsLeft, type Hero } from '../hero';
import {
  abilityCheck,
  attackRoll,
  abilityModifier,
  addCondition,
  hasCondition,
  isDying,
  isIncapacitated,
  removeCondition,
  roll,
  SKILLS,
  stabilize,
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
  currentAc,
  dealDamage,
  get,
  hasEffect,
  healCombatant,
  heroOf,
  hostiles,
  produce,
  say,
  sayAll,
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
  | 'font-make-points'
  | 'rage-frenzy'
  | 'frenzy-attack'
  | 'flurry-prone'
  | 'flurry-push'
  | 'flurry-no-reactions'
  | 'sacred-weapon'
  | 'turn-the-unholy'
  | 'horde-breaker'
  | 'spiritual-weapon'
  | 'call-lightning'
  | 'heat-metal'
  | 'vampiric-touch'
  | 'wholeness-of-body'
  | 'move-mark';

export type PlayerAction =
  | { type: 'move'; to: Pos }
  | { type: 'attack'; targetId: string; optionId: string; smiteLevel?: number; stun?: boolean }
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

/** Uses the action, or an extra one from Action Surge. Returns false if none is left. */
/**
 * Use the action (or an extra one from Action Surge). `limited` actions (one weapon attack,
 * Dash, Disengage, Hide, Use an Object) can also use Haste's extra action (PHB: Haste).
 */
function spendAction(c: Combatant, limited = false): boolean {
  c.turn.inHasteAction = false;
  if (!c.turn.actionUsed) {
    c.turn.actionUsed = true;
    return true;
  }
  if (c.turn.extraActions > 0) {
    c.turn.extraActions -= 1;
    return true;
  }
  if (limited && c.turn.hasteAction) {
    c.turn.hasteAction = false;
    c.turn.inHasteAction = true;
    return true;
  }
  return false;
}
const actionFree = (c: Combatant) => !c.turn.actionUsed || c.turn.extraActions > 0;

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
    case 'parley':
      return parley(ctx, c);
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
  });
  return null;
}

/** Spend one attack of the Attack action, starting a new action if needed. */
function startAttack(c: Combatant): boolean {
  if (c.turn.attacksLeft > 0) {
    c.turn.attacksLeft -= 1;
    return true;
  }
  if (!spendAction(c, true)) return false;
  // Haste's extra action allows only one weapon attack.
  c.turn.attacksLeft = c.turn.inHasteAction ? 0 : usesExtraAttack(c) - 1;
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
/** Class features usable now. `s` (the fight) lets features look at other creatures. */
export function featureList(c: Combatant, s?: CombatState): FeatureInfo[] {
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
  // ── Level 3 subclass features ──
  if (lvl('barbarian') >= 3) {
    if (!hasEffect(c, 'rage'))
      out.push({
        id: 'rage-frenzy',
        name: 'Rage (Frenzy)',
        cost: 'bonus',
        detail: 'rage, and attack as a bonus action each turn; 1 exhaustion afterwards',
        blocked:
          h.equipment.armor && /plate|splint|chain-mail|ring/.test(h.equipment.armor)
            ? 'not in heavy armor'
            : bonus(res('rage')),
      });
    if (hasEffect(c, 'frenzy'))
      out.push({
        id: 'frenzy-attack',
        name: 'Frenzy attack',
        cost: 'bonus',
        detail: 'one melee weapon attack',
        target: 'enemy',
        blocked: bonus(),
      });
  }
  if (lvl('monk') >= 3) {
    const flurry = (id: FeatureId, name: string, detail: string) =>
      out.push({
        id,
        name,
        cost: 'bonus',
        detail: `${detail} · 1 ki`,
        target: 'enemy',
        blocked: bonus(t.attacked ? res('ki') : 'attack first'),
      });
    flurry('flurry-prone', 'Flurry: knock prone', 'two strikes; each hit: Dex save or prone');
    flurry('flurry-push', 'Flurry: push 15 ft', 'two strikes; each hit: Str save or pushed');
    flurry('flurry-no-reactions', 'Flurry: no reactions', 'two strikes; each hit stops reactions');
  }
  if (lvl('paladin') >= 3) {
    out.push({
      id: 'sacred-weapon',
      name: 'Sacred Weapon',
      cost: 'action',
      detail: `+${Math.max(1, abilityModifier(h.abilities.cha))} to weapon attacks for 1 minute · Channel Divinity`,
      blocked: action(hasEffect(c, 'sacred-weapon') ? 'already active' : res('channel-divinity')),
    });
    out.push({
      id: 'turn-the-unholy',
      name: 'Turn the Unholy',
      cost: 'action',
      detail: 'fiends and undead within 30 ft flee',
      blocked: action(res('channel-divinity')),
    });
  }
  if (lvl('ranger') >= 3 && h.choices['hunters-prey']?.includes('horde-breaker'))
    out.push({
      id: 'horde-breaker',
      name: 'Horde Breaker',
      cost: 'free',
      detail: 'one more attack on a creature next to your last target',
      target: 'enemy',
      blocked:
        t.attacked && !t.hordeUsed ? undefined : t.hordeUsed ? 'once per turn' : 'attack first',
    });
  if (lvl('monk') >= 6)
    out.push({
      id: 'wholeness-of-body',
      name: 'Wholeness of Body',
      cost: 'action',
      detail: `heal ${3 * lvl('monk')} HP · once per long rest`,
      blocked: action(res('wholeness-of-body')),
    });
  // PHB: Hex / Hunter's Mark. When the marked creature drops to 0 HP, move the mark to a new
  // creature as a bonus action [inferred: allowed on the same turn too].
  const markSpell = c.creature.concentration;
  if (s && (markSpell === 'hex' || markSpell === 'hunters-mark')) {
    const tag = markSpell === 'hex' ? 'hex-target' : 'hunters-mark-target';
    const marked = Object.values(s.combatants).some(
      (x) => conscious(x) && x.effects.some((e) => e.tag === tag && e.sourceId === c.id),
    );
    if (!marked)
      out.push({
        id: 'move-mark',
        name: markSpell === 'hex' ? 'Hex: curse a new target' : "Hunter's Mark: mark a new target",
        cost: 'bonus',
        detail: 'the last one dropped; move it without a new spell slot',
        target: 'enemy',
        blocked: bonus(),
      });
  }
  const lightning = c.effects.find((e) => e.tag === 'call-lightning');
  if (lightning)
    out.push({
      id: 'call-lightning',
      name: 'Call Lightning',
      cost: 'action',
      detail: `another bolt (${lightning.data?.dice} lightning, Dex save half) on an enemy and anyone within 5 ft`,
      target: 'enemy',
      blocked: action(),
    });
  if (hasEffect(c, 'heat-metal'))
    out.push({
      id: 'heat-metal',
      name: 'Heat Metal',
      cost: 'bonus',
      detail: 'burn the heated creature again (2d8 fire)',
      target: 'enemy',
      blocked: bonus(),
    });
  if (hasEffect(c, 'vampiric-touch'))
    out.push({
      id: 'vampiric-touch',
      name: 'Vampiric Touch',
      cost: 'action',
      detail: 'another draining touch (melee spell attack; heal half)',
      target: 'enemy',
      blocked: action(),
    });
  if (hasEffect(c, 'spiritual-weapon'))
    out.push({
      id: 'spiritual-weapon',
      name: 'Spiritual Weapon attack',
      cost: 'bonus',
      detail: 'the floating weapon strikes (melee spell attack)',
      target: 'enemy',
      blocked: bonus(),
    });
  return out;
}

function feature(
  ctx: Ctx,
  c: Combatant,
  id: FeatureId,
  targetId?: string,
): string | null | undefined {
  const { s, rng } = ctx;
  const info = featureList(c, ctx.s).find((f) => f.id === id);
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
      me(
        `Action Surge! ${c.name} gains one extra action: attack again, Dash to run further, Disengage, Dodge or cast.`,
      );
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
        // PHB: Destroy Undead (cleric 5): undead of CR 1/2 or lower that fail are destroyed.
        const cr = getMonster(u.monsterId!).cr;
        const crValue = cr.includes('/')
          ? Number(cr.split('/')[0]) / Number(cr.split('/')[1])
          : Number(cr);
        if (!r.success && classLevel(c, 'cleric') >= 5 && crValue <= 0.5) {
          u.creature = { ...u.creature, hp: 0, dead: true };
          say(s, 'crit', `${u.name} crumbles to dust (Destroy Undead)`);
          continue;
        }
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
    case 'rage-frenzy':
      spendResource(c, 'rage');
      addEffect(c, {
        id: 'rage',
        name: 'Rage',
        sourceId: c.id,
        tag: 'rage',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      // PHB: Berserker, Frenzy. A bonus-action melee attack each turn while raging; 1 exhaustion when it ends.
      addEffect(c, {
        id: 'frenzy',
        name: 'Frenzy',
        sourceId: c.id,
        tag: 'frenzy',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      s.flags = { ...s.flags, [`frenzied:${c.id}`]: true };
      me(`${c.name} flies into a frenzied rage!`);
      return null;
    case 'frenzy-attack': {
      const opt = attackOptions(c).find(
        (o) => o.kind === 'melee' && !o.unarmed && target && !attackBlocked(ctx, c, target, o),
      );
      if (!target || !opt) return 'No melee target in reach.';
      makeAttack(ctx, c, target, opt);
      return null;
    }
    case 'flurry-prone':
    case 'flurry-push':
    case 'flurry-no-reactions': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      const unarmed = attackOptions(c).find((o) => o.unarmed)!;
      const blocked = attackBlocked(ctx, c, target, unarmed);
      if (blocked) return blocked;
      spendResource(c, 'ki');
      // PHB: Way of the Open Hand, Open Hand Technique (save DC 8 + proficiency + Wis).
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
      for (let i = 0; i < 2 && conscious(target); i++) {
        const r = makeAttack(ctx, c, target, unarmed);
        if (!r.hit || !conscious(target)) continue;
        if (id === 'flurry-no-reactions') {
          target.reactionUsed = true;
          me(`${target.name} can't take reactions until the end of ${c.name}'s next turn`);
        } else if (id === 'flurry-prone') {
          if (!combatSave(ctx, target, 'dex', dc).success) {
            target.creature = addCondition(target.creature, { id: 'prone' });
            me(`${target.name} is knocked prone`);
          }
        } else if (!combatSave(ctx, target, 'str', dc).success) {
          const n = {
            x: target.pos.x + Math.sign(target.pos.x - c.pos.x) * 3,
            y: target.pos.y + Math.sign(target.pos.y - c.pos.y) * 3,
          };
          for (let k = 3; k > 0; k--) {
            const p = {
              x: target.pos.x + Math.sign(n.x - target.pos.x),
              y: target.pos.y + Math.sign(n.y - target.pos.y),
            };
            if (!reachable(s, target, 5).has(posKey(p))) break;
            target.pos = p;
          }
          me(`${target.name} is pushed away`);
        }
      }
      return null;
    }
    case 'sacred-weapon': {
      spendResource(c, 'channel-divinity');
      const cha = Math.max(1, abilityModifier(h.abilities.cha));
      addEffect(c, {
        id: 'sacred-weapon',
        name: 'Sacred Weapon',
        sourceId: c.id,
        tag: 'sacred-weapon',
        mod: { attack: cha },
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      me(`${c.name}'s weapon blazes with holy light (+${cha} to attack)`);
      return null;
    }
    case 'turn-the-unholy': {
      spendResource(c, 'channel-divinity');
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.cha);
      me(`${c.name} raises a holy symbol: Turn the Unholy (DC ${dc})`);
      for (const u of hostiles(s, c).filter(
        (x) =>
          x.monsterId &&
          ['undead', 'fiend'].includes(getMonster(x.monsterId).type) &&
          distanceFeet(x.pos, c.pos) <= 30,
      )) {
        if (!combatSave(ctx, u, 'wis', dc, { against: 'frightened', magic: true }).success)
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
    case 'horde-breaker': {
      // PHB: Hunter, Horde Breaker. Once per turn, attack another creature within 5 ft of the first target.
      const opt = attackOptions(c).find(
        (o) => !o.unarmed && target && !attackBlocked(ctx, c, target, o),
      );
      if (!target || !opt) return 'No target in range.';
      c.turn.hordeUsed = true;
      makeAttack(ctx, c, target, opt);
      return null;
    }
    case 'move-mark': {
      const spell = c.creature.concentration;
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (spell !== 'hex' && spell !== 'hunters-mark') return 'You are not concentrating on it.';
      const tag = spell === 'hex' ? 'hex-target' : 'hunters-mark-target';
      if (distanceFeet(c.pos, target.pos) > 90) return 'Too far (90 ft).';
      for (const x of Object.values(s.combatants))
        x.effects = x.effects.filter((e) => !(e.tag === tag && e.sourceId === c.id));
      addEffect(target, {
        id: tag,
        name: spell === 'hex' ? 'Hex' : "Hunter's Mark",
        sourceId: c.id,
        tag,
        concentration: spell,
      });
      me(`${c.name} moves ${spell === 'hex' ? 'the Hex' : "the Hunter's Mark"} to ${target.name}`);
      return null;
    }
    case 'wholeness-of-body': {
      // PHB: Way of the Open Hand, Wholeness of Body (level 6): heal 3 × monk level.
      spendResource(c, 'wholeness-of-body');
      healCombatant(ctx, c, 3 * classLevel(c, 'monk'), 'Wholeness of Body', c);
      return null;
    }
    case 'call-lightning': {
      // PHB: Call Lightning. A bolt hits a point; everyone within 5 ft makes a Dex save.
      if (!target) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 120) return 'Too far (120 ft).';
      const eff = c.effects.find((e) => e.tag === 'call-lightning')!;
      const dmg = roll(String(eff.data?.dice ?? '3d10'), ctx.rng);
      me(`${c.name} calls down a bolt of lightning: ${dmg.text}`);
      for (const t of Object.values(s.combatants).filter(
        (x) => !x.gone && !x.creature.dead && distanceFeet(x.pos, target.pos) <= 5,
      )) {
        const r = combatSave(ctx, t, 'dex', Number(eff.data?.dc ?? 10), { magic: true });
        dealDamage(
          ctx,
          t,
          [{ amount: r.success ? Math.floor(dmg.total / 2) : dmg.total, type: 'lightning' }],
          { attacker: c },
        );
      }
      return null;
    }
    case 'heat-metal': {
      const eff = c.effects.find((e) => e.tag === 'heat-metal')!;
      if (!target || target.id !== eff.data?.targetId) return 'Only the creature you heated.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far (60 ft).';
      c.turn.bonusUsed = true;
      const dmg = roll(String(eff.data?.dice ?? '2d8'), ctx.rng);
      me(`${c.name} makes the metal glow hotter: ${dmg.text} fire`);
      dealDamage(ctx, target, [{ amount: dmg.total, type: 'fire' }], { attacker: c });
      return null;
    }
    case 'vampiric-touch': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 5) return 'You must be next to it.';
      const eff = c.effects.find((e) => e.tag === 'vampiric-touch')!;
      const nums = casterNumbers(c);
      const r = attackRoll(c.creature, { ...target.creature, ac: currentAc(target) }, ctx.rng, {
        attackBonus: nums.attack,
        melee: true,
        within5ft: true,
        label: 'Vampiric Touch',
      });
      sayAll(s, [r.log], c);
      if (r.hit) {
        const dmg = roll(String(eff.data?.dice ?? '3d6'), ctx.rng);
        me(`Vampiric Touch: ${dmg.text} necrotic`);
        const dealt = dealDamage(
          ctx,
          target,
          [{ amount: dmg.total * (r.critical ? 2 : 1), type: 'necrotic' }],
          { attacker: c, critical: r.critical },
        );
        const healed = Math.floor(dealt / 2);
        if (healed) healCombatant(ctx, c, healed, 'Vampiric Touch', c);
      }
      return null;
    }
    case 'spiritual-weapon': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far for the spiritual weapon (60 ft).';
      spiritAttack(ctx, c, target);
      return null;
    }
  }
}

/**
 * Adventuring gear in a fight (PHB Chapter 5): throw a flask (alchemist's fire, holy water, acid)
 * or use a healer's kit. Thrown flasks are improvised weapons: Dex to hit, no proficiency, 20/60 ft.
 */
function applyGear(ctx: Ctx, c: Combatant, itemId: string, targetId: string): string | null {
  const { s } = ctx;
  const g = gear.find((x) => x.id === itemId)!;
  const use = g.use;
  if (!use) return `${g.name} isn't used in a fight.`;
  const target = s.combatants[targetId];
  if (!target) return 'Choose a target.';
  if (use.type === 'stabilize') {
    // PHB: Healer's Kit. Stabilize a creature at 0 HP without a Medicine check.
    if (target.side !== c.side) return 'Choose a dying ally.';
    if (!isDying(target.creature)) return `${target.name} isn't dying.`;
    if (distanceFeet(c.pos, target.pos) > 5) return 'You must be next to them.';
    if (!spendAction(c, true)) return 'No action left.';
    target.creature = stabilize(target.creature);
    say(s, 'you', `${c.name} uses a healer's kit on ${target.name}: stable (no check needed)`);
    return null;
  }
  if (target.side === c.side) return 'Throw it at an enemy.';
  const type = target.monsterId ? getMonster(target.monsterId).type : 'humanoid';
  if (use.onlyVs && !use.onlyVs.includes(type))
    return `${g.name} only harms ${use.onlyVs.join(' and ')}.`;
  const h = heroOf(c);
  const opt: AttackOption = {
    id: `throw-${g.id}`,
    name: g.name,
    kind: 'ranged',
    toHit: h ? abilityModifier(h.abilities.dex) : 0,
    reach: 5,
    range: [use.rangeFt, use.rangeFt * 3],
    damage: [{ dice: use.dice, type: use.damageType }],
    onHit: [],
    finesse: false,
    light: false,
    twoHanded: false,
    ability: 'none',
    monk: false,
    unarmed: false,
  };
  const blocked = attackBlocked(ctx, c, target, opt);
  if (blocked) return `Can't throw at ${target.name}: ${blocked}.`;
  if (!spendAction(c, true)) return 'No action left.';
  s.inventory = { ...s.inventory, [itemId]: s.inventory[itemId]! - 1 };
  say(s, 'you', `${c.name} throws ${g.name.toLowerCase()} at ${target.name}`);
  const r = makeAttack(ctx, c, target, opt);
  if (r.hit && use.burning && !target.creature.dead) {
    // PHB: Alchemist's Fire burns each turn until put out (DC 10 Dex). The target tries at the
    // end of each of its turns [inferred: monsters never spend an action on it].
    addEffect(target, {
      id: `burning-${c.id}`,
      name: "alchemist's fire",
      sourceId: c.id,
      tag: 'burning',
      data: { dice: use.dice, repeatSave: 'dex', dc: 10 },
    });
    say(s, 'dmg', `${target.name} is on fire`);
  }
  return null;
}

/** PHB: Use an Object. Drink a potion, or pour it down an adjacent ally's throat. */
function applyItem(ctx: Ctx, c: Combatant, itemId: string, targetId: string): string | null {
  const { s, rng } = ctx;
  if ((s.inventory[itemId] ?? 0) < 1) return 'None left.';
  if (gear.some((x) => x.id === itemId)) return applyGear(ctx, c, itemId, targetId);
  const item = getItem(itemId);
  if (!item.consumable) return `${item.name} isn't something you can use in a fight.`;
  const target = s.combatants[targetId];
  if (!target || target.side !== c.side) return 'Choose yourself or an ally.';
  if (target.id !== c.id && distanceFeet(c.pos, target.pos) > 5) return 'You must be next to them.';
  // PHB: Thief, Fast Hands. Use an object with Cunning Action (a bonus action).
  const fast = classLevel(c, 'rogue') >= 3 && !c.turn.bonusUsed;
  if (fast) c.turn.bonusUsed = true;
  else if (!spendAction(c, true)) return 'No action left.';
  s.inventory = { ...s.inventory, [itemId]: s.inventory[itemId]! - 1 };
  say(
    s,
    'you',
    `${c.name} uses ${item.name}${target.id !== c.id ? ` on ${target.name}` : ''}${fast ? ' (Fast Hands)' : ''}`,
  );
  for (const e of item.effects) {
    if (e.type === 'heal') {
      const r = roll(e.dice, rng);
      say(s, 'you', `${item.name}: ${r.text}`);
      healCombatant(ctx, target, r.total, item.name, c);
    } else if (e.type === 'special' && e.id === 'resistance-for-1-hour') {
      addEffect(target, {
        id: `resist-${e.note}`,
        name: `${item.name}`,
        sourceId: c.id,
        tag: 'resistance',
        data: { type: String(e.note) },
      });
      say(s, 'you', `${target.name} resists ${e.note} damage`);
    }
  }
  return null;
}

/** Talk the enemy down mid-fight (Story_Bible: Ulric). The speaker's own check, once per hero. */
function parley(ctx: Ctx, c: Combatant): string | null {
  const { s, rng } = ctx;
  const p = s.parley;
  if (!p) return 'There is no one here to talk down.';
  if (s.parleyTried.includes(c.id)) return `${c.name} has already tried.`;
  if (!spendAction(c)) return 'No action left.';
  s.parleyTried = [...s.parleyTried, c.id];
  const h = heroOf(c)!;
  const skills = p.skills.map((sk) => sk as Skill);
  const skill = skills.reduce((best, sk) => (skillBonus(h, sk) > skillBonus(h, best) ? sk : best));
  const dc = p.easierFlag && s.flags[p.easierFlag] ? (p.easierDc ?? p.dc) : p.dc;
  const ability = SKILLS[skill];
  const bonus = skillBonus(h, skill) - abilityModifier(h.abilities[ability]);
  const r = abilityCheck(h, ability, dc, rng, {
    label: skill[0]!.toUpperCase() + skill.slice(1),
    bonuses: bonus ? [{ label: 'skill', value: bonus }] : [],
  });
  say(s, 'you', `${c.name} tries to talk the fight down: ${r.log.text.replace(`${h.name} `, '')}`);
  if (r.success) {
    say(s, 'head', p.text);
    s.outcome = 'parley';
  } else say(s, 'info', 'The words don\u2019t land. The fight goes on.');
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
