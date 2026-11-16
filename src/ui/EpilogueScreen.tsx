import { useEffect, useState } from 'react';
import { epilogueSlides } from '../game/epilogue';
import { useGame } from '../game/store';
import './World.css';

/** The epilogue: the ending, what became of everyone, and Maelis's last letter. */
export function EpilogueScreen() {
  const { game, goto } = useGame();
  const slides = epilogueSlides(game!);
  const [i, setI] = useState(0);
  const last = i >= slides.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter')
        setI((n) => Math.min(slides.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);
  const s = slides[i];
  if (!s) return null;
  return (
    <div className="epilogue">
      <div className={`epilogue-card ${s.kind}`} aria-live="polite">
        <span className="eyebrow">
          {s.kind === 'ending' ? 'The ending' : s.kind === 'letter' ? 'A letter' : 'Afterwards'} ·{' '}
          {i + 1} of {slides.length}
        </span>
        <h1>{s.title}</h1>
        {s.note && <p className="epilogue-note">{s.note}</p>}
        {s.text.map((t) => (
          <p key={t} className={s.kind === 'letter' ? 'letter-text' : ''}>
            {t}
          </p>
        ))}
      </div>
      <nav className="epilogue-nav" aria-label="Epilogue">
        <button
          type="button"
          className="menu-secondary small-btn"
          disabled={i === 0}
          onClick={() => setI(i - 1)}
        >
          Back
        </button>
        {last ? (
          <button type="button" className="menu-primary small-btn" onClick={() => goto('title')}>
            The End · title screen
          </button>
        ) : (
          <button
            type="button"
            className="menu-primary small-btn"
            autoFocus
            onClick={() => setI(i + 1)}
          >
            Next
          </button>
        )}
      </nav>
    </div>
  );
}
