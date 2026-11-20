// Floating damage numbers and hit flashes (M10 polish; the full animation system is M11).
import { useEffect, useRef, useState } from 'react';
import type { CombatState } from '../game/combat';

export interface FloatFx {
  key: number;
  id: string;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'miss';
}

const hpOf = (c: CombatState['combatants'][string]) =>
  (c.wildShape?.hp ?? c.creature.hp) + (c.creature.tempHp ?? 0);

let nextKey = 1;

/** Watch the fight for HP changes and misses; return the numbers to float and who to flash. */
export function useHitFx(s: CombatState) {
  const prev = useRef<{ hp: Record<string, number>; log: number } | null>(null);
  const [floats, setFloats] = useState<FloatFx[]>([]);
  const [flash, setFlash] = useState<Record<string, number>>({});

  useEffect(() => {
    const hp: Record<string, number> = {};
    for (const c of Object.values(s.combatants)) hp[c.id] = hpOf(c);
    const before = prev.current;
    prev.current = { hp, log: s.log.length };
    if (!before || s.log.length < before.log) return;
    const fresh = s.log.slice(before.log);
    const crit = new Set<string>();
    const added: FloatFx[] = [];
    const byName = (name: string) => Object.values(s.combatants).find((c) => c.name === name);
    for (const l of fresh) {
      const m = /attacks (.+?) with .*→ (HIT|MISS)/.exec(l.text);
      if (!m) continue;
      const t = byName(m[1]!);
      if (!t) continue;
      if (m[2] === 'MISS') added.push({ key: nextKey++, id: t.id, text: 'miss', kind: 'miss' });
      else if (l.kind === 'crit' || /CRITICAL/.test(l.text)) crit.add(t.id);
    }
    const hit: string[] = [];
    for (const [id, now] of Object.entries(hp)) {
      const was = before.hp[id];
      if (was === undefined || was === now) continue;
      if (now < was) {
        hit.push(id);
        added.push({
          key: nextKey++,
          id,
          text: `${crit.has(id) ? 'CRIT ' : ''}−${was - now}`,
          kind: crit.has(id) ? 'crit' : 'dmg',
        });
      } else added.push({ key: nextKey++, id, text: `+${now - was}`, kind: 'heal' });
    }
    if (!added.length) return;
    // Defer the state updates out of the effect body (and let them expire on their own).
    const t0 = window.setTimeout(() => {
      setFloats((f) => [...f, ...added].slice(-12));
      if (hit.length)
        setFlash((f) => {
          const n = { ...f };
          for (const id of hit) n[id] = (n[id] ?? 0) + 1;
          return n;
        });
    }, 0);
    const t1 = window.setTimeout(() => {
      setFloats((f) => f.filter((x) => !added.includes(x)));
      setFlash((f) => {
        const n = { ...f };
        for (const id of hit) n[id] = Math.max(0, (n[id] ?? 1) - 1);
        return n;
      });
    }, 1200);
    void t0;
    void t1;
  }, [s]);

  return { floats, flashing: (id: string) => (flash[id] ?? 0) > 0 };
}
