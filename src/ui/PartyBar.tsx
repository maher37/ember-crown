import { getClass, getSpecies } from '../game/hero';
import { useGame } from '../game/store';
import { canLevelUp } from '../rules';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import './Explore.css';
import { Portrait } from './Portrait';

/** The party's cards along the bottom of the tavern and place maps. */
export function PartyBar() {
  const { game, goto, openLevelUp } = useGame();
  const g = game!;
  return (
    <div className="party-bar">
      {g.party.map((h) => (
        <div key={h.id} className="party-card">
          <button
            type="button"
            className="card-portrait"
            aria-label={`Character sheet: ${h.name}`}
            onClick={() => goto('party')}
          >
            <Portrait
              {...h.portrait}
              ears={ELF_EARS.has(h.speciesId) ? 'elf' : 'human'}
              cloth={CLASS_COPY[h.classId]!.cloth}
              label={`Portrait of ${h.name}`}
            />
          </button>
          <div className="card-info">
            <span className="card-name">{h.name}</span>
            <span className="small muted">
              {getSpecies(h.speciesId).name} {getClass(h.classId).name} {h.level}
            </span>
            <span className="small">
              HP {h.hp} / {h.maxHp} · AC {h.ac}
            </span>
            {canLevelUp(h) ? (
              <button type="button" className="level-btn" onClick={() => openLevelUp(h.id)}>
                Level up!
              </button>
            ) : (
              <div className="hp-mini">
                <div style={{ width: `${Math.round((h.hp / h.maxHp) * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
