'use strict';

const MAX_BUCKETS = 10_000;
const STALE_AFTER_MS = 10 * 60 * 1000;

export class TokenBucket {
  constructor({ capacity = 5, refillPerSecond = 5 } = {}) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.buckets = new Map();
  }

  tryConsume(key, now = Date.now()) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      this.evictIfNeeded();
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
      return { allowed: true };
    }

    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const refilled = Math.min(
      this.capacity,
      bucket.tokens + elapsedSeconds * this.refillPerSecond
    );
    bucket.tokens = refilled;
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }
    return { allowed: false };
  }

  evictIfNeeded(now = Date.now()) {
    if (this.buckets.size < MAX_BUCKETS) return;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > STALE_AFTER_MS) this.buckets.delete(key);
    }
    if (this.buckets.size >= MAX_BUCKETS) {
      const overflow = this.buckets.size - MAX_BUCKETS + 1;
      let i = 0;
      for (const key of this.buckets.keys()) {
        if (i++ >= overflow) break;
        this.buckets.delete(key);
      }
    }
  }

  snapshot() {
    return Array.from(this.buckets.entries()).map(([key, bucket]) => ({
      key,
      tokens: bucket.tokens,
    }));
  }

  reset(key) {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}
