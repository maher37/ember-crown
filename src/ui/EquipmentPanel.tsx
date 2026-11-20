import { useState } from 'react';
import { weapons } from '../data';
import { equipProblem, isMagicItem, itemName, lookupItem, formatCoins } from '../game/gear';
import { armorSlows, type Hero } from '../game/hero';
import { attunedCount, getItem, MAX_ATTUNED } from '../game/items';
import { useGame } from '../game/store';
import './Sheet.css';

/** What one hero wears and carries, and the party's shared pack (wear, wield, attune, drink). */
export function EquipmentPanel({ heroId }: { heroId: string }) {
  const { game, unequipItem, unequipGear, shortRest, spendPearl, spendStaff } = useGame();
  const g = game!;
  const hero = g.party.find((h) => h.id === heroId)!;
  const [patient, setPatient] = useState(g.party[0]!.id);
  const [msg, setMsg] = useState('');
  const first = hero.name.split(' ')[0]!;
  const pack = Object.entries(g.inventory)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n, it: lookupItem(id) }))
    .filter((x) => x.it)
    .sort((a, b) => order(a.it!.type) - order(b.it!.type) || a.it!.name.localeCompare(b.it!.name));
  const armorName = hero.equipment.armor ? itemName(hero.equipment.armor) : null;

  return (
    <div className="equipment">
      <section aria-label={`${hero.name} wears and carries`}>
        <h3 className="eyebrow">
          {hero.name} wears and carries · AC {hero.ac} · attuned {attunedCount(hero)}/{MAX_ATTUNED}
        </h3>
        <ul className="item-list">
          <li>
            <span>
              <span className="slot-label">Armor</span>
              <span className="strong">{armorName ?? 'None'}</span>{' '}
              <span className="small muted">
                {hero.equipment.armor ? lookupItem(hero.equipment.armor)?.summary : 'Unarmored.'}
                {armorSlows(hero) ? ' Too heavy for their Strength: −10 ft speed.' : ''}
              </span>
            </span>
            {hero.equipment.armor && (
              <button
                type="button"
                className="menu-secondary small-btn"
                onClick={() => unequipGear(hero.id, { armor: true })}
              >
                Take off
              </button>
            )}
          </li>
          <li>
            <span>
              <span className="slot-label">Shield</span>
              <span className="strong">{hero.equipment.shield ? 'Shield' : 'None'}</span>{' '}
              <span className="small muted">{hero.equipment.shield ? '+2 AC.' : ''}</span>
            </span>
            {hero.equipment.shield && (
              <button
                type="button"
                className="menu-secondary small-btn"
                onClick={() => unequipGear(hero.id, { shield: true })}
              >
                Put away
              </button>
            )}
          </li>
          {hero.equipment.weapons.map((id, i) => {
            const w = weapons.find((x) => x.id === id);
            return (
              <li key={`${id}-${i}`}>
                <span>
                  <span className="slot-label">Weapon</span>
                  <span className="strong">{w?.name ?? itemName(id)}</span>{' '}
                  <span className="small muted">{lookupItem(id)?.summary}</span>
                </span>
                <button
                  type="button"
                  className="menu-secondary small-btn"
                  onClick={() => unequipGear(hero.id, { weapon: id })}
                >
                  Put away
                </button>
              </li>
            );
          })}
          {(hero.equipment.magic ?? []).map((id) => (
            <li key={id}>
              <span>
                <span className="slot-label">Magic</span>
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
      </section>
      <section aria-label="The party's pack">
        <h3 className="eyebrow">The party&apos;s pack · {formatCoins(g.gold ?? 0)}</h3>
        {pack.length ? (
          <ul className="item-list">
            {pack.map(({ id, n, it }) => (
              <li key={id}>
                <span>
                  <span className="strong">
                    {it!.name}
                    {n > 1 ? ` ×${n}` : ''}
                  </span>{' '}
                  <span className="small muted">
                    {it!.summary}
                    {isMagicItem(id) && getItem(id).attunement ? ' · requires attunement' : ''}
                  </span>
                </span>
                <PackAction hero={hero} id={id} first={first} setMsg={setMsg} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Nothing in the pack.</p>
        )}
        {!shortRest && (
          <p className="small muted">
            Magic items that need attunement can only be attuned during a short rest (Camp → Short
            rest). Buy and sell gear at Brannoc&apos;s counter in the Drowned Lantern.
          </p>
        )}
        <p className="small" role="status">
          {msg}
        </p>
      </section>
    </div>
  );
}

function PackAction({
  hero,
  id,
  first,
  setMsg,
}: {
  hero: Hero;
  id: string;
  first: string;
  setMsg: (m: string) => void;
}) {
  const { equipItem, drinkPotion } = useGame();
  const it = lookupItem(id)!;
  if (it.type === 'armor' || it.type === 'shield' || it.type === 'weapon') {
    const problem = equipProblem(hero, id);
    const verb = it.type === 'armor' ? 'Wear' : it.type === 'shield' ? 'Carry' : 'Wield';
    return (
      <button
        type="button"
        className="menu-secondary small-btn"
        aria-disabled={!!problem}
        title={problem ?? `${first} takes the ${it.name.toLowerCase()}`}
        onClick={() =>
          setMsg(
            problem ?? equipItem(hero.id, id) ?? `${first} takes the ${it.name.toLowerCase()}.`,
          )
        }
      >
        {verb}
      </button>
    );
  }
  if (it.type === 'gear') return <span className="small muted nowrap">{gearUse(id)}</span>;
  const m = getItem(id);
  if (m.consumable)
    return m.effects.some((e) => e.type === 'heal') ? (
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
  return (
    <button
      type="button"
      className="menu-secondary small-btn"
      onClick={() => setMsg(equipItem(hero.id, id) ?? `${hero.name} takes ${m.name}.`)}
    >
      {m.attunement ? 'Attune' : 'Equip'}
    </button>
  );
}

const order = (t: string) => ['magic', 'gear', 'armor', 'shield', 'weapon'].indexOf(t);

function gearUse(id: string): string {
  const it = lookupItem(id);
  if (!it) return '';
  if (/alchemist|holy-water|acid/.test(id)) return 'throw it in a fight';
  if (id === 'healers-kit') return 'in a fight';
  return 'used in the story';
}
