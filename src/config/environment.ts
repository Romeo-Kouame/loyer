import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/loyers_db',
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  
  kpay: {
    apiKey: requireEnv('KPAY_API_KEY'),
    secretKey: requireEnv('KPAY_SECRET_KEY'),
    baseUrl: process.env.KPAY_BASE_URL || 'https://admin.kpay.site',
    // Only needed to verify incoming webhooks; validated lazily so the app
    // still boots locally before it's configured in the K-Pay dashboard.
    webhookSecret: process.env.KPAY_WEBHOOK_SECRET || '',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  // Used to build the link sent in "forgot password" emails. Defaults to the
  // same origin as CORS_ORIGIN since that's the frontend in local dev.
  frontend: {
    url: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  redis: {
    // Optional. Backs the rate limiters with a store shared across all
    // instances - without it they fall back to in-memory, which only works
    // correctly for a single long-running process (fine for local dev, not
    // for Vercel's serverless instances).
    url: process.env.REDIS_URL || '',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  // Tighter limit for brute-forceable/abusable endpoints (login, registration,
  // payment initiation), on top of the global limiter above.
  authRateLimit: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10'),
  },

  rent: {
    gracePeriodDays: parseInt(process.env.RENT_GRACE_PERIOD_DAYS || '5'),
  },

  payouts: {
    // Platform commission taken from each confirmed payment before the rest
    // is pushed to the landlord (0.04 = 4%). K-Pay's own withdrawal fee is
    // separate and deducted by them on top of this.
    commissionRate: parseFloat(process.env.PAYOUT_COMMISSION_RATE || '0.04'),
    // Hours to wait after payment confirmation before a payout is actually
    // attempted, leaving a window for a dispute to be raised first.
    reserveHoldHours: parseFloat(process.env.PAYOUT_RESERVE_HOLD_HOURS || '48'),
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
  },
};
