import { useState } from 'react';
import { places } from '../data';
import { formatDate } from '../game/calendar';
import { useGame } from '../game/store';
import { currentPlace, isUnlocked, travelHours } from '../game/travel';
import { PLACE_SCENES } from '../game/dialogue';
import { canLevelUp } from '../rules';
import { InventoryDialog, SpellsDialog } from './ExploreDialogs';
import mapArt from './art/worldmap.svg?raw';
import './World.css';
import { SoundButton } from '../audio/SoundButton';

const KIND_COLORS: Record<string, [string, string]> = {
  town: ['#f8f3e8', '#5a3b22'],
  main: ['#e8833a', '#fff3e2'],
  side: ['#4f8fc0', '#eef6fc'],
  elite: ['#7a2a1f', '#f3e3d0'],
  locked: ['#9a9488', '#5a5040'],
};
const REGION_NAMES: Record<string, string> = {
  none: 'None (in town)',
  road: 'Grayflow road and foothills · d20, 18+ (15%)',
  marsh: 'Marsh of Chelimber · d20, 18+ (15%)',
  heights: 'High Greypeaks · d20, 18+ (15%)',
};
const DANGER: Record<string, [string, string]> = {
  town: ['Safe', '#9fd18a'],
  main: ['Medium fights', '#e8c27a'],
  side: ['Easy to Hard', '#e8c27a'],
  elite: ['Deadly at your level', '#ff9c8a'],
  locked: ['Unknown', '#aeb9c9'],
};

