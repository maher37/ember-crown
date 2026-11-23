// Plays the engine's presentation events (M11) back as a short timeline: the cast glow, then the
// shot or area, then the numbers where it lands. The rules have already decided everything.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fxSince, type CombatState, type FxEvent } from '../../game/combat';
import type { AnimSpeed } from '../../game/settings';

export interface Playing {
  key: number;
  ev: FxEvent;
  /** How long it plays on screen, in ms. */
  dur: number;
  /** Floating numbers already on the same creature (to stack them). */
  stack: number;
}

/** Base timings at 1× speed, in ms [inferred: chosen to feel quick but readable]. */
export const TIMING = {
  cast: 320,
  castLead: 220,
  shotMelee: 240,
  shotPerCell: 45,
  shotMin: 220,
  shotMax: 520,
  area: 650,
  areaLead: 380,
  number: 1100,
  save: 1000,
  banner: 950,
  bannerLead: 450,
} as const;

/** Lay the events out in time. Pure, so it can be tested. */
export function schedule(
  events: FxEvent[],
  s: Pick<CombatState, 'combatants'>,
  opts: { speed: AnimSpeed; reduceMotion: boolean },
): { at: number; dur: number; ev: FxEvent }[] {
  // Instant, or reduce motion: nothing flies; numbers, saves and banners still show.
  const still = opts.speed === 'instant' || opts.reduceMotion;
  const k = opts.speed === '2x' ? 0.5 : 1;
  const out: { at: number; dur: number; ev: FxEvent }[] = [];
  let cursor = 0;
  let volley: { id: number; at: number; end: number } | null = null;
  for (const ev of events) {
    switch (ev.type) {
      case 'cast':
        if (still) break;
        out.push({ at: cursor, dur: TIMING.cast * k, ev });
        cursor += TIMING.castLead * k;
        break;
      case 'shot': {
        if (still) break;
        const from = s.combatants[ev.fromId]?.pos;
        const to = ev.toPos ?? s.combatants[ev.toId]?.pos;
        const cells = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 1;
        const dur =
          (ev.style === 'melee'
            ? TIMING.shotMelee
            : Math.min(TIMING.shotMax, Math.max(TIMING.shotMin, cells * TIMING.shotPerCell))) * k;
        // PHB: Magic Missile's darts strike simultaneously: one volley launches and lands together.
        const same: { id: number; at: number; end: number } | null =
          ev.volley && volley && volley.id === ev.volley ? volley : null;
        const start: number = same ? same.at : cursor;
        out.push({ at: start, dur, ev });
        const end = Math.max(start + dur, same ? same.end : 0);
        volley = ev.volley ? { id: ev.volley, at: start, end } : null;
        cursor = Math.max(cursor, end);
        break;
      }
      case 'area':
        out.push({ at: cursor, dur: still ? TIMING.area : TIMING.area * k, ev });
        if (!still) cursor += TIMING.areaLead * k;
        break;
      case 'damage':
      case 'heal':
        out.push({ at: cursor, dur: TIMING.number, ev });
        break;
      case 'save':
        out.push({ at: cursor, dur: TIMING.save, ev });
        break;
      case 'banner':
        out.push({ at: cursor, dur: TIMING.banner, ev });
        if (!still) cursor += TIMING.bannerLead * k;
        break;
    }
  }
  return out;
}

let nextKey = 1;

/** Watch the fight's presentation events and play the new ones. */
export function useFxPlayer(s: CombatState, opts: { speed: AnimSpeed; reduceMotion: boolean }) {
  const seen = useRef<number | null>(null);
  const busyUntil = useRef(0);
  const timers = useRef<number[]>([]);
  const [playing, setPlaying] = useState<Playing[]>([]);
  const { speed, reduceMotion } = opts;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const last = s.fxSeq ?? 0;
    // The first look at a fight (or a reloaded one) plays nothing from before.
    if (seen.current === null || last < seen.current) {
      seen.current = last;
      return;
    }
    const fresh = fxSince(s, seen.current);
    seen.current = last;
    if (!fresh.length) return;
    const now = performance.now();
    const base = Math.max(0, busyUntil.current - now);
    const plan = schedule(fresh, s, { speed, reduceMotion });
    for (const p of plan) {
      const key = nextKey++;
      const show = window.setTimeout(() => {
        setPlaying((list) => {
          const target = p.ev.type === 'damage' || p.ev.type === 'heal' ? p.ev.targetId : undefined;
          const stack = target
            ? list.filter(
                (x) => (x.ev.type === 'damage' || x.ev.type === 'heal') && x.ev.targetId === target,
              ).length
            : 0;
          return [...list, { key, ev: p.ev, dur: p.dur, stack }].slice(-40);
        });
      }, base + p.at);
      const hide = window.setTimeout(
        () => setPlaying((list) => list.filter((x) => x.key !== key)),
        base + p.at + p.dur,
      );
      timers.current.push(show, hide);
    }
    const end = Math.max(
      0,
      ...plan
        .filter((p) => p.ev.type !== 'damage' && p.ev.type !== 'heal' && p.ev.type !== 'save')
        .map((p) => p.at + p.dur),
    );
    busyUntil.current = now + base + end;
    if (timers.current.length > 400) timers.current = timers.current.slice(-200);
  }, [s, speed, reduceMotion]);

  /** How long until the current animations finish (the enemy waits for them). */
  const busyMs = useCallback(() => Math.max(0, busyUntil.current - performance.now()), []);
  return { playing, busyMs };
}
