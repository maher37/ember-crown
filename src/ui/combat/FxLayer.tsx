// Draws what the fx player is playing (M11): shots, spell areas, cast glows, floating numbers
// coloured by damage type, healing motes, save shields and reaction banners. Decorative only:
// everything here is also in the combat log, so it is hidden from screen readers.
import type { CSSProperties } from 'react';
import type { CombatState, Pos } from '../../game/combat';
import type { Playing } from './fxPlayer';
import { CELL } from './MapTerrain';
import './fx.css';

/** Damage-type colours (Animation_Plan.md), readable on the slate map. */
export const DAMAGE_COLORS: Record<string, string> = {
  fire: '#ff9a4a',
  cold: '#a9dcff',
  lightning: '#ffe45c',
  thunder: '#c9d4ff',
  acid: '#9be35a',
  poison: '#b5d84a',
  necrotic: '#b48cd9',
  radiant: '#ffd86b',
  force: '#c49bff',
  psychic: '#ff9ad1',
  bludgeoning: '#ffb08a',
  piercing: '#ffb08a',
  slashing: '#ffb08a',
};
export const colorOf = (type?: string) => (type && DAMAGE_COLORS[type]) || '#ffb08a';
const PHYSICAL = new Set(['bludgeoning', 'piercing', 'slashing']);

/** Spell-school cast glows (Animation_Plan.md). */
export const SCHOOL_COLORS: Record<string, string> = {
  evocation: '#e8833a',
  abjuration: '#7fb3e6',
  necromancy: '#7fcf7a',
  enchantment: '#ff9ad1',
  illusion: '#d8c8ff',
  conjuration: '#6fd6c8',
  divination: '#f3e29a',
  transmutation: '#e8c27a',
};

const center = (p: Pos) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });

export function FxLayer({
  s,
  playing,
  reduceFlashing,
}: {
  s: CombatState;
  playing: Playing[];
  reduceFlashing: boolean;
}) {
  return (
    <div className={`fx-layer ${reduceFlashing ? 'calm' : ''}`} aria-hidden="true">
      {playing.map((p) => {
        const ev = p.ev;
        const vars = { '--dur': `${p.dur}ms` } as CSSProperties;
        switch (ev.type) {
          case 'cast': {
            const c = s.combatants[ev.casterId];
            if (!c) return null;
            const at = center(c.pos);
            return (
              <span
                key={p.key}
                className={`fx-cast school-${ev.school}`}
                style={{
                  ...vars,
                  left: at.x,
                  top: at.y,
                  ['--fx' as string]: SCHOOL_COLORS[ev.school] ?? '#e8833a',
                }}
              />
            );
          }
          case 'shot':
            return <Shot key={p.key} s={s} p={p} />;
          case 'area':
            return (
              <div
                key={p.key}
                className={`fx-area ${ev.prism ? 'prism' : ''} shape-${ev.shape}`}
                style={{ ...vars, ['--fx' as string]: colorOf(ev.damageType) }}
              >
                {ev.cells.map((c) => (
                  <span
                    key={`${c.x},${c.y}`}
                    className="fx-cell"
                    style={{ left: c.x * CELL, top: c.y * CELL }}
                  />
                ))}
              </div>
            );
          case 'damage':
          case 'heal': {
            const c = s.combatants[ev.targetId];
            if (!c) return null;
            const heal = ev.type === 'heal';
            const crit = ev.type === 'damage' && ev.critical;
            const type = ev.type === 'damage' ? ev.damageType : undefined;
            return (
              <span
                key={p.key}
                className={`float ${heal ? 'heal' : crit ? 'crit' : 'dmg'}`}
                style={{
                  ...vars,
                  left: c.pos.x * CELL + 24 + (p.stack % 2 ? 14 : 0),
                  top: c.pos.y * CELL + 2 - p.stack * 16,
                  color: heal ? undefined : crit ? undefined : colorOf(type),
                }}
              >
                {crit ? 'CRIT ' : ''}
                {heal ? '+' : '−'}
                {ev.amount}
                {type && !PHYSICAL.has(type) && <small className="float-type"> {type}</small>}
                {heal && (
                  <span className="motes">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
            );
          }
          case 'save': {
            const c = s.combatants[ev.targetId];
            if (!c) return null;
            return (
              <span
                key={p.key}
                className={`fx-save ${ev.success ? 'saved' : 'failed'}`}
                style={{ ...vars, left: c.pos.x * CELL + 24, top: c.pos.y * CELL + 44 }}
              >
                <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true">
                  <path d="M6 1 L11 3 V7 C11 10 8.5 12 6 13 C3.5 12 1 10 1 7 V3 Z" />
                </svg>
                {ev.success ? 'Saved' : 'Failed'}
              </span>
            );
          }
          case 'banner':
            return (
              <div key={p.key} className={`fx-banner ${ev.side}`} style={vars}>
                {ev.text}
              </div>
            );
        }
        return null;
      })}
    </div>
  );
}

/** One projectile, beam or swing. A miss carries on past the target and lands behind it. */
function Shot({ s, p }: { s: CombatState; p: Playing }) {
  const ev = p.ev;
  if (ev.type !== 'shot') return null;
  const from = s.combatants[ev.fromId];
  const to = ev.toPos ?? s.combatants[ev.toId]?.pos;
  if (!from || !to) return null;
  const a = center(from.pos);
  let b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  if (!ev.hit) {
    // Overshoot by most of a square and drift to one side [inferred look].
    b = {
      x: b.x + (dx / len) * CELL * 0.9 + (-dy / len) * CELL * 0.3,
      y: b.y + (dy / len) * CELL * 0.9 + (dx / len) * CELL * 0.3,
    };
  }
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const color = colorOf(ev.damageType);
  const style = {
    '--dur': `${p.dur}ms`,
    '--fx': color,
    '--dx': `${b.x - a.x}px`,
    '--dy': `${b.y - a.y}px`,
    '--len': `${Math.hypot(b.x - a.x, b.y - a.y)}px`,
    '--rot': `${angle}rad`,
    left: a.x,
    top: a.y,
  } as CSSProperties;
  if (ev.style === 'melee') {
    const t = center(to);
    return (
      <span
        className={`fx-swing ${ev.hit ? 'hit' : 'miss'}`}
        style={{ ...style, left: t.x, top: t.y }}
      />
    );
  }
  if (ev.style === 'ray') return <span className="fx-ray" style={style} />;
  return (
    <span className={`fx-shot ${ev.style} ${ev.hit ? 'hit' : 'miss'}`} style={style}>
      <i />
    </span>
  );
}
