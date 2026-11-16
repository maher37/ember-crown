import { useEffect, useRef, useState } from 'react';
import { describeSave, listSlots, parseSave, SLOT_NAMES } from '../game/save';
import { useGame } from '../game/store';
import './LoadDialog.css';

/** Pick a save slot, or import a save file. */
export function LoadDialog({ onClose }: { onClose: () => void }) {
  const loadGame = useGame((s) => s.loadGame);
  const [error, setError] = useState('');
  const slots = listSlots();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseSave(await file.text());
    if (result.ok) loadGame(result.save);
    else setError(result.error);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="load-title">Load game</h2>
        <ul className="load-list">
          {slots.map((s, i) => (
            <li key={s.slot}>
              <div>
                <div className="strong">{SLOT_NAMES[s.slot]}</div>
                <div className="muted small">
                  {s.save
                    ? `${describeSave(s.save).party} · ${describeSave(s.save).detail}`
                    : (s.error ?? 'Empty')}
                </div>
              </div>
              <button
                type="button"
                ref={i === 0 ? first : undefined}
                className="menu-secondary small-btn"
                disabled={!s.save}
                onClick={() => s.save && loadGame(s.save)}
              >
                Load
              </button>
            </li>
          ))}
        </ul>
        <label className="import">
          Import a save file (.json)
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="menu-secondary small-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
