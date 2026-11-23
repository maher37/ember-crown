import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statusWords, TokenStatus } from '../../src/ui/combat/TokenStatus';
import { f2 } from './combat/helpers';

// M11: condition icons and the downed state (Animation_Plan.md, "Downed").
describe('token status', () => {
  it('a downed hero shows a blood drop and 3 + 3 death-save pips', () => {
    const s = f2();
    const mira = s.combatants['mira']!;
    mira.creature = {
      ...mira.creature,
      hp: 0,
      deathSaves: { successes: 1, failures: 2 },
      conditions: [{ id: 'unconscious' }, { id: 'prone' }],
    };
    const { container } = render(<TokenStatus c={mira} />);
    expect(container.querySelectorAll('.death-pips i')).toHaveLength(6);
    expect(container.querySelectorAll('.death-pips i.ok.on')).toHaveLength(1);
    expect(container.querySelectorAll('.death-pips i.bad.on')).toHaveLength(2);
    expect(container.querySelector('.blood-drop')).not.toBeNull();
    expect(statusWords(mira)).toContain('death saves 1 of 3 successes, 2 of 3 failures');
  });
  it('a stable hero says so; a dead one gets a skull', () => {
    const s = f2();
    const mira = s.combatants['mira']!;
    mira.creature = { ...mira.creature, hp: 0, stable: true };
    expect(render(<TokenStatus c={mira} />).container.textContent).toContain('Stable');
    mira.creature = { ...mira.creature, dead: true };
    expect(render(<TokenStatus c={mira} />).container.querySelector('.skull')).not.toBeNull();
  });
  it('conditions and concentration get icons and words', () => {
    const s = f2();
    const g = s.combatants['goblin-a']!;
    g.creature = {
      ...g.creature,
      conditions: [{ id: 'poisoned' }, { id: 'frightened' }],
      concentration: 'bless',
    };
    const { container } = render(<TokenStatus c={g} />);
    expect(container.querySelectorAll('.status-icon')).toHaveLength(2);
    expect(container.querySelector('.conc-ring')).not.toBeNull();
    expect(statusWords(g)).toBe(', frightened, poisoned, concentrating');
  });
});
