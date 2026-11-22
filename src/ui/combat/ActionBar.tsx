// The combat footer's turn economy and its pop-up action menu (split from CombatScreen.tsx).
import {
  METAMAGIC_NAMES,
  type Combatant,
  type FeatureId,
  type FeatureInfo,
  type Metamagic,
  type SpellChoice,
} from '../../game/combat';
import { ABILITY_LONG } from '../../game/combat/leaves';
import type { Hero } from '../../game/hero';
import type { MoreAction } from './modes';

/** Action, bonus action, reaction and movement left this turn. */
export function TurnEconomy({ me, actionLeft }: { me: Combatant; actionLeft: boolean }) {
  return (
    <div className="economy">
      <div className="row small">
        <span className="pip-row">
          <span className={`pip action ${actionLeft ? '' : 'used'}`} />
          Action
          {me.turn.extraActions > 0 ? ` +${me.turn.extraActions} extra` : ''}
          {me.turn.hasteAction ? ' +1 (Haste)' : ''}
        </span>
        <span className="pip-row">
          <span className={`pip bonus ${me.turn.bonusUsed ? 'used' : ''}`} />
          Bonus
        </span>
        <span className="pip-row">
          <span className={`pip reaction ${me.reactionUsed ? 'used' : ''}`} />
          Reaction
        </span>
      </div>
      <div className="row between small">
        <span>Movement</span>
        <span className="muted">
          {me.turn.movement} / {me.speed} ft
        </span>
      </div>
      <div className="move-bar">
        <div
          style={{
            width: `${Math.min(100, Math.round((me.turn.movement / Math.max(1, me.speed)) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}

export type MenuKind = 'spells' | 'features' | 'more';

/** The Spells, Features or More menu above the action buttons. */
export function ActionMenu({
  menu,
  setMenu,
  knownMetamagic,
  mm,
  setMm,
  spells,
  hero,
  pickSpell,
  features,
  pickFeature,
  moreActions,
}: {
  menu: MenuKind;
  setMenu: (m: MenuKind | null) => void;
  knownMetamagic: Metamagic[];
  mm: Metamagic | '';
  setMm: (m: Metamagic | '') => void;
  spells: SpellChoice[];
  hero: (Combatant & { creature: Hero }) | null;
  pickSpell: (spellId: string, level: number) => void;
  features: FeatureInfo[];
  pickFeature: (id: FeatureId) => void;
  moreActions: MoreAction[];
}) {
  return (
    <div
      className="menu"
      role="menu"
      aria-label={
        menu === 'spells' ? 'Spells' : menu === 'features' ? 'Class features' : 'More actions'
      }
    >
      {menu === 'spells' && knownMetamagic.length > 0 && (
        <div className="menu-row">
          <label className="small">
            Metamagic{' '}
            <select
              value={mm}
              onChange={(e) => setMm(e.target.value as Metamagic | '')}
              aria-label="Metamagic"
            >
              <option value="">none</option>
              {knownMetamagic.map((m) => (
                <option key={m} value={m}>
                  {METAMAGIC_NAMES[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {menu === 'spells' &&
        spells.map((c) => (
          <div key={c.spell.id} className="menu-row">
            <span>
              <span className="strong">{c.spell.name}</span>{' '}
              <span className="muted small">
                {c.spell.level === 0 ? 'cantrip' : `level ${c.spell.level}`} · {c.spell.castingTime}
                {c.spell.concentration ? ' · concentration' : ''}
              </span>
              <br />
              <span className="small muted">
                {c.blocked ?? c.spell.summary}
                {c.spell.id === 'hex' && hero
                  ? ` Curses ${ABILITY_LONG[hero.creature.choices['hex-ability']?.[0] ?? 'str']} (change it on the Party sheet).`
                  : ''}
              </span>
            </span>
            <span className="row">
              {c.levels.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  role="menuitem"
                  className="mini"
                  disabled={!!c.blocked}
                  onClick={() => pickSpell(c.spell.id, lv)}
                >
                  {lv === 0 ? 'Cast' : `Lv ${lv}`}
                </button>
              ))}
            </span>
          </div>
        ))}
      {menu === 'features' &&
        features.map((f) => (
          <div key={f.id} className="menu-row">
            <span>
              <span className="strong">{f.name}</span> <span className="muted small">{f.cost}</span>
              <br />
              <span className="small muted">{f.blocked ?? f.detail}</span>
            </span>
            <button
              type="button"
              role="menuitem"
              className="mini"
              disabled={!!f.blocked}
              onClick={() => pickFeature(f.id)}
            >
              Use
            </button>
          </div>
        ))}
      {menu === 'more' &&
        moreActions.map((m) => (
          <div key={m.label} className="menu-row">
            <span>
              <span className="strong">{m.label}</span>
              <br />
              <span className="small muted">{m.blocked ?? m.detail}</span>
            </span>
            <button
              type="button"
              role="menuitem"
              className="mini"
              disabled={!!m.blocked}
              onClick={() => {
                setMenu(null);
                m.onClick();
              }}
            >
              Do it
            </button>
          </div>
        ))}
    </div>
  );
}
