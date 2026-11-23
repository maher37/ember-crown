import { useState } from 'react';
import { slotsLeft, type Hero } from '../game/hero';
import {
  afterCasts,
  allyCanTake,
  precastProblems,
  precastSpells,
  precastTarget,
  type Precast,
} from '../game/precast';
import { getSpell } from '../game/combat';

const ord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/**
 * D34: cast buffs just before the fight (and Hex or Hunter's Mark on a foe in sight). The list is
 * cast when the fight starts, after initiative and before the first turn.
 */
export function PrecastPanel({
  party,
  foes,
  foesInSight,
  list,
  onChange,
}: {
  party: Hero[];
  foes: { id: string; name: string }[];
  foesInSight: boolean;
  list: Precast[];
  onChange: (l: Precast[]) => void;
}) {
  const casters = party.filter((h) => precastSpells(h, foesInSight).length > 0);
  if (!casters.length) return null;
  const problems = precastProblems(party, list);
  return (
    <div className="precast">
      <h2 className="eyebrow">Cast before the fight</h2>
      <p className="muted small">
        Buffs cast now carry into the fight for their normal duration, counted from the first round.
        Each uses a spell slot.
        {foesInSight ? '' : ' The enemy is out of sight, so Hex and Hunter’s Mark must wait.'}
      </p>
      {list.length > 0 && (
        <ul className="precast-list">
          {list.map((p, i) => {
            const caster = party.find((h) => h.id === p.casterId);
            const names = p.targetIds
              .map(
                (id) => party.find((h) => h.id === id)?.name ?? foes.find((f) => f.id === id)?.name,
              )
              .filter(Boolean)
              .map((n) => n!.split(' ')[0]);
            return (
              <li key={i}>
                <span>
                  <strong>{caster?.name.split(' ')[0]}</strong>: {getSpell(p.spellId).name} (
                  {ord(p.slotLevel)}-level slot){names.length ? ` on ${names.join(', ')}` : ''}
                </span>
                <button
                  type="button"
                  className="mini"
                  aria-label={`Don't cast ${getSpell(p.spellId).name}`}
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {problems.map((p) => (
        <p key={p} className="notice small" role="alert">
          {p}
        </p>
      ))}
      {casters.map((h) => (
        <CasterRow
          key={h.id}
          hero={afterCasts(h, list)}
          party={party}
          foes={foes}
          foesInSight={foesInSight}
          concentrating={list.some((p) => p.casterId === h.id && getSpell(p.spellId).concentration)}
          onAdd={(p) => onChange([...list, p])}
        />
      ))}
    </div>
  );
}

function CasterRow({
  hero,
  party,
  foes,
  foesInSight,
  concentrating,
  onAdd,
}: {
  hero: Hero;
  party: Hero[];
  foes: { id: string; name: string }[];
  foesInSight: boolean;
  concentrating: boolean;
  onAdd: (p: Precast) => void;
}) {
  const options = precastSpells(hero, foesInSight).filter(
    (o) => !(concentrating && o.spell.concentration),
  );
  const [spellId, setSpellId] = useState('');
  const [level, setLevel] = useState(0);
  const [targets, setTargets] = useState<string[]>([]);
  const first = hero.name.split(' ')[0]!;
  const chosen = options.find((o) => o.spell.id === spellId);
  const slot = chosen ? (chosen.levels.includes(level) ? level : chosen.levels[0]!) : 0;
  const t = chosen ? precastTarget(chosen.spell, slot) : null;
  const allies = chosen ? party.filter((a) => allyCanTake(chosen.spell, a)) : [];
  const ready =
    !!chosen && (t!.kind === 'self' || (targets.length > 0 && targets.every((id) => id)));
  const left = slotsLeft(hero)
    .map((n, i) => (n > 0 ? `${n}×${ord(i + 1)}` : null))
    .filter(Boolean)
    .join(', ');

  const pick = (id: string) => {
    setSpellId(id);
    setTargets([]);
    setLevel(0);
  };
  const toggle = (id: string, max: number) =>
    setTargets(
      targets.includes(id)
        ? targets.filter((x) => x !== id)
        : max === 1
          ? [id]
          : targets.length < max
            ? [...targets, id]
            : targets,
    );

  return (
    <fieldset className="precast-row">
      <legend>
        {first} <span className="muted small">(slots left: {left || 'none'})</span>
      </legend>
      {options.length === 0 ? (
        <p className="muted small">
          {concentrating ? `${first} is already concentrating on a spell.` : 'No slots left.'}
        </p>
      ) : (
        <>
          <label className="small">
            Spell{' '}
            <select value={spellId} onChange={(e) => pick(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.spell.id} value={o.spell.id}>
                  {o.spell.name}
                  {o.spell.concentration ? ' (concentration)' : ''}
                </option>
              ))}
            </select>
          </label>
          {chosen && chosen.levels.length > 1 && (
            <label className="small">
              {' '}
              Slot{' '}
              <select value={slot} onChange={(e) => setLevel(Number(e.target.value))}>
                {chosen.levels.map((l) => (
                  <option key={l} value={l}>
                    {ord(l)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {chosen && <p className="muted small">{chosen.spell.summary}</p>}
          {t?.kind === 'allies' && (
            <div className="precast-targets" role="group" aria-label="Targets">
              <span className="small muted">{t.count === 1 ? 'On:' : `On up to ${t.count}:`}</span>
              {allies.map((a) => (
                <label key={a.id} className="check small">
                  <input
                    type="checkbox"
                    checked={targets.includes(a.id)}
                    disabled={!targets.includes(a.id) && t.count > 1 && targets.length >= t.count}
                    onChange={() => toggle(a.id, t.count)}
                  />
                  {a.name.split(' ')[0]}
                </label>
              ))}
              {!allies.length && <span className="small muted">no one can take it</span>}
            </div>
          )}
          {t?.kind === 'foe' && (
            <label className="small">
              On{' '}
              <select value={targets[0] ?? ''} onChange={(e) => setTargets([e.target.value])}>
                <option value="">Choose an enemy…</option>
                {foes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {chosen && (
            <button
              type="button"
              className="mini"
              disabled={!ready}
              onClick={() => {
                onAdd({
                  casterId: hero.id,
                  spellId: chosen.spell.id,
                  slotLevel: slot,
                  targetIds: t!.kind === 'self' ? [] : targets,
                });
                pick('');
              }}
            >
              Cast {chosen.spell.name}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}

const BUFF_NAMES: Record<string, string> = {
  aid: 'Aid',
  'mage-armor': 'Mage Armor',
  'armor-of-agathys': 'Armor of Agathys',
  'false-life': 'False Life',
};

/** D34: long spells from earlier that will still be up in this fight (no slot needed). */
export function StillActive({ party, clock }: { party: Hero[]; clock: number }) {
  const live = party.flatMap((h) =>
    (h.buffs ?? [])
      .filter((b) => b.until > clock)
      .map((b) => {
        const left = b.until - clock;
        const time = left >= 1 ? `${Math.floor(left)} h left` : 'under an hour left';
        return `${h.name.split(' ')[0]}: ${BUFF_NAMES[b.spell]} (${time})`;
      }),
  );
  if (!live.length) return null;
  return (
    <p className="small muted" role="status">
      Still in effect from earlier: {live.join(' · ')}
    </p>
  );
}
