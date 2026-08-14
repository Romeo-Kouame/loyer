import { processDuePayouts } from '../services/payout.service';
import { logger } from '../utils/logger';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// In-process scheduler: fine for a single backend instance. If this ever
// runs as multiple instances, move this to a real job queue (Redis is
// already a dependency) so payouts aren't processed more than once.
export function startPayoutScheduler(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const { processed } = await processDuePayouts();
      if (processed > 0) {
        logger.info(`Payout scheduler processed ${processed} due payout(s)`);
      }
    } catch (err) {
      logger.error(`Payout scheduler sweep failed: ${err}`);
    }
  }, SWEEP_INTERVAL_MS);

  timer.unref();
  return timer;
}
