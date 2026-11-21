// Standard parties for the balance simulator: the same heroes a player might make, levelled to a
// fight's expected level with the level-up defaults.
import { readyParty } from '../game/combat';
import { giveLoadouts } from '../game/loadout';
import { buildHero, classSkillChoices, grantedSkills, newDraft, type Hero } from '../game/hero';

/** A level-1 hero of a class, with the creator's defaults (standard array, first skills). */
export function simHero(classId: string, name: string, speciesId = 'human'): Hero {
  const d = newDraft(classId, speciesId);
  const skills = classSkillChoices(classId);
  const have = new Set(grantedSkills(d));
  const pool = skills.from.filter((x) => !have.has(x));
  return buildHero(
    {
      ...d,
      name,
      classSkills: pool.slice(0, skills.choose),
      fightingStyle: classId === 'fighter' ? 'defense' : null,
      expertise: classId === 'rogue' ? pool.slice(0, 2) : [],
    },
    name.toLowerCase(),
  );
}

/** The parties the simulator tests. */
export const SIM_PARTIES: Record<string, { label: string; classes: string[] }> = {
  classic: {
    label: 'Fighter, cleric, rogue, wizard',
    classes: ['fighter', 'cleric', 'rogue', 'wizard'],
  },
  mixed: {
    label: 'Paladin, druid, ranger, warlock',
    classes: ['paladin', 'druid', 'ranger', 'warlock'],
  },
};

export function simParty(id: keyof typeof SIM_PARTIES | string, level: number): Hero[] {
  const p = SIM_PARTIES[id] ?? SIM_PARTIES['classic']!;
  return giveLoadouts(
    readyParty(
      p.classes.map((c, i) => simHero(c, ['Ana', 'Bram', 'Cass', 'Dov'][i]!)),
      level,
    ),
    {},
  ).party;
}
