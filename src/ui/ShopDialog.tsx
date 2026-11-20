import { useState } from 'react';
import { armor, weapons } from '../data';
import {
  armorProficient,
  formatCoins,
  lookupItem,
  sellPrice,
  SHOP_STOCK,
  weaponProficient,
  type CatalogItem,
} from '../game/gear';
import { useGame } from '../game/store';
import { Modal } from './ExploreDialogs';
import './Sheet.css';

const SECTIONS: { name: string; match: (it: CatalogItem) => boolean }[] = [
  { name: 'Adventuring gear', match: (it) => it.type === 'gear' },
  { name: 'Potions', match: (it) => it.type === 'magic' },
  { name: 'Armor and shields', match: (it) => it.type === 'armor' || it.type === 'shield' },
  { name: 'Weapons', match: (it) => it.type === 'weapon' },
];

/** Brannoc's counter: standard equipment at standard prices; he buys back at half (PHB). */
export function ShopDialog({ onClose }: { onClose: () => void }) {
  const { game, buyItem, sellItem } = useGame();
  const g = game!;
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState('');
  const stock = SHOP_STOCK.map((id) => lookupItem(id)!).filter(Boolean);
  const first = (name: string) => name.split(' ')[0]!;
  /** Which heroes are trained to use a piece of armor or a weapon. */
  const whoCanUse = (it: CatalogItem) => {
    if (it.type === 'armor' || it.type === 'shield')
      return g.party.filter((h) => armorProficient(h, it.id)).map((h) => first(h.name));
    if (it.type === 'weapon') {
      const w = weapons.find((x) => x.id === it.id)!;
      return g.party.filter((h) => weaponProficient(h, w)).map((h) => first(h.name));
    }
    return null;
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
                        <span>
                          <span className="strong">{it.name}</span>{' '}
                          {owned > 0 && <span className="small muted">(have {owned}) </span>}
                          <span className="small muted">{it.summary}</span>
                          {users && (
                            <span className="small users">
                              {' '}
                              {users.length
                                ? `Trained: ${users.join(', ')}`
                                : 'No one in the party is trained with this.'}
                              {a?.strength ? ` · Str ${a.strength}` : ''}
                            </span>
                          )}
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
