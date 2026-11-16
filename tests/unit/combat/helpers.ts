import { buildHero, newDraft, type Hero, type HeroDraft } from '../../../src/game/hero';
import {
  act,
  active,
  advance,
  attackOptions,
  distanceFeet,
  getEncounter,
  posKey,
  reachable,
  readyParty,
  startCombat,
  targetsFor,
  type CombatState,
} from '../../../src/game/combat';
import type { DifficultyId } from '../../../src/data/schemas/difficulty';

export function hero(classId: string, name: string, patch: Partial<HeroDraft> = {}): Hero {
  const skills: Record<string, [string, string] | string[]> = {
    fighter: ['athletics', 'perception'],
    cleric: ['history', 'medicine'],
    rogue: ['acrobatics', 'perception', 'insight', 'investigation'],
    wizard: ['arcana', 'history'],
    barbarian: ['athletics', 'perception'],
    bard: ['arcana', 'history', 'insight'],
    monk: ['acrobatics', 'history'],
    paladin: ['athletics', 'insight'],
    ranger: ['athletics', 'nature', 'stealth'],
    sorcerer: ['arcana', 'insight'],
    druid: ['arcana', 'nature'],
  };
  const d: HeroDraft = {
    ...newDraft(classId),
    name,
    classSkills: (skills[classId] ?? ['arcana', 'history']) as never,
    fightingStyle: classId === 'fighter' ? 'defense' : null,
    expertise: classId === 'rogue' ? ['perception', 'insight'] : [],
    ...patch,
  };
  return buildHero(d, name.toLowerCase());
}

export const standardParty = (): Hero[] =>
  readyParty(
    [
      hero('fighter', 'Mira'),
      hero('cleric', 'Thorn'),
      hero('rogue', 'Ilse'),
      hero('wizard', 'Wren'),
    ],
    2,
  );

export function f2(
  difficulty: DifficultyId = 'medium',
  seed = 1,
  party = standardParty(),
): CombatState {
  return startCombat({
    encounter: getEncounter('f2-road-ambush'),
    party,
    difficulty,
    rngState: seed,
  });
}

/**
 * A simple party "player": attack someone in reach, else walk toward the nearest enemy and
 * attack, else end the turn. Accepts every reaction prompt.
 */
export function botTurn(s: CombatState): CombatState {
  if (s.prompt) return act(s, { type: 'react', accept: true }).state;
  const me = active(s);
  const enemies = Object.values(s.combatants).filter(
    (c) => c.side === 'enemy' && !c.gone && !c.creature.dead && c.creature.hp > 0,
  );
  const opts = attackOptions(me).filter((o) => !o.unarmed);
  for (const o of opts) {
    const t = targetsFor(s, me, o)[0];
    if (t) {
      const r = act(s, { type: 'attack', targetId: t, optionId: o.id });
      if (!r.error) return act(r.state, { type: 'end-turn' }).state;
    }
  }
  const nearest = enemies.sort(
    (a, b) => distanceFeet(me.pos, a.pos) - distanceFeet(me.pos, b.pos),
  )[0];
  if (nearest) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const [k, v] of reachable(s, me, me.turn.movement)) {
      const p = v.path.at(-1);
      if (p && distanceFeet(p, nearest.pos) < bestD) {
        bestD = distanceFeet(p, nearest.pos);
        best = k;
      }
    }
    if (best && best !== posKey(me.pos)) {
      const [x, y] = best.split(',').map(Number);
      const moved = act(s, { type: 'move', to: { x: x!, y: y! } });
      if (
        !moved.error &&
        !moved.state.prompt &&
        !moved.state.outcome &&
        active(moved.state).id === me.id
      ) {
        for (const o of opts) {
          const t = targetsFor(moved.state, me, o)[0];
          if (t) {
            const r = act(moved.state, { type: 'attack', targetId: t, optionId: o.id });
            if (!r.error)
              return r.state.outcome ? r.state : act(r.state, { type: 'end-turn' }).state;
          }
        }
        return act(moved.state, { type: 'end-turn' }).state;
      }
      if (!moved.error) return moved.state;
    }
  }
  return act(s, { type: 'end-turn' }).state;
}

/** Play a whole fight with the bot; returns the final state. */
export function playOut(s: CombatState, maxSteps = 2000): CombatState {
  let state = s;
  for (let i = 0; i < maxSteps && !state.outcome; i++) {
    if (state.prompt) state = act(state, { type: 'react', accept: true }).state;
    else if (active(state).side === 'enemy') state = advance(state);
    else state = botTurn(state);
  }
  return state;
}
