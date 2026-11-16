import { useState } from 'react';
import { getBackground, getClass, getSpecies, skillBonus, type Hero } from '../game/hero';
import { SLOT_NAMES, type SlotId } from '../game/save';
import { useGame } from '../game/store';
import { ABILITIES, abilityModifier } from '../rules';
import { CLASS_COPY, ELF_EARS, signed, SKILL_NAMES } from './creatorCopy';
import './PartyScreen.css';
import { Portrait } from './Portrait';
import { downloadSave } from './saveFiles';

/**
 * The party sheet: the screen after creation and after loading. A stand-in for the tavern
 * until exploration arrives (M5).
 */
export function PartyScreen() {
  const { game, saveTo, goto } = useGame();
  const [message, setMessage] = useState('Autosaved.');
  if (!game) return null;

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
          <h1>Your party</h1>
          <p className="muted">The Drowned Lantern, Ashford · Act I: Lantern Night</p>
        </div>
        <div className="party-actions">
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
        {message} The tavern, Edric and Lantern Night arrive in Milestone M5.
      </p>
      <div className="party-grid">
        {game.party.map((h) => (
          <HeroCard key={h.id} hero={h} />
        ))}
      </div>
    </div>
  );
}

function HeroCard({ hero }: { hero: Hero }) {
  const cls = getClass(hero.classId);
  const sp = getSpecies(hero.speciesId);
  return (
    <article className="hero-card" aria-label={hero.name}>
      <div className="hero-top">
        <div className="hero-portrait">
          <Portrait
            {...hero.portrait}
            ears={ELF_EARS.has(sp.id) ? 'elf' : 'human'}
            cloth={CLASS_COPY[cls.id]!.cloth}
            label={`Portrait of ${hero.name}`}
          />
        </div>
        <div>
          <h2>{hero.name}</h2>
          {hero.origin === 'corin' && <span className="tag">Origin</span>}
          <p className="small muted">
            {sp.name} {cls.name} · Level {hero.level}
          </p>
          <p className="small muted">{getBackground(hero.backgroundId).name}</p>
        </div>
      </div>
      <dl className="hero-stats">
        <div>
          <dt>HP</dt>
          <dd>
            {hero.hp}/{hero.maxHp}
          </dd>
        </div>
        <div>
          <dt>AC</dt>
          <dd>{hero.ac}</dd>
        </div>
        <div>
          <dt>Init</dt>
          <dd>{signed(abilityModifier(hero.abilities.dex))}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{hero.speed}</dd>
        </div>
      </dl>
      <dl className="hero-abilities">
        {ABILITIES.map((a) => (
          <div key={a}>
            <dt>{a.toUpperCase()}</dt>
            <dd>
              {hero.abilities[a]}{' '}
              <span className="muted">({signed(abilityModifier(hero.abilities[a]))})</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="small">
        <span className="eyebrow-inline">Skills</span>{' '}
        {hero.skills.map((s) => `${SKILL_NAMES[s]} ${signed(skillBonus(hero, s))}`).join(', ')}
      </p>
      <p className="small muted">
        <span className="eyebrow-inline">Gear</span>{' '}
        {[hero.equipment.armor, hero.equipment.shield && 'shield', ...hero.equipment.weapons]
          .filter(Boolean)
          .join(', ')
          .replace(/-/g, ' ')}
      </p>
    </article>
  );
}
