import { useEffect, useRef, useState } from 'react';
import { quests, spells } from '../data';
import { getClass, slotsLeft, maxSlots } from '../game/hero';
import { SLOT_NAMES, type SlotId } from '../game/save';
import { useGame } from '../game/store';
import { downloadSave } from './saveFiles';

function Modal({
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
          </section>
        ))}
        <p className="small muted">
          You choose spells when you level up. Preparing spells after a long rest arrives with rests
          (M6).
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
