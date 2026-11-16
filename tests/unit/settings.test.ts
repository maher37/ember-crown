import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, SETTINGS_STORAGE_KEY, useSettings } from '../../src/game/settings';

describe('settings store', () => {
  beforeEach(() => useSettings.getState().reset());

  it('starts on Medium with the mockup defaults', () => {
    const s = useSettings.getState();
    expect(s.difficulty).toBe('medium');
    expect(s.showRolls).toBe(true);
    expect(s.clickToRoll).toBe(false);
    expect(s.allowCombatSave).toBe(true);
  });

  it('changes difficulty', () => {
    useSettings.getState().setDifficulty('hard');
    expect(useSettings.getState().difficulty).toBe('hard');
  });

  it('flips a toggle', () => {
    useSettings.getState().toggle('clickToRoll');
    expect(useSettings.getState().clickToRoll).toBe(true);
  });

  it('remembers settings in localStorage', () => {
    useSettings.getState().setDifficulty('easy');
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.state).toEqual({ ...defaultSettings, difficulty: 'easy' });
    expect(stored.version).toBe(1);
  });
});
