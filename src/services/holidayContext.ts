/**
 * Date-aware personality guidance for scheduled social posts.
 *
 * Holiday dates are resolved in an explicit timezone so the calendar policy
 * does not have to follow the scheduler's UTC execution timezone.
 */

export interface HolidayContext {
  key: string;
  name: string;
  tone: string;
  promptInstructions: string;
}

const HOLIDAY_CONTEXTS: Record<string, HolidayContext> = {
  '01-01': {
    key: 'new_years_day',
    name: "New Year's Day",
    tone: 'optimistic and forward-looking',
    promptInstructions:
      "Celebrate New Year's Day with optimistic puppy energy and a fresh-start perspective. Keep the message community-focused and grounded in accurate Charlie Bull facts.",
  },
  '02-14': {
    key: 'valentines_day',
    name: "Valentine's Day",
    tone: 'warm, appreciative, and playful',
    promptInstructions:
      "Celebrate Valentine's Day with warm, wholesome appreciation for the Charlie Bull community. Keep the message playful and educational rather than romantic or promotional.",
  },
  '10-31': {
    key: 'halloween',
    name: 'Halloween',
    tone: 'playfully spooky and mischievous',
    promptInstructions:
      "Give Charlie a playful spooky personality for Halloween: mischievous puppy energy, haunted blockchain jokes, pumpkins, ghosts, and light suspense. Keep the tone wholesome and fun.",
  },
  '12-25': {
    key: 'christmas_day',
    name: 'Christmas Day',
    tone: 'warm, festive, and community-focused',
    promptInstructions:
      "Celebrate Christmas Day with warm, festive puppy energy and appreciation for the Charlie Bull community. Keep the message inclusive, wholesome, and educational.",
  },
};

const HOLIDAY_GUARDRAILS =
  'Do not invent promotions, giveaways, token launches, prices, or active liquidity. Preserve all project facts and the pre-TGE rule.';

function getMonthDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!month || !day) {
    throw new Error(`Unable to resolve holiday date in timezone: ${timeZone}`);
  }

  return `${month}-${day}`;
}

/**
 * Resolve fixed-date holiday guidance for a calendar date.
 *
 * The timezone is explicit because scheduler execution uses UTC while holiday
 * observance may follow a different audience timezone.
 */
export function getHolidayContext(
  date: Date = new Date(),
  timeZone: string = 'UTC'
): HolidayContext | null {
  const context = HOLIDAY_CONTEXTS[getMonthDay(date, timeZone)];
  if (!context) return null;

  return {
    ...context,
    promptInstructions: `${context.promptInstructions} ${HOLIDAY_GUARDRAILS}`,
  };
}
