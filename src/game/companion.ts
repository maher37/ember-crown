import { hasSubclass, type Hero } from './hero';

/**
 * PHB: Beast Master, Ranger's Companion. The beasts offered (owner, Nov 23, D36): monster ids in
 * monsters.json. The PHB allows any Medium or smaller beast of challenge 1/4 or lower.
 */
export const COMPANION_FORMS = ['wolf', 'panther', 'boar', 'giant-badger'] as const;

/** A Beast Master's animal: its kind, and whether it's away until the next long rest. */
export interface Companion {
  form: string;
  /** Killed in a fight: back after a long rest (owner, Nov 23). */
  lost?: boolean;
  /** A new animal was chosen: it joins after a long rest (PHB: 8 hours to bond with it). */
  waiting?: boolean;
}

export const hasCompanion = (h: Hero) => hasSubclass(h, 'ranger', 'beast-master', 3);

/** The hero's companion (a wolf until the player picks [inferred default]), or null. */
export function companionOf(h: Hero): Companion | null {
  if (!hasCompanion(h)) return null;
  const known = h.companion && (COMPANION_FORMS as readonly string[]).includes(h.companion.form);
  return known ? { ...h.companion! } : { form: 'wolf' };
}

/** Is the companion here for the next fight? */
export const companionReady = (h: Hero) => {
  const c = companionOf(h);
  return !!c && !c.lost && !c.waiting;
};

/**
 * Choose the animal. The first choice is immediate; a later change brings the new animal after
 * the next long rest (PHB: bonding takes 8 hours) [inferred].
 */
export function setCompanionForm(h: Hero, form: string): Hero {
  if (!hasCompanion(h) || !(COMPANION_FORMS as readonly string[]).includes(form)) return h;
  const now = companionOf(h)!;
  if (form === now.form) return h;
  return { ...h, companion: h.companion ? { form, waiting: true } : { form } };
}

/** After a long rest a lost companion is back, and a newly chosen one arrives. */
export function companionAfterLongRest(h: Hero): Hero {
  return h.companion?.lost || h.companion?.waiting
    ? { ...h, companion: { form: h.companion.form } }
    : h;
}

/** PHB: Ranger's Companion. Its hit point maximum: its normal maximum or 4 × ranger level. */
export const companionMaxHp = (monsterHp: number, rangerLevel: number) =>
  Math.max(monsterHp, 4 * rangerLevel);

export const companionId = (heroId: string) => `${heroId}-companion`;
