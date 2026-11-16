import { z } from 'zod';
import { ABILITIES, CONDITIONS, DAMAGE_TYPES, SKILL_IDS, type Skill } from '../../rules';

export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lowercase-with-dashes');
export const AbilityId = z.enum(ABILITIES);
export const DamageTypeId = z.enum(DAMAGE_TYPES);
export const ConditionIdSchema = z.enum(CONDITIONS);
export const SkillId = z.enum(SKILL_IDS as [Skill, ...Skill[]]);
export const Dice = z
  .string()
  .regex(/^\s*(\d*d\d+\s*([+-]\s*\d+)?|[+-]?\s*\d+)\s*$/i, 'dice like "2d6+3" or a number');

/**
 * Every record (and every file) can be flagged for the owner to check against the books.
 * `verify: true` means: entered from memory or marked ⚠ in the docs, not yet checked.
 */
export const Verify = {
  verify: z.boolean().optional(),
  verifyNote: z.string().min(1).optional(),
};

/** File wrapper: `{ "verify": ..., "verifyNote": ..., "<key>": [records] }`. */
export const fileOf = <K extends string, T extends z.ZodType>(key: K, record: T) =>
  z
    .object({
      ...Verify,
      ...({ [key]: z.array(record).min(1) } as { [P in K]: z.ZodArray<T> }),
    })
    .strict();

export const Speed = z
  .object({
    walk: z.number().int().min(0),
    fly: z.number().int().positive().optional(),
    climb: z.number().int().positive().optional(),
    swim: z.number().int().positive().optional(),
    burrow: z.number().int().positive().optional(),
    hover: z.boolean().optional(),
  })
  .strict();

export const Area = z
  .object({
    shape: z.enum(['cone', 'cube', 'sphere', 'cylinder', 'line', 'square', 'aura']),
    /** Feet: cone length, cube side, sphere/cylinder/aura radius, line length. */
    size: z.number().int().positive(),
    /** Line width or cylinder height, in feet. */
    width: z.number().int().positive().optional(),
  })
  .strict();

export const Duration = z.union([
  z.literal('instant'),
  z.literal('until-end-of-next-turn'),
  z.literal('until-start-of-next-turn'),
  z.object({ rounds: z.number().int().positive() }).strict(),
  z.object({ minutes: z.number().int().positive() }).strict(),
  z.object({ hours: z.number().int().positive() }).strict(),
  z.literal('until-dispelled'),
]);

// ── Effect primitives (CLAUDE.md: attack, save, damage, heal, condition, area, concentration) ──
// "Leaf" effects happen to a target. "Gate" effects (attack, save) decide which leaves apply.
// Area and concentration live on the spell/action itself.

const Damage = z
  .object({
    type: z.literal('damage'),
    dice: Dice,
    damageType: DamageTypeId,
    /** Add the caster's spellcasting modifier (e.g. Spiritual Weapon). */
    addModifier: z.boolean().optional(),
  })
  .strict();

const Heal = z
  .object({ type: z.literal('heal'), dice: Dice, addModifier: z.boolean().optional() })
  .strict();

const TempHp = z.object({ type: z.literal('tempHp'), dice: Dice }).strict();

const Condition = z
  .object({
    type: z.literal('condition'),
    condition: ConditionIdSchema,
    duration: Duration.optional(),
    /** The target repeats this save at the end of each of its turns to end the condition. */
    repeatSave: AbilityId.optional(),
  })
  .strict();

/** A bonus or penalty to a roll or stat while the effect lasts (Bless, Shield, Bane...). */
const Modifier = z
  .object({
    type: z.literal('modifier'),
    target: z.enum(['attack', 'save', 'check', 'ac', 'damage', 'speed', 'initiative']),
    /** A flat value, or dice ("1d4"; "-1d4" for Bane). */
    value: z.union([z.number().int(), Dice, z.string().regex(/^-\d*d\d+$/)]),
    duration: Duration.optional(),
  })
  .strict();

const Move = z
  .object({
    type: z.literal('move'),
    kind: z.enum(['push', 'pull', 'teleport', 'move-away']),
    feet: z.number().int().positive(),
  })
  .strict();

/** Handled by named code in the engine (Sleep's HP pool, Counterspell, Wild Shape...). */
const Special = z
  .object({ type: z.literal('special'), id: Id, note: z.string().min(1).optional() })
  .strict();

export const LeafEffect = z.discriminatedUnion('type', [
  Damage,
  Heal,
  TempHp,
  Condition,
  Modifier,
  Move,
  Special,
]);
export type LeafEffect = z.infer<typeof LeafEffect>;

const Save = z
  .object({
    type: z.literal('save'),
    ability: AbilityId,
    /** Fixed DC for monsters; omitted for spells (uses the caster's spell save DC). */
    dc: z.number().int().positive().optional(),
    onFail: z.array(LeafEffect).min(1),
    /** "half" = half damage on a success. */
    onSuccess: z.union([z.literal('half'), z.literal('none'), z.array(LeafEffect)]).default('none'),
  })
  .strict();

const Attack = z
  .object({
    type: z.literal('attack'),
    kind: z.enum(['melee', 'ranged']),
    /** Fixed to-hit for monsters; omitted for spells (uses the caster's spell attack bonus). */
    toHit: z.number().int().optional(),
    reach: z.number().int().positive().optional(),
    /** Normal and long range in feet. */
    range: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    /** What happens on a hit; may include a save (e.g. a poisoned bite). */
    onHit: z.array(z.union([LeafEffect, Save])).min(1),
  })
  .strict();

export const Effect = z.union([Attack, Save, LeafEffect]);
export type Effect = z.infer<typeof Effect>;

export const Recharge = z.union([
  z.object({ roll: z.number().int().min(2).max(6) }).strict(), // recharges on d6 ≥ roll
  z
    .object({
      per: z.enum(['short-rest', 'long-rest', 'day', 'turn']),
      uses: z.number().int().positive(),
    })
    .strict(),
]);

export type { Skill };
