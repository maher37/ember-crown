import { useEffect, useState } from 'react';
import { quests } from '../data';
import { formatDate } from '../game/calendar';
import { partyLevel } from '../game/journal';
import { useGame } from '../game/store';
import { XP_THRESHOLDS } from '../rules';
import './Explore.css';
import { InventoryDialog, JournalDialog, SaveDialog, SpellsDialog } from './ExploreDialogs';
import { PartyBar } from './PartyBar';
import { ShopDialog } from './ShopDialog';
import { TavernMap } from './scenes/TavernMap';
import { PARTY_OFFSETS, useWalk } from './useWalk';
import { SoundButton } from '../audio/SoundButton';

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
  const { game, talk, toasts, clearToasts, goto, saveTo, openCamp } = useGame();
  const [dialog, setDialog] = useState<null | 'journal' | 'spells' | 'save' | 'inventory' | 'shop'>(
    null,
  );
  const g = game!;
  const f = (k: string) => !!g.flags[k];
  const { at, walkTo } = useWalk('tavern', [455, 382], [450, 260]);

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
      id: 'shop',
      glyph: '⚖',
      label: 'Shop (buy and sell)',
      knot: '',
      x: 736,
      y: 214,
      kind: 'object',
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
        <div className="row">
          <SoundButton />
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
        </div>
      </header>

      <div className="explore-main">
        <div className="tavern-map">
          <TavernMap />
          {spots
            .filter((s) => !s.hidden)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className={`hotspot ${s.kind}`}
                style={{ left: s.x - 22, top: s.y - 22 }}
                aria-label={`${s.label}${s.news ? ' (new)' : ''}`}
                onClick={() =>
                  walkTo(s.x, s.y, () => (s.id === 'shop' ? setDialog('shop') : talk(s.knot)))
                }
              >
                <span aria-hidden="true">
                  {s.kind === 'exit'
                    ? '⇣'
                    : s.id === 'shop'
                      ? '⚖'
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
            onClick={() => walkTo(96, 417, () => openCamp('inn'))}
          >
            <span aria-hidden="true">≡</span>
            <span className="spot-label" aria-hidden="true">
              Stairs
            </span>
          </button>
          {g.party.map((h, i) => {
            const [ox, oy] = PARTY_OFFSETS[i % 4]!;
            return (
              <span
                key={h.id}
                className="party-token"
                style={{ left: at[0] + ox - 16, top: at[1] + oy - 16 }}
                aria-hidden="true"
              >
                {h.name[0]}
              </span>
            );
          })}
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
        <PartyBar />
        <nav aria-label="Actions" className="explore-actions">
          <button type="button" onClick={() => setDialog('inventory')}>
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
      {dialog === 'inventory' && <InventoryDialog onClose={() => setDialog(null)} />}
      {dialog === 'shop' && <ShopDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
