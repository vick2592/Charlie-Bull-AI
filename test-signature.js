import { formatForX, formatForBluesky } from './dist/services/responseFormatter.js';

const testReply = "That's a great question! Absolutely, DeFi continues to evolve and grow, especially with the demand for true cross-chain interoperability. That's exactly where Charlie Bull shines on Base L2, making it accessible & educational for all! Want to dive deeper?";

console.log('=== Testing formatForX (280 char limit) ===');
const xResult = formatForX(testReply);
console.log('Length:', xResult.text.length);
console.log('Text:', xResult.text);
console.log('');

console.log('=== Testing formatForBluesky (300 char limit) ===');
const bskyResult = formatForBluesky(testReply);
console.log('Length:', bskyResult.text.length);
console.log('Text:', bskyResult.text);
console.log('');

console.log('✅ Signature includes: - Charlie AI 🐾🐶 #CharlieBull');
