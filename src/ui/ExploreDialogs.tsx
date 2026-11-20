import { useEffect, useRef, useState } from 'react';
import { quests, spells } from '../data';
import { getClass, resourceLeft, slotsLeft, maxSlots } from '../game/hero';
import { healingSpells } from '../game/healing';
import { SLOT_NAMES, type SlotId } from '../game/save';
import { getLetter, trust } from '../game/letters';
import { useGame } from '../game/store';
import { TRUTHS } from '../game/dialogue';
import { EquipmentPanel } from './EquipmentPanel';
import { downloadSave } from './saveFiles';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dialog wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <h2>{title}</h2>
          <button type="button" ref={ref} className="menu-secondary small-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function JournalDialog({ onClose }: { onClose: () => void }) {
  const g = useGame((s) => s.game)!;
  const entries = Object.entries(g.quests)
    .map(([id, st]) => ({ q: quests.find((x) => x.id === id)!, st }))
    .filter((x) => x.q);
  return (
    <Modal title="Journal" onClose={onClose}>
      <div className="journal-scroll">
        {(['main', 'side'] as const).map((kind) => (
          <section key={kind}>
            <h3 className="eyebrow">{kind === 'main' ? 'Main quests' : 'Side quests'}</h3>
            {entries
              .filter((x) => x.q.kind === kind)
              .map(({ q, st }) => (
                <div key={q.id} className="journal-quest">
                  <div className="strong">
                    {q.title} {st.status === 'done' ? '· complete' : ''}
                  </div>
                  <div className="small muted">{q.summary}</div>
                  <ul>
                    {q.steps
                      .filter((s) => st.steps.includes(s.id) || st.status === 'active')
                      .map((s) => (
                        <li key={s.id} className={st.steps.includes(s.id) ? 'done' : ''}>
                          {st.steps.includes(s.id) ? '✓ ' : '☐ '}
                          {s.text}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </section>
        ))}
        <section>
          <h3 className="eyebrow">Letters</h3>
          {g.letters.length ? (
            <ul>
              {g.letters.map((l) => (
                <li key={l.id}>
                  “{getLetter(l.id).title}”{l.read ? '' : ' (unread: read it at camp)'}
                  {l.reply
                    ? ` · you sent ${l.reply === 'hard' ? 'a hard' : `an ${l.reply}`.replace('an kind', 'a kind')} reply`
                    : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No letters yet.</p>
          )}
          <p className="small muted">Trust with M.V.: {trust(g)}</p>
        </section>
        <section>
          <h3 className="eyebrow">Truths</h3>
          {Object.entries(TRUTHS).some(([id]) => g.flags[`truth_${id}`]) ? (
            <ul>
              {Object.entries(TRUTHS)
                .filter(([id]) => g.flags[`truth_${id}`])
                .map(([id, name]) => (
                  <li key={id}>{name}</li>
                ))}
            </ul>
          ) : (
            <p className="small muted">
              None yet. Each Truth you hold opens a way to talk Maelis down at the end.
            </p>
          )}
        </section>
        <section>
          <h3 className="eyebrow">Notes</h3>
          {g.notes.length ? (
            <ul>
              {g.notes.map((n) => (
                <li key={n.text}>{n.text}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Nothing yet.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

export function SpellsDialog({ onClose }: { onClose: () => void }) {
  const g = useGame((s) => s.game)!;
  const healOutside = useGame((s) => s.healOutside);
  const toasts = useGame((s) => s.toasts);
  const [target, setTarget] = useState(g.party[0]!.id);
  const [msg, setMsg] = useState('');
  const name = (id: string) => spells.find((s) => s.id === id)?.name ?? id;
  const casters = g.party.filter((h) => getClass(h.classId).spellcasting);
  return (
    <Modal title="Spells" onClose={onClose}>
      <div className="journal-scroll">
        {!casters.length && <p className="muted">No one in the party casts spells.</p>}
        {casters.map((h) => (
          <section key={h.id} className="journal-quest">
            <div className="strong">
              {h.name} · {getClass(h.classId).name} {h.level}
            </div>
            <div className="small">Cantrips: {h.cantrips.map(name).join(', ') || '—'}</div>
            <div className="small">Spells: {h.spells.map(name).join(', ') || '—'}</div>
            <div className="small muted">
              Slots:{' '}
              {maxSlots(h)
                .map((n, i) => (n ? `${['1st', '2nd', '3rd'][i]} ${slotsLeft(h)[i]}/${n}` : ''))
                .filter(Boolean)
                .join(' · ') || 'none yet'}
            </div>
            {healingSpells(h).map(({ spell, levels, group }) => (
              <div key={spell.id} className="row small heal-row">
                <span className="strong">{spell.name}</span>
                <span className="muted">
                  {group
                    ? 'heals the whole party'
                    : `on ${g.party.find((p) => p.id === target)?.name}`}
                </span>
                {levels.length ? (
                  levels.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      className="mini"
                      onClick={() =>
                        setMsg(
                          healOutside(h.id, { spellId: spell.id, slotLevel: lv }, target) ?? '',
                        )
                      }
                    >
                      Cast (level {lv})
                    </button>
                  ))
                ) : (
                  <span className="muted">no slots left</span>
                )}
              </div>
            ))}
          </section>
        ))}
        {g.party.some((h) => h.classId === 'paladin' && h.level >= 1) &&
          g.party
            .filter((h) => h.classId === 'paladin')
            .map((p) => (
              <div key={p.id} className="row small heal-row">
                <span className="strong">{p.name}: Lay on Hands</span>
                <span className="muted">{resourceLeft(p, 'lay-on-hands')} points left</span>
                <button
                  type="button"
                  className="mini"
                  onClick={() => setMsg(healOutside(p.id, 'lay-on-hands', target) ?? '')}
                >
                  Heal {g.party.find((x) => x.id === target)?.name}
                </button>
              </div>
            ))}
        <label className="small">
          Heal whom{' '}
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Heal whom">
            {g.party.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.dead ? 'dead' : `HP ${p.hp}/${p.maxHp}`})
              </option>
            ))}
          </select>
        </label>
        <p className="small" role="status">
          {msg || toasts.at(-1)}
        </p>
        <p className="small muted">
          You choose spells when you level up. Other ways to heal between fights: a short rest
          (spend Hit Dice), a long rest (everything back), or a potion from the Inventory.
        </p>
      </div>
    </Modal>
  );
}

export function SaveDialog({ onClose }: { onClose: () => void }) {
  const saveTo = useGame((s) => s.saveTo);
  const [message, setMessage] = useState('');
  const save = (slot: SlotId) => {
    try {
      saveTo(slot);
      setMessage(`Saved to ${SLOT_NAMES[slot]}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal title="Save game" onClose={onClose}>
      <div className="row">
        <button type="button" className="menu-secondary small-btn" onClick={() => save('slot1')}>
          Save to Slot 1
        </button>
        <button type="button" className="menu-secondary small-btn" onClick={() => save('slot2')}>
          Save to Slot 2
        </button>
        <button
          type="button"
          className="menu-secondary small-btn"
          onClick={() => downloadSave(saveTo('autosave'))}
        >
          Export save file
        </button>
      </div>
      <p className="small" role="status">
        {message}
      </p>
    </Modal>
  );
}

/** The party's pack and what each hero wears (Items.md: attune during a short rest). */
export function InventoryDialog({ onClose }: { onClose: () => void }) {
  const { game } = useGame();
  const g = game!;
  const [who, setWho] = useState(g.party[0]!.id);
  return (
    <Modal title="Inventory" onClose={onClose}>
      <div className="journal-scroll">
        <label className="small">
          Hero{' '}
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Hero">
            {g.party.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} (HP {h.hp}/{h.maxHp})
              </option>
            ))}
          </select>
        </label>
        <EquipmentPanel heroId={who} />
      </div>
    </Modal>
  );
}
