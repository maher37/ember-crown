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
  /** Sound volumes, 0 to 1 (music, the sound of the place, and effects). */
  music: number;
  ambience: number;
  effects: number;
  /** All sound off (the M key toggles it). */
  muted: boolean;
}

export const defaultSettings: Settings = {
  difficulty: difficulties.default,
  showRolls: true,
  clickToRoll: false,
  allowCombatSave: true,
  music: 0.6,
  ambience: 0.7,
  effects: 0.8,
  muted: false,
};

export type VolumeKey = 'music' | 'ambience' | 'effects';

export type ToggleKey = 'showRolls' | 'clickToRoll' | 'allowCombatSave';

interface SettingsStore extends Settings {
  setDifficulty: (d: DifficultyId) => void;
  toggle: (key: ToggleKey) => void;
  setVolume: (key: VolumeKey, value: number) => void;
  toggleMute: () => void;
  reset: () => void;
}

export const SETTINGS_STORAGE_KEY = 'ember-crown:settings';

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setDifficulty: (difficulty) => set({ difficulty }),
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
      setVolume: (key, value) => set({ [key]: Math.max(0, Math.min(1, value)) }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      reset: () => set(defaultSettings),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Settings saved before sound existed simply get the default volumes.
      partialize: ({
        difficulty,
        showRolls,
        clickToRoll,
        allowCombatSave,
        music,
        ambience,
        effects,
        muted,
      }) => ({
        difficulty,
        showRolls,
        clickToRoll,
        allowCombatSave,
        music,
        ambience,
        effects,
        muted,
      }),
    },
  ),
);
