import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

// Redis key format: slotlock:{salonId}:{staffId}:{startAt_unix}
const buildKey = (salonId: string, staffId: string, startAt: Date) =>
  `slotlock:${salonId}:${staffId}:${Math.floor(startAt.getTime() / 1000)}`;

@Injectable()
export class SlotLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Atomically acquires a slot lock using Redis SET NX EX.
   * Returns the lock key if acquired, throws ConflictException if already locked.
   */
  async acquireLock(
    salonId: string,
    staffId: string,
    startAt: Date,
    sessionId: string,
    ttlSeconds = 300, // 5 minutes default
  ): Promise<string> {
    const key = buildKey(salonId, staffId, startAt);
    // SET key value NX EX ttl — returns "OK" if set, null if already exists
    const result = await this.redis.set(key, sessionId, 'EX', ttlSeconds, 'NX');
    if (result !== 'OK') {
      // Check if it's the same session (idempotent re-lock)
      const owner = await this.redis.get(key);
      if (owner !== sessionId) {
        throw new ConflictException('This slot is currently held by another booking');
      }
    }
    return key;
  }

  /**
   * Releases a lock only if the caller is the owner (Lua script for atomicity).
   */
  async releaseLock(
    salonId: string,
    staffId: string,
    startAt: Date,
    sessionId: string,
  ): Promise<void> {
    const key = buildKey(salonId, staffId, startAt);
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(luaScript, 1, key, sessionId);
  }

  /**
   * Checks if a slot is currently locked (by anyone).
   */
  async isLocked(salonId: string, staffId: string, startAt: Date): Promise<boolean> {
    const key = buildKey(salonId, staffId, startAt);
    const owner = await this.redis.get(key);
    return owner !== null;
  }

  /**
   * Returns remaining TTL in seconds, or null if not locked.
   */
  async getLockTtl(salonId: string, staffId: string, startAt: Date): Promise<number | null> {
    const key = buildKey(salonId, staffId, startAt);
    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : null;
  }
}
