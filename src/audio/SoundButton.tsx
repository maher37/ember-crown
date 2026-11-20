import { useEffect, useRef, useState } from 'react';
import { useSettings, type VolumeKey } from '../game/settings';
import './sound.css';

const LABELS: Record<VolumeKey, string> = {
  music: 'Music',
  ambience: 'Place sounds',
  effects: 'Effects',
};

/** The three volume sliders and the mute switch (used on the title screen and in the sound pop-up). */
export function SoundControls() {
  const s = useSettings();
  return (
    <div className="sound-controls">
      {(Object.keys(LABELS) as VolumeKey[]).map((k) => (
        <label key={k} className="sound-row">
          <span>{LABELS[k]}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s[k] * 100)}
            onChange={(e) => s.setVolume(k, Number(e.target.value) / 100)}
            aria-label={`${LABELS[k]} volume`}
          />
          <span className="sound-pct">{Math.round(s[k] * 100)}%</span>
        </label>
      ))}
      <label className="sound-row mute">
        <input type="checkbox" checked={s.muted} onChange={s.toggleMute} />
        <span>Mute all sound (shortcut: M)</span>
      </label>
    </div>
  );
}

/** A small speaker button for screen headers; opens the sound controls. */
export function SoundButton() {
  const muted = useSettings((s) => s.muted);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="sound-button-wrap" ref={ref}>
      <button
        type="button"
        className="menu-secondary small-btn sound-button"
        aria-label={muted ? 'Sound (muted)' : 'Sound'}
        aria-expanded={open}
        title="Sound settings (M mutes)"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path
              d="M16 9l5 6M21 9l-5 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {open && (
        <div className="sound-pop" role="dialog" aria-label="Sound">
          <h2>Sound</h2>
          <SoundControls />
        </div>
      )}
    </div>
  );
}
