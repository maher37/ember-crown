import { describe, expect, it } from 'vitest';
import { buildHero, newDraft, type Hero, type HeroDraft } from '../../src/game/hero';
import {
  abilityPreview,
  applyLevelUp,
  defaultPlan,
  hpGain,
  levelUpOptions,
  planProblems,
  spellRules,
  type LevelUpPlan,
} from '../../src/game/levelup';

const make = (cls: string, patch: Partial<HeroDraft> = {}, xp = 300): Hero => ({
  ...buildHero(
    {
      ...newDraft(cls),
      name: 'Test',
      classSkills: (
        {
          fighter: ['athletics', 'perception'],
          wizard: ['arcana', 'history'],
          warlock: ['arcana', 'deception'],
          cleric: ['medicine', 'insight'],
          bard: ['arcana', 'history', 'insight'],
          paladin: ['athletics', 'insight'],
        } as unknown as Record<string, never[]>
      )[cls]!,
      fightingStyle: cls === 'fighter' ? 'defense' : null,
      ...patch,
    },
    't',
  ),
  xp,
});
const plan = (h: Hero, p: Partial<LevelUpPlan> = {}): LevelUpPlan => ({ ...defaultPlan(h), ...p });

describe('level-up options', () => {
  it('a fighter at level 2 gets Action Surge and average HP of 6', () => {
    const o = levelUpOptions(make('fighter'));
    expect(o.newLevel).toBe(2);
    expect(o.averageHp).toBe(6);
    expect(o.features.map((f) => f.name)).toEqual(['Action Surge']);
    expect(o.asi).toBe(false);
    expect(o.next).toMatchObject({ level: 3, names: ['Improved Critical'] });
    expect(o.next!.features[0]!.summary).toMatch(/19 or 20/);
  });

  it('a warlock at level 2 picks two invocations', () => {
    const o = levelUpOptions(make('warlock'));
    expect(o.picks).toEqual([expect.objectContaining({ id: 'invocations', count: 2 })]);
  });

  it('a paladin at level 2 picks a fighting style and gets spells', () => {
    const o = levelUpOptions(make('paladin'));
    expect(o.picks[0]!.id).toBe('fighting-style');
    expect(o.spells).toMatchObject({ style: 'prepared', maxLevel: 1 });
  });

  it('the ASI arrives at level 4', () => {
    const h = { ...make('fighter', {}, 2700), level: 3 };
    expect(levelUpOptions(h).asi).toBe(true);
  });
});

// PHB class tables (counts from data; the counts themselves are in the verify checklist).
describe('spell limits', () => {
  it('wizard spellbook: 6 at level 1, +2 per level; cantrips 3', () => {
    expect(spellRules(make('wizard'), 2)).toMatchObject({
      style: 'spellbook',
      spells: 8,
      cantrips: 3,
      maxLevel: 1,
    });
    expect(spellRules(make('wizard'), 3)!.maxLevel).toBe(2);
  });
  it('cleric prepares Wis modifier + level', () => {
    const h = make('cleric');
    const wis = Math.floor((h.abilities.wis - 10) / 2);
    expect(spellRules(h, 2)!.spells).toBe(wis + 2);
  });
  it('warlock pact slots: level 3 reaches 2nd-level spells', () => {
    expect(spellRules(make('warlock'), 3)!.maxLevel).toBe(2);
  });
  it('only class spells are on offer', () => {
    const r = spellRules(make('cleric'), 2)!;
    expect(r.spellPool.map((s) => s.id)).toContain('cure-wounds');
    expect(r.spellPool.map((s) => s.id)).not.toContain('magic-missile');
  });
});

describe('applying a level-up', () => {
  it('adds average HP + Con, a Hit Die and keeps damage taken', () => {
    const h = { ...make('fighter'), hp: 5 };
    const con = Math.floor((h.abilities.con - 10) / 2);
    const up = applyLevelUp(h, plan(h));
    expect(up.level).toBe(2);
    expect(up.maxHp).toBe(h.maxHp + 6 + con);
    expect(up.hp).toBe(5 + 6 + con);
    expect(up.hitDice.total).toBe(2);
  });

  it('can use a rolled HP value', () => {
    const h = make('fighter');
    expect(hpGain(h, plan(h, { hp: { method: 'roll', value: 1 } }))).toBe(
      Math.max(1, 1 + Math.floor((h.abilities.con - 10) / 2)),
    );
  });

  it('a Con increase raises HP for every level already gained (PHB)', () => {
    const h = {
      ...make('fighter', {}, 2700),
      level: 3,
      abilities: { ...make('fighter').abilities, con: 15 },
    };
    const g1 = hpGain(h, plan(h, { asi: { str: 2 } }));
    const g2 = hpGain(h, plan(h, { asi: { con: 1, str: 1 } }));
    expect(g2 - g1).toBe(1 + 3);
  });

  it('refuses an unfinished plan with readable reasons', () => {
    const h = make('warlock');
    expect(planProblems(h, plan(h, { picks: {} }))).toContain('Choose 2 for Eldritch Invocations.');
    const ok = plan(h, { picks: { invocations: ['agonizing-blast', 'devils-sight'] } });
    expect(planProblems(h, ok)).toEqual([]);
    expect(applyLevelUp(h, ok).invocations).toEqual(['agonizing-blast', 'devils-sight']);
  });

  it('enforces the ASI rules: 2 points, +2 max per score, 20 cap', () => {
    const h = { ...make('fighter', {}, 2700), level: 3 };
    expect(planProblems(h, plan(h, { asi: { str: 1 } }))).toContain('Spend 1 more ability point.');
    expect(planProblems(h, plan(h, { asi: { str: 3 } }))[0]).toMatch(/at most 2|Spend/);
    const capped = { ...h, abilities: { ...h.abilities, str: 20 } };
    expect(planProblems(capped, plan(capped, { asi: { str: 1, dex: 1 } }))).toContain(
      'Scores can rise by at most 2, and never above 20.',
    );
  });

  it('needs the XP', () => {
    const h = make('fighter', {}, 299);
    expect(() => applyLevelUp(h, plan(h))).toThrow(/XP/);
  });
});

describe('hover previews (LevelUp mockup)', () => {
  it('shows what raising Strength changes for a fighter', () => {
    const h = make('fighter');
    const rows = abilityPreview(h, 'str', h.abilities.str + 2);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Longsword attack');
    expect(labels).toContain('Strength saves (proficient)');
    expect(labels).toContain('Athletics (proficient)');
    const atk = rows.find((r) => r.label === 'Longsword attack')!;
    expect(Number(atk.after) - Number(atk.before)).toBe(1);
  });
  it('shows spell DC for a wizard raising Intelligence', () => {
    const h = make('wizard');
    const rows = abilityPreview(h, 'int', h.abilities.int + 2);
    expect(rows.find((r) => r.label === 'Spell save DC')).toBeDefined();
  });
  it('shows passive Perception for Wisdom', () => {
    const h = make('fighter');
    expect(abilityPreview(h, 'wis', 14).some((r) => r.label.startsWith('Passive Perception'))).toBe(
      true,
    );
  });
});
