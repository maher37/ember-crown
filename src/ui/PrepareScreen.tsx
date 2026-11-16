import { useState } from 'react';
import { difficulties, monsters } from '../data';
import type { DifficultyId } from '../data/schemas/difficulty';
import { getEncounter, parseMapForUi } from './combatUi';
import { getClass, slotsLeft } from '../game/hero';
import { useSettings } from '../game/settings';
import { useGame } from '../game/store';
import { canLevelUp } from '../rules';
import './Combat.css';

// DMG encounter multipliers (docs/Encounters_and_XP.md §3).
const multiplier = (n: number) => (n <= 1 ? 1 : n === 2 ? 1.5 : n <= 6 ? 2 : 2.5);

/** The pre-combat "Prepare" step: what you face, difficulty, formation, then fight. */
export function PrepareScreen() {
  const { game, encounterId, startFight, goHome, pendingArrival, backToCamp, talkPast } = useGame();
  const [talkResult, setTalkResult] = useState<{ success: boolean; text: string } | null>(null);
  const onRoad = !!pendingArrival || backToCamp;
  const settings = useSettings();
  const [difficulty, setDifficulty] = useState<DifficultyId>(settings.difficulty);
  const enc = getEncounter(encounterId!);
  const party = game!.party;
  const [order, setOrder] = useState(party.map((h) => h.id));
  const [mageArmor, setMageArmor] = useState<string[]>([]);
  const foes = enc.enemies.filter((e) => e.difficulties.includes(difficulty));
  const raw = foes.reduce((n, e) => n + monsters.find((m) => m.id === e.monster)!.xp, 0);
  const groups = Object.entries(
    foes.reduce<Record<string, number>>(
      (acc, e) => ({ ...acc, [e.monster]: (acc[e.monster] ?? 0) + 1 }),
      {},
    ),
  );
  const below = party.some((h) => h.level < 2);
  const casters = party.filter(
    (h) => h.spells.includes('mage-armor') && !h.equipment.armor && (slotsLeft(h)[0] ?? 0) > 0,
  );
  const map = parseMapForUi(enc);

  const swap = (i: number, j: number) => {
    const o = [...order];
    [o[i], o[j]] = [o[j]!, o[i]!];
    setOrder(o);
  };

  const fight = () => {
    settings.setDifficulty(difficulty);
    const formation = Object.fromEntries(
      order.map((id, i) => [id, { x: enc.partyStart[i]![0], y: enc.partyStart[i]![1] }]),
    );
    startFight({ difficulty, formation, mageArmor });
  };

  return (
    <div className="prepare">
      <header className="combat-header">
        <h1>Prepare: {enc.name}</h1>
        {onRoad ? (
          <span className="muted small">
            {enc.surprise
              ? 'They came out of nowhere. Passive Perception decides who is caught by surprise.'
              : ''}
          </span>
        ) : (
          <button type="button" className="menu-secondary small-btn" onClick={goHome}>
            Not yet
          </button>
        )}
      </header>
      <div className="prepare-body">
        <section className="prepare-col" aria-label="Briefing">
          <p className="briefing">{enc.briefing}</p>
          <h2 className="eyebrow">
            You will face ({difficulties.levels.find((d) => d.id === difficulty)!.name})
          </h2>
          <ul className="foe-list">
            {groups.map(([id, n]) => {
              const m = monsters.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <span className="foe-chip" aria-hidden="true" />
                  {n} × {m.name} · AC {m.ac} · HP {m.hp} · CR {m.cr}
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            {foes.length} enemies · {raw} XP × {multiplier(foes.length)} ={' '}
            {raw * multiplier(foes.length)} adjusted · reward {enc.xpPerPc} XP each on every
            difficulty
          </p>
          <h2 className="eyebrow">Difficulty</h2>
          <div role="radiogroup" aria-label="Difficulty" className="seg seg-inline">
            {difficulties.levels.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={difficulty === d.id}
                className={difficulty === d.id ? 'on' : ''}
                onClick={() => setDifficulty(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
          <ul className="muted small diff-notes">
            {difficulties.levels
              .find((d) => d.id === difficulty)!
              .summary.map((l) => (
                <li key={l}>{l}</li>
              ))}
          </ul>
        </section>

        <section className="prepare-col" aria-label="Formation">
          <h2 className="eyebrow">Formation</h2>
          <p className="muted small">Starting squares, front to back. Use the arrows to reorder.</p>
          <ol className="formation">
            {order.map((id, i) => {
              const h = party.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <span>
                    <strong>{h.name}</strong> · {getClass(h.classId).name} {Math.max(2, h.level)} ·
                    AC {h.ac}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Move ${h.name} forward`}
                      disabled={i === 0}
                      onClick={() => swap(i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Move ${h.name} back`}
                      disabled={i === order.length - 1}
                      onClick={() => swap(i, i + 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          <svg
            viewBox={`0 0 ${map.width * 20} ${map.height * 20}`}
            className="mini-map"
            role="img"
            aria-label="Battle map preview with starting squares"
          >
            {map.terrain.flatMap((row, y) =>
              row.map((t, x) => (
                <rect
                  key={`${x},${y}`}
                  x={x * 20}
                  y={y * 20}
                  width={20}
                  height={20}
                  fill={TERRAIN_FILL[t]}
                  stroke="#00000022"
                />
              )),
            )}
            {enc.partyStart.map(([x, y], i) => (
              <g key={i}>
                <circle
                  cx={x * 20 + 10}
                  cy={y * 20 + 10}
                  r={8}
                  fill="#1f2a36"
                  stroke="#7fb3e6"
                  strokeWidth={2}
                />
                <text
                  x={x * 20 + 10}
                  y={y * 20 + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#e6f0fa"
                >
                  {party.find((h) => h.id === order[i])!.name[0]}
                </text>
              </g>
            ))}
            {foes.map((f) => (
              <rect
                key={f.id}
                x={f.pos[0] * 20 + 3}
                y={f.pos[1] * 20 + 3}
                width={14}
                height={14}
                rx={3}
                fill="#3a1d12"
                stroke="#e06a3b"
                strokeWidth={2}
              />
            ))}
          </svg>
        </section>

        <section className="prepare-col" aria-label="Ready">
          {party.some((h) => canLevelUp(h)) && (
            <p className="notice">
              Some heroes have enough XP to level up. Go back to the tavern and use “Level up!” on
              the party bar first.
            </p>
          )}
          {below && !party.some((h) => canLevelUp(h)) && (
            <p className="notice">This fight is built for level-2 heroes. It will be hard.</p>
          )}
          {casters.length > 0 && (
            <>
              <h2 className="eyebrow">Before the fight</h2>
              {casters.map((h) => (
                <label key={h.id} className="check">
                  <input
                    type="checkbox"
                    checked={mageArmor.includes(h.id)}
                    onChange={(e) =>
                      setMageArmor(
                        e.target.checked
                          ? [...mageArmor, h.id]
                          : mageArmor.filter((x) => x !== h.id),
                      )
                    }
                  />
                  {h.name} casts Mage Armor (uses a 1st-level slot)
                </label>
              ))}
            </>
          )}
          {enc.talk && (
            <div className="talk">
              <h2 className="eyebrow">Talk or fight</h2>
              <button
                type="button"
                className="menu-secondary small-btn"
                disabled={!!talkResult}
                onClick={() => setTalkResult(talkPast())}
              >
                {enc.talk.prompt} ({enc.talk.skill[0]!.toUpperCase() + enc.talk.skill.slice(1)} DC{' '}
                {enc.talk.dc})
              </button>
              {talkResult && !talkResult.success && (
                <p className="small" role="status">
                  {talkResult.text}
                </p>
              )}
              <p className="muted small">
                Talking your way past is worth the same XP as winning (D16).
              </p>
            </div>
          )}
          <p className="muted small">The game autosaves before the fight starts.</p>
          <button type="button" className="primary fight-btn" onClick={fight}>
            Fight!
          </button>
        </section>
      </div>
    </div>
  );
}

export const TERRAIN_FILL: Record<string, string> = {
  open: '#2f3b26',
  road: '#6b5638',
  brush: '#3c5530',
  trees: '#1d2a17',
  boulder: '#5f5a52',
};
