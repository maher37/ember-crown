import { z } from 'zod';
import {
  AbilityId,
  Area,
  ConditionIdSchema,
  DamageTypeId,
  Dice,
  Effect,
  fileOf,
  Id,
  Recharge,
  SkillId,
  Speed,
  Verify,
} from './common';

// DMG: Experience Points by Challenge Rating.
export const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
};

// MM: Proficiency Bonus by Challenge Rating.
export function crProficiency(cr: string): number {
  const n = cr.includes('/') ? 0 : Number(cr);
  return n < 5 ? 2 : n < 9 ? 3 : n < 13 ? 4 : 5;
}

export const MonsterAction = z
  .object({
    id: Id,
    name: z.string().min(1),
    cost: z.enum(['action', 'bonus', 'reaction']).default('action'),
    area: Area.optional(),
    recharge: Recharge.optional(),
    /** Our own words. */
    summary: z.string().min(1).optional(),
    /** Only against a prone creature (a giant elk's Hooves). */
    onlyVsProne: z.boolean().optional(),
    effects: z.array(Effect).min(1),
    ...Verify,
  })
  .strict();

export const MonsterTrait = z
  .object({
    id: Id,
    name: z.string().min(1),
    summary: z.string().min(1),
    /**
     * Charge / Pounce: after moving 20 ft straight at a target, a hit with `attack` deals `dice`
     * extra and the target makes a Strength save (`dc`) or falls prone. Pounce: a prone target
     * then takes a `bonusAttack` (a bonus action).
     */
    charge: z
      .object({
        attack: Id,
        dice: Dice.optional(),
        damageType: DamageTypeId.optional(),
        dc: z.number().int().positive(),
        bonusAttack: Id.optional(),
      })
      .strict()
      .optional(),
    /** A number the trait uses (Relentless: the most damage it shrugs off). */
    limit: z.number().int().positive().optional(),
    ...Verify,
  })
  .strict();

export const MonsterSpellcasting = z
  .object({
    ability: AbilityId,
    dc: z.number().int().positive(),
    attackBonus: z.number().int(),
    /** Spells known by id, grouped: "0" = cantrips/at will, "1".."5" = slot levels. */
    spells: z.record(z.string().regex(/^[0-5]$/), z.array(Id)),
    /** Slots per level, e.g. { "1": 4, "2": 3 }. Innate casters use `perDay` instead. */
    slots: z.record(z.string().regex(/^[1-5]$/), z.number().int().positive()).optional(),
    innate: z.boolean().default(false),
    ...Verify,
  })
  .strict();

export const Monster = z
  .object({
    id: Id,
    name: z.string().min(1),
    size: z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge']),
    type: z.enum([
      'beast',
      'construct',
      'dragon',
      'elemental',
      'fey',
      'fiend',
      'giant',
      'humanoid',
      'monstrosity',
      'undead',
    ]),
    cr: z.enum(Object.keys(CR_XP) as [string, ...string[]]),
    xp: z.number().int().positive(),
    ac: z.number().int().positive(),
    acNote: z.string().min(1).optional(),
    hp: z.number().int().positive(),
    hitDice: Dice.optional(),
    speed: Speed,
    abilities: z.record(AbilityId, z.number().int().min(1).max(30)),
    /** Total save bonuses where they differ from the plain ability modifier. */
    saves: z.partialRecord(AbilityId, z.number().int()).default({}),
    skills: z.partialRecord(SkillId, z.number().int()).default({}),
    resistances: z.array(DamageTypeId).default([]),
    /** Bludgeoning, piercing and slashing resistance only applies to nonmagical attacks. */
    resistancesNonmagicalOnly: z.boolean().default(false),
    vulnerabilities: z.array(DamageTypeId).default([]),
    immunities: z.array(DamageTypeId).default([]),
    conditionImmunities: z.array(z.union([ConditionIdSchema, z.literal('exhaustion')])).default([]),
    darkvision: z.number().int().positive().optional(),
    traits: z.array(MonsterTrait).default([]),
    /** e.g. ["scimitar", "scimitar", "dagger"]: action ids used by one Multiattack. */
    multiattack: z.array(Id).optional(),
    /** Some tiny familiars (frog, sea horse) have no attacks. */
    actions: z.array(MonsterAction),
    spellcasting: MonsterSpellcasting.optional(),
    /** Where the docs use it (encounter ids, quests). */
    usedIn: z.array(z.string().min(1)).default([]),
    /** Original art concept (docs/Monster_Roster.md). Never MM art. */
    art: z.string().min(1).optional(),
    homebrew: z.boolean().default(false),
    /** Too strong to fight; kept as a design reference. */
    referenceOnly: z.boolean().default(false),
    ...Verify,
  })
  .strict()
  .refine((m) => CR_XP[m.cr] === m.xp, {
    message: 'xp must match the DMG value for its CR',
    path: ['xp'],
  })
  .refine((m) => !m.multiattack || m.multiattack.every((a) => m.actions.some((x) => x.id === a)), {
    message: 'multiattack names an action that does not exist',
    path: ['multiattack'],
  });
export type Monster = z.infer<typeof Monster>;
export const MonsterFile = fileOf('monsters', Monster);

/** A named foe built on a base stat block (Brother Ulric = cult fanatic, Scald = wyrmling...). */
export const NamedFoe = z
  .object({
    id: Id,
    name: z.string().min(1),
    base: Id,
    role: z.enum(['boss', 'elite', 'villain', 'named']),
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Villains are knocked out, not killed, at 0 HP (Rules_Scope §1). */
    knockedOutAtZero: z.boolean().default(false),
    /** Stat changes from the base. */
    overrides: z
      .object({
        hp: z.number().int().positive().optional(),
        ac: z.number().int().positive().optional(),
      })
      .strict()
      .default({}),
    companions: z
      .array(z.object({ monster: Id, count: z.number().int().positive() }).strict())
      .default([]),
    encounter: z.string().min(1).optional(),
    reward: z.array(Id).default([]),
    summary: z.string().min(1),
    art: z.string().min(1).optional(),
    ...Verify,
  })
  .strict();
export const NamedFoeFile = fileOf('foes', NamedFoe);
