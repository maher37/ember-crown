import { useEffect, useRef } from 'react';
import { SoundControls } from '../audio/SoundButton';
import './LoadDialog.css';

/** Settings from the title screen. Sound for now; difficulty and dice options are on the title screen. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title">Settings</h2>
        <div className="eyebrow">Sound</div>
        <SoundControls />
        <p className="muted small">
          Music and sounds start after your first click. Difficulty and dice options are on the
          title screen and can be changed any time.
        </p>
        <button type="button" ref={close} className="menu-secondary small-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
