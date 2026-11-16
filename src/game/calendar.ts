/**
 * The Calendar of Harptos (docs/Story_Bible.md §3): twelve 30-day months, with festival days
 * between some of them. Shieldmeet follows Midsummer in leap years (every 4th year DR).
 * Month and festival order is from memory of the Forgotten Realms sources [verify].
 */
type Period = { name: string; days: number; festival?: boolean; leapOnly?: boolean };

export const HARPTOS: Period[] = [
  { name: 'Hammer', days: 30 },
  { name: 'Midwinter', days: 1, festival: true },
  { name: 'Alturiak', days: 30 },
  { name: 'Ches', days: 30 },
  { name: 'Tarsakh', days: 30 },
  { name: 'Greengrass', days: 1, festival: true },
  { name: 'Mirtul', days: 30 },
  { name: 'Kythorn', days: 30 },
  { name: 'Flamerule', days: 30 },
  { name: 'Midsummer', days: 1, festival: true },
  { name: 'Shieldmeet', days: 1, festival: true, leapOnly: true },
  { name: 'Eleasis', days: 30 },
  { name: 'Eleint', days: 30 },
  { name: 'Highharvestide', days: 1, festival: true },
  { name: 'Marpenoth', days: 30 },
  { name: 'Uktar', days: 30 },
  { name: 'Feast of the Moon', days: 1, festival: true },
  { name: 'Nightal', days: 30 },
];

export const isLeapYear = (year: number) => year % 4 === 0;
const periods = (year: number) => HARPTOS.filter((p) => !p.leapOnly || isLeapYear(year));
export const daysInYear = (year: number) => periods(year).reduce((n, p) => n + p.days, 0);

/** The game clock counts hours from midnight on 1 Hammer of this year. */
export const CLOCK_EPOCH_YEAR = 1492;

/** Day-of-year (0-based) of a month's day, or a festival. */
export function dayOfYear(year: number, name: string, day = 1): number {
  let n = 0;
  for (const p of periods(year)) {
    if (p.name === name) return n + day - 1;
    n += p.days;
  }
  throw new Error(`No "${name}" in ${year} DR`);
}

/** The game opens on the evening of the Feast of the Moon, 1492 DR (Story_Bible §3). */
export const GAME_START = dayOfYear(1492, 'Feast of the Moon') * 24 + 20;

export interface CalendarDate {
  year: number;
  /** Month or festival name. */
  period: string;
  festival: boolean;
  day: number;
  hour: number;
}

export function toDate(clock: number): CalendarDate {
  let year = CLOCK_EPOCH_YEAR;
  let days = Math.floor(clock / 24);
  const hour = ((clock % 24) + 24) % 24;
  while (days >= daysInYear(year)) {
    days -= daysInYear(year);
    year++;
  }
  for (const p of periods(year)) {
    if (days < p.days) return { year, period: p.name, festival: !!p.festival, day: days + 1, hour };
    days -= p.days;
  }
  throw new Error('unreachable');
}

export function timeOfDay(hour: number): string {
  return hour < 5
    ? 'Night'
    : hour < 8
      ? 'Dawn'
      : hour < 12
        ? 'Morning'
        : hour < 17
          ? 'Afternoon'
          : hour < 21
            ? 'Evening'
            : 'Night';
}

/** "3 Nightal, 1492 DR · Evening" or "Feast of the Moon, 1492 DR · Evening". */
export function formatDate(clock: number): string {
  const d = toDate(clock);
  const date = d.festival ? d.period : `${d.day} ${d.period}`;
  return `${date}, ${d.year} DR · ${timeOfDay(d.hour)}`;
}