/** Travel map of the southern Greypeaks (rebuilt from docs/mockups/WorldMap.dc.html). */
export function WorldMapScreen() {
  const { game, travelTo, travelLog, goto, openCamp, enterPlace } = useGame();
  const [items, setItems] = useState(false);
  const [spellsOpen, setSpells] = useState(false);
  const g = game!;
  const here = currentPlace(g);
  const [selId, setSel] = useState(here.id === 'ashford' ? 'old-mine' : here.id);
  const sel = places.find((p) => p.id === selId)!;
  const locked = !isUnlocked(g, sel);
  const isHere = sel.id === here.id;
  const hours = travelHours(here, sel);
  const kind = locked ? 'locked' : sel.kind;

  return (
    <div className="world">
      <header className="world-header">
        <div className="row baseline">
          <h1>The Southern Greypeaks</h1>
          <span className="muted">The North of Faerûn · travel map</span>
        </div>
        <div className="row">
          <span className="date" aria-label="Date">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="#e8c27a"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10 H20 M9 3 V7 M15 3 V7" />
            </svg>
            {formatDate(g.clock)}
          </span>
          {here.id === 'ashford' ? (
            <button
              type="button"
              className="menu-secondary small-btn"
              onClick={() => goto('explore')}
            >
              Back to the Drowned Lantern
            </button>
          ) : (
            <button type="button" className="menu-secondary small-btn" onClick={() => openCamp()}>
              Make camp here
            </button>
          )}
          <button type="button" className="menu-secondary small-btn" onClick={() => goto('party')}>
            Party{g.party.some((h) => canLevelUp(h)) ? ' · level up!' : ''}
          </button>
          <button type="button" className="menu-secondary small-btn" onClick={() => setItems(true)}>
            Inventory
          </button>
          <button
            type="button"
            className="menu-secondary small-btn"
            onClick={() => setSpells(true)}
          >
            Spells &amp; healing
          </button>
          <SoundButton />
        </div>
      </header>
      <div className="world-main">
        <div className="world-map">
          <div className="map-art" dangerouslySetInnerHTML={{ __html: mapArt }} />
          <span
            className="party-pulse"
            style={{ left: here.x - 13, top: here.y - 13 }}
            aria-hidden="true"
          />
          {places.map((p) => {
            const k = isUnlocked(g, p) ? p.kind : 'locked';
            const [bg, border] = KIND_COLORS[k]!;
            const size = p.kind === 'town' ? 26 : 22;
            return (
              <button
                key={p.id}
                type="button"
                className={`marker ${p.id === selId ? 'on' : ''}`}
                aria-label={`${p.name} (${isUnlocked(g, p) ? p.tag : `Act ${['I', 'II', 'III'][p.act - 1]} · locked`})${p.id === here.id ? ', you are here' : ''}`}
                aria-pressed={p.id === selId}
                style={{
                  left: p.x - size / 2,
                  top: p.y - size / 2,
                  width: size,
                  height: size,
                  background: bg,
                  border: `2px ${k === 'locked' ? 'dashed' : 'solid'} ${border}`,
                }}
                onClick={() => setSel(p.id)}
              >
                {p.kind === 'elite' && isUnlocked(g, p) && (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <circle cx="7" cy="6" r="5" fill="#f3e3d0" />
                    <rect x="4.5" y="9" width="5" height="3" fill="#f3e3d0" />
                    <circle cx="5" cy="6" r="1.4" fill="#5a1f17" />
                    <circle cx="9" cy="6" r="1.4" fill="#5a1f17" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        <aside className="world-aside">
          <div className="place-card">
            <span className="eyebrow">
              {locked ? `Act ${['I', 'II', 'III'][sel.act - 1]} · unexplored` : sel.tag}
            </span>
            <span className="place-name">{sel.name}</span>
            <span className="small">
              {!locked
                ? sel.desc
                : sel.act <= g.act && sel.requires
                  ? sel.requires.hint
                  : 'The story hasn’t reached here yet.'}
            </span>
            <dl className="place-facts">
              <div>
                <dt>Travel time</dt>
                <dd>
                  {isHere
                    ? 'You are here'
                    : locked
                      ? '—'
                      : `${hours} hour${hours === 1 ? '' : 's'} on foot`}
                </dd>
              </div>
              <div>
                <dt>Danger</dt>
                <dd style={{ color: DANGER[kind]![1] }}>{DANGER[kind]![0]}</dd>
              </div>
              <div>
                <dt>Road encounters</dt>
                <dd>{REGION_NAMES[sel.region === 'none' ? here.region : sel.region]}</dd>
              </div>
            </dl>
            {isHere && PLACE_SCENES[sel.id] && (
              <button type="button" className="travel-btn" onClick={() => enterPlace(sel.id)}>
                Explore {sel.name}
              </button>
            )}
            <button
              type="button"
              className="travel-btn"
              disabled={isHere || locked}
              onClick={() => travelTo(sel.id)}
            >
              {isHere
                ? 'You are here'
                : locked
                  ? sel.act <= g.act
                    ? 'Not yet'
                    : `Unlocks in Act ${['I', 'II', 'III'][sel.act - 1]}`
                  : `Travel (${hours} h)`}
            </button>
            {!isHere && !locked && sel.id !== 'ashford' && !PLACE_SCENES[sel.id] && (
              <span className="small muted">
                What waits there arrives with a later milestone; you can camp there and travel back.
              </span>
            )}
          </div>
          <div className="travel-log" role="log" aria-live="polite">
            <span className="eyebrow muted-eyebrow">Travel log</span>
            {travelLog.length === 0 && (
              <div className="small muted">The party is in {here.name}.</div>
            )}
            {travelLog.map((l, i) => (
              <div
                key={`${i}-${l}`}
                className={`small ${/Encounter!|birdsong/.test(l) ? 'enc' : /^Road check/.test(l) ? 'roll' : /^Arrived|^Victory/.test(l) ? 'ok' : ''}`}
              >
                {l}
              </div>
            ))}
          </div>
          <div className="legend small">
            <span>
              <span className="legend-dot" style={{ background: '#e8833a' }} /> Main story
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#4f8fc0' }} /> Side quest
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#7a2a1f' }} /> Elite (Deadly)
            </span>
            <span>
              <span className="legend-dot" style={{ background: '#9a9488' }} /> Unexplored
            </span>
          </div>
        </aside>
      </div>
      {items && <InventoryDialog onClose={() => setItems(false)} />}
      {spellsOpen && <SpellsDialog onClose={() => setSpells(false)} />}
    </div>
  );
}
