// Presentation events (M11, docs/Animation_Plan.md). The engine resolves an action first (all
// the rolls), then records what happened here for the screen to play back. Animation never
// decides anything: a missed arrow is recorded as a miss and visibly flies past its target.
import type { DamageType } from '../../rules';
import type { Effect } from '../../data/schemas/common';
import type { CombatState, Pos } from './types';

export type ShotStyle = 'arrow' | 'bolt' | 'thrown' | 'melee' | 'ray' | 'dart' | 'bead';
export type AreaShape = 'cone' | 'cube' | 'sphere' | 'cylinder' | 'line' | 'square' | 'aura';

export type FxBody =
  /** A spellcaster gathers power: a glow in the colour of the spell's school. */
  | { type: 'cast'; casterId: string; school: string; spellId: string }
  /** An attack travels from one creature to another (or swings, for melee). */
  | {
      type: 'shot';
      fromId: string;
      toId: string;
      style: ShotStyle;
      hit: boolean;
      damageType?: DamageType;
      /** Shots with the same volley number fly together (Magic Missile's darts). */
      volley?: number;
      /** A bead aimed at a square rather than a creature (Fireball). */
      toPos?: Pos;
    }
  /** A spell area or breath weapon blooms over these squares. */
  | {
      type: 'area';
      casterId: string;
      shape: AreaShape;
      cells: Pos[];
      damageType?: DamageType;
      /** A many-coloured area (Color Spray): calmer with "reduce flashing". */
      prism?: boolean;
    }
  | { type: 'damage'; targetId: string; amount: number; damageType: DamageType; critical: boolean }
  | { type: 'heal'; targetId: string; amount: number }
  | { type: 'save'; targetId: string; success: boolean; ability: string }
  /** A reaction interrupts the turn: "Opportunity Attack!", "Shield!", "Counterspell!". */
  | { type: 'banner'; text: string; side: 'party' | 'enemy' };

export type FxEvent = FxBody & { seq: number };

/** Keep only the most recent events (the screen only needs the ones it hasn't played yet). */
export const FX_KEEP = 80;

/** Record a presentation event. Returns it, so a caller can fill in the result later. */
export function fx<T extends FxBody>(s: CombatState, body: T): T & { seq: number } {
  const seq = (s.fxSeq ?? 0) + 1;
  s.fxSeq = seq;
  const ev = { ...body, seq };
  const list = (s.fx ??= []);
  list.push(ev);
  if (list.length > FX_KEEP) list.splice(0, list.length - FX_KEEP);
  return ev;
}

/** Events recorded after `seq`, oldest first. */
export function fxSince(s: CombatState, seq: number): FxEvent[] {
  return (s.fx ?? []).filter((e) => e.seq > seq);
}

let volleys = 0;
/** A fresh volley number for shots that fly together. */
export const nextVolley = () => ++volleys;

/** How a weapon attack looks, from its name and kind. */
export function weaponShot(name: string, kind: 'melee' | 'ranged'): ShotStyle {
  if (kind === 'melee') return 'melee';
  if (/crossbow/i.test(name)) return 'bolt';
  if (/bow|sling/i.test(name)) return 'arrow';
  return /javelin|dagger|axe|spear|hammer|dart|rock|stone/i.test(name) ? 'thrown' : 'arrow';
}

/** The first damage type an effect list deals (for the colour of a spell or breath). */
export function firstDamageType(effects: readonly Effect[]): DamageType | undefined {
  for (const e of effects) {
    if (e.type === 'damage') return e.damageType;
    const inner = e.type === 'save' ? e.onFail : e.type === 'attack' ? e.onHit : [];
    for (const x of inner) if (x.type === 'damage') return x.damageType;
  }
  return undefined;
}
