import { Fragment, useEffect, useState } from 'react';
import { letterReplies, wix } from '../data';
import { formatDate } from '../game/calendar';
import { canReply, getLetter, letterText } from '../game/letters';
import { canLongRest } from '../game/rest';
import { useGame, type CampScene } from '../game/store';
import { currentPlace } from '../game/travel';
import cave from './art/camp-cave.svg?raw';
import inn from './art/camp-inn.svg?raw';
import wild from './art/camp-wild.svg?raw';
import moth from './art/moth.svg?raw';
import './art/camp-anim.css';
import './World.css';
import { InventoryDialog } from './ExploreDialogs';

const ART: Record<CampScene, string> = { wild, inn, cave };
const SCENES: Record<
  CampScene,
  { label: string; bubble: [number, number]; moth: [number, number] }
> = {
  wild: { label: 'Wilderness', bubble: [330, 280], moth: [880, 392] },
  inn: { label: 'Inn room', bubble: [350, 300], moth: [1005, 262] },
  cave: { label: 'Cave', bubble: [350, 300], moth: [920, 392] },
};

/** Render *emphasis* from the letter text as italics. */
function Emph({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) => (
        <Fragment key={i}>
          {part.startsWith('*') && part.endsWith('*') ? <em>{part.slice(1, -1)}</em> : part}
        </Fragment>
      ))}
    </>
  );
}

