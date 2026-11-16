import { describe, expect, it } from 'vitest';
import {
  daysInYear,
  formatDate,
  GAME_START,
  isLeapYear,
  timeOfDay,
  toDate,
} from '../../src/game/calendar';

describe('Calendar of Harptos', () => {
  it('has 365 days, 366 in leap years (Shieldmeet)', () => {
    expect(isLeapYear(1492)).toBe(true);
    expect(daysInYear(1492)).toBe(366);
    expect(daysInYear(1493)).toBe(365);
  });

  it('opens on the evening of the Feast of the Moon, 1492 DR (Story_Bible §3)', () => {
    expect(formatDate(GAME_START)).toBe('Feast of the Moon, 1492 DR · Evening');
  });

  it('the next day is 1 Nightal', () => {
    expect(toDate(GAME_START + 12)).toMatchObject({ period: 'Nightal', day: 1, year: 1492 });
    expect(formatDate(GAME_START + 24 * 3 - 2)).toBe('3 Nightal, 1492 DR · Evening');
  });

  it('rolls over into Hammer 1493, then Midwinter between Hammer and Alturiak (Act II climax)', () => {
    const newYear = GAME_START + 4 + 24 * 30; // past 30 Nightal
    expect(toDate(newYear)).toMatchObject({ year: 1493, period: 'Hammer', day: 1 });
    expect(toDate(newYear + 24 * 30)).toMatchObject({
      year: 1493,
      period: 'Midwinter',
      festival: true,
    });
    expect(toDate(newYear + 24 * 31)).toMatchObject({ period: 'Alturiak', day: 1 });
  });

  it('names times of day', () => {
    expect([2, 6, 9, 14, 19, 22].map(timeOfDay)).toEqual([
      'Night',
      'Dawn',
      'Morning',
      'Afternoon',
      'Evening',
      'Night',
    ]);
  });
});
