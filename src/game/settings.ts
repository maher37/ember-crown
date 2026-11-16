import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { difficulties } from '../data';
import type { DifficultyId } from '../data/schemas/difficulty';

/**
 * Player settings. These live outside save files (they apply to every game) and are
 * kept in the browser's localStorage. Difficulty can change at any time (D9).
 */
export interface Settings {
  difficulty: DifficultyId;
  /** Show every dice roll in the combat log. */
  showRolls: boolean;
  /** Pause so the player can click to roll their own dice. */
  clickToRoll: boolean;
  /** Allow saving during combat. */
  allowCombatSave: boolean;
}

export const defaultSettings: Settings = {
  difficulty: difficulties.default,
  showRolls: true,
  clickToRoll: false,
  allowCombatSave: true,
};

export type ToggleKey = 'showRolls' | 'clickToRoll' | 'allowCombatSave';

interface SettingsStore extends Settings {
  setDifficulty: (d: DifficultyId) => void;
  toggle: (key: ToggleKey) => void;
  reset: () => void;
}

export const SETTINGS_STORAGE_KEY = 'ember-crown:settings';

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setDifficulty: (difficulty) => set({ difficulty }),
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
      reset: () => set(defaultSettings),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ difficulty, showRolls, clickToRoll, allowCombatSave }) => ({
        difficulty,
        showRolls,
        clickToRoll,
        allowCombatSave,
      }),
    },
  ),
);
