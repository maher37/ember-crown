import { useState } from 'react';
import { formatCoins, isMagicItem, lookupItem } from '../game/gear';
import { armorSlows, type Hero } from '../game/hero';
import { getItem } from '../game/items';
import {
  attunedIn,
  ATTUNE_MAX,
  autoSlot,
  itemLabel,
  loadoutOf,
  placeItem,
  SLOT_NAMES,
  slotKindOf,
  weaponFor,
  type Loadout,
  type SlotId,
} from '../game/loadout';
import { useGame } from '../game/store';
import './Sheet.css';

const WORN: SlotId[] = ['armor', 'cloak', 'neck', 'ring1', 'ring2', 'feet', 'trinket1', 'trinket2'];

/** What an item is, in a few words ("Warhammer · 1d8 bludgeoning · +1"). */
export function itemKindLine(id: string, hero?: Hero): string {
  const it = lookupItem(id);
  if (!it) return '';
  const kind = slotKindOf(id);
  const w = kind === 'weapon' ? weaponFor(id, hero) : null;
  if (w) {
    const magic = isMagicItem(id) ? ' · magic' : '';
    return `${w.name} · ${w.damage.dice} ${w.damage.type}${w.properties.length ? ` · ${w.properties.join(', ')}` : ''}${magic}`;
  }
  if (it.type === 'armor') return it.summary.replace(/\.$/, '');
  if (kind === 'shield') return isMagicItem(id) ? 'Shield · magic' : 'Shield · +2 AC';
  if (it.type === 'magic') {
    const m = getItem(id);
    return `${m.consumable ? 'Potion' : (kind ?? m.kind).replace(/^./, (c) => c.toUpperCase())} · ${m.rarity}${m.attunement ? ' · needs attunement' : ''}`;
  }
  return 'Adventuring gear';
}

/** The full "how it works" for an item. */
export function itemHowItWorks(id: string): string {
  if (isMagicItem(id)) {
    const m = getItem(id);
    return m.howItWorks ?? m.summary;
  }
  return lookupItem(id)?.summary ?? '';
}

