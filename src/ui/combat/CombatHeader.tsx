// The combat header (title, round, difficulty) and the initiative strip (split from CombatScreen.tsx).
import { difficulties } from '../../data';
import type { DifficultyId } from '../../data/schemas/difficulty';
import type { CombatState } from '../../game/combat';
import { SoundButton } from '../../audio/SoundButton';

export function CombatHeader({
  s,
  encounterText,
  onDifficulty,
}: {
  s: CombatState;
  encounterText: string;
  onDifficulty: (d: DifficultyId) => void;
}) {
  return (
    <header className="combat-header">
      <div className="row baseline">
        <h1>{s.name}</h1>
        <span className="muted">
          Round {s.round} · {encounterText}
        </span>
      </div>
      <div className="row">
        <SoundButton />
        <div role="radiogroup" aria-label="Difficulty" className="seg">
          {difficulties.levels.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={s.difficulty === d.id}
              className={s.difficulty === d.id ? 'on' : ''}
              onClick={() => onDifficulty(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Initiative order: whoever is acting comes first. */
export function TurnOrder({ s, meId }: { s: CombatState; meId: string }) {
  return (
    <div className="initiative" aria-label="Turn order">
      <span className="eyebrow muted-eyebrow">Initiative</span>
      {/* Whoever is acting comes first; those who've gone move to the back (playtest). */}
      {[...s.order.slice(s.turnIndex), ...s.order.slice(0, s.turnIndex)].map((id, i, all) => {
        const c = s.combatants[id]!;
        const down = c.gone || c.creature.dead || c.creature.hp === 0;
        const nextRound = i === all.length - s.turnIndex && s.turnIndex > 0;
        return (
          <div
            key={id}
            className={`chip ${id === meId ? 'on' : ''} ${down ? 'down' : ''} ${nextRound ? 'next-round' : ''}`}
            aria-current={id === meId ? 'true' : undefined}
            title={nextRound ? `Round ${s.round + 1} starts here` : undefined}
          >
            <span className={`dot ${c.side}`} aria-hidden="true" />
            <span>{c.name}</span>
            <span className="faint">{c.initiative}</span>
          </div>
        );
      })}
    </div>
  );
}
