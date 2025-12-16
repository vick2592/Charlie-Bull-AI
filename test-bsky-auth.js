// Quick test script to debug Bluesky authentication
import { AtpAgent } from '@atproto/api';
import 'dotenv/config';

const identifier = process.env.BLUESKY_IDENTIFIER;
const password = process.env.BLUESKY_PASSWORD;

console.log('Testing Bluesky authentication...');
console.log('Identifier:', identifier);
console.log('Password length:', password?.length, 'characters');
console.log('Password format check:', password?.includes('-') ? '✓ Has dashes' : '✗ Missing dashes');

const agent = new AtpAgent({ service: 'https://bsky.social' });

try {
  console.log('\nAttempting login...');
  const result = await agent.login({ identifier, password });
  console.log('✓ SUCCESS! Authenticated as:', result.data.handle);
  console.log('DID:', result.data.did);
} catch (error) {
  console.error('✗ FAILED!');
  console.error('Error:', error.message || error);
  if (error.status) console.error('Status:', error.status);
}
