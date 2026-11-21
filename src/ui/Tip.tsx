// Hover (or keyboard-focus) tooltips with real content: what a spell, feature or option does.
import type { ReactNode } from 'react';
import type { Spell } from '../data/schemas/spell';
import './Tip.css';

const ORD = ['Cantrip', '1st level', '2nd level', '3rd level', '4th level', '5th level'];

/** "2nd-level evocation · action · 120 ft · concentration, 1 minute". */
export function spellMeta(s: Spell): string {
  const range = s.range === 'self' ? 'self' : s.range === 'touch' ? 'touch' : `${s.range.feet} ft`;
  const d = s.duration;
  const dur =
    d === 'instant'
      ? 'instant'
      : typeof d === 'string'
        ? d.replace(/-/g, ' ')
        : 'rounds' in d
          ? `${d.rounds} rounds`
          : 'minutes' in d
            ? `${d.minutes} minute${d.minutes === 1 ? '' : 's'}`
            : `${d.hours} hour${d.hours === 1 ? '' : 's'}`;
  const area = s.area ? ` · ${s.area.size}-ft ${s.area.shape}` : '';
  return `${ORD[s.level]}${s.level ? ' ' : ' · '}${s.school} · ${s.castingTime.replace('-', ' ')} · ${range}${area} · ${
    s.concentration ? `concentration, ${dur}` : dur
  }${s.ritual ? ' · ritual' : ''}`;
}

/**
 * Wraps a button or label; the tip shows on hover and on keyboard focus (CSS only, so it works
 * everywhere and never blocks a click). Keep `title` short and put the detail in `children`.
 */
export function Tip({
  title,
  meta,
  children,
  wrap,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  /** The element the tip belongs to. */
  wrap: ReactNode;
}) {
  return (
    <span className="has-tip">
      {wrap}
      <span className="tip" role="tooltip">
        <span className="tip-title">{title}</span>
        {meta && <span className="tip-meta">{meta}</span>}
        <span className="tip-body">{children}</span>
      </span>
    </span>
  );
}

/** A spell's tooltip. */
export function SpellTip({ spell, wrap }: { spell: Spell; wrap: ReactNode }) {
  return (
    <Tip title={spell.name} meta={spellMeta(spell)} wrap={wrap}>
      {spell.summary}
      {spell.utility ? ' (Used in scenes and exploring; no combat effect.)' : ''}
    </Tip>
  );
}
