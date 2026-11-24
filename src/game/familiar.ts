import type { Hero } from './hero';

/**
 * PHB: Find Familiar. The animal shapes any caster of the spell can pick (from memory of the PHB,
 * [CONFIRM LOCALLY]). Monster ids in monsters.json.
 */
export const FAMILIAR_FORMS = [
  'bat',
  'cat',
  'frog',
  'hawk',
  'lizard',
  'octopus',
  'owl',
  'rat',
  'raven',
  'sea-horse',
  'spider',
  'weasel',
] as const;

/** PHB: Pact of the Chain. Extra shapes for a warlock's familiar. */
export const CHAIN_FORMS = ['imp', 'pseudodragon', 'quasit', 'sprite'] as const;

/** What a hero's familiar is: its shape, and whether it is gone until the next long rest. */
export interface Familiar {
  form: string;
  /** Killed in a fight: it comes back after a long rest (owner, Nov 23 [inferred: RAW 1 hour + 10 gp]). */
  lost?: boolean;
}

export const hasChain = (h: Hero) =>
  h.classId === 'warlock' && !!h.choices['pact-boon']?.includes('pact-of-the-chain');

/** A wizard who knows Find Familiar, or a Pact of the Chain warlock (who gets it free). */
export const hasFamiliar = (h: Hero) =>
  hasChain(h) || (h.classId === 'wizard' && h.spells.includes('find-familiar'));

/** The shapes this hero may pick. */
export const familiarForms = (h: Hero): string[] =>
  hasChain(h) ? [...CHAIN_FORMS, ...FAMILIAR_FORMS] : [...FAMILIAR_FORMS];

/** Default shapes until the player picks one [inferred]: an owl, or an imp for the Chain. */
export function familiarOf(h: Hero): Familiar | null {
  if (!hasFamiliar(h)) return null;
  const forms = familiarForms(h);
  const form = h.familiar && forms.includes(h.familiar.form) ? h.familiar.form : null;
  return { ...h.familiar, form: form ?? (hasChain(h) ? 'imp' : 'owl') };
}

/** Pick a new shape (the spell is recast in a new form; a lost familiar stays lost). */
export function setFamiliarForm(h: Hero, form: string): Hero {
  if (!familiarForms(h).includes(form)) return h;
  return { ...h, familiar: { ...familiarOf(h), form } };
}

/** The familiar's combatant id in a fight. */
export const familiarId = (heroId: string) => `${heroId}-familiar`;

/** After a long rest a lost familiar is back. */
export function familiarAfterLongRest(h: Hero): Hero {
  return h.familiar?.lost ? { ...h, familiar: { form: h.familiar.form } } : h;
}
