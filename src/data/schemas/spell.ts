import { z } from 'zod';
import { Area, Dice, Duration, Effect, fileOf, Id, Verify } from './common';

export const CLASS_IDS = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;
export const ClassId = z.enum(CLASS_IDS);

export const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
] as const;

export const Spell = z
  .object({
    id: Id,
    name: z.string().min(1),
    level: z.number().int().min(0).max(5),
    school: z.enum(SCHOOLS),
    castingTime: z.enum(['action', 'bonus', 'reaction', '1-minute', '10-minutes', '1-hour']),
    range: z.union([
      z.literal('self'),
      z.literal('touch'),
      z.object({ feet: z.number().int().positive() }).strict(),
    ]),
    area: Area.optional(),
    /** How many targets (e.g. 3 for Bless). Omit for one target or an area. */
    targets: z.number().int().positive().optional(),
    concentration: z.boolean(),
    duration: Duration,
    ritual: z.boolean().default(false),
    components: z
      .string()
      .regex(/^V?,? ?S?,? ?M?$/)
      .optional(),
    /** Costly material component in gp, if any (Revivify: 300). */
    materialCostGp: z.number().int().positive().optional(),
    /** Empty for spells only monsters use. */
    classes: z.array(ClassId),
    /** Our own words. */
    summary: z.string().min(1),
    /** Exploration/dialogue only: no combat effect yet. */
    utility: z.boolean().default(false),
    /** D34: can be cast on the Prepare screen just before a fight, and carries into it. */
    beforeFight: z.boolean().default(false),
    effects: z.array(Effect),
    upcast: z
      .object({
        dicePerLevel: Dice.optional(),
        targetsPerLevel: z.number().int().positive().optional(),
        note: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    /** Cantrip damage dice at character level 5 (2014 rules: also at 11 and 17). */
    cantripAt5: Dice.optional(),
    ...Verify,
  })
  .strict()
  .refine((s) => s.utility || s.effects.length > 0, 'combat spells need at least one effect');
export type Spell = z.infer<typeof Spell>;
export const SpellFile = fileOf('spells', Spell);