/** Camp: rests, Wix and lantern-moth letters (rebuilt from docs/mockups/Camp.dc.html). */
export function CampScreen() {
  const {
    game,
    campScene,
    setCampScene,
    campLog,
    beginShortRest,
    spendHitDie,
    endShortRest,
    shortRest,
    planLongRest,
    interruptLongRest,
    wakeEarly,
    completeLongRest,
    answerLetter,
    openMap,
    goto,
  } = useGame();
  const g = game!;
  const [sleeping, setSleeping] = useState(false);
  const [joke, setJoke] = useState(-1);
  const [letterId, setLetterId] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const place = currentPlace(g);
  const inTown = place.id === 'ashford';
  const hasWix = !!g.flags['wix_companion'];
  const unread = g.letters.filter((l) => !l.read);
  const sc = SCENES[campScene];
  const scenes = (inTown ? ['inn'] : ['wild', 'cave']) as CampScene[];
  const canLong = canLongRest(g);
  const letter = letterId ? getLetter(letterId) : null;
  const letterState = letterId ? g.letters.find((l) => l.id === letterId) : null;
  const jokeText =
    joke < 0
      ? wix.greeting
      : `${sleeping ? '(whispering) ' : ''}${wix.jokes[joke % wix.jokes.length]}`;

  // The long rest plays out hour by hour (playtest feedback): you can wake early, and a night
  // ambush strikes partway through.
  const [rest, setRest] = useState<{
    hour: number;
    interruptAt: number | null;
    encounterId: string | null;
  } | null>(null);
  const resting = !!rest;
  useEffect(() => {
    if (!rest) return;
    const fast =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(
      () => {
        const hour = rest.hour + 1;
        if (rest.encounterId && rest.interruptAt === hour) {
          setRest(null);
          setSleeping(false);
          interruptLongRest(rest.encounterId, hour);
          return;
        }
        if (hour >= 8) {
          setRest(null);
          completeLongRest();
          if (useGame.getState().screen === 'camp') setSleeping(true);
          return;
        }
        setRest({ ...rest, hour });
      },
      fast ? 120 : 700,
    );
    return () => clearTimeout(t);
  }, [rest, interruptLongRest, completeLongRest]);

  const doLong = () => {
    if (rest) {
      wakeEarly(rest.hour);
      setRest(null);
      setSleeping(false);
      return;
    }
    if (sleeping) {
      setSleeping(false);
      return;
    }
    const plan = planLongRest();
    if (!plan) return;
    setSleeping(true);
    setRest({ hour: 0, ...plan });
    if (hasWix) setJoke((j) => j + 2);
  };

  return (
    <div className="camp">
      <div
        className={`camp-scene ${sleeping ? 'sleeping' : ''} ${hasWix ? '' : 'no-wix'}`}
        dangerouslySetInnerHTML={{ __html: ART[campScene] }}
      />
      <div className="camp-title">
        <span className="place">
          {campScene === 'inn'
            ? 'Private room · the Drowned Lantern'
            : campScene === 'cave'
              ? `Camp · a dry cave near ${place.name}`
              : `Camp · near ${place.name}`}
        </span>
        <span className="muted small">{formatDate(g.clock)}</span>
      </div>
      {scenes.length > 1 && (
        <div role="radiogroup" aria-label="Camp location" className="seg camp-seg">
          {scenes.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={campScene === k}
              className={campScene === k ? 'on' : ''}
              onClick={() => setCampScene(k)}
            >
              {SCENES[k].label}
            </button>
          ))}
        </div>
      )}
      {hasWix && (
        <div className="wix-bubble" style={{ left: sc.bubble[0], top: sc.bubble[1] }} role="status">
          <span className="wix-name">Wix</span>
          <span>{jokeText}</span>
        </div>
      )}
      {unread.length > 0 && (
        <div
          className="moth"
          style={{ left: sc.moth[0], top: sc.moth[1] }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: moth }}
        />
      )}

      {resting && (
        <div className="rest-progress" role="status" aria-live="polite">
          <span className="strong">Sleeping… hour {rest!.hour} of 8</span>
          <div className="rest-bar" aria-hidden="true">
            <div style={{ width: `${(rest!.hour / 8) * 100}%` }} />
          </div>
          <span className="small muted">{formatDate(g.clock + rest!.hour)}</span>
        </div>
      )}
      <footer className="camp-footer">
        <div className="camp-status" role="log" aria-live="polite">
          <span className="eyebrow">Camp</span>
          {campLog.slice(-3).map((l, i) => (
            <span key={`${campLog.length}-${i}`} className="small">
              {l}
            </span>
          ))}
        </div>
        {hasWix && (
          <button type="button" className="camp-btn" onClick={() => setJoke(joke + 1)}>
            Ask Wix for a joke
          </button>
        )}
        <button
          type="button"
          className="camp-btn"
          disabled={sleeping || resting || !!shortRest}
          onClick={() => {
            beginShortRest();
            if (hasWix) setJoke(joke + 1);
          }}
        >
          <span className="strong">Short rest</span>
          <span className="small">1 hour · spend Hit Dice</span>
        </button>
        <button
          type="button"
          className={`camp-btn ${canLong || sleeping ? 'primary-camp' : ''}`}
          disabled={!!shortRest}
          onClick={doLong}
        >
          <span className="strong">
            {resting ? 'Wake early' : sleeping ? 'Wake the party' : 'Long rest'}
          </span>
          <span className="small">
            {resting
              ? `Hour ${rest!.hour} of 8 · stopping now gives no benefit`
              : sleeping
                ? 'Rested: start the day'
                : canLong
                  ? '8 hours · full recovery'
                  : 'Not yet (once per day)'}
          </span>
        </button>
        <button
          type="button"
          className={`camp-btn ${unread.length ? 'letter-new' : ''}`}
          disabled={!g.letters.length}
          onClick={() => setLetterId((unread[0] ?? g.letters[g.letters.length - 1])!.id)}
        >
          <span className="strong">Read letter</span>
          <span className="small">
            {unread.length ? 'From M.V. · new' : g.letters.length ? 'Read again' : 'No letters yet'}
          </span>
        </button>
        <button
          type="button"
          className="camp-btn"
          disabled={sleeping || resting || !!shortRest}
          onClick={() => (inTown ? goto('explore') : openMap())}
        >
          <span className="strong">Break camp</span>
          <span className="small">{inTown ? 'Back to the tavern' : 'Back to the map'}</span>
        </button>
      </footer>

      {shortRest && (
        <div className="dialog-backdrop">
          <div role="dialog" aria-modal="true" aria-label="Short rest" className="dialog wide">
            <h2>Short rest: spend Hit Dice</h2>
            <p className="small muted">
              Each Hit Die heals its roll + Constitution modifier. Spend as many as you like, then
              finish the rest.
            </p>
            <ul className="hd-list">
              {g.party.map((h) => (
                <li key={h.id}>
                  <span>
                    <span className="strong">{h.name}</span> · HP {h.hp}/{h.maxHp} · Hit Dice{' '}
                    {h.hitDice.remaining}/{h.hitDice.total} (d{h.hitDice.die})
                  </span>
                  <button
                    type="button"
                    className="mini"
                    disabled={h.dead || h.hp === 0 || h.hitDice.remaining < 1 || h.hp >= h.maxHp}
                    onClick={() => spendHitDie(h.id)}
                  >
                    Spend a Hit Die
                  </button>
                </li>
              ))}
            </ul>
            <div className="hd-log small" role="log">
              {campLog.slice(-4).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div className="row">
              <button type="button" className="primary" onClick={endShortRest}>
                Finish the short rest
              </button>
              <button
                type="button"
                className="menu-secondary small-btn"
                onClick={() => setShowItems(true)}
              >
                Attune items
              </button>
            </div>
          </div>
        </div>
      )}

      {showItems && <InventoryDialog onClose={() => setShowItems(false)} />}

      {letter && letterState && (
        <div className="dialog-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Letter from ${letter.originOnly ? 'Mae' : 'M.V.'}`}
            className="letter pop"
          >
            <span className="letter-head">
              {letter.originOnly
                ? 'In Corin’s pack since Lantern Night'
                : `Letter ${letter.number} of 7 · delivered by lantern moth`}{' '}
              · “{letter.title}”
            </span>
            {letterText(g, letter).map((p, i) => (
              <p key={i}>
                <Emph text={p} />
              </p>
            ))}
            <div className="letter-actions">
              {canReply(letter) && !letterState.reply ? (
                letterReplies.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="reply"
                    onClick={() => {
                      answerLetter(letter.id, r.id);
                      setLetterId(null);
                    }}
                  >
                    {r.label}
                    {r.trust ? ` (+${r.trust} Trust)` : ''}
                  </button>
                ))
              ) : letterState.reply ? (
                <span className="small">
                  You replied:{' '}
                  {letterReplies
                    .find((r) => r.id === letterState.reply)
                    ?.label.replace('Write a', 'a')}
                  .
                </span>
              ) : null}
              <button
                type="button"
                className="keep"
                autoFocus
                onClick={() => {
                  answerLetter(letter.id);
                  setLetterId(null);
                }}
              >
                Keep it and close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
