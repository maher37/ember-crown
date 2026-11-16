import { useRef, useState, type KeyboardEvent } from 'react';
import { difficulties } from '../data';
import type { DifficultyId } from '../data/schemas/difficulty';
import { useSettings, type ToggleKey } from '../game/settings';
import { TitleArt } from './TitleArt';
import './TitleScreen.css';

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'showRolls', label: 'Show every dice roll in the combat log' },
  { key: 'clickToRoll', label: 'Pause so I can click to roll my own dice' },
  { key: 'allowCombatSave', label: 'Allow saving during combat' },
];

// Save slots arrive in Milestone M3; until then all three show as empty.
const SLOTS = ['Autosave', 'Slot 1', 'Slot 2'];

/** Title screen, rebuilt from docs/mockups/Main.dc.html. */
export function TitleScreen() {
  const settings = useSettings();
  const levels = difficulties.levels;
  const current = levels.find((l) => l.id === settings.difficulty) ?? levels[1]!;
  const [notice, setNotice] = useState('');
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (id: DifficultyId) => settings.setDifficulty(id);

  // Arrow keys move through the difficulty radio group (WAI-ARIA radio group pattern).
  const onRadioKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (index + step + levels.length) % levels.length;
    pick(levels[next]!.id);
    radioRefs.current[next]?.focus();
  };

  return (
    <div className="title-screen">
      <section className="title-left">
        <TitleArt />
        <div className="title-heading">
          <h1>The Ember Crown</h1>
          <p>A tale that begins, as they do, in a tavern.</p>
        </div>

        <nav aria-label="Main menu" className="title-menu">
          <button
            type="button"
            className="menu-primary"
            onClick={() => setNotice('Character creation arrives in Milestone M3.')}
          >
            New Game<span>{current.name}</span>
          </button>
          <button type="button" className="menu-secondary" disabled title="No saved games yet">
            Continue
          </button>
          <div className="menu-row">
            <button type="button" className="menu-secondary" disabled title="No saved games yet">
              Load Game
            </button>
            <button
              type="button"
              className="menu-secondary"
              onClick={() =>
                setNotice(
                  'The full Settings screen comes later. The options on the right already work.',
                )
              }
            >
              Settings
            </button>
          </div>
          <p className="menu-notice" role="status" aria-live="polite">
            {notice}
          </p>
        </nav>

        <p className="title-attribution">
          Rules: D&amp;D 5th Edition (2014). Includes material from the System Reference Document
          5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0.
        </p>
      </section>

      <section className="title-right" aria-labelledby="new-adventure">
        <div className="title-heading-sm">
          <h2 id="new-adventure">New adventure</h2>
          <p>Difficulty can be changed at any time from Settings.</p>
        </div>

        <div role="radiogroup" aria-label="Difficulty" className="difficulty-group">
          {levels.map((level, i) => {
            const selected = level.id === current.id;
            return (
              <button
                key={level.id}
                ref={(el) => {
                  radioRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={`difficulty${selected ? ' is-selected' : ''}`}
                onClick={() => pick(level.id)}
                onKeyDown={(e) => onRadioKey(e, i)}
              >
                <span className="difficulty-name">{level.name}</span>
                <span className="difficulty-tag">{level.tag}</span>
              </button>
            );
          })}
        </div>

        <div className="panel">
          <div className="eyebrow eyebrow-ember">What {current.name} changes</div>
          <ul className="diff-lines" data-testid="difficulty-summary">
            {current.summary.map((line) => (
              <li key={line}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M7 1 L13 7 L7 13 L1 7 Z"
                    fill="none"
                    stroke="#e8833a"
                    strokeWidth="1.6"
                  />
                </svg>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="stack">
          <div className="eyebrow">Dice &amp; saving</div>
          {TOGGLES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={settings[key]}
              className={`toggle${settings[key] ? ' is-on' : ''}`}
              onClick={() => settings.toggle(key)}
            >
              <span>{label}</span>
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-knob" />
              </span>
            </button>
          ))}
        </div>

        <div className="stack">
          <div className="eyebrow">Saved games</div>
          <ul className="slots">
            {SLOTS.map((slot) => (
              <li key={slot} className="slot-empty">
                <span className="slot-name">{slot}</span>
                <span>Empty</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
