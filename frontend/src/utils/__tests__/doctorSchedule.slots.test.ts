import { describe, expect, it } from 'vitest';
import { assignOverlapLanesPure, dedupeDoctorSlots, slotKey } from '../doctorSchedule';

describe('slotKey', () => {
  it('zeros sub-second noise to match backend minute boundaries', () => {
    const a = '2035-06-15T10:00:00.007Z';
    const b = '2035-06-15T10:00:00.000Z';
    expect(slotKey(a)).toBe(slotKey(b));
  });

  it('is stable across DST-style ISO strings (UTC normalization)', () => {
    const winter = '2026-01-15T15:30:00+00:00';
    expect(slotKey(winter)).toBe('2026-01-15T15:30:00.000Z');
  });
});

describe('dedupeDoctorSlots', () => {
  it('merges rows that differ only by sub-second start', () => {
    const rows = [
      { start: '2035-06-15T10:00:00.100Z', available: true },
      { start: '2035-06-15T10:00:00.900Z', available: false },
    ];
    const out = dedupeDoctorSlots(rows);
    expect(out).toHaveLength(1);
    expect(out[0].available).toBe(false);
  });
});

describe('assignOverlapLanesPure', () => {
  it('uses three lanes when three intervals mutually overlap', () => {
    const placed = assignOverlapLanesPure([
      { start: 0, end: 30 },
      { start: 10, end: 40 },
      { start: 20, end: 50 },
    ]);
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 2]);
    expect(placed.every((p) => p.laneCount === 3)).toBe(true);
  });

  it('reuses a lane when the interval starts after that lane ends', () => {
    const placed = assignOverlapLanesPure([
      { start: 0, end: 10 },
      { start: 12, end: 18 },
      { start: 15, end: 25 },
    ]);
    expect(placed.map((p) => p.lane)).toEqual([0, 0, 1]);
    expect(placed.every((p) => p.laneCount === 2)).toBe(true);
  });
});
