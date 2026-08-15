import { sendDueReminders } from '../services/reminder.service';
import { logger } from '../utils/logger';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

// In-process scheduler, same caveat as payoutScheduler.ts: fine for a single
// backend instance, move to a real job queue if this ever runs multi-instance.
export function startRentReminderScheduler(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const { sent } = await sendDueReminders();
      if (sent > 0) {
        logger.info(`Rent reminder scheduler sent ${sent} reminder(s)`);
      }
    } catch (err) {
      logger.error(`Rent reminder scheduler sweep failed: ${err}`);
    }
  }, SWEEP_INTERVAL_MS);

  timer.unref();
  return timer;
}
