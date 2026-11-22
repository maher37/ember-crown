// Combat screen logic with no markup: aiming modes, valid targets, the "More" menu.

import { getMonster } from '../../game/creatures';
import { heroOf } from '../../game/combat/core';
import { getGear } from '../../game/gear';
import { getItem } from '../../game/items';
import {
  castProblem,
  distanceFeet,
  hideProblem,
  offhandWeapons,
  targeting,
  targetsFor,
  type AttackOption,
  type Combatant,
  type CombatState,
  type FeatureId,
  type Metamagic,
  type PlayerAction,
  type SpellChoice,
} from '../../game/combat';
import type { Hero } from '../../game/hero';
import { hasCondition, SeededRng } from '../../rules';

export type Mode =
  | { kind: 'idle' }
  | { kind: 'attack'; optionId: string; offhand?: boolean }
  | { kind: 'spell'; spellId: string; level: number; targets: string[]; mm?: Metamagic }
  | { kind: 'item'; itemId: string }
  | { kind: 'feature'; id: FeatureId; target: 'ally' | 'enemy' }
  | { kind: 'help' }
  | { kind: 'shove'; mode: 'prone' | 'push' }
  | { kind: 'grapple' };

/** A hero (not a monster ally the player controls, like the militia, Ser Ida or conjured wolves). */
export const isHero = (c: Combatant): c is Combatant & { creature: Hero } =>
  c.side === 'party' && !!heroOf(c);

/** Which tokens can be clicked in the current mode. */
export function validTargetsFor(
  s: CombatState,
  me: Combatant,
  myTurn: boolean,
  mode: Mode,
  options: AttackOption[],
  spells: SpellChoice[],
  myLevel: number,
): Set<string> {
  if (!myTurn) return new Set<string>();
  const all = Object.values(s.combatants).filter((c) => !c.gone && !c.creature.dead);
  if (mode.kind === 'attack') {
    const opt = options.find((o) => o.id === mode.optionId);
    return new Set(opt ? targetsFor(s, me, opt) : []);
  }
  if (mode.kind === 'shove' || mode.kind === 'grapple')
    return new Set(
      all
        .filter(
          (c) =>
            c.side === 'enemy' &&
            Math.max(Math.abs(c.pos.x - me.pos.x), Math.abs(c.pos.y - me.pos.y)) === 1,
        )
        .map((c) => c.id),
    );
  if (mode.kind === 'help')
    return new Set(all.filter((c) => c.side === 'party' && c.id !== me.id).map((c) => c.id));
  if (mode.kind === 'item' && getGear(mode.itemId)?.use?.type === 'throw') {
    const use = getGear(mode.itemId)!.use as { rangeFt: number; onlyVs?: string[] };
    return new Set(
      all
        .filter(
          (c) =>
            c.side === 'enemy' &&
            distanceFeet(c.pos, me.pos) <= use.rangeFt * 3 &&
            (!use.onlyVs ||
              use.onlyVs.includes(c.monsterId ? getMonster(c.monsterId).type : 'humanoid')),
        )
        .map((c) => c.id),
    );
  }
  if (mode.kind === 'item' && getGear(mode.itemId)?.use?.type === 'stabilize')
    return new Set(
      all
        .filter(
          (c) =>
            c.side === 'party' &&
            c.creature.hp === 0 &&
            !c.creature.stable &&
            Math.abs(c.pos.x - me.pos.x) <= 1 &&
            Math.abs(c.pos.y - me.pos.y) <= 1,
        )
        .map((c) => c.id),
    );
  if (mode.kind === 'item')
    return new Set(
      all
        .filter(
          (c) =>
            c.side === 'party' &&
            (c.id === me.id ||
              (Math.abs(c.pos.x - me.pos.x) <= 1 && Math.abs(c.pos.y - me.pos.y) <= 1)),
        )
        .map((c) => c.id),
    );
  if (mode.kind === 'feature')
    return new Set(
      all
        .filter((c) => (mode.target === 'ally' ? c.side === 'party' : c.side === 'enemy'))
        .map((c) => c.id),
    );
  if (mode.kind === 'spell') {
    const sp = spells.find((x) => x.spell.id === mode.spellId)?.spell;
    if (!sp) return new Set<string>();
    const t = targeting(sp, mode.level, mode.mm, myLevel);
    if (t.kind !== 'creatures') return new Set<string>();
    return new Set(
      all
        .filter(
          (c) =>
            !castProblem({ s, rng: new SeededRng(1) }, me, {
              spellId: sp.id,
              slotLevel: mode.level,
              targetIds: [c.id],
              metamagic: mode.mm,
            }),
        )
        .map((c) => c.id),
    );
  }
  return new Set<string>();
}

