import { describe, expect, it } from 'vitest';
import {
  addCondition,
  applyCondition,
  CONDITIONS,
  effectiveSpeed,
  isIncapacitated,
  removeCondition,
  type ConditionId,
} from '../../../src/rules';
import { makeCreature } from './helpers';

const withC = (id: ConditionId) => makeCreature({ conditions: [{ id }] });

describe('conditions', () => {
  it('has all 14 PHB conditions', () => {
    expect(CONDITIONS).toHaveLength(14);
  });

  // PHB Appendix A: paralyzed, petrified, stunned and unconscious include incapacitated.
  it.each(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'] as const)(
    '%s means incapacitated',
    (id) => expect(isIncapacitated(withC(id))).toBe(true),
  );

  it.each([
    'blinded',
    'charmed',
    'frightened',
    'grappled',
    'poisoned',
    'prone',
    'restrained',
  ] as const)('%s does not incapacitate', (id) => expect(isIncapacitated(withC(id))).toBe(false));

  // PHB Appendix A: speed 0 conditions.
  it.each(['grappled', 'restrained', 'paralyzed', 'petrified', 'stunned', 'unconscious'] as const)(
    '%s: speed 0',
    (id) => expect(effectiveSpeed(withC(id), 30)).toBe(0),
  );

  it('prone and others leave speed alone (crawling cost is a movement rule for M4)', () => {
    expect(effectiveSpeed(withC('prone'), 30)).toBe(30);
    expect(effectiveSpeed(makeCreature(), 25)).toBe(25);
  });

  // PHB Appendix A: Exhaustion 2 = half speed, 5 = speed 0.
  it('exhaustion halves speed at level 2 and stops it at level 5', () => {
    expect(effectiveSpeed(makeCreature({ exhaustion: 1 }), 30)).toBe(30);
    expect(effectiveSpeed(makeCreature({ exhaustion: 2 }), 30)).toBe(15);
    expect(effectiveSpeed(makeCreature({ exhaustion: 2 }), 25)).toBe(12);
    expect(effectiveSpeed(makeCreature({ exhaustion: 5 }), 30)).toBe(0);
  });

  it('adds a condition once per source, and removes it', () => {
    let c = makeCreature();
    c = addCondition(c, { id: 'charmed', source: 'hag' });
    c = addCondition(c, { id: 'charmed', source: 'hag' });
    c = addCondition(c, { id: 'charmed', source: 'maelis' });
    expect(c.conditions).toHaveLength(2);
    expect(removeCondition(c, 'charmed', 'hag').conditions).toEqual([
      { id: 'charmed', source: 'maelis' },
    ]);
    expect(removeCondition(c, 'charmed').conditions).toEqual([]);
  });

  // PHB Appendix A: Unconscious. Falls prone.
  it('unconscious also makes the creature prone', () => {
    const { creature } = applyCondition(makeCreature(), { id: 'unconscious' });
    expect(creature.conditions.map((x) => x.id)).toEqual(['unconscious', 'prone']);
  });

  // PHB: Concentration. Incapacitated = concentration ends.
  it('an incapacitating condition ends concentration', () => {
    const { creature, log } = applyCondition(makeCreature({ concentration: 'bless' }), {
      id: 'stunned',
    });
    expect(creature.concentration).toBeNull();
    expect(log.map((l) => l.text)).toContain('Hero loses concentration on bless');
  });

  it('a non-incapacitating condition keeps concentration', () => {
    const { creature } = applyCondition(makeCreature({ concentration: 'bless' }), { id: 'prone' });
    expect(creature.concentration).toBe('bless');
  });
});
