import { useState } from 'react';
import { boardNotices, questTitle } from '../game/bounties';
import { useGame } from '../game/store';
import { getPlace } from '../game/travel';
import { Modal } from './ExploreDialogs';
import './Sheet.css';

/** The notice board by Ashford Hall's door: take a bounty, go and do it, come back for the purse. */
export function BoardDialog({ onClose }: { onClose: () => void }) {
  const { game, takeNotice, claimNotice } = useGame();
  const g = game!;
  const [msg, setMsg] = useState('');
  const notices = boardNotices(g);
  return (
    <Modal title="Ashford Hall: notice board" onClose={onClose}>
      <div className="board">
        <p className="small muted">
          Bounties nailed up by the Hall door. Take one, find the trouble (it&apos;s marked on your
          map), then come back here for the purse.
        </p>
        {notices.length === 0 && (
          <p className="small muted">
            Nothing new today. A torn corner of paper flaps where the last notice was.
          </p>
        )}
        <ul className="notice-list">
          {notices.map(({ bounty: b, state }) => (
            <li key={b.quest} className={`notice ${state}`}>
              <div className="notice-paper">
                <span className="notice-title">{questTitle(b.quest)}</span>
                <span className="notice-text">{b.poster}</span>
                <span className="notice-from">— {b.from}</span>
              </div>
              <div className="notice-meta small">
                <span>
                  Where: <strong>{getPlace(b.place).name}</strong>
                </span>
                {b.rewardGp && (
                  <span>
                    Reward: <strong>{b.rewardGp} gp</strong>
                  </span>
                )}
                <span className="notice-state">
                  {state === 'new'
                    ? ''
                    : state === 'taken'
                      ? 'Taken: go and deal with it'
                      : state === 'hunted'
                        ? 'Done: collect your reward'
                        : 'Paid'}
                </span>
              </div>
              {state === 'new' && (
                <button
                  type="button"
                  className="menu-primary small-btn"
                  onClick={() => {
                    takeNotice(b.quest);
                    setMsg(
                      `Taken: ${questTitle(b.quest)}. ${getPlace(b.place).name} is marked on the map.`,
                    );
                  }}
                >
                  Take the notice
                </button>
              )}
              {state === 'hunted' && (
                <button
                  type="button"
                  className="menu-primary small-btn"
                  onClick={() => setMsg(claimNotice(b.quest) ?? `Paid: ${b.rewardGp} gp.`)}
                >
                  Collect {b.rewardGp} gp
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="small" role="status">
          {msg}
        </p>
      </div>
    </Modal>
  );
}
