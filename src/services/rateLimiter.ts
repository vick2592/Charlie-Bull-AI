interface WindowRecord {
  timestamps: number[]; // epoch ms
}

export class SlidingWindowRateLimiter {
  private perKey = new Map<string, WindowRecord>();
  private global: WindowRecord = { timestamps: [] };

  constructor(private perKeyLimit: number, private globalLimit: number, private windowMs: number) {}

  attempt(key: string): { allowed: boolean; retryAfter?: number; global?: boolean } {
    const now = Date.now();
    this.evict(now);
    const rec = this.perKey.get(key) || { timestamps: [] };
    if (rec.timestamps.length >= this.perKeyLimit) {
      const retryAfter = Math.ceil((this.windowMs - (now - rec.timestamps[0])) / 1000);
      return { allowed: false, retryAfter };
    }
    if (this.global.timestamps.length >= this.globalLimit) {
      const retryAfter = Math.ceil((this.windowMs - (now - this.global.timestamps[0])) / 1000);
      return { allowed: false, retryAfter, global: true };
    }
    rec.timestamps.push(now);
    this.perKey.set(key, rec);
    this.global.timestamps.push(now);
    return { allowed: true };
  }

  private evict(now: number) {
    const cutoff = now - this.windowMs;
    for (const rec of this.perKey.values()) {
      while (rec.timestamps.length && rec.timestamps[0] < cutoff) rec.timestamps.shift();
    }
    while (this.global.timestamps.length && this.global.timestamps[0] < cutoff) this.global.timestamps.shift();
  }
}
