import { describe, expect, it } from 'vitest';
import { getHolidayContext } from './holidayContext.js';

describe('getHolidayContext', () => {
  it('resolves Halloween in the requested timezone', () => {
    const context = getHolidayContext(new Date('2026-10-31T23:30:00Z'), 'America/New_York');

    expect(context).toMatchObject({
      key: 'halloween',
      name: 'Halloween',
      tone: 'playfully spooky and mischievous',
    });
    expect(context?.promptInstructions).toContain('haunted blockchain jokes');
    expect(context?.promptInstructions).toContain('pre-TGE rule');
  });

  it('resolves a date using UTC when no timezone is provided', () => {
    const context = getHolidayContext(new Date('2026-10-31T23:30:00Z'));

    expect(context?.key).toBe('halloween');
  });

  it('returns no context for an ordinary date', () => {
    expect(getHolidayContext(new Date('2026-11-01T12:00:00Z'))).toBeNull();
  });

  it('handles a holiday boundary according to the requested timezone', () => {
    const date = new Date('2026-11-01T02:30:00Z');

    expect(getHolidayContext(date, 'America/New_York')?.key).toBe('halloween');
    expect(getHolidayContext(date, 'UTC')).toBeNull();
  });
});
