import { useEffect, useState } from 'react';
import { quests } from '../data';
import { getClass, getSpecies } from '../game/hero';
import { formatDate } from '../game/calendar';
import { partyLevel } from '../game/journal';
import { useGame } from '../game/store';
import { canLevelUp, XP_THRESHOLDS } from '../rules';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import './Explore.css';
import { JournalDialog, SaveDialog, SpellsDialog } from './ExploreDialogs';
import { Portrait } from './Portrait';

interface Hotspot {
  id: string;
  label: string;
  /** Ink knot to start. */
  knot: string;
  x: number;
  y: number;
  hidden?: boolean;
  /** Something new to say ("!"). */
  news?: boolean;
  kind: 'quest' | 'npc' | 'object' | 'exit';
  /** Letter or symbol on the marker. */
  glyph: string;
}

/** The Drowned Lantern on Lantern Night (rebuilt from docs/mockups/Exploration.dc.html). */
export function ExploreScreen() {
  const { game, talk, openLevelUp, toasts, clearToasts, goto, saveTo, openCamp } = useGame();
  const [dialog, setDialog] = useState<null | 'journal' | 'spells' | 'save'>(null);
  const g = game!;
  const f = (k: string) => !!g.flags[k];

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(clearToasts, 6000);
    return () => clearTimeout(t);
  }, [toasts, clearToasts]);

  // First visit: the scene-setting card (the full Lantern Night opening arrives in M7).
  useEffect(() => {
    if (!g.flags['intro_seen']) {
      useGame.setState({ game: { ...g, flags: { ...g.flags, intro_seen: true } } });
      talk('intro');
    }
  }, [g, talk]);

  const talkedBrannoc = g.quests['lantern-night']?.steps.includes('talk-brannoc');
  const spots: Hotspot[] = [
    {
      id: 'brannoc',
      glyph: 'B',
      label: 'Brannoc Hale, innkeeper',
      knot: 'brannoc',
      x: 690,
      y: 74,
      news: !talkedBrannoc || (!f('has_letter') && !f('letter_lost')),
      kind: 'quest',
    },
    {
      id: 'edric',
      glyph: 'E',
      label: 'Wounded courier',
      knot: 'edric',
      x: 572,
      y: 414,
      news: !f('edric_tended') || !f('edric_clue'),
      kind: 'quest',
    },
    {
      id: 'strangers',
      glyph: 'S',
      label: 'Strangers by the hearth',
      knot: 'strangers',
      x: 200,
      y: 182,
      hidden: f('strangers_gone'),
      kind: 'npc',
    },
    {
      id: 'cellar',
      glyph: '◇',
      label: 'Cellar trapdoor',
      knot: 'cellar',
      x: 722,
      y: 322,
      news: !f('cellar_asked'),
      kind: 'object',
    },
    {
      id: 'hooded',
      glyph: '?',
      label: 'Hooded figure',
      knot: 'hooded',
      x: 840,
      y: 420,
      hidden: f('hooded_gone'),
      kind: 'npc',
    },
    {
      id: 'door',
      label: 'Front door',
      knot: 'front_door',
      x: 455,
      y: 466,
      glyph: '⇣',
      kind: 'exit',
    },
  ];
  const main = Object.entries(g.quests)
    .map(([id, st]) => ({ q: quests.find((x) => x.id === id)!, st }))
    .filter((x) => x.q);
  const activeMain = main.filter((x) => x.q.kind === 'main' && x.st.status === 'active');
  const sides = main.filter((x) => x.q.kind === 'side');
  const { level, xp } = partyLevel(g);
  const nextXp = XP_THRESHOLDS[level] ?? xp;
  const prevXp = XP_THRESHOLDS[level - 1] ?? 0;

  return (
    <div className="explore">
      <header className="explore-header">
        <div className="row baseline">
          <h1>The Drowned Lantern</h1>
          <span className="muted">
            Ashford · Act {['I', 'II', 'III'][g.act - 1]} · {formatDate(g.clock)}
          </span>
        </div>
        <button
          type="button"
          className="menu-secondary small-btn"
          onClick={() => {
            saveTo('autosave');
            goto('title');
          }}
        >
          Menu
        </button>
      </header>

      <div className="explore-main">
        <div className="tavern-map">
          <TavernArt />
          {spots
            .filter((s) => !s.hidden)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className={`hotspot ${s.kind}`}
                style={{ left: s.x - 22, top: s.y - 22 }}
                aria-label={`${s.label}${s.news ? ' (new)' : ''}`}
                onClick={() => talk(s.knot)}
              >
                <span aria-hidden="true">
                  {s.kind === 'exit'
                    ? '⇣'
                    : s.kind === 'object'
                      ? '◇'
                      : s.id === 'hooded'
                        ? '?'
                        : s.label[0]}
                </span>
                {s.news && (
                  <span className="news" aria-hidden="true">
                    !
                  </span>
                )}
                <span className="spot-label" aria-hidden="true">
                  {s.label}
                </span>
              </button>
            ))}
          <button
            type="button"
            className="hotspot object"
            style={{ left: 96 - 22, top: 417 - 22 }}
            aria-label="Stairs to the rooms (rest)"
            onClick={() => openCamp('inn')}
          >
            <span aria-hidden="true">≡</span>
            <span className="spot-label" aria-hidden="true">
              Stairs
            </span>
          </button>
          {g.party.map((h, i) => (
            <span
              key={h.id}
              className="party-token"
              style={{
                left: [455, 410, 500, 455][i]! - 16,
                top: [400, 424, 424, 440][i]! - 16 - 40,
              }}
              aria-hidden="true"
            >
              {h.name[0]}
            </span>
          ))}
        </div>

        <aside className="journal-panel" aria-label="Journal">
          {activeMain.map(({ q, st }) => (
            <div key={q.id} className="quest-card main">
              <span className="eyebrow">Main quest</span>
              <span className="quest-title">{q.title}</span>
              {q.steps.map((s) => (
                <div key={s.id} className={`step ${st.steps.includes(s.id) ? 'done' : ''}`}>
                  <span className="box" aria-hidden="true">
                    {st.steps.includes(s.id) ? '✓' : ''}
                  </span>
                  <span>
                    {s.text}
                    <span className="sr-only">{st.steps.includes(s.id) ? ' (done)' : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
          {sides.map(({ q, st }) => (
            <div key={q.id} className="quest-card side">
              <span className="eyebrow muted-eyebrow">Side quest · optional XP</span>
              <span className="quest-title">{q.title}</span>
              <span className="small muted">{st.status === 'done' ? 'Complete.' : q.summary}</span>
            </div>
          ))}
          <div className="xp-card">
            <div className="row between small">
              <span>Party level {level}</span>
              <span className="muted">
                {xp} / {nextXp} XP
              </span>
            </div>
            <div className="xp-bar">
              <div
                style={{
                  width: `${Math.min(100, Math.round(((xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100))}%`,
                }}
              />
            </div>
            <span className="small faint">
              Side quests put you ahead of the main story's curve.
            </span>
          </div>
          <div className="legend small">
            <span>
              <span className="legend-dot party" /> Your party
            </span>
            <span>
              <span className="legend-dot quest" /> Quest character
            </span>
            <span>
              <span className="legend-dot npc" /> Townsfolk and strangers
            </span>
          </div>
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t, i) => (
              <div key={`${t}-${i}`} className="toast">
                {t}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="explore-footer">
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
        <nav aria-label="Actions" className="explore-actions">
          <button
            type="button"
            disabled
            title="Inventory arrives with Act I's items (Milestone M7)"
          >
            Inventory
          </button>
          <button type="button" onClick={() => setDialog('spells')}>
            Spells
          </button>
          <button type="button" onClick={() => openCamp('inn')}>
            Short rest
          </button>
          <button type="button" onClick={() => setDialog('journal')}>
            Journal
          </button>
          <button type="button" onClick={() => openCamp('inn')}>
            Long rest
          </button>
          <button type="button" onClick={() => setDialog('save')}>
            Save
          </button>
        </nav>
      </footer>
      {dialog === 'journal' && <JournalDialog onClose={() => setDialog(null)} />}
      {dialog === 'spells' && <SpellsDialog onClose={() => setDialog(null)} />}
      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

/** The tavern floor plan (original SVG art from the Exploration mockup). */
function TavernArt() {
  return (
    <svg
      viewBox="0 0 900 492"
      width="900"
      height="492"
      role="img"
      aria-label="Top-down map of the Drowned Lantern tavern: bar to the north-east, hearth to the west, stairs to the south-west, and the front door to the south."
    >
      <defs>
        <pattern id="planks" width="80" height="40" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="80" height="40" fill="#5b402b" />
          <rect x="0" y="20" width="80" height="20" fill="#563c28" />
          <path
            d="M0 19.5 H80 M0 39.5 H80 M40 0 V20 M0 20 V40 M80 20 V40"
            stroke="#3b2a1c"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="900" height="492" fill="#1d242f" />
      <rect x="24" y="24" width="852" height="444" fill="url(#planks)" />
      <circle cx="70" cy="226" r="150" fill="#e8833a" opacity="0.1" />
      <circle cx="70" cy="226" r="80" fill="#e8833a" opacity="0.08" />
      <rect x="24" y="24" width="852" height="444" fill="none" stroke="#2a1f17" strokeWidth="16" />
      <rect x="33" y="33" width="834" height="426" fill="none" stroke="#6a5038" strokeWidth="2" />
      <rect x="418" y="458" width="74" height="22" fill="#5b402b" />
      <path
        d="M418 468 A 74 74 0 0 1 492 468"
        fill="none"
        stroke="#8a6a46"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <rect x="24" y="176" width="46" height="100" fill="#4a4743" />
      <rect x="30" y="192" width="30" height="68" fill="#1a0f0a" />
      <path d="M45 252 C34 240 40 226 45 214 C50 226 58 238 45 252 Z" fill="#e8833a" />
      <path d="M45 252 C40 244 43 236 45 230 C48 238 51 244 45 252 Z" fill="#f6c76a" />
      <circle cx="606" cy="56" r="14" fill="#6b4529" stroke="#3a2516" strokeWidth="3" />
      <circle cx="642" cy="56" r="14" fill="#6b4529" stroke="#3a2516" strokeWidth="3" />
      <rect x="574" y="100" width="246" height="34" fill="#3a2516" />
      <rect x="786" y="100" width="34" height="160" fill="#3a2516" />
      <rect x="574" y="100" width="246" height="6" fill="#7a5233" />
      <rect x="40" y="378" width="112" height="78" fill="#3e2c1e" />
      <path
        d="M54 378 V456 M68 378 V456 M82 378 V456 M96 378 V456 M110 378 V456 M124 378 V456 M138 378 V456"
        stroke="#2a1d13"
        strokeWidth="2"
      />
      <rect
        x="700"
        y="300"
        width="44"
        height="44"
        fill="#4a3220"
        stroke="#2a1c12"
        strokeWidth="3"
      />
      <path d="M700 300 L744 344 M744 300 L700 344" stroke="#2a1c12" strokeWidth="2" />
      <g fill="#5c3d26">
        {[
          [160, 130],
          [240, 130],
          [200, 92],
          [160, 226],
          [240, 226],
          [200, 264],
          [290, 330],
          [370, 330],
          [430, 180],
          [510, 180],
          [470, 142],
          [760, 400],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r="9" />
        ))}
      </g>
      <g fill="#7a5232" stroke="#3e2a1a" strokeWidth="3">
        <circle cx="200" cy="130" r="30" />
        <circle cx="200" cy="226" r="30" />
        <circle cx="330" cy="330" r="30" />
        <circle cx="470" cy="180" r="30" />
        <circle cx="800" cy="410" r="28" />
      </g>
      <circle cx="200" cy="226" r="5" fill="#d9c9a0" />
      <circle cx="330" cy="330" r="5" fill="#d9c9a0" />
      <g fill="#3a4558" stroke="#6a5c4a" strokeWidth="2">
        <circle cx="290" cy="300" r="13" />
        <circle cx="510" cy="210" r="13" />
      </g>
    </svg>
  );
}
