// D34: casting between fights. Spells cast on the Prepare screen carry into the fight.
import { describe, expect, it } from 'vitest';
import type { Hero } from '../../src/game/hero';
import { spells } from '../../src/data';
import { precastProblems, precastSpells, type Precast } from '../../src/game/precast';
import { fight, L, party, texts } from './combat/arrange';

const knows = (h: Hero, ids: string[]): Hero => ({ ...h, spells: [...h.spells, ...ids] });
const cleric = () => knows(L('cleric', 'Ada', 5), ['bless', 'shield-of-faith', 'spirit-guardians']);
const warlock = () => knows(L('warlock', 'Ada', 3), ['hex', 'armor-of-agathys']);
const start = (lead: Hero, precasts: Precast[]) =>
  fight('f13-cloister', party(lead, lead.level), 1, { precasts });

describe('casting before a fight (D34)', () => {
  it("offers exactly the spells the owner approved (D34), plus Hex and Hunter's Mark", () => {
    expect(
      spells
        .filter((s) => s.beforeFight)
        .map((s) => s.id)
        .sort(),
    ).toEqual(
      [
        'bless',
        'shield-of-faith',
        'aid',
        'protection-from-evil-and-good',
        'divine-favor',
        'armor-of-agathys',
        'false-life',
        'mage-armor',
        'blur',
        'mirror-image',
        'enlarge-reduce',
        'haste',
        'magic-weapon',
        'protection-from-energy',
        'spirit-guardians',
        'beacon-of-hope',
        'invisibility',
        'pass-without-trace',
        'hex',
        'hunters-mark',
      ].sort(),
    );
  });

  it('Bless on three allies is up from round 1, spends the slot, and keeps the first turn', () => {
    const s = start(cleric(), [
      { casterId: 'ada', spellId: 'bless', slotLevel: 1, targetIds: ['ada', 'thorn', 'ilse'] },
    ]);
    for (const id of ['ada', 'thorn', 'ilse'])
      expect(s.combatants[id]!.effects.some((e) => e.name === 'Bless')).toBe(true);
    expect(s.combatants['wren']!.effects.some((e) => e.name === 'Bless')).toBe(false);
    const ada = s.combatants['ada']!.creature as Hero;
    expect(ada.slotsUsed[0]).toBe(1);
    expect(ada.concentration).toBe('bless');
    expect(texts(s)).toMatch(/Before the fight[\s\S]*Ada casts Bless/);
    expect(s.combatants['ada']!.turn.actionUsed).toBe(false);
  });

  it('Armor of Agathys gives its temporary HP before the first turn (PHB)', () => {
    const s = start(warlock(), [
      { casterId: 'ada', spellId: 'armor-of-agathys', slotLevel: 2, targetIds: [] },
    ]);
    expect(s.combatants['ada']!.creature.tempHp).toBeGreaterThanOrEqual(5);
    expect(s.combatants['ada']!.effects.some((e) => e.tag === 'agathys')).toBe(true);
  });

  it('Hex can mark a foe you can see before the fight', () => {
    const s = start(warlock(), [
      { casterId: 'ada', spellId: 'hex', slotLevel: 2, targetIds: ['cultist-a'] },
    ]);
    expect(s.combatants['cultist-a']!.effects.some((e) => e.tag === 'hex-target')).toBe(true);
  });

  it("Hex and Hunter's Mark are not offered when the enemy is hidden until the fight", () => {
    const ids = (seen: boolean) => precastSpells(warlock(), seen).map((x) => x.spell.id);
    expect(ids(true)).toContain('hex');
    expect(ids(false)).not.toContain('hex');
    expect(ids(false)).toContain('armor-of-agathys');
  });

  it('only one concentration spell per caster; the second is not cast (PHB: Concentration)', () => {
    const list: Precast[] = [
      { casterId: 'ada', spellId: 'bless', slotLevel: 1, targetIds: ['thorn'] },
      { casterId: 'ada', spellId: 'shield-of-faith', slotLevel: 1, targetIds: ['ilse'] },
    ];
    expect(precastProblems([cleric()], list)[0]).toMatch(/only one spell/);
    const s = start(cleric(), list);
    expect(s.combatants['thorn']!.effects.some((e) => e.name === 'Bless')).toBe(true);
    expect(s.combatants['ilse']!.effects.some((e) => e.name === 'Shield of Faith')).toBe(false);
  });

  it('cannot spend more slots than are left', () => {
    const h = cleric();
    const lots = Array.from({ length: 5 }, (): Precast => ({
      casterId: 'ada',
      spellId: 'mage-armor',
      slotLevel: 1,
      targetIds: ['wren'],
    }));
    expect(precastProblems([h], lots).join()).toMatch(/level-1 slots/);
  });

  it('Spirit Guardians starts around the cleric (PHB)', () => {
    const s = start(cleric(), [
      { casterId: 'ada', spellId: 'spirit-guardians', slotLevel: 3, targetIds: [] },
    ]);
    expect(s.zones.some((z) => z.spellId === 'spirit-guardians')).toBe(true);
  });
});
