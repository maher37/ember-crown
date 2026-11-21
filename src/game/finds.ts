// Exploring (src/data/finds.json): things to notice at a place with passive Perception, a
// careful search (a Perception check), and chests to open (locks, traps, loot). Pure functions;
// the dice are seeded and every roll is logged.
import { finds } from '../data';
import type { Find } from '../data/schemas/town';
import {
  abilityCheck,
  abilityModifier,
  roll,
  savingThrow,
  SKILLS,
  type RandomSource,
  type Skill,
} from '../rules';
import { toDate } from './calendar';
import { bestFor, checkBonus } from './dialogue';
import { itemName } from './gear';
import { skillBonus, type Hero } from './hero';
import { hasSpecial, itemMods } from './items';
import { completeStep, startQuest } from './journal';
import { holds } from './placeMaps';
import type { GameState } from './save';

export const getFind = (id: string): Find => {
  const f = finds.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown find "${id}"`);
  return f;
};

const awake = (g: GameState) => g.party.filter((h) => !h.dead && h.hp > 0);

/** Finds that exist at this place right now (act reached, story conditions met). */
export const findsAt = (g: GameState, placeId: string): Find[] =>
  finds.filter((f) => f.place === placeId && (f.act ?? 1) <= g.act && holds(g, f.requires));

/** Finds the party has noticed here (and not yet emptied, except merchants who stay). */
export const seenFinds = (g: GameState, placeId: string) =>
  findsAt(g, placeId).filter((f) => g.finds?.[f.id] === 'seen' || g.finds?.[f.id] === 'done');

/**
 * PHB: Passive checks. Passive Perception = 10 + Perception bonus, +5 with advantage (a Sentinel
 * Shield). The best in the party counts (D11: party-best).
 */
export function passivePerception(h: Hero): number {
  return 10 + checkBonus(h, 'perception') + (hasSpecial(h, 'perception-advantage') ? 5 : 0);
}

export function bestPassive(g: GameState): { hero: Hero; score: number } | null {
  const list = awake(g);
  if (!list.length) return null;
  const hero = list.reduce((a, b) => (passivePerception(b) > passivePerception(a) ? b : a));
  return { hero, score: passivePerception(hero) };
}

const mark = (g: GameState, ids: string[], state: 'seen' | 'done'): GameState => ({
  ...g,
  finds: { ...(g.finds ?? {}), ...Object.fromEntries(ids.map((id) => [id, state])) },
});

/** On arrival: everything in plain sight, or within the party's passive Perception, is noticed. */
export function spotFinds(g: GameState, placeId: string): { game: GameState; messages: string[] } {
  const best = bestPassive(g);
  if (!best) return { game: g, messages: [] };
  const fresh = findsAt(g, placeId).filter(
    (f) => !g.finds?.[f.id] && (f.dc === null || f.dc <= best.score),
  );
  if (!fresh.length) return { game: g, messages: [] };
  const first = best.hero.name.split(' ')[0]!;
  return {
    game: mark(
      g,
      fresh.map((f) => f.id),
      'seen',
    ),
    messages: fresh.map((f) =>
      f.dc === null
        ? `You notice: ${f.label}.`
        : `${first} notices something (passive Perception ${best.score}): ${f.label}.`,
    ),
  };
}

/** A party-best skill check, logged like the dialogue's ("Perception check (Ilse): d20 (14) + 5 = 19 vs DC 15"). */
export function partyCheck(
  g: GameState,
  skill: Skill,
  dc: number,
  rng: RandomSource,
  label: string,
  who?: Hero,
): { success: boolean; text: string; hero: Hero } {
  const hero = who ?? bestFor(g, skill);
  const ability = SKILLS[skill];
  const bonus = skillBonus(hero, skill) - abilityModifier(hero.abilities[ability]);
  const luck = itemMods(hero).check;
  const edge =
    (skill === 'perception' && hasSpecial(hero, 'perception-advantage')) ||
    (skill === 'stealth' && hasSpecial(hero, 'stealth-advantage-quiet'));
  const r = abilityCheck(hero, ability, dc, rng, {
    advantage: edge ? ['magic item'] : [],
    label,
    bonuses: [
      ...(bonus ? [{ label: 'skill', value: bonus }] : []),
      ...(luck ? [{ label: 'items', value: luck }] : []),
    ],
  });
  const first = hero.name.split(' ')[0]!;
  return {
    success: r.success,
    hero,
    text: r.log.text.replace(`${hero.name} ${label} check`, `${label} check (${first})`),
  };
}

const today = (g: GameState) => {
  const d = toDate(g.clock);
  return `${d.year}-${d.period}-${d.day}`;
};

/** Has the party already searched this place today? (One careful search a day per place.) */
export const searchedToday = (g: GameState, placeId: string) =>
  g.flags[`searched:${placeId}`] === today(g);

/**
 * Search the area: a Perception check (party-best) against each hidden thing not yet noticed.
 * Once a day per place; it takes an hour.
 */
export function searchArea(
  g: GameState,
  placeId: string,
  rng: RandomSource,
): { game: GameState; log: string[] } {
  if (searchedToday(g, placeId))
    return { game: g, log: ["You've already searched here today. Come back tomorrow."] };
  const hidden = findsAt(g, placeId).filter((f) => !g.finds?.[f.id]);
  let next: GameState = {
    ...g,
    clock: g.clock + 1,
    flags: { ...g.flags, [`searched:${placeId}`]: today(g) },
  };
  if (!hidden.length) {
    // Still roll: the players shouldn't learn there's nothing here from a missing roll.
    const r = partyCheck(g, 'perception', 15, rng, 'Perception');
    return {
      game: next,
      log: [r.text.replace(/ vs DC \d+.*$/, ''), 'An hour of searching turns up nothing new.'],
    };
  }
  // One roll for the whole search; every hidden thing at or under it is found.
  const hardest = Math.max(...hidden.map((f) => f.dc ?? 0));
  const r = partyCheck(g, 'perception', hardest, rng, 'Perception');
  const total = Number(/= (\d+) vs/.exec(r.text)?.[1] ?? 0);
  const found = hidden.filter((f) => (f.dc ?? 0) <= total);
  next = mark(
    next,
    found.map((f) => f.id),
    'seen',
  );
  return {
    game: next,
    log: [
      r.text.replace(/ vs DC \d+.*$/, ''),
      ...(found.length
        ? found.map((f) => `Found: ${f.label}. ${f.notice}`)
        : ['An hour of searching turns up nothing new.']),
    ],
  };
}

const hasTools = (g: GameState) => (g.inventory['thieves-tools'] ?? 0) > 0;

export type OpenHow = 'open' | 'pick' | 'force';

export interface OpenResult {
  game: GameState;
  log: string[];
  /** Journal toasts (items received, quests). */
  messages: string[];
  /** A hidden merchant: open this shop. */
  shop?: string;
  opened: boolean;
}

/**
 * Open a find. Traps first (PHB: Investigation to spot, thieves' tools to disarm; a failed disarm
 * or an unseen trap goes off: the opener saves, never below 1 HP outside a fight [inferred]).
 * Then locks: thieves' tools (Sleight of Hand, house rule) or force (Athletics, DC + 2); a failed
 * force still gets it open after an hour of work (fail forward, Story_Bible §10).
 */
export function openFind(g: GameState, id: string, how: OpenHow, rng: RandomSource): OpenResult {
  const f = getFind(id);
  const log: string[] = [];
  const messages: string[] = [];
  let next = g;
  if (f.shop)
    return { game: mark(g, [id], 'seen'), log: [f.text], messages, shop: f.shop, opened: true };
  if (g.finds?.[id] === 'done')
    return { game: g, log: ['Already emptied.'], messages, opened: false };
  const lead = awake(g)[0];
  if (!lead) return { game: g, log: ['Nobody is awake to do it.'], messages, opened: false };

  // Traps.
  if (f.trap && !g.flags[`find_trap:${id}`]) {
    const spot = partyCheck(next, 'investigation', f.trap.dc, rng, 'Investigation');
    log.push(spot.text);
    let goesOff = !spot.success;
    if (spot.success) {
      log.push(`${spot.hero.name.split(' ')[0]} spots ${f.trap.name}.`);
      if (hasTools(next)) {
        const dis = partyCheck(
          next,
          'sleightOfHand',
          f.trap.dc,
          rng,
          "Sleight of Hand (thieves' tools)",
        );
        log.push(dis.text);
        if (dis.success) log.push('Disarmed.');
        else {
          log.push('The tools slip: the trap goes off.');
          goesOff = true;
        }
      } else {
        log.push("Without thieves' tools you can only spring it from arm's length, carefully.");
        goesOff = true;
      }
    }
    if (goesOff) {
      const h = lead;
      const luck = itemMods(h).save;
      const save = savingThrow(h, f.trap.save, f.trap.saveDc, rng, {
        bonuses: luck ? [{ label: 'items', value: luck }] : [],
        // A trap you've spotted and spring on purpose is easier to dodge [inferred].
        advantage: spot.success ? ['spotted it'] : [],
      });
      log.push(`${f.trap.name[0]!.toUpperCase()}${f.trap.name.slice(1)}! ${save.log.text}`);
      const r = roll(f.trap.dice, rng);
      const dmg = save.success ? Math.floor(r.total / 2) : r.total;
      log.push(`${r.text} ${f.trap.type} damage${save.success ? ` (halved: ${dmg})` : ''}`);
      next = {
        ...next,
        party: next.party.map((x) => (x.id === h.id ? { ...x, hp: Math.max(1, x.hp - dmg) } : x)),
      };
    }
    next = { ...next, flags: { ...next.flags, [`find_trap:${id}`]: true } };
  }

  // Locks.
  if (f.lock && !next.flags[`find_lock:${id}`]) {
    if (how === 'open')
      return { game: next, log: [...log, 'It is locked.'], messages, opened: false };
    if (how === 'pick') {
      if (!hasTools(next))
        return {
          game: next,
          log: [...log, "You need thieves' tools to pick it."],
          messages,
          opened: false,
        };
      const r = partyCheck(
        next,
        'sleightOfHand',
        f.lock.dc,
        rng,
        "Sleight of Hand (thieves' tools)",
      );
      log.push(r.text);
      if (!r.success) {
        log.push("The lock won't give. You could still force it.");
        return { game: next, log, messages, opened: false };
      }
    } else {
      const r = partyCheck(next, 'athletics', f.lock.dc + 2, rng, 'Athletics');
      log.push(r.text);
      if (!r.success) {
        log.push('It takes an hour of levering and swearing, but it gives in the end.');
        next = { ...next, clock: next.clock + 1 };
      }
    }
    next = { ...next, flags: { ...next.flags, [`find_lock:${id}`]: true } };
  }

  // Loot and story.
  log.push(f.text);
  if (f.loot.gold) {
    next = { ...next, gold: Math.round((next.gold + f.loot.gold) * 100) / 100 };
    messages.push(`Received: ${f.loot.gold} gp`);
  }
  for (const it of f.loot.items) {
    next = {
      ...next,
      inventory: { ...next.inventory, [it.id]: (next.inventory[it.id] ?? 0) + it.qty },
    };
    messages.push(`Received: ${itemName(it.id)}${it.qty > 1 ? ` ×${it.qty}` : ''}`);
  }
  if (f.setsFlag) next = { ...next, flags: { ...next.flags, [f.setsFlag]: true } };
  if (f.startsQuest) {
    const r = startQuest(next, f.startsQuest);
    next = r.game;
    messages.push(...r.messages);
  }
  if (f.completes) {
    const r = completeStep(next, f.completes.quest, f.completes.step);
    next = r.game;
    messages.push(...r.messages);
  }
  return { game: mark(next, [id], 'done'), log, messages, opened: true };
}
