import { describe, expect, it } from 'vitest';
import {
  buildHero,
  computeAc,
  corinDraft,
  draftProblems,
  finalAbilities,
  grantedSkills,
  levelOneHp,
  newDraft,
  skillBonus,
  type HeroDraft,
} from '../../src/game/hero';
import type { AbilityScores } from '../../src/rules';

const s = (
  str: number,
  dex: number,
  con: number,
  int: number,
  wis: number,
  cha: number,
): AbilityScores => ({ str, dex, con, int, wis, cha });
const ready = (patch: Partial<HeroDraft> = {}): HeroDraft => ({
  ...newDraft('fighter', 'human'),
  name: 'Mira Ashgrove',
  classSkills: ['athletics', 'perception'],
  fightingStyle: 'defense',
  ...patch,
});

describe('hero drafts', () => {
  it('places the standard array for the class (fighter: STR, CON, DEX first)', () => {
    expect(newDraft('fighter').baseAbilities).toEqual(s(15, 13, 14, 8, 12, 10));
    expect(newDraft('wizard').baseAbilities.int).toBe(15);
  });

  it('adds species bonuses (human +1 to all)', () => {
    expect(finalAbilities(ready())).toEqual(s(16, 14, 15, 9, 13, 11));
  });

  it('half-elf: +2 Cha and +1 to two chosen abilities', () => {
    const d = ready({ speciesId: 'half-elf', halfElfBonus: ['str', 'con'] });
    expect(finalAbilities(d)).toEqual(s(16, 13, 15, 8, 12, 12));
  });

  it('lists what is missing', () => {
    expect(draftProblems({ ...newDraft('fighter'), name: '' })).toEqual([
      'Give your hero a name.',
      'Choose 2 class skills.',
      'Choose a fighting style.',
    ]);
    expect(draftProblems(ready())).toEqual([]);
  });

  it('needs a roll before the Roll method is ready', () => {
    expect(draftProblems(ready({ method: 'roll', rolled: null }))).toContain(
      'Roll your ability scores.',
    );
  });

  it('rejects an overspent point buy', () => {
    expect(
      draftProblems(ready({ method: 'point', baseAbilities: s(15, 15, 15, 15, 8, 8) })),
    ).toContain('Point buy must spend at most 27 points on scores of 8 to 15.');
  });

  it("won't let a class skill repeat a background skill", () => {
    const d = ready({ backgroundId: 'soldier', classSkills: ['athletics', 'perception'] });
    expect(draftProblems(d)).toContain('A class skill is not on the list, or you already have it.');
  });

  it('asks rogues for Expertise and half-elves for two extra skills', () => {
    const rogue = ready({
      classId: 'rogue',
      fightingStyle: null,
      classSkills: ['acrobatics', 'perception', 'insight', 'investigation'],
    });
    expect(draftProblems(rogue)).toEqual(['Choose 2 of your skills for Expertise.']);
    expect(draftProblems({ ...rogue, expertise: ['perception', 'insight'] })).toEqual([]);
    expect(draftProblems({ ...rogue, expertise: ['perception', 'stealth'] })).toEqual([
      'Choose 2 of your skills for Expertise.',
    ]);
    const halfElf = ready({ speciesId: 'half-elf' });
    expect(draftProblems(halfElf)).toEqual(['Choose 2 skills from Skill Versatility.']);
  });

  it('grants background and species skills automatically', () => {
    expect(grantedSkills({ speciesId: 'high-elf', backgroundId: 'sage' }).sort()).toEqual([
      'arcana',
      'history',
      'perception',
    ]);
    expect(grantedSkills({ speciesId: 'half-orc', backgroundId: 'urchin' }).sort()).toEqual([
      'intimidation',
      'sleightOfHand',
      'stealth',
    ]);
  });
});

// PHB: Hit Points (1st level = die maximum + Con).
describe('level-1 hit points', () => {
  it('fighter: 10 + Con', () => expect(levelOneHp(ready())).toBe(12));
  it('hill dwarf: +1 (Dwarven Toughness)', () =>
    expect(levelOneHp(ready({ speciesId: 'hill-dwarf' }))).toBe(14));
  it('draconic sorcerer: +1 (Draconic Resilience)', () =>
    expect(levelOneHp(corinDraft())).toBe(6 + 2 + 1));
});

