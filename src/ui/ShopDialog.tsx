import { useState } from 'react';
import { armor } from '../data';
import {
  formatCoins,
  isMagicItem,
  lookupItem,
  RARE_FINDS,
  sellPrice,
  shopStock,
  type CatalogItem,
} from '../game/gear';
import { emptyLoadout, placeProblem, slotKindOf, type SlotId } from '../game/loadout';
import { itemHowItWorks, RarityTag } from './EquipmentPanel';
import { ItemIcon } from './ItemIcon';
import { useGame } from '../game/store';
import { Modal } from './ExploreDialogs';
import './Sheet.css';

const SECTIONS: { name: string; match: (it: CatalogItem) => boolean }[] = [
  {
    name: 'Rare finds (magic)',
    match: (it) => it.type === 'magic' && it.id !== 'potion-of-healing' && !/potion/.test(it.id),
  },
  { name: 'Potions', match: (it) => it.type === 'magic' && /potion/.test(it.id) },
  { name: 'Adventuring gear', match: (it) => it.type === 'gear' },
  { name: 'Armor and shields', match: (it) => it.type === 'armor' || it.type === 'shield' },
  { name: 'Weapons', match: (it) => it.type === 'weapon' },
];

/** Brannoc's counter: standard equipment at standard prices; he buys back at half (PHB). */
export function ShopDialog({ onClose }: { onClose: () => void }) {
  const { game, buyItem, sellItem } = useGame();
  const g = game!;
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState('');
  const stock = shopStock(g.act)
    .map((id) => lookupItem(id)!)
    .filter(Boolean);
  const coming = RARE_FINDS.filter((m) => m.shopAct! > g.act);
  const first = (name: string) => name.split(' ')[0]!;
  /**
   * For things you wear or wield: each hero, and whether they can use it (and why not).
   * PHB: proficiency, two hands, light off-hand weapons.
   */
  const whoCanUse = (it: CatalogItem) => {
    const kind = slotKindOf(it.id);
    if (!kind) return null;
    return g.party.map((h) => {
      const lo = emptyLoadout();
      const slot =
        kind === 'shield'
          ? 'off1'
          : kind === 'weapon'
            ? 'main1'
            : kind === 'ring'
              ? 'ring1'
              : kind === 'trinket'
                ? 'trinket1'
                : (kind as SlotId);
      const why = placeProblem(h, lo, slot, it.id);
      return { name: first(h.name), ok: !why, why: why ?? '' };
    });
  };
  const sellable = Object.entries(g.inventory).filter(([id, n]) => n > 0 && sellPrice(id) !== null);

  return (
    <Modal title="Brannoc's stores" onClose={onClose}>
      <div className="shop">
        <div className="row between">
          <div role="tablist" aria-label="Buy or sell" className="seg">
            {(['buy', 'sell'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'on' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'buy' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>
          <span className="shop-gold">Party gold: {formatCoins(g.gold ?? 0)}</span>
        </div>
        <p className="small muted">
          &ldquo;Rope, oil, a decent coat of mail. If it&apos;s not on the shelf, I&apos;ll have it
          up from Waterdeep by the next barge.&rdquo; Prices are the standard ones; Brannoc buys
          gear back at half.
        </p>
        <div className="journal-scroll shop-list">
          {tab === 'buy' && coming.length > 0 && (
            <p className="small muted">
              More rare finds arrive later in the story ({coming.length} items, from Act{' '}
              {Math.min(...coming.map((m) => m.shopAct!))}).
            </p>
          )}
          {tab === 'buy' ? (
            SECTIONS.map((sec) => (
              <section key={sec.name} aria-label={sec.name}>
                <h3 className="eyebrow">{sec.name}</h3>
                <ul className="item-list">
                  {stock.filter(sec.match).map((it) => {
                    const users = whoCanUse(it);
                    const afford = (g.gold ?? 0) + 1e-9 >= (it.costGp ?? 0);
                    const owned = g.inventory[it.id] ?? 0;
                    const a = armor.find((x) => x.id === it.id);
                    return (
                      <li key={it.id}>
                        <span className="item-row-main">
                          <ItemIcon id={it.id} />
                          <span>
                            <span className="strong">{it.name}</span>
                            <RarityTag id={it.id} />{' '}
                            {owned > 0 && <span className="small muted">(have {owned}) </span>}
                            <span className="small muted">{it.summary}</span>
                            {isMagicItem(it.id) && (
                              <span className="small faint"> {itemHowItWorks(it.id)}</span>
                            )}
                            {users && (
                              <span className="who-can">
                                {users.map((u) => (
                                  <span
                                    key={u.name}
                                    className={`who ${u.ok ? 'ok' : 'no'}`}
                                    title={u.ok ? `${u.name} can use it` : u.why}
                                  >
                                    {u.ok ? '✓' : '✗'} {u.name}
                                    {!u.ok && <span className="why"> · {shortWhy(u.why)}</span>}
                                  </span>
                                ))}
                                {a?.strength ? (
                                  <span className="who">needs Str {a.strength} (else −10 ft)</span>
                                ) : null}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="row nowrap">
                          <span className="price">{formatCoins(it.costGp ?? 0)}</span>
                          <button
                            type="button"
                            className="menu-secondary small-btn"
                            aria-disabled={!afford}
                            aria-label={`Buy ${it.name}`}
                            onClick={() =>
                              setMsg(
                                buyItem(it.id) ?? `Bought: ${it.name}. It's in the party's pack.`,
                              )
                            }
                          >
                            Buy
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ) : sellable.length ? (
            <ul className="item-list">
              {sellable.map(([id, n]) => {
                const it = lookupItem(id)!;
                return (
                  <li key={id}>
                    <span>
                      <span className="strong">
                        {it.name}
                        {n > 1 ? ` ×${n}` : ''}
                      </span>{' '}
                      <span className="small muted">{it.summary}</span>
                    </span>
                    <span className="row nowrap">
                      <span className="price">{formatCoins(sellPrice(id)!)}</span>
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        aria-label={`Sell ${it.name}`}
                        onClick={() => setMsg(sellItem(id) ?? `Sold: ${it.name}.`)}
                      >
                        Sell
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="small muted">
              Nothing to sell. (Worn gear has to be taken off first, on the character sheet. Story
              treasures aren&apos;t for sale.)
            </p>
          )}
        </div>
        <p className="small" role="status">
          {msg}
        </p>
      </div>
    </Modal>
  );
}

/** The reason, shortened for the shop list ("not trained", "needs both hands"…). */
function shortWhy(why: string): string {
  if (/isn't trained/.test(why)) return 'not trained';
  if (/both hands/.test(why)) return 'needs both hands';
  if (/light weapon/.test(why)) return 'not light';
  return why.replace(/\.$/, '');
}
