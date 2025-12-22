// Test the formatter functions
import { formatForX, formatForBluesky } from './dist/services/responseFormatter.js';

const testContent = "Great question! Absolutely, DeFi is seeing continuous growth, with innovation driving expansion across new use cases and chains. We're seeing more adoption & TVL, especially on L2s like Base. Interoperability is key to this expansion! 🐂 🐕";

console.log('=== Testing Response Formatter ===\n');
console.log('Original content:', testContent);
console.log('Length:', testContent.length, '\n');

console.log('--- Formatted for X (280 char limit) ---');
const xFormatted = formatForX(testContent);
console.log(xFormatted.text);
console.log('Length:', xFormatted.characterCount, '\n');

console.log('--- Formatted for Bluesky (300 char limit) ---');
const bskyFormatted = formatForBluesky(testContent);
console.log(bskyFormatted.text);
console.log('Length:', bskyFormatted.characterCount);
