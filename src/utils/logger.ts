import winston from 'winston';
import { config } from '../config/environment';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.nodeEnv === 'production' ? winston.format.json() : winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  ),
  transports: [new winston.transports.Console()],
});
