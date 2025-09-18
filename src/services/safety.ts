const bannedPatterns: RegExp[] = [
  /illegal/i,
  /scam/i,
  /pump\s+and\s+dump/i,
  /hack\b/i,
  /exploit\b/i
];

export function safetyCheck(input: string): { allowed: boolean } {
  for (const rx of bannedPatterns) {
    if (rx.test(input)) return { allowed: false };
  }
  return { allowed: true };
}

export function safetyRefusal(): string {
  return 'I can’t help with that specific request, but I can explain related DeFi concepts if you’d like. 🐕';
}