/** One hero's slots (two weapon sets and what they wear) and the party's shared pack. */
export function EquipmentPanel({ heroId }: { heroId: string }) {
  const { game, clearHeroSlot, switchHeroWeapons } = useGame();
  const g = game!;
  const hero = g.party.find((h) => h.id === heroId)!;
  const lo = loadoutOf(hero);
  const [selected, setSelected] = useState<SlotId | null>(null);
  const [msg, setMsg] = useState('');
  const first = hero.name.split(' ')[0]!;
  const pack = Object.entries(g.inventory)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n, it: lookupItem(id) }))
    .filter((x) => x.it)
    .filter((x) => !selected || slotFits(selected, x.id))
    .sort((a, b) => order(a.it!.type) - order(b.it!.type) || a.it!.name.localeCompare(b.it!.name));

  const slotBox = (slot: SlotId) => {
    const id = lo[slot];
    return (
      <div
        key={slot}
        className={`slot${id ? ' filled' : ''}${selected === slot ? ' selected' : ''}`}
        role="group"
        aria-label={`${SLOT_NAMES[slot]}: ${id ? itemLabel(id) : 'empty'}`}
      >
        <button
          type="button"
          className="slot-main"
          aria-pressed={selected === slot}
          title={id ? itemHowItWorks(id) : 'Empty: click to see what fits here'}
          onClick={() => setSelected(selected === slot ? null : slot)}
        >
          <span className="slot-label">{SLOT_NAMES[slot]}</span>
          <span className="slot-item">{id ? itemLabel(id) : 'empty'}</span>
          {id && <span className="slot-kind small muted">{itemKindLine(id, hero)}</span>}
        </button>
        {id && (
          <button
            type="button"
            className="slot-remove"
            aria-label={`Take off ${itemLabel(id)}`}
            title="Back to the pack"
            onClick={() => {
              clearHeroSlot(hero.id, slot);
              setMsg(`${itemLabel(id)} went back in the pack.`);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="equipment">
      <section className="equip-card" aria-label="Weapon sets">
        <div className="row between">
          <h3 className="eyebrow">Weapon sets</h3>
          <button
            type="button"
            className="menu-secondary small-btn"
            onClick={() => switchHeroWeapons(hero.id)}
          >
            Use set {lo.active === 1 ? 2 : 1}
          </button>
        </div>
        <div className="sets">
          {([1, 2] as const).map((set) => (
            <div key={set} className={`set${lo.active === set ? ' active' : ''}`}>
              <span className="set-name">
                Set {set}
                {lo.active === set ? ' · in hand' : ''}
              </span>
              <div className="set-slots">
                {slotBox(set === 1 ? 'main1' : 'main2')}
                {slotBox(set === 1 ? 'off1' : 'off2')}
              </div>
            </div>
          ))}
        </div>
        <p className="small muted">
          Switching sets is free outside fights, and once a turn in a fight (“Switch weapons”).
          Two-handed weapons need the off hand free; only light weapons fit the off hand.
        </p>
      </section>

      <section className="equip-card" aria-label={`${hero.name} wears`}>
        <h3 className="eyebrow">
          Worn · AC {hero.ac} · attuned {attunedIn(lo)}/{ATTUNE_MAX}
          {armorSlows(hero) ? ' · armor too heavy: −10 ft speed' : ''}
        </h3>
        <div className="worn-slots">{WORN.map(slotBox)}</div>
      </section>

      {selected && lo[selected] && (
        <p className="how-it-works small" role="status">
          <span className="strong">{itemLabel(lo[selected]!)}:</span>{' '}
          {itemHowItWorks(lo[selected]!)}
        </p>
      )}

      <section className="equip-card" aria-label="The party's pack">
        <h3 className="eyebrow">
          {selected
            ? `The pack: what fits the ${SLOT_NAMES[selected].toLowerCase()} slot`
            : 'The party’s pack'}{' '}
          · {formatCoins(g.gold ?? 0)}
          {selected && (
            <button type="button" className="link-btn small" onClick={() => setSelected(null)}>
              {' '}
              show everything
            </button>
          )}
        </h3>
        {pack.length ? (
          <ul className="item-list">
            {pack.map(({ id, n, it }) => (
              <li key={id}>
                <span>
                  <span className="strong">
                    {it!.name}
                    {n > 1 ? ` ×${n}` : ''}
                  </span>{' '}
                  <span className="small faint">{itemKindLine(id, hero)}</span>
                  <br />
                  <span className="small muted">{itemHowItWorks(id)}</span>
                </span>
                <PackAction
                  hero={hero}
                  lo={lo}
                  slot={selected}
                  id={id}
                  first={first}
                  setMsg={setMsg}
                  onDone={() => setSelected(null)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">
            {selected ? 'Nothing in the pack fits here.' : 'Nothing in the pack.'}
          </p>
        )}
        <p className="small muted">
          Items that need attunement are put on during a short rest (Camp → Short rest). Buy and
          sell at Brannoc&apos;s, in Ashford.
        </p>
        <p className="small" role="status">
          {msg}
        </p>
      </section>
    </div>
  );

  function slotFits(slot: SlotId, id: string) {
    const k = slotKindOf(id);
    if (!k) return false;
    if (slot.startsWith('main')) return k === 'weapon';
    if (slot.startsWith('off')) return k === 'weapon' || k === 'shield';
    if (slot.startsWith('ring')) return k === 'ring';
    if (slot.startsWith('trinket')) return k === 'trinket';
    return k === slot;
  }
}

function PackAction({
  hero,
  lo,
  slot,
  id,
  first,
  setMsg,
  onDone,
}: {
  hero: Hero;
  lo: Loadout;
  slot: SlotId | null;
  id: string;
  first: string;
  setMsg: (m: string) => void;
  onDone: () => void;
}) {
  const { equipToHeroSlot, drinkPotion, spendPearl, spendStaff, game } = useGame();
  const [patient, setPatient] = useState(game!.party[0]!.id);
  const it = lookupItem(id)!;
  if (it.type === 'gear') return <span className="small muted nowrap">{gearUse(id)}</span>;
  if (isMagicItem(id) && getItem(id).consumable)
    return getItem(id).effects.some((e) => e.type === 'heal') ? (
      <button
        type="button"
        className="menu-secondary small-btn"
        onClick={() => setMsg(drinkPotion(hero.id, id) ?? '')}
      >
        {first} drinks
      </button>
    ) : (
      <span className="small muted">use it in a fight</span>
    );
  const where = slot ?? autoSlot(hero, lo, id);
  const problem = where
    ? placeItem(hero, lo, where, id).error
    : `${it.name} isn't worn or wielded.`;
  return (
    <span className="row nowrap pack-actions">
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
            {game!.party.map((p) => (
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
            Cure Wounds ({Number(game!.flags['staff_charges'] ?? 10)})
          </button>
        </>
      )}
      <button
        type="button"
        className="menu-secondary small-btn"
        aria-disabled={!!problem}
        title={problem ?? `${first}: ${where ? SLOT_NAMES[where].toLowerCase() : ''}`}
        onClick={() => {
          if (problem) return setMsg(problem);
          const err = equipToHeroSlot(hero.id, id, where!);
          setMsg(
            err ??
              `${first} takes the ${it.name.toLowerCase()} (${SLOT_NAMES[where!].toLowerCase()}).`,
          );
          if (!err) onDone();
        }}
      >
        {where ? `Equip: ${SLOT_NAMES[where].toLowerCase()}` : 'Equip'}
      </button>
    </span>
  );
}

const order = (t: string) => ['magic', 'weapon', 'shield', 'armor', 'gear'].indexOf(t);

function gearUse(id: string): string {
  if (/alchemist|holy-water|acid/.test(id)) return 'throw it in a fight';
  if (id === 'healers-kit') return 'in a fight';
  return 'used in the story';
}
