import rateLimit, { Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config/environment';
import { redisClient } from '../config/redis';

// Jest sets NODE_ENV=test by default; the test suite hits /auth/login and
// /auth/register far more than a real client would in the same window, so
// this limiter would otherwise start rejecting unrelated tests.
const skipInTests = () => config.nodeEnv === 'test';

// Each limiter gets its own prefix so they don't share hit counts for the
// same key (IP) when backed by the same Redis instance.
export function createRateLimitStore(prefix: string): Store | undefined {
  if (!redisClient) {
    return undefined; // express-rate-limit falls back to its in-memory store
  }
  const client = redisClient;
  return new RedisStore({ prefix, sendCommand: (...args: string[]) => client.sendCommand(args) });
}

// Brute-force / credential-stuffing guard for login and account creation.
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  store: createRateLimitStore('rl:auth:'),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
});

// Throttles payment-initiation spam/abuse independently of the global limiter.
export const paymentInitiateRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  store: createRateLimitStore('rl:payment:'),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
});
