// What a token shows about its creature's state (M11): condition icons, a concentration ring,
// and, at 0 HP, the downed marks (a blood drop, death-save pips, "stable" or a skull).
import type { ReactNode } from 'react';
import type { Combatant } from '../../game/combat';
import type { ConditionId } from '../../rules';

/** Small drawn icons [inferred design]. Each has a plain-English name for its tooltip. */
const ICONS: Partial<
  Record<ConditionId | 'rage', { label: string; color: string; draw: ReactNode }>
> = {
  prone: {
    label: 'Prone',
    color: '#c3ccd9',
    draw: <path d="M2 9 H10 M4 6 L2 9 L4 12" fill="none" />,
  },
  grappled: {
    label: 'Grappled',
    color: '#d9c38a',
    draw: (
      <>
        <ellipse cx="4.5" cy="6" rx="2.6" ry="1.8" fill="none" />
        <ellipse cx="7.5" cy="6" rx="2.6" ry="1.8" fill="none" />
      </>
    ),
  },
  restrained: {
    label: 'Restrained',
    color: '#d9c38a',
    draw: (
      <>
        <ellipse cx="3.5" cy="6" rx="2.2" ry="1.6" fill="none" />
        <ellipse cx="6" cy="6" rx="2.2" ry="1.6" fill="none" />
        <ellipse cx="8.5" cy="6" rx="2.2" ry="1.6" fill="none" />
      </>
    ),
  },
  frightened: {
    label: 'Frightened',
    color: '#c49bff',
    draw: <path d="M6 2 V7.5 M6 9.5 V10.5" fill="none" />,
  },
  charmed: {
    label: 'Charmed',
    color: '#ff9ad1',
    draw: <path d="M6 10 L2.2 6.2 A2 2 0 0 1 6 3.6 A2 2 0 0 1 9.8 6.2 Z" stroke="none" />,
  },
  poisoned: {
    label: 'Poisoned',
    color: '#b5d84a',
    draw: <path d="M6 2 C8 5 9 6.5 9 7.8 A3 3 0 0 1 3 7.8 C3 6.5 4 5 6 2 Z" stroke="none" />,
  },
  blinded: {
    label: 'Blinded',
    color: '#e8e3d6',
    draw: (
      <>
        <path d="M1.5 6 Q6 1.5 10.5 6 Q6 10.5 1.5 6 Z" fill="none" />
        <path d="M2 10 L10 2" fill="none" />
      </>
    ),
  },
  deafened: {
    label: 'Deafened',
    color: '#e8e3d6',
    draw: <path d="M4 9 C4 7 8 7 8 4.5 A2.5 2.5 0 0 0 3.5 4 M2 10 L10 2" fill="none" />,
  },
  paralyzed: {
    label: 'Paralyzed',
    color: '#ffe45c',
    draw: <path d="M7 1.5 L3.5 6.5 H6.5 L5 10.5 L8.5 5.5 H5.5 Z" stroke="none" />,
  },
  stunned: {
    label: 'Stunned',
    color: '#ffe45c',
    draw: (
      <path
        d="M6 1.5 L7.2 4.6 L10.5 4.8 L7.9 6.9 L8.8 10.1 L6 8.3 L3.2 10.1 L4.1 6.9 L1.5 4.8 L4.8 4.6 Z"
        stroke="none"
      />
    ),
  },
  incapacitated: {
    label: 'Incapacitated',
    color: '#c3ccd9',
    draw: <path d="M3 3.5 H8 L3 8.5 H8" fill="none" />,
  },
  petrified: {
    label: 'Petrified',
    color: '#a7a9ad',
    draw: <path d="M2 9 L4 3 L8 2.5 L10 8 L6 10 Z" stroke="none" />,
  },
  invisible: {
    label: 'Invisible',
    color: '#bfdcff',
    draw: <circle cx="6" cy="6" r="3.8" fill="none" strokeDasharray="1.6 1.4" />,
  },
  rage: {
    label: 'Raging',
    color: '#ff7a4a',
    draw: (
      <path
        d="M6 1.5 C9 5 9.5 7 8.5 9 A3 3 0 0 1 3.5 9 C2.5 7 4 6 4.5 4 C5.5 5 6 4 6 1.5 Z"
        stroke="none"
      />
    ),
  },
};

