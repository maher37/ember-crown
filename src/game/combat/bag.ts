import { getMonster, monsterToCreature } from '../creatures';
import type { Hero } from '../hero';
import { roll } from '../../rules';
import { spendAction } from './basics';
import { heroOf, say, type Ctx } from './core';
import { freeNear } from './familiars';
import { makeCombatant } from './turn';
import type { Combatant } from './types';

export const BAG_ID = 'wixs-clan-gift';
/** DMG: Bag of Tricks. Three uses, back at dawn (here: after a long rest; SRD 5.1). */
export const BAG_USES = 3;

/** DMG: Bag of Tricks (gray). d8 → the beast that comes out (checked against SRD 5.1, Nov 24). */
export const BAG_TABLE = [
  'weasel',
  'giant-rat',
  'badger',
  'boar',
  'panther',
  'giant-badger',
  'dire-wolf',
  'giant-elk',
] as const;

/** Is this hero carrying the bag (in a trinket slot)? */
export const holdsBag = (h: Hero) => h.equipment.magic.includes(BAG_ID);
export const bagUsesLeft = (h: Hero) => BAG_USES - (h.resourcesUsed[BAG_ID] ?? 0);

/** Why the bag can't be used now, or null. */
export function bagProblem(c: Combatant): string | null {
  const h = heroOf(c);
  if (!h || !holdsBag(h)) return 'not carrying the bag';
  if (bagUsesLeft(h) < 1) return 'empty until a long rest';
  if (c.turn.actionUsed && c.turn.extraActions < 1) return 'no action left';
  return null;
}

/**
 * DMG: Bag of Tricks (Wix's Clan Gift, D36). An action: pull out a fuzzy ball and it becomes a
 * random beast (d8) that fights for the party until the fight ends or it drops. It appears next to
 * the user (RAW: thrown up to 20 ft) and acts right after them, controlled by the player
 * (owner, Nov 23: BG3 style; RAW it obeys bonus-action commands) [inferred simplifications].
 */
export function openBag(ctx: Ctx, c: Combatant): string | null {
  const { s, rng } = ctx;
  const problem = bagProblem(c);
  if (problem) return `Can't use the bag: ${problem}.`;
  const pos = freeNear(s, c.pos);
  if (!pos) return 'No free space next to you.';
  spendAction(c);
  const h = heroOf(c)!;
  c.creature = {
    ...h,
    resourcesUsed: { ...h.resourcesUsed, [BAG_ID]: (h.resourcesUsed[BAG_ID] ?? 0) + 1 },
  };
  const r = roll('1d8', rng);
  const m = getMonster(BAG_TABLE[r.total - 1]!);
  const n = Object.values(s.combatants).filter((x) => x.pet?.kind === 'bag').length + 1;
  const id = `${c.id}-bag-${n}`;
  const name = `${m.name} from the bag`;
  const beast = makeCombatant(
    id,
    name,
    m.name[0]!.toLowerCase(),
    c.side,
    pos,
    monsterToCreature(m, id, name),
    m.speed.walk,
  );
  beast.monsterId = m.id;
  beast.initiative = c.initiative;
  beast.pet = { kind: 'bag', ownerId: c.id, canAttack: true };
  s.combatants[id] = beast;
  // It takes its turn right after the user.
  const at = s.order.indexOf(c.id);
  s.order = [...s.order.slice(0, at + 1), id, ...s.order.slice(at + 1)];
  if (s.turnIndex > at) s.turnIndex += 1;
  say(
    s,
    'you',
    `${c.name} pulls a fuzzy ball from Wix's Clan Gift: d8 (${r.total}) → ${m.name.toLowerCase()}! (${bagUsesLeft(c.creature as Hero)} left)`,
  );
  return null;
}
