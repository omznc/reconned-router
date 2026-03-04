/**
 * In-memory rate limit store implementation
 * Uses a Map to store rate limit data
 * Note: This is not suitable for distributed systems - use Redis store for that
 */
import type { RateLimitStore } from "./types";
export declare class InMemoryRateLimitStore implements RateLimitStore {
    private store;
    zremrangebyscore(key: string, min: number, max: number): Promise<void>;
    zcard(key: string): Promise<number>;
    zadd(key: string, score: number, member: string): Promise<void>;
    expire(key: string, seconds: number): Promise<void>;
    /**
     * Clear all stored data (useful for testing)
     */
    clear(): void;
}
/**
 * Redis rate limit store implementation
 * Requires a Redis client with the following methods:
 * - zremrangebyscore(key, min, max)
 * - zcard(key)
 * - zadd(key, score, member)
 * - expire(key, seconds)
 */
export declare class RedisRateLimitStore implements RateLimitStore {
    private readonly redis;
    constructor(redis: {
        zremrangebyscore: (key: string, min: number, max: number) => Promise<undefined | number>;
        zcard: (key: string) => Promise<number>;
        zadd: (key: string, score: number, member: string) => Promise<undefined | number>;
        expire: (key: string, seconds: number) => Promise<undefined | boolean>;
    });
    zremrangebyscore(key: string, min: number, max: number): Promise<void>;
    zcard(key: string): Promise<number>;
    zadd(key: string, score: number, member: string): Promise<void>;
    expire(key: string, seconds: number): Promise<void>;
}
/**
 * Create a Redis store from a standard Redis client
 * Works with ioredis and similar clients
 */
export declare function createRedisStore(redis: {
    zremrangebyscore: (key: string, min: number | string, max: number | string) => Promise<unknown>;
    zcard: (key: string) => Promise<number>;
    zadd: (key: string, score: number | string, member: string) => Promise<unknown>;
    expire: (key: string, seconds: number | string) => Promise<unknown>;
}): RedisRateLimitStore;
//# sourceMappingURL=rate-limit-store.d.ts.map