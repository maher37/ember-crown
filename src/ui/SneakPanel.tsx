// "Sneak ahead" on the Prepare screen (D35): pick one scout, see everyone's odds, then slip past
// or ambush. The fight button on the Prepare screen reads the result (ambush or spotted).
import type { DifficultyId } from '../data/schemas/difficulty';
import type { Encounter } from '../data/schemas/encounter';
import { sneakChance, sneakDc, sneakOdds } from '../game/sneak';
import { useGame } from '../game/store';

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function SneakPanel({ enc, difficulty }: { enc: Encounter; difficulty: DifficultyId }) {
  const { game, scout, slipPast, scouted } = useGame();
  if (!enc.sneak) return null;
  const dc = sneakDc(enc, difficulty);
  const result = scouted?.encounterId === enc.id ? scouted : null;
  const odds = game!.party
    .map(sneakOdds)
    .map((o) => ({ ...o, chance: sneakChance(o, dc) }))
    .sort((a, b) => b.chance - a.chance);

  return (
    <div className="talk sneak">
      <h2 className="eyebrow">Sneak ahead</h2>
      <p className="small">{enc.sneak.prompt}</p>
      {!result ? (
        <>
          <p className="muted small">
            Send one scout: Stealth DC {dc} (the sharpest enemy&apos;s passive Perception, +1 for
            each other enemy watching).
          </p>
          <ul className="sneak-list">
            {odds.map((o) => (
              <li key={o.heroId} className="row between baseline">
                <span>
                  <span className="strong">{o.name.split(' ')[0]}</span>{' '}
                  <span className="small">Stealth {signed(o.bonus)}</span>
                  {o.advantage.length > 0 && (
                    <span className="small sneak-adv"> · advantage ({o.advantage.join(', ')})</span>
                  )}
                  {o.disadvantage.length > 0 && (
                    <span className="small sneak-dis">
                      {' '}
                      · disadvantage ({o.disadvantage.join(', ')})
                    </span>
                  )}
                  <span className="muted small"> · {o.chance}%</span>
                </span>
                <button
                  type="button"
                  className="menu-secondary small-btn"
                  onClick={() => scout(o.heroId, difficulty)}
                >
                  Send {o.name.split(' ')[0]}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Unseen: slip past for the same XP as the fight, or ambush them (they lose their first
            turn). Spotted: the fight starts with your party surprised.
          </p>
        </>
      ) : (
        <>
          <p className="small" role="status">
            {result.text}
          </p>
          {result.success && enc.sneak.slipPast && (
            <button type="button" className="menu-secondary small-btn" onClick={slipPast}>
              Slip past unseen (+{enc.xpPerPc} XP each)
            </button>
          )}
        </>
      )}
    </div>
  );
}
