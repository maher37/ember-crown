// D32: camp companions at the fire. Each one either has something to say (a one-time scene in
// fire.ink) or just an idle line.
import { campCompanions, fireSceneFor } from '../game/companions';
import type { GameState } from '../game/save';
import { useGame } from '../game/store';

/** How many companions have something new to say. */
export const firesWaiting = (g: GameState) =>
  campCompanions(g).filter((c) => fireSceneFor(g, c.id)).length;

export function FirePanel({ onClose }: { onClose: () => void }) {
  const { game, talkAtFire } = useGame();
  const g = game!;
  const here = campCompanions(g);
  return (
    <section className="fire-panel" aria-label="Around the fire">
      <div className="row between baseline">
        <h2 className="eyebrow">Around the fire</h2>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      {here.length === 0 ? (
        <p className="small muted">
          Nobody else is at the fire yet. Friends you make on the road may join the camp.
        </p>
      ) : (
        <ul className="fire-list">
          {here.map((c) => {
            const scene = fireSceneFor(g, c.id);
            return (
              <li key={c.id} className="row between baseline">
                <span>
                  <span className="strong">{c.name}</span>
                  <br />
                  <span className="small muted">{scene ? 'has something to say' : c.idle}</span>
                </span>
                {scene && (
                  <button
                    type="button"
                    className="menu-secondary small-btn"
                    onClick={() => talkAtFire(c.id)}
                  >
                    Talk
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
