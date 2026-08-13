import express from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
      timestamp: new Date(),
    });
    return;
  }

  logger.error(err.stack || err.message);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    timestamp: new Date(),
  });
}
