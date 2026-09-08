import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';

// Jest sets NODE_ENV=test by default; the test suite hits /auth/login and
// /auth/register far more than a real client would in the same window, so
// this limiter would otherwise start rejecting unrelated tests.
const skipInTests = () => config.nodeEnv === 'test';

// Brute-force / credential-stuffing guard for login and account creation.
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
});

// Throttles payment-initiation spam/abuse independently of the global limiter.
export const paymentInitiateRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
});
