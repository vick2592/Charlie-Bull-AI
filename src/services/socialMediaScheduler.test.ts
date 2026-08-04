import { describe, expect, it } from 'vitest';
import {
  SOCIAL_SCHEDULER_TIMEZONE,
  getScheduledAfternoonSlotForDate,
} from './socialMediaScheduler.js';

describe('social media scheduler timing helpers', () => {
  it('pins scheduled jobs to UTC', () => {
    expect(SOCIAL_SCHEDULER_TIMEZONE).toBe('UTC');
  });

  it('derives the afternoon slot from the UTC date, not process state', () => {
    expect(getScheduledAfternoonSlotForDate(new Date('2026-08-03T12:00:00Z'))).toBe('17:00');
    expect(getScheduledAfternoonSlotForDate(new Date('2026-08-04T12:00:00Z'))).toBe('21:00');
  });
});