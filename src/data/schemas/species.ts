import { z } from 'zod';
import { AbilityId, DamageTypeId, fileOf, Id, SkillId, Verify } from './common';

/** What a racial/class trait does, in terms the engine understands. */
export const TraitMechanic = z.discriminatedUnion('type', [
  z.object({ type: z.literal('darkvision'), feet: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('resistance'), damageType: DamageTypeId }).strict(),
  z.object({ type: z.literal('skill'), skill: SkillId }).strict(),
  z.object({ type: z.literal('skillChoice'), count: z.number().int().positive() }).strict(),
  z
    .object({
      type: z.literal('saveAdvantage'),
      against: z.enum(['poison', 'charmed', 'frightened', 'magic-int-wis-cha']),
    })
    .strict(),
  z.object({ type: z.literal('hpPerLevel'), amount: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('weapons'), weapons: z.array(Id).min(1) }).strict(),
  z
    .object({
      type: z.literal('spell'),
      spell: Id,
      /** Character level needed (1 = from the start). */
      atLevel: z.number().int().min(1).max(20),
      /** Cast once per long rest at this slot level; omitted for cantrips. */
      castAtLevel: z.number().int().min(1).max(9).optional(),
      ability: AbilityId,
    })
    .strict(),
  z.object({ type: z.literal('special'), id: Id }).strict(),
]);

export const Trait = z
  .object({
    id: Id,
    name: z.string().min(1),
    /** Our own words. */
    summary: z.string().min(1),
    mechanics: z.array(TraitMechanic).default([]),
    ...Verify,
  })
  .strict();

export const Species = z
  .object({
    id: Id,
    name: z.string().min(1),
    size: z.enum(['Small', 'Medium']),
    speed: z.number().int().positive(),
    /** Fixed ability increases. */
    abilityBonuses: z.partialRecord(AbilityId, z.number().int().positive()),
    /** Extra +1s the player chooses (Half-Elf: two, not Charisma). */
    abilityChoice: z
      .object({
        count: z.number().int().positive(),
        amount: z.number().int().positive(),
        exclude: z.array(AbilityId),
      })
      .strict()
      .optional(),
    languages: z.array(z.string().min(1)).min(1),
    extraLanguages: z.number().int().min(0).default(0),
    traits: z.array(Trait),
    ...Verify,
  })
  .strict();
export type Species = z.infer<typeof Species>;
export const SpeciesFile = fileOf('species', Species);