/** The icons to show for a combatant, in a fixed order. Unconscious is shown as "downed". */
export function statusIcons(c: Combatant): { id: string; label: string }[] {
  const ids = new Set<string>(c.creature.conditions.map((x) => x.id));
  if (c.effects.some((e) => e.tag === 'rage')) ids.add('rage');
  return (Object.keys(ICONS) as (keyof typeof ICONS)[])
    .filter((id) => ids.has(id))
    .map((id) => ({ id, label: ICONS[id]!.label }));
}

export function TokenStatus({ c }: { c: Combatant }) {
  const cr = c.creature;
  // At 0 HP the downed marks say it all (unconscious and prone are implied).
  const icons = cr.hp === 0 && !c.wildShape ? [] : statusIcons(c);
  const down = cr.hp === 0 && !cr.dead && !c.wildShape;
  const pc = c.side === 'party';
  return (
    <>
      {cr.concentration && !cr.dead && (
        <span className="conc-ring" title={`Concentrating (${cr.concentration})`} />
      )}
      {icons.length > 0 && (
        <span className="status-icons">
          {icons.slice(0, 4).map((i) => {
            const icon = ICONS[i.id as keyof typeof ICONS]!;
            return (
              <svg
                key={i.id}
                className={`status-icon s-${i.id}`}
                viewBox="0 0 12 12"
                width="14"
                height="14"
                stroke={icon.color}
                fill={icon.color}
                strokeWidth="1.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <title>{i.label}</title>
                {icon.draw}
              </svg>
            );
          })}
        </span>
      )}
      {down && pc && (
        <span className="downed-marks">
          {cr.stable ? (
            <span className="stable-mark" title="Stable">
              Stable
            </span>
          ) : (
            <>
              <svg
                className="blood-drop"
                viewBox="0 0 10 12"
                width="10"
                height="12"
                aria-hidden="true"
              >
                <path d="M5 1 C7 4.5 8.5 6 8.5 7.8 A3.5 3.5 0 0 1 1.5 7.8 C1.5 6 3 4.5 5 1 Z" />
              </svg>
              <span className="death-pips" title="Death saves: successes and failures">
                {[0, 1, 2].map((i) => (
                  <i key={`s${i}`} className={i < cr.deathSaves.successes ? 'ok on' : 'ok'} />
                ))}
                {[0, 1, 2].map((i) => (
                  <i key={`f${i}`} className={i < cr.deathSaves.failures ? 'bad on' : 'bad'} />
                ))}
              </span>
            </>
          )}
        </span>
      )}
      {cr.dead && pc && (
        <svg className="skull" viewBox="0 0 12 12" width="16" height="16" aria-hidden="true">
          <path d="M6 1 A4.5 4.5 0 0 0 1.5 5.5 C1.5 7 2.5 8 3.5 8.5 V10.5 H8.5 V8.5 C9.5 8 10.5 7 10.5 5.5 A4.5 4.5 0 0 0 6 1 Z" />
          <circle cx="4.2" cy="5.6" r="1.1" fill="#1f2a36" />
          <circle cx="7.8" cy="5.6" r="1.1" fill="#1f2a36" />
        </svg>
      )}
    </>
  );
}

/** Words for the token's accessible name: conditions, concentration, death saves. */
export function statusWords(c: Combatant): string {
  const cr = c.creature;
  const parts = statusIcons(c).map((i) => i.label.toLowerCase());
  if (cr.concentration && !cr.dead) parts.push('concentrating');
  if (cr.hp === 0 && !cr.dead && c.side === 'party')
    parts.push(
      cr.stable
        ? 'stable'
        : `death saves ${cr.deathSaves.successes} of 3 successes, ${cr.deathSaves.failures} of 3 failures`,
    );
  return parts.length ? `, ${parts.join(', ')}` : '';
}
