import { useState } from 'react';
import { formationOrder } from '../game/formation';
import { getClass } from '../game/hero';
import { SLOT_NAMES, type SlotId } from '../game/save';
import { homeScreen, useGame } from '../game/store';
import { canLevelUp } from '../rules';
import { CharacterSheet } from './CharacterSheet';
import './PartyScreen.css';
import { Portrait } from './Portrait';
import { heroPortrait } from './heroLook';
import { downloadSave } from './saveFiles';

/**
 * The party sheet: the screen after creation and after loading. A stand-in for the tavern
 * until exploration arrives (M5).
 */
export function PartyScreen() {
  const { game, saveTo, goto, goHome, openLevelUp, setFormation, sheetHeroId } = useGame();
  const [message, setMessage] = useState('');
  if (!game) return null;
  const order = formationOrder(game).map((id) => game.party.find((h) => h.id === id)!);
  const selected = game.party.find((h) => h.id === sheetHeroId) ?? order[0]!;

  const save = (slot: SlotId) => {
    try {
      saveTo(slot);
      setMessage(`Saved to ${SLOT_NAMES[slot]}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="party-screen">
      <header className="party-header">
        <div>
          <h1>Party</h1>
          <p className="muted">
            {game.location === 'drowned-lantern' ? 'The Drowned Lantern, Ashford' : 'On the road'} ·
            Act {['I', 'II', 'III'][game.act - 1]}
          </p>
        </div>
        <div className="party-actions">
          <button type="button" className="menu-primary small-btn" onClick={goHome}>
            {homeScreen(game) === 'explore'
              ? 'Back to the tavern'
              : homeScreen(game) === 'placemap'
                ? 'Back'
                : 'Back to the map'}
          </button>
          {game.party
            .filter((h) => canLevelUp(h))
            .map((h) => (
              <button
                key={h.id}
                type="button"
                className="menu-primary small-btn"
                onClick={() => openLevelUp(h.id)}
              >
                Level up {h.name.split(' ')[0]}!
              </button>
            ))}
          <button type="button" className="menu-secondary small-btn" onClick={() => save('slot1')}>
            Save to Slot 1
          </button>
          <button type="button" className="menu-secondary small-btn" onClick={() => save('slot2')}>
            Save to Slot 2
          </button>
          <button
            type="button"
            className="menu-secondary small-btn"
            onClick={() => downloadSave(saveTo('autosave'))}
          >
            Export save file
          </button>
          <button type="button" className="menu-secondary small-btn" onClick={() => goto('title')}>
            Title screen
          </button>
        </div>
      </header>
      <p className="party-status" role="status">
        {message}
      </p>
      <div className="party-body">
        <aside className="party-side">
          <nav aria-label="Party members" className="hero-tabs">
            {order.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`hero-tab${h.id === selected.id ? ' on' : ''}`}
                aria-current={h.id === selected.id}
                aria-label={`${h.name}: ${getClass(h.classId).name} ${h.level}, HP ${h.hp} of ${h.maxHp}${canLevelUp(h) ? ', level up ready' : ''}`}
                onClick={() => useGame.setState({ sheetHeroId: h.id })}
              >
                <span className="hero-tab-portrait">
                  <Portrait {...heroPortrait(h)} />
                </span>
                <span className="hero-tab-text">
                  <span className="strong">{h.name}</span>
                  <span className="small muted">
                    {getClass(h.classId).name} {h.level} · HP {h.hp}/{h.maxHp} · AC {h.ac}
                  </span>
                  {canLevelUp(h) && <span className="small level-flag">Level up ready</span>}
                </span>
              </button>
            ))}
          </nav>
          <section className="marching" aria-label="Marching order">
            <span className="eyebrow">Marching order (front to back)</span>
            <ol>
              {formationOrder(game).map((id, i, all) => {
                const h = game.party.find((x) => x.id === id)!;
                const move = (j: number) => {
                  const o = [...all];
                  [o[i], o[j]] = [o[j]!, o[i]!];
                  setFormation(o);
                };
                return (
                  <li key={id}>
                    <span>{h.name}</span>
                    <button
                      type="button"
                      className="mini"
                      disabled={i === 0}
                      aria-label={`Move ${h.name} forward`}
                      onClick={() => move(i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mini"
                      disabled={i === all.length - 1}
                      aria-label={`Move ${h.name} back`}
                      onClick={() => move(i + 1)}
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
        <CharacterSheet key={selected.id} hero={selected} />
      </div>
    </div>
  );
}