export interface MoreAction {
  label: string;
  detail: string;
  onClick: () => void;
  blocked?: string;
}

export type FightGear = { g: NonNullable<ReturnType<typeof getGear>>; n: number };

/** The entries of the "More" menu: parley, potions, gear, Help, Hide, shove, grapple, stand, off-hand. */
export function moreActionsFor({
  s,
  me,
  hero,
  actionLeft,
  potions,
  fightGear,
  options,
  doAct,
  setMode,
}: {
  s: CombatState;
  me: Combatant;
  hero: (Combatant & { creature: Hero }) | null;
  actionLeft: boolean;
  potions: [string, number][];
  fightGear: FightGear[];
  options: AttackOption[];
  doAct: (a: PlayerAction) => string | undefined;
  setMode: (m: Mode) => void;
}): MoreAction[] {
  return [
    ...(s.parley
      ? [
          {
            label: 'Talk them down',
            detail: `${s.parley.skills.join(' or ')} check · uses your action · once each`,
            onClick: () => doAct({ type: 'parley' }),
            blocked: s.parleyTried.includes(me.id)
              ? 'already tried'
              : actionLeft
                ? undefined
                : 'no action left',
          },
        ]
      : []),
    ...potions.map(([id, n]) => ({
      label: `${getItem(id).name} (${n})`,
      detail: 'drink it, or give it to an adjacent ally · action',
      onClick: () => setMode({ kind: 'item', itemId: id }),
      blocked:
        actionLeft ||
        (hero &&
          hero.creature.classId === 'rogue' &&
          hero.creature.level >= 3 &&
          !me.turn.bonusUsed)
          ? undefined
          : 'no action left',
    })),
    ...fightGear.map(({ g, n }) => ({
      label:
        g.use!.type === 'stabilize'
          ? `${g.name}: stabilize`
          : `Throw ${g.name.toLowerCase()} (${n})`,
      detail:
        g.use!.type === 'stabilize'
          ? 'a dying ally next to you becomes stable · action'
          : `${g.use!.type === 'throw' ? `${g.use!.dice} ${g.use!.damageType}` : ''}${
              g.use!.type === 'throw' && g.use!.onlyVs ? ` vs ${g.use!.onlyVs.join('/')}` : ''
            } · ${g.use!.type === 'throw' ? g.use!.rangeFt : 5} ft · action`,
      onClick: () => setMode({ kind: 'item', itemId: g.id }),
      blocked: actionLeft ? undefined : 'no action left',
    })),
    {
      label: 'Help',
      detail: 'an ally gets advantage on their next attack',
      onClick: () => setMode({ kind: 'help' }),
    },
    {
      label: 'Hide',
      detail: 'Stealth vs passive Perception',
      onClick: () => doAct({ type: 'hide' }),
      blocked: hideProblem(s, me) ?? undefined,
    },
    {
      label: 'Shove: knock prone',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'shove', mode: 'prone' }),
    },
    {
      label: 'Shove: push 5 ft',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'shove', mode: 'push' }),
    },
    {
      label: 'Grapple',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'grapple' }),
    },
    {
      label: 'Stand up',
      detail: 'costs half your speed',
      onClick: () => doAct({ type: 'stand' }),
      blocked: hasCondition(me.creature, 'prone') ? undefined : 'not prone',
    },
    ...offhandWeapons(me).map((id) => ({
      label: `Off-hand: ${options.find((o) => o.id === id)?.name}`,
      detail: 'bonus action',
      onClick: () => setMode({ kind: 'attack', optionId: id, offhand: true }),
      blocked: me.turn.bonusUsed
        ? 'bonus action used'
        : me.turn.lightWeaponUsed
          ? undefined
          : 'attack with a light weapon first',
    })),
  ];
}

export function targetBanner(
  mode: Mode,
  options: { id: string; name: string }[],
  spells: { spell: { id: string; name: string } }[],
): string | null {
  switch (mode.kind) {
    case 'idle':
      return null;
    case 'attack':
      return `Choose a target for ${options.find((o) => o.id === mode.optionId)?.name ?? 'the attack'}.`;
    case 'spell':
      return `${spells.find((x) => x.spell.id === mode.spellId)?.spell.name}: choose ${mode.targets.length ? 'more targets or cast now' : 'a target or a square'}.`;
    case 'feature':
      return `Choose ${mode.target === 'ally' ? 'an ally' : 'an enemy'}.`;
    case 'help':
      return 'Choose an ally to help.';
    case 'shove':
      return 'Choose an enemy next to you to shove.';
    case 'grapple':
      return 'Choose an enemy next to you to grapple.';
    case 'item':
      return 'Choose who drinks it: yourself or an ally next to you.';
  }
}
