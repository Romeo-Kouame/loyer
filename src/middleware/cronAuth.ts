import express from 'express';
import { UnauthorizedError } from '../utils/errors';

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically once
// CRON_SECRET is set as a project env var. If CRON_SECRET isn't set at all
// (local dev, where these endpoints aren't exercised - the in-process
// schedulers call the services directly instead), skip the check rather than
// lock everyone out of an endpoint nobody configured yet.
export function requireCronSecret(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    next();
    return;
  }

  if (req.header('authorization') !== `Bearer ${secret}`) {
    throw new UnauthorizedError('Invalid or missing cron secret');
  }

  next();
}
