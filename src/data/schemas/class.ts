import { z } from 'zod';
import { AbilityId, Id, SkillId, Verify } from './common';
import { TraitMechanic } from './species';

const PerLevel = z.array(z.number().int().min(0)).length(6); // index 0 = level 1 ... 5 = level 6

export const Resource = z
  .object({
    id: Id,
    name: z.string().min(1),
    /** Uses at levels 1-6 (0 = not yet). Omit when it's a formula (see `formula`). */
    perLevel: PerLevel.optional(),
    /** e.g. "cha-mod-min-1", "5-x-level". */
    formula: z.string().min(1).optional(),
    recharge: z.enum(['short-rest', 'long-rest']),
    /** Only heroes of this subclass have it (a domain's own uses, say). */
    subclass: Id.optional(),
    ...Verify,
  })
  .strict()
  .refine((r) => (r.perLevel ? !r.formula : !!r.formula), 'give perLevel or formula, not both');

export const FeatureOption = z
  .object({ id: Id, name: z.string().min(1), summary: z.string().min(1), ...Verify })
  .strict();

export const Feature = z
  .object({
    id: Id,
    name: z.string().min(1),
    summary: z.string().min(1),
    /** A resource this feature spends (see the class's `resources`). */
    uses: Id.optional(),
    /** Choices the player makes (fighting styles, metamagic, invocations...). */
    options: z.array(FeatureOption).optional(),
    choose: z.number().int().positive().optional(),
    mechanics: z.array(TraitMechanic).default([]),
    ...Verify,
  })
  .strict();

export const Spellcasting = z
  .object({
    ability: AbilityId,
    /** Which shared slot table to use (`spellSlots` in classes.json). */
    progression: z.enum(['full', 'half', 'pact']),
    /** prepared = choose daily from the class list; known = fixed list; spellbook = wizard. */
    style: z.enum(['prepared', 'known', 'spellbook']),
    cantripsKnown: PerLevel,
    /** For "known" casters. */
    spellsKnown: PerLevel.optional(),
    /** For "prepared"/"spellbook" casters, e.g. "wis-mod+level". */
    preparedFormula: z.string().min(1).optional(),
    ritualCasting: z.boolean().default(false),
    ...Verify,
  })
  .strict();

export const ClassDef = z
  .object({
    id: Id,
    name: z.string().min(1),
    hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    primaryAbilities: z.array(AbilityId).min(1),
    saves: z.tuple([AbilityId, AbilityId]),
    armor: z.array(z.enum(['light', 'medium', 'heavy', 'shields'])),
    weapons: z.array(z.string().min(1)),
    tools: z.array(z.string().min(1)).default([]),
    skills: z
      .object({
        choose: z.number().int().positive(),
        from: z.union([z.array(SkillId).min(1), z.literal('any')]),
      })
      .strict(),
    subclass: z
      .object({ id: Id, name: z.string().min(1), level: z.number().int().min(1).max(3) })
      .strict(),
    /**
     * When there's a choice of subclass (cleric domains): each option, its extra proficiencies,
     * cantrips and always-prepared spells by class level. `subclass` above is the default.
     */
    subclasses: z
      .array(
        z
          .object({
            id: Id,
            name: z.string().min(1),
            summary: z.string().min(1),
            armor: z.array(z.enum(['light', 'medium', 'heavy', 'shields'])).default([]),
            weapons: z.array(z.string().min(1)).default([]),
            cantrips: z.array(Id).default([]),
            /** Class level → spells always prepared from then on (they don't count against the limit). */
            spells: z.record(z.string(), z.array(Id)).default({}),
            ...Verify,
          })
          .strict(),
      )
      .optional(),
    spellcasting: Spellcasting.optional(),
    resources: z.array(Resource).default([]),
    /** What a new level-1 hero of this class starts with. */
    startingKit: z
      .object({
        armor: Id.optional(),
        shield: z.boolean().default(false),
        weapons: z.array(Id).min(1),
        ...Verify,
      })
      .strict(),
    /** Features gained at each level, 1-6. Subclass features are marked by `subclass: true`. */
    levels: z
      .array(
        z
          .object({
            level: z.number().int().min(1).max(6),
            features: z.array(
              Feature.extend({ subclass: z.boolean().optional(), subclassId: Id.optional() }),
            ),
          })
          .strict(),
      )
      .length(6),
    ...Verify,
  })
  .strict()
  .refine((c) => c.levels.every((l, i) => l.level === i + 1), 'levels must be 1-6 in order');
export type ClassDef = z.infer<typeof ClassDef>;

const SlotRow = z.array(z.number().int().min(0)); // slots of 1st, 2nd, 3rd... level

export const ClassFile = z
  .object({
    ...Verify,
    /** docs/Rules_Scope.md §4. Index 0 = character level 1. */
    spellSlots: z
      .object({
        full: z.array(SlotRow).length(6),
        half: z.array(SlotRow).length(6),
        /** Warlock: number of slots and the slot level. */
        pact: z
          .array(
            z
              .object({ slots: z.number().int().min(1), slotLevel: z.number().int().min(1) })
              .strict(),
          )
          .length(6),
      })
      .strict(),
    classes: z.array(ClassDef).length(12),
  })
  .strict();
