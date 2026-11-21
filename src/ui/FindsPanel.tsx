import { useState } from 'react';
import { huntsAt, questTitle } from '../game/bounties';
import { getFind, searchedToday, seenFinds } from '../game/finds';
import { useGame } from '../game/store';
import { ShopDialog } from './ShopDialog';

const KIND_GLYPH: Record<string, string> = {
  chest: '▣',
  cache: '◇',
  buried: '⛏',
  body: '✝',
  herbs: '❦',
  note: '✎',
  merchant: '⚖',
};

/**
 * Exploring a place: what the party has noticed (passive Perception on arrival), a careful search
 * (a Perception check, once a day), chests to open, hidden merchants, and taken bounties to hunt.
 */
export function FindsPanel({ placeId }: { placeId: string }) {
  const { game, searchHere, openFindAt, huntBounty } = useGame();
  const g = game!;
  const [log, setLog] = useState<string[]>([]);
  const [shop, setShop] = useState<string | null>(null);
  const seen = seenFinds(g, placeId);
  const hunts = huntsAt(g, placeId);
  const hasTools = (g.inventory['thieves-tools'] ?? 0) > 0;
  const act = (id: string, how: 'open' | 'pick' | 'force') => {
    const r = openFindAt(id, how);
    setLog(r.log);
    if (r.shop) setShop(r.shop);
  };
  return (
    <section className="finds-panel" aria-label="Exploring here">
      <span className="eyebrow">Exploring here</span>
      {hunts.map((b) => (
        <button
          key={b.quest}
          type="button"
          className="travel-btn hunt-btn"
          onClick={() => huntBounty(b.quest)}
        >
          Hunt: {questTitle(b.quest).replace(/^Bounty: /, '')}
        </button>
      ))}
      {seen.length > 0 ? (
        <ul className="finds-list">
          {seen.map((f) => {
            const done = g.finds?.[f.id] === 'done' && !f.shop;
            const locked = f.lock && !g.flags[`find_lock:${f.id}`];
            return (
              <li key={f.id} className={done ? 'done' : ''}>
                <span className="find-glyph" aria-hidden="true">
                  {KIND_GLYPH[f.kind]}
                </span>
                <span className="find-label">
                  {f.label}
                  {done && <span className="small faint"> (emptied)</span>}
                </span>
                {!done && (
                  <span className="row nowrap find-actions">
                    {f.shop ? (
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        onClick={() => act(f.id, 'open')}
                      >
                        Trade
                      </button>
                    ) : locked ? (
                      <>
                        <button
                          type="button"
                          className="menu-secondary small-btn"
                          aria-disabled={!hasTools}
                          title={hasTools ? undefined : "Needs thieves' tools"}
                          onClick={() => act(f.id, 'pick')}
                        >
                          Pick the lock
                        </button>
                        <button
                          type="button"
                          className="menu-secondary small-btn"
                          onClick={() => act(f.id, 'force')}
                        >
                          Force it
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        onClick={() => act(f.id, 'open')}
                      >
                        {f.kind === 'chest' ? 'Open' : f.kind === 'buried' ? 'Dig' : 'Look closer'}
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small muted">Nothing has caught your eye here yet.</p>
      )}
      <button
        type="button"
        className="menu-secondary small-btn"
        aria-disabled={searchedToday(g, placeId)}
        onClick={() => setLog(searchHere())}
      >
        {searchedToday(g, placeId) ? 'Searched today' : 'Search the area (Perception, 1 hour)'}
      </button>
      {log.length > 0 && (
        <div className="finds-log small" role="log" aria-live="polite">
          {log.map((l, i) => (
            <div key={`${i}-${l}`} className={/check|save/.test(l) ? 'roll' : ''}>
              {l}
            </div>
          ))}
        </div>
      )}
      {shop && <ShopDialog shopId={shop} onClose={() => setShop(null)} />}
      {/* The notice text of the last thing found (for screen readers too). */}
      <span className="sr-only">{seen.map((f) => getFind(f.id).notice).join(' ')}</span>
    </section>
  );
}
