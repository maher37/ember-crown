import { difficulties } from '../data';
import { SoundControls } from '../audio/SoundButton';
import { ANIM_SPEEDS, useSettings, type ToggleKey } from '../game/settings';
import { useGame } from '../game/store';
import { Modal } from './ExploreDialogs';
import './Sheet.css';

const GROUPS: { title: string; toggles: { key: ToggleKey; label: string; note?: string }[] }[] = [
  {
    title: 'Dice and saving',
    toggles: [
      { key: 'showRolls', label: 'Show every dice roll in the combat log' },
      { key: 'clickToRoll', label: 'Pause so I can click to roll my own dice' },
      { key: 'allowCombatSave', label: 'Allow saving during combat' },
      {
        key: 'kindDice',
        label: 'Kind dice for your spells',
        note: 'Your spells land a little more often (a miss is sometimes quietly rerolled).',
      },
    ],
  },
  {
    title: 'Comfort',
    toggles: [
      {
        key: 'reduceMotion',
        label: 'Reduce motion',
        note: 'Stops background animation; the party jumps instead of walking; rests run fast.',
      },
      {
        key: 'reduceFlashing',
        label: 'Reduce flashing',
        note: 'No bright flashes when someone is hit or a spell goes off; Color Spray stays still.',
      },
      {
        key: 'shake',
        label: 'Shake tokens when hit',
        note: 'Off: a hit shows as a red outline instead.',
      },
    ],
  },
];

/** Every setting in one place: difficulty, dice, sound, motion. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const combat = useGame((s) => s.combat);
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="journal-scroll settings">
        <section aria-label="Difficulty">
          <h3 className="eyebrow">Difficulty</h3>
          <div role="radiogroup" aria-label="Difficulty" className="seg">
            {difficulties.levels.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={settings.difficulty === d.id}
                className={settings.difficulty === d.id ? 'on' : ''}
                onClick={() => settings.setDifficulty(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
          <p className="small muted">
            {difficulties.levels.find((d) => d.id === settings.difficulty)!.tag}. Changes the number
            of enemies from the next fight
            {combat ? ' (use the switch in the fight to change this one)' : ''}; XP rewards stay the
            same.
          </p>
        </section>
        {GROUPS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="eyebrow">{g.title}</h3>
            {g.toggles.map((t) => (
              <label key={t.key} className="setting-row">
                <input
                  type="checkbox"
                  checked={settings[t.key]}
                  onChange={() => settings.toggle(t.key)}
                />
                <span>
                  {t.label}
                  {t.note && <span className="small muted"> · {t.note}</span>}
                </span>
              </label>
            ))}
          </section>
        ))}
        <section aria-label="Combat animation">
          <h3 className="eyebrow">Combat animation</h3>
          <div role="radiogroup" aria-label="Animation speed" className="seg">
            {ANIM_SPEEDS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={settings.animSpeed === a.id}
                className={settings.animSpeed === a.id ? 'on' : ''}
                onClick={() => settings.setAnimSpeed(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="small muted">
            Arrows, spells and damage numbers. Instant shows only the numbers. Reduce motion also
            skips the flying effects.
          </p>
        </section>
        <section aria-label="Sound">
          <h3 className="eyebrow">Sound</h3>
          <SoundControls />
          <p className="small muted">Music and sounds start after your first click.</p>
        </section>
      </div>
    </Modal>
  );
}
