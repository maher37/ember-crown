// The combat pop-ups: the reaction prompt and the end-of-fight dialog (split from CombatScreen.tsx).
import { getSpell, type CombatState } from '../../game/combat';

export function PromptDialog({
  state,
  onAnswer,
}: {
  state: CombatState;
  onAnswer: (yes: boolean) => void;
}) {
  const p = state.prompt!;
  const name = (id: string) => state.combatants[id]!.name;
  const text =
    p.kind === 'opportunity-attack'
      ? `${name(p.targetId)} is leaving ${name(p.reactorId)}'s reach. Make an opportunity attack?`
      : p.kind === 'shield'
        ? `${name(p.attackerId)} hits ${name(p.reactorId)} with a ${p.total}. Cast Shield (+5 AC, uses a spell slot) to turn it into a miss?`
        : p.kind === 'protection'
          ? `${name(p.attackerId)} attacks ${name(p.targetId)}. Should ${name(p.reactorId)} use Protection (disadvantage on the attack)?`
          : p.kind === 'cutting-words'
            ? `${name(p.attackerId)} hits ${name(p.targetId)} with a ${p.total}. Should ${name(p.reactorId)} use Cutting Words (a Bardic Inspiration die off the roll)?`
            : p.kind === 'counterspell'
              ? `${name(p.casterId)} starts casting ${getSpell(p.spellId).name}. Should ${name(p.reactorId)} cast Counterspell (a 3rd-level slot) to stop it?`
              : `${name(p.attackerId)} just hurt ${name(p.reactorId)}. Answer with Hellish Rebuke (uses a spell slot)?`;
  return (
    <div className="dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        aria-describedby="prompt-text"
        className="dialog"
      >
        <h2 id="prompt-title">Reaction</h2>
        <p id="prompt-text">{text}</p>
        <div className="row">
          <button type="button" className="primary" autoFocus onClick={() => onAnswer(true)}>
            Yes
          </button>
          <button
            type="button"
            className="menu-secondary small-btn"
            onClick={() => onAnswer(false)}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

/** Victory, parley, or defeat (with the way back). */
export function OutcomeDialog({
  s,
  onContinue,
  onLoadAutosave,
  onTitle,
}: {
  s: CombatState;
  onContinue: () => void;
  onLoadAutosave: () => void;
  onTitle: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-title"
        className="dialog outcome"
      >
        <h2 id="outcome-title">
          {s.outcome === 'victory'
            ? 'Victory!'
            : s.outcome === 'parley'
              ? 'The fight is over'
              : s.defeatContinues
                ? 'Beaten'
                : 'Defeat'}
        </h2>
        {s.outcome !== 'defeat' || s.defeatContinues ? (
          <>
            <p>
              {s.outcome === 'defeat'
                ? 'Your party is knocked flat, but the story goes on.'
                : `${s.outcome === 'parley' ? 'Words won where swords would have.' : 'The enemy is beaten.'} Each surviving hero earns ${s.xpPerPc} XP.`}
            </p>
            <button type="button" className="primary" autoFocus onClick={onContinue}>
              Continue
            </button>
          </>
        ) : (
          <>
            <p>Your party has fallen.</p>
            <button type="button" className="primary" autoFocus onClick={onLoadAutosave}>
              Load the autosave from before the fight
            </button>
            <button type="button" className="menu-secondary small-btn" onClick={onTitle}>
              Title screen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
