import { useEffect, useRef, useState } from 'react';
import { quests, spells } from '../data';
import { getClass, slotsLeft, maxSlots } from '../game/hero';
import { SLOT_NAMES, type SlotId } from '../game/save';
import { getLetter, trust } from '../game/letters';
import { useGame } from '../game/store';
import { TRUTHS } from '../game/dialogue';
import { attunedCount, getItem, MAX_ATTUNED } from '../game/items';
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

const g0 = (g: ReturnType<typeof useGame.getState>['game']) => g!;

/** The party's pack and what each hero wears (Items.md: attune during a short rest). */
export function InventoryDialog({ onClose }: { onClose: () => void }) {
  const { game, equipItem, unequipItem, drinkPotion, shortRest, spendPearl, spendStaff } =
    useGame();
  const [patient, setPatient] = useState(g0(game).party[0]!.id);
  const g = game!;
  const [msg, setMsg] = useState('');
  const [who, setWho] = useState(g.party[0]!.id);
  const pack = Object.entries(g.inventory).filter(([, n]) => n > 0);
  const hero = g.party.find((h) => h.id === who)!;
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
        <section>
          <h3 className="eyebrow">
            {hero.name} wears · attuned {attunedCount(hero)}/{MAX_ATTUNED}
          </h3>
          {(hero.equipment.magic ?? []).length ? (
            <ul className="item-list">
              {hero.equipment.magic.map((id) => (
                <li key={id}>
                  <span>
                    <span className="strong">{getItem(id).name}</span>{' '}
                    <span className="small muted">{getItem(id).summary}</span>
                  </span>
                  <span className="row">
                    {id === 'bog-pearl' && (
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        onClick={() => setMsg(spendPearl(hero.id) ?? '')}
                      >
                        Recover a slot
                      </button>
                    )}
                    {id === 'staff-of-healing' && (
                      <>
                        <select
                          value={patient}
                          onChange={(e) => setPatient(e.target.value)}
                          aria-label="Heal whom"
                        >
                          {g.party.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="menu-secondary small-btn"
                          onClick={() => setMsg(spendStaff(hero.id, patient) ?? '')}
                        >
                          Cure Wounds ({Number(g.flags['staff_charges'] ?? 10)} charges)
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="menu-secondary small-btn"
                      onClick={() => unequipItem(hero.id, id)}
                    >
                      Take off
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No magic items.</p>
          )}
        </section>
        <section>
          <h3 className="eyebrow">The pack · {g.gold ?? 0} gp</h3>
          {pack.length ? (
            <ul className="item-list">
              {pack.map(([id, n]) => {
                const it = getItem(id);
                return (
                  <li key={id}>
                    <span>
                      <span className="strong">
                        {it.name}
                        {n > 1 ? ` ×${n}` : ''}
                      </span>{' '}
                      <span className="small muted">
                        {it.summary}
                        {it.attunement ? ' · requires attunement' : ''}
                      </span>
                    </span>
                    {it.consumable ? (
                      it.effects.some((e) => e.type === 'heal') ? (
                        <button
                          type="button"
                          className="menu-secondary small-btn"
                          onClick={() => setMsg(drinkPotion(hero.id, id) ?? '')}
                        >
                          {hero.name.split(' ')[0]} drinks
                        </button>
                      ) : (
                        <span className="small muted">use it in a fight</span>
                      )
                    ) : (
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        onClick={() =>
                          setMsg(equipItem(hero.id, id) ?? `${hero.name} takes ${it.name}.`)
                        }
                      >
                        {it.attunement ? 'Attune' : 'Equip'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="small muted">Nothing in the pack.</p>
          )}
          {!shortRest && (
            <p className="small muted">
              Items that need attunement can only be attuned during a short rest (Camp → Short
              rest).
            </p>
          )}
          <p className="small" role="status">
            {msg}
          </p>
        </section>
      </div>
    </Modal>
  );
}
