import { getMonster, monsterToCreature } from '../creatures';
import { familiarId, familiarOf, hasChain } from '../familiar';
import type { Hero } from '../hero';
import { blocksMovement, inBounds, occupant, terrainAt } from './grid';
import type { CombatState, Combatant, Pos } from './types';

type Make = (
  id: string,
  name: string,
  short: string,
  side: Combatant['side'],
  pos: Pos,
  creature: Combatant['creature'],
  speed: number,
) => Combatant;

/** The nearest free, walkable square to `p` (rings outward), or null if none. */
function freeNear(s: CombatState, p: Pos): Pos | null {
  for (let r = 1; r <= 3; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const q = { x: p.x + dx, y: p.y + dy };
        if (!inBounds(s.map, q) || blocksMovement(terrainAt(s.map, q)) || occupant(s, q)) continue;
        return q;
      }
  return null;
}

/**
 * PHB: Find Familiar. Each hero's familiar starts the fight next to them, on the party's side and
 * controlled by the player (owner, Nov 23: Baldur's Gate 3 style; it rolls its own initiative).
 * A wizard's familiar can't attack; a Pact of the Chain familiar can (owner, Nov 23 [inferred: RAW
 * it attacks with the warlock's reaction]).
 */
export function placeFamiliars(s: CombatState, party: Hero[], make: Make): void {
  for (const h of party) {
    const fam = familiarOf(h);
    if (!fam || fam.lost || h.dead) continue;
    const at = s.combatants[h.id]?.pos;
    const pos = at && freeNear(s, at);
    if (!pos) continue;
    const m = getMonster(fam.form);
    const id = familiarId(h.id);
    const name = `${h.name}'s ${m.name.toLowerCase()}`;
    // Flying familiars move at their flying speed (the grid has no height).
    const speed = Math.max(m.speed.walk, m.speed.fly ?? 0);
    const c = make(
      id,
      name,
      m.name[0]!.toLowerCase(),
      'party',
      pos,
      monsterToCreature(m, id, name),
      speed,
    );
    c.monsterId = m.id;
    c.pet = { kind: 'familiar', ownerId: h.id, canAttack: hasChain(h) };
    s.combatants[id] = c;
  }
}

/** Heroes whose familiar was killed in this fight: it's gone until a long rest. */
export function familiarsAfterFight(
  s: CombatState,
  party: Hero[],
): { party: Hero[]; notes: string[] } {
  const notes: string[] = [];
  const out = party.map((h) => {
    const c = s.combatants[familiarId(h.id)];
    const fam = familiarOf(h);
    if (!c?.pet || c.creature.hp > 0 || !fam) return h;
    notes.push(`${c.name} is gone. It comes back after a long rest.`);
    return { ...h, familiar: { form: fam.form, lost: true } };
  });
  return { party: out, notes };
}
