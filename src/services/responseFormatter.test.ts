import { describe, expect, it } from 'vitest';
import {
  BLUESKY_CONTENT_LIMIT,
  BLUESKY_HARD_LIMIT,
  formatForBluesky,
} from './responseFormatter.js';

describe('formatForBluesky', () => {
  it('uses a 280-character content budget below the 300-character hard limit', () => {
    const formatted = formatForBluesky('A'.repeat(BLUESKY_CONTENT_LIMIT));

    expect(formatted.characterCount).toBeLessThanOrEqual(BLUESKY_HARD_LIMIT);
    expect(formatted.text).toContain('- Charlie AI');
  });

  it('trims 281-300 character input at a complete sentence', () => {
    const content = `${'A'.repeat(200)}. ${'B'.repeat(90)}`;
    const formatted = formatForBluesky(content);

    expect(formatted.characterCount).toBeLessThanOrEqual(BLUESKY_HARD_LIMIT);
    expect(formatted.text).toContain(`${'A'.repeat(200)}.`);
    expect(formatted.text).not.toContain('B'.repeat(90));
  });

  it('removes trailing whitespace before formatting', () => {
    const formatted = formatForBluesky('Charlie is building cross-chain community.   \n\n');

    expect(formatted.text).toContain('community.\n\n- Charlie AI');
    expect(formatted.characterCount).toBeLessThanOrEqual(BLUESKY_HARD_LIMIT);
  });
});