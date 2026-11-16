import { describe, expect, it } from 'vitest';
import { SKILL_IDS, SKILLS } from '../../../src/rules';

// PHB: Skills.
describe('skills', () => {
  it('has the 18 PHB skills', () => {
    expect(SKILL_IDS).toHaveLength(18);
  });
  it('maps skills to abilities', () => {
    expect(SKILLS.athletics).toBe('str');
    expect(SKILLS.stealth).toBe('dex');
    expect(SKILLS.arcana).toBe('int');
    expect(SKILLS.perception).toBe('wis');
    expect(SKILLS.persuasion).toBe('cha');
    expect((Object.values(SKILLS) as string[]).filter((a) => a === 'con')).toHaveLength(0);
  });
});
