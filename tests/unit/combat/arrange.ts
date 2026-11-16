// Shared helpers for combat rule tests: put creatures where we want them, try seeds.
import {
  getEncounter,
  readyParty,
  speedNow,
  startCombat,
  type CombatState,
  type Pos,
} from '../../../src/game/combat';
import type { Hero } from '../../../src/game/hero';
import { hero } from './helpers';

/** Put creatures where we want them and make `activeId` the one whose turn it is. */
export function arrange(
  s: CombatState,
  where: Record<string, Pos | null>,
  activeId: string,
): CombatState {
  const t = structuredClone(s);
  for (const [id, p] of Object.entries(where)) {
    if (!t.combatants[id]) continue;
    if (p) t.combatants[id]!.pos = p;
    else t.combatants[id]!.gone = true;
  }
  t.turnIndex = t.order.indexOf(activeId);
  const c = t.combatants[activeId]!;
  c.turn = {
    ...c.turn,
    actionUsed: false,
    bonusUsed: false,
    movement: speedNow(c),
    disengaged: false,
    attacked: false,
    attacksLeft: 0,
    extraActions: 0,
    sneakAttackUsed: false,
    lightWeaponUsed: null,
    bonusSpellCast: false,
    actionSpellCast: false,
  };
  t.prompt = null;
  t.plan = null;
  t.log = [];
  return t;
}
export const texts = (s: CombatState) => s.log.map((l) => l.text).join('\n');

/** A level-N party; the first hero is replaced by `lead` (already levelled with it). */
export function party(lead: Hero, level: number): Hero[] {
  return [
    lead,
    ...readyParty([hero('cleric', 'Thorn'), hero('rogue', 'Ilse'), hero('wizard', 'Wren')], level),
  ];
}
export const L = (
  cls: string,
  name: string,
  level: number,
  choices: Record<string, string[]> = {},
) => {
  const h = readyParty([hero(cls, name)], level)[0]!;
  return { ...h, choices: { ...h.choices, ...choices } };
};
export function fight(
  id: string,
  p: Hero[],
  seed = 1,
  opts: Partial<Parameters<typeof startCombat>[0]> = {},
) {
  return startCombat({
    encounter: getEncounter(id),
    party: p,
    difficulty: 'medium',
    rngState: seed,
    ...opts,
  });
}
/** Try seeds until `pred` holds for the result (dice are seeded, not scripted). */
export function withSeed(make: (seed: number) => CombatState, pred: (s: CombatState) => boolean) {
  for (let seed = 1; seed < 200; seed++) {
    const s = make(seed);
    if (pred(s)) return s;
  }
  throw new Error('no seed matched');
}
export const easyTarget = (s: CombatState, id: string) => {
  s.combatants[id]!.creature = { ...s.combatants[id]!.creature, ac: 1 };
};
