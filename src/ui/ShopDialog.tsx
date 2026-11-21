import { useState } from 'react';
import { armor } from '../data';
import { formatCoins, isMagicItem, lookupItem, type CatalogItem } from '../game/gear';
import { emptyLoadout, placeProblem, slotKindOf, type SlotId } from '../game/loadout';
import {
  comingLater,
  getShop,
  hoursToMarket,
  purchasesLeft,
  sellPriceAt,
  serviceCost,
  shopOpen,
  stockOf,
} from '../game/shops';
import { itemHowItWorks, RarityTag } from './EquipmentPanel';
import { ItemIcon } from './ItemIcon';
import { useGame } from '../game/store';
import { Modal } from './ExploreDialogs';
import './Sheet.css';

const SECTIONS: { name: string; match: (it: CatalogItem) => boolean }[] = [
  {
    name: 'Magic items',
    match: (it) => it.type === 'magic' && !/potion/.test(it.id),
  },
  { name: 'Potions', match: (it) => it.type === 'magic' && /potion/.test(it.id) },
  { name: 'Adventuring gear', match: (it) => it.type === 'gear' },
  { name: 'Armor and shields', match: (it) => it.type === 'armor' || it.type === 'shield' },
  { name: 'Weapons', match: (it) => it.type === 'weapon' },
];

/**
 * A shop counter (src/data/shops.json): the keeper's stock today, buy-back at half price (PHB:
 * Selling Treasure), purchase limits for wandering merchants, and the temple's services.
 */
export function ShopDialog({
  shopId = 'brannoc',
  onClose,
}: {
  shopId?: string;
  onClose: () => void;
}) {
  const { game, buyFrom, sellTo, templeService } = useGame();
  const g = game!;
  const shop = getShop(shopId);
  const [tab, setTab] = useState<'buy' | 'sell' | 'services'>(
    shop.services.length ? 'services' : 'buy',
  );
  const [msg, setMsg] = useState('');
  const [who, setWho] = useState(g.party[0]!.id);
  const open = shopOpen(g, shop);
  const stock = stockOf(g, shopId)
    .map((id) => lookupItem(id)!)
    .filter(Boolean);
  const coming = comingLater(g, shopId);
  const left = purchasesLeft(g, shopId);
  const first = (name: string) => name.split(' ')[0]!;
  const keeper = first(shop.keeper.split(',')[0]!);
  /**
   * For things you wear or wield: each hero, and whether they can use it (and why not).
   * PHB: proficiency, two hands, light off-hand weapons; DMG: attunement by a spellcaster.
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
  const sellable = Object.entries(g.inventory).filter(
    ([id, n]) => n > 0 && sellPriceAt(shopId, id) !== null,
  );
  const tabs = [
    ...(shop.services.length ? (['services'] as const) : []),
    ...(stock.length || !open ? (['buy'] as const) : []),
    ...(shop.buys.length ? (['sell'] as const) : []),
  ];

  return (
    <Modal title={shop.name} onClose={onClose}>
      <div className="shop">
        <div className="row between">
          <div role="tablist" aria-label="Shop" className="seg">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'on' : ''}
                onClick={() => setTab(t)}
              >
                {t === 'buy' ? 'Buy' : t === 'sell' ? 'Sell' : 'Services'}
              </button>
            ))}
          </div>
          <span className="shop-gold">Party gold: {formatCoins(g.gold ?? 0)}</span>
        </div>
        <p className="small muted">
          <span className="strong">{shop.keeper}:</span> {shop.blurb}
          {shop.buys.length > 0 && ` ${keeper} buys gear back at half price.`}
        </p>
        {shop.limit && open && (
          <p className="small accent" role="note">
            {left > 0
              ? `${keeper} will sell you ${left} more ${left === 1 ? 'thing' : 'things'}${shop.marketDays ? ' this visit' : ''}.`
              : `${keeper} won't sell you anything more${shop.marketDays ? ' until the next market day' : ''}.`}
          </p>
        )}
        <div className="journal-scroll shop-list">
          {tab === 'services' && (
            <ul className="item-list">
              {shop.services.map((s) => {
                const cost = serviceCost(g, s.id, who);
                const needsHero = s.id !== 'heal-party';
                return (
                  <li key={s.id}>
                    <span>
                      <span className="strong">{s.name}</span>{' '}
                      <span className="small muted">{s.summary}</span>
                    </span>
                    <span className="row nowrap">
                      {needsHero && (
                        <select
                          aria-label={`${s.name}: for whom`}
                          value={who}
                          onChange={(e) => setWho(e.target.value)}
                        >
                          {g.party.map((h) => (
                            <option key={h.id} value={h.id}>
                              {first(h.name)}
                              {h.dead ? ' (dead)' : h.exhaustion ? ' (exhausted)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      <span className="price">{formatCoins(cost === Infinity ? 0 : cost)}</span>
                      <button
                        type="button"
                        className="menu-secondary small-btn"
                        aria-label={s.name}
                        onClick={() =>
                          setMsg(templeService(s.id, needsHero ? who : undefined) ?? 'Done.')
                        }
                      >
                        Ask
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {tab === 'buy' && !open && (
            <p className="small muted">
              The wagon isn&apos;t in town. Odo comes on market days (the first four days of each
              tenday, and festivals): back in about {Math.ceil(hoursToMarket(g.clock) / 24)} day
              {Math.ceil(hoursToMarket(g.clock) / 24) === 1 ? '' : 's'}.
            </p>
          )}
          {tab === 'buy' && open && coming > 0 && (
            <p className="small muted">More arrives later in the story ({coming} items).</p>
          )}
          {tab === 'buy' &&
            open &&
            SECTIONS.map((sec) => {
              const list = stock.filter(sec.match);
              if (!list.length) return null;
              return (
                <section key={sec.name} aria-label={sec.name}>
                  <h3 className="eyebrow">{sec.name}</h3>
                  <ul className="item-list">
                    {list.map((it) => {
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
                                    <span className="who">
                                      needs Str {a.strength} (else −10 ft)
                                    </span>
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
                              aria-disabled={!afford || left <= 0}
                              aria-label={`Buy ${it.name}`}
                              onClick={() =>
                                setMsg(
                                  buyFrom(shopId, it.id) ??
                                    `Bought: ${it.name}. It's in the party's pack.`,
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
              );
            })}
          {tab === 'sell' &&
            (sellable.length ? (
              <ul className="item-list">
                {sellable.map(([id, n]) => {
                  const it = lookupItem(id)!;
                  return (
                    <li key={id}>
                      <span className="item-row-main">
                        <ItemIcon id={id} />
                        <span>
                          <span className="strong">
                            {it.name}
                            {n > 1 ? ` ×${n}` : ''}
                          </span>{' '}
                          <span className="small muted">{it.summary}</span>
                        </span>
                      </span>
                      <span className="row nowrap">
                        <span className="price">{formatCoins(sellPriceAt(shopId, id)!)}</span>
                        <button
                          type="button"
                          className="menu-secondary small-btn"
                          aria-label={`Sell ${it.name}`}
                          onClick={() => setMsg(sellTo(shopId, id) ?? `Sold: ${it.name}.`)}
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
                Nothing {keeper} wants to buy. (Worn gear has to be taken off first, on the
                character sheet. Story treasures aren&apos;t for sale.)
              </p>
            ))}
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
  if (/spellcaster/.test(why)) return 'spellcasters only';
  return why.replace(/\.$/, '');
}
