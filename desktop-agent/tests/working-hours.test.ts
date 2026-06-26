import { describe, expect, it } from 'vitest';
import { isWithinWorkingHours } from '../src/services/working-hours';

describe('working-hours', () => {
  it('allows weekdays inside 09:00–18:00 Asia/Kolkata', () => {
    const config = {
      startTime: '09:00',
      endTime: '18:00',
      workDays: [1, 2, 3, 4, 5],
      timezone: 'Asia/Kolkata',
    };
    const inside = new Date('2026-06-29T05:00:00.000Z');
    expect(isWithinWorkingHours(config, inside)).toBe(true);
  });

  it('blocks weekends', () => {
    const config = {
      startTime: '09:00',
      endTime: '18:00',
      workDays: [1, 2, 3, 4, 5],
      timezone: 'UTC',
    };
    const sunday = new Date('2026-06-28T12:00:00.000Z');
    expect(isWithinWorkingHours(config, sunday)).toBe(false);
  });

  it('returns true when working hours are not configured', () => {
    expect(isWithinWorkingHours(undefined)).toBe(true);
  });
});