// PHB: Armor and Shields, Unarmored Defense, Draconic Resilience.
describe('armor class', () => {
  const none = { armor: null, shield: false };
  const a = s(16, 14, 15, 10, 16, 10); // Dex +2, Con +2, Wis +3
  it('chain mail 16 + shield 2, Defense +1', () => {
    expect(computeAc('fighter', a, { armor: 'chain-mail', shield: true }, null)).toBe(18);
    expect(computeAc('fighter', a, { armor: 'chain-mail', shield: true }, 'defense')).toBe(19);
  });
  it('light armor adds all of Dex; medium at most 2', () => {
    expect(
      computeAc('rogue', s(10, 18, 10, 10, 10, 10), { armor: 'leather', shield: false }, null),
    ).toBe(15);
    expect(
      computeAc('ranger', s(10, 18, 10, 10, 10, 10), { armor: 'scale-mail', shield: false }, null),
    ).toBe(16);
  });
  it('unarmored: 10 + Dex; barbarian adds Con; monk adds Wis; draconic sorcerer 13 + Dex', () => {
    expect(computeAc('wizard', a, none, null)).toBe(12);
    expect(computeAc('barbarian', a, none, null)).toBe(14);
    expect(computeAc('monk', a, none, null)).toBe(15);
    expect(computeAc('sorcerer', a, none, null)).toBe(15);
  });
  it('Defense does nothing without armor', () =>
    expect(computeAc('wizard', a, none, 'defense')).toBe(12));
});

describe('buildHero', () => {
  it('builds a complete level-1 fighter', () => {
    const h = buildHero(
      ready({ backgroundId: 'soldier', classSkills: ['perception', 'survival'] }),
      'h1',
    );
    expect(h).toMatchObject({
      id: 'h1',
      name: 'Mira Ashgrove',
      kind: 'pc',
      level: 1,
      proficiencyBonus: 2,
      maxHp: 12,
      hp: 12,
      ac: 19,
      speed: 30,
    });
    expect(h.saveProficiencies).toEqual(['str', 'con']);
    expect(h.skills.sort()).toEqual(['athletics', 'intimidation', 'perception', 'survival']);
    expect(h.hitDice).toEqual({ die: 10, total: 1, remaining: 1 });
    expect(skillBonus(h, 'athletics')).toBe(5);
    expect(skillBonus(h, 'stealth')).toBe(2);
  });

  it('builds Corin: human draconic sorcerer, fire resistance not included (that is red dragonborn)', () => {
    const h = buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'corin');
    expect(h).toMatchObject({
      origin: 'corin',
      name: 'Corin Varrow',
      speciesId: 'human',
      classId: 'sorcerer',
      maxHp: 9,
      ac: 15, // 13 + Dex +2 (Draconic Resilience)
    });
    expect(h.defenses.resistances).toEqual([]);
  });

  it('gives dragonborn and tieflings fire resistance', () => {
    expect(buildHero(ready({ speciesId: 'tiefling' }), 't').defenses.resistances).toEqual(['fire']);
  });

  it('doubles proficiency with Expertise', () => {
    const rogue = buildHero(
      ready({
        classId: 'rogue',
        baseAbilities: newDraft('rogue').baseAbilities,
        fightingStyle: null,
        backgroundId: 'urchin',
        classSkills: ['acrobatics', 'perception', 'insight', 'investigation'],
        expertise: ['stealth', 'perception'],
      }),
      'r',
    );
    // Rogue Dex 15 + 1 (human) = 16 → +3. Stealth: +3 + 2 × 2 = +7. Acrobatics (no expertise): +3 + 2 = +5.
    expect(skillBonus(rogue, 'stealth')).toBe(7);
    expect(skillBonus(rogue, 'acrobatics')).toBe(5);
  });

  it('refuses an unfinished draft', () => {
    expect(() => buildHero(newDraft(), 'x')).toThrow(/not ready/);
  });
});
