import { Injectable, ConflictException, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

// Redis key format: slotlock:{salonId}:{staffId}:{startAt_unix}
const buildKey = (salonId: string, staffId: string, startAt: Date) =>
  `slotlock:${salonId}:${staffId}:${Math.floor(startAt.getTime() / 1000)}`;

/**
 * Slot locks are an advisory UX layer (they reserve a slot during checkout).
 * The authoritative double-booking guard is the DB overlap check performed at
 * appointment creation — so when Redis is unreachable we fail OPEN (log a
 * warning and continue without locks) instead of breaking the booking flow.
 */
@Injectable()
export class SlotLockService {
  private readonly logger = new Logger(SlotLockService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Atomically acquires a slot lock using Redis SET NX EX.
   * Returns the lock key if acquired, throws ConflictException if already
   * locked by another session. Proceeds without a lock if Redis is down.
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
    let result: string | null;
    try {
      result = await this.redis.set(key, sessionId, 'EX', ttlSeconds, 'NX');
    } catch (err) {
      this.warnRedisDown('acquireLock', err);
      return key;
    }

    if (result !== 'OK') {
      // Check if it's the same session (idempotent re-lock)
      let owner: string | null;
      try {
        owner = await this.redis.get(key);
      } catch (err) {
        this.warnRedisDown('acquireLock', err);
        return key;
      }
      if (owner !== sessionId) {
        throw new ConflictException(
          'This slot is currently held by another booking',
        );
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
    try {
      await this.redis.eval(luaScript, 1, key, sessionId);
    } catch (err) {
      this.warnRedisDown('releaseLock', err);
    }
  }

  /**
   * Checks if a slot is currently locked (by anyone).
   * Reports "not locked" when Redis is unreachable so availability keeps working.
   */
  async isLocked(
    salonId: string,
    staffId: string,
    startAt: Date,
  ): Promise<boolean> {
    const key = buildKey(salonId, staffId, startAt);
    try {
      const owner = await this.redis.get(key);
      return owner !== null;
    } catch (err) {
      this.warnRedisDown('isLocked', err);
      return false;
    }
  }

  /**
   * Returns remaining TTL in seconds, or null if not locked.
   */
  async getLockTtl(
    salonId: string,
    staffId: string,
    startAt: Date,
  ): Promise<number | null> {
    const key = buildKey(salonId, staffId, startAt);
    try {
      const ttl = await this.redis.ttl(key);
      return ttl > 0 ? ttl : null;
    } catch (err) {
      this.warnRedisDown('getLockTtl', err);
      return null;
    }
  }

  private warnRedisDown(operation: string, err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `Redis unavailable during ${operation} — continuing without slot lock (${detail})`,
    );
  }
}
