import { createClient } from 'redis';
import { config } from './environment';
import { logger } from '../utils/logger';

// Backs the rate limiters with a store shared across all instances. Without
// REDIS_URL, callers fall back to express-rate-limit's in-memory store,
// which only tracks hits for the single process it runs in - fine for local
// dev, but not for Vercel, where each serverless instance would otherwise
// keep its own counters and the limit would never really be enforced.
//
// Also skipped in tests: NODE_ENV=test has no Redis service in CI, and the
// rate limiters themselves are already disabled there (see rateLimiters.ts).
export const redisClient =
  config.redis.url && config.nodeEnv !== 'test' ? createClient({ url: config.redis.url }) : null;

if (redisClient) {
  redisClient.on('error', (err) => logger.warn(`Redis client error: ${err}`));
  redisClient.connect().catch((err) => logger.warn(`Failed to connect to Redis: ${err}`));
}
