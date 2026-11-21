import { useEffect, useState } from 'react';
import { quests } from '../data';
import type { MapSpot } from '../data/schemas/story';
import { SoundButton } from '../audio/SoundButton';
import { formatDate } from '../game/calendar';
import { nextSpot, placeMapFor, spotState, type SpotState } from '../game/placeMaps';
import { useGame } from '../game/store';
import { canLevelUp } from '../rules';
import './Explore.css';
import { InventoryDialog, JournalDialog, SaveDialog, SpellsDialog } from './ExploreDialogs';
import { PartyBar } from './PartyBar';
import { GameMenuButton } from './GameMenu';
import { KilnMap, MineMap } from './scenes/DungeonMaps';
import { TownMap } from './scenes/TownMap';
import { BoardDialog } from './BoardDialog';
import { FindsPanel } from './FindsPanel';
import { ShopDialog } from './ShopDialog';
import { boardNotices } from '../game/bounties';
import { questTargets } from '../game/questMap';
import { getShop, hoursToMarket, shopOpen } from '../game/shops';
import { PARTY_OFFSETS, useWalk } from './useWalk';

const STATE_TEXT: Record<SpotState, string> = {
  hidden: '',
  locked: 'not reached yet',
  open: '',
  done: 'done',
};

/** A place you walk around (Ashford, the Old Mine, the King's Kiln): each spot opens part of its story. */
export function PlaceMapScreen() {
  const { game, talk, toasts, clearToasts, goto, openMap, openCamp, enterTavern } = useGame();
  const [dialog, setDialog] = useState<
    null | 'journal' | 'spells' | 'save' | 'inventory' | 'board'
  >(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const g = game!;
  const m = placeMapFor(g.location)!;
  const { at, walkTo } = useWalk(m.id, m.start, [450, 250]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(clearToasts, 6000);
    return () => clearTimeout(t);
  }, [toasts, clearToasts]);

  const next = nextSpot(g, m);
  const quest = m.quest ? quests.find((q) => q.id === m.quest) : undefined;
  const qs = m.quest ? g.quests[m.quest] : undefined;
  const isTown = m.art === 'town';
  // In town: the active main quests, and a "!" where there's something new.
  const mainQuests = Object.entries(g.quests)
    .map(([id, st]) => ({ q: quests.find((x) => x.id === id)!, st }))
    .filter((x) => x.q && x.q.kind === 'main' && x.st.status === 'active');
  const boardNews = boardNotices(g).some((n) => n.state === 'new' || n.state === 'hunted');
  const tavernNews = isTown && (questTargets(g)['ashford'] ?? []).length > 0;
  const closed = (s: MapSpot) => s.kind === 'shop' && !shopOpen(g, getShop(s.shop!));
  const visit = (s: MapSpot, state: SpotState) => {
    if (state === 'locked') {
      setHint(`${s.label}: ${s.hint ?? 'not reached yet.'}`);
      return;
    }
    setHint(null);
    if (s.kind === 'exit') return walkTo(s.x, s.y, openMap);
    if (s.kind === 'door') return walkTo(s.x, s.y, enterTavern);
    if (s.kind === 'board') return walkTo(s.x, s.y, () => setDialog('board'));
    if (s.kind === 'shop') {
      if (closed(s)) {
        const days = Math.max(1, Math.ceil(hoursToMarket(g.clock) / 24));
        return walkTo(s.x, s.y, () =>
          setHint(
            `The market square is quiet. Odo's wagon comes on market days (the first four of each tenday): back in about ${days} day${days === 1 ? '' : 's'}.`,
          ),
        );
      }
      return walkTo(s.x, s.y, () => setShopId(s.shop!));
    }
    if (s.kind === 'npc') return walkTo(s.x, s.y, () => talk(s.knot!, s.story ?? m.story));
    if (state === 'done') {
      // Somewhere already dealt with: just walk there.
      walkTo(s.x, s.y, () => setHint(`${s.label}: nothing more to do here.`));
      return;
    }
    walkTo(s.x, s.y, () => talk(s.knot!, s.story ?? m.story));
  };

  return (
    <div className="explore place-map-screen">
      <header className="explore-header">
        <div className="row baseline">
          <h1>{m.title}</h1>
          <span className="muted">
            {m.subtitle} · {formatDate(g.clock)}
          </span>
        </div>
        <div className="row">
          <SoundButton />
          <button type="button" className="menu-secondary small-btn" onClick={() => goto('party')}>
            Party{g.party.some((h) => canLevelUp(h)) ? ' · level up!' : ''}
          </button>
          <button type="button" className="menu-secondary small-btn" onClick={openMap}>
            World map
          </button>
          <GameMenuButton />
        </div>
      </header>

      <div className="explore-main">
        <div className="tavern-map place-map">
          {m.art === 'mine' ? (
            <MineMap />
          ) : m.art === 'kiln' ? (
            <KilnMap />
          ) : (
            <TownMap act={g.act} market={shopOpen(g, getShop('wagon'))} />
          )}
          {m.spots.map((s) => {
            const st = spotState(g, s);
            return st !== 'locked' || !s.fog ? null : (
              <div
                key={`fog-${s.id}`}
                className="map-fog"
                style={{ left: s.fog[0], top: s.fog[1], width: s.fog[2], height: s.fog[3] }}
                aria-hidden="true"
              />
            );
          })}
          {m.spots.map((s) => {
            const st = spotState(g, s);
            if (st === 'hidden') return null;
            const isNext =
              next?.id === s.id ||
              (s.kind === 'board' && boardNews) ||
              (s.kind === 'door' && tavernNews);
            const away = closed(s);
            return (
              <button
                key={s.id}
                type="button"
                className={`hotspot ${s.kind} ${st}${isNext ? ' next' : ''}${away ? ' away' : ''}`}
                style={{ left: s.x - 22, top: s.y - 22 }}
                aria-label={`${s.label}${STATE_TEXT[st] ? ` (${STATE_TEXT[st]})` : ''}${away ? ' (away today)' : ''}${isNext ? (s.kind === 'board' || s.kind === 'door' ? ' (new)' : ' (go here next)') : ''}`}
                aria-disabled={st === 'locked'}
                onClick={() => visit(s, st)}
              >
                <span aria-hidden="true">{st === 'locked' ? '?' : s.glyph}</span>
                {isNext && (
                  <span className="news" aria-hidden="true">
                    !
                  </span>
                )}
                {st === 'done' && s.kind !== 'exit' && (
                  <span className="tick" aria-hidden="true">
                    ✓
                  </span>
                )}
                <span className="spot-label" aria-hidden="true">
                  {st === 'locked' ? '???' : s.label}
                </span>
              </button>
            );
          })}
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
          {hint && (
            <div className="map-hint" role="status">
              {hint}
            </div>
          )}
        </div>

        <aside className="journal-panel" aria-label="Journal">
          {isTown &&
            mainQuests.map(({ q, st }) => (
              <div key={q.id} className="quest-card main">
                <span className="eyebrow">Main quest</span>
                <span className="quest-title">{q.title}</span>
                {q.steps
                  .filter((s) => !st.steps.includes(s.id))
                  .slice(0, 3)
                  .map((s) => (
                    <div key={s.id} className="step">
                      <span className="box" aria-hidden="true" />
                      <span>{s.text}</span>
                    </div>
                  ))}
              </div>
            ))}
          {quest && qs && (
            <div className="quest-card main">
              <span className="eyebrow">
                {qs.status === 'done' ? 'Quest complete' : 'Main quest'}
              </span>
              <span className="quest-title">{quest.title}</span>
              {quest.steps.map((s) => (
                <div key={s.id} className={`step ${qs.steps.includes(s.id) ? 'done' : ''}`}>
                  <span className="box" aria-hidden="true">
                    {qs.steps.includes(s.id) ? '✓' : ''}
                  </span>
                  <span>
                    {s.text}
                    <span className="sr-only">{qs.steps.includes(s.id) ? ' (done)' : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <FindsPanel placeId={m.id} />
          <div className="xp-card small">
            <span>
              {isTown
                ? 'Click a building or a person to walk there. ! means something new.'
                : "Click a marked place to go there. ! is the way on; ◇ is something to search; ? is somewhere you haven't reached."}
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
          <button type="button" onClick={() => (isTown ? enterTavern() : openCamp())}>
            {isTown ? 'Rest at the inn' : 'Make camp'}
          </button>
          <button type="button" onClick={() => setDialog('journal')}>
            Journal
          </button>
          <button type="button" onClick={openMap}>
            World map
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
      {dialog === 'board' && <BoardDialog onClose={() => setDialog(null)} />}
      {shopId && <ShopDialog shopId={shopId} onClose={() => setShopId(null)} />}
    </div>
  );
}
