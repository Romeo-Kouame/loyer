import app from './app';
import { config } from './config/environment';
import { startPayoutScheduler } from './jobs/payoutScheduler';
import { startRentReminderScheduler } from './jobs/rentReminderScheduler';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🚀 API ready at http://localhost:${PORT}/api/v1`);
});

// On Vercel there is no persistent process for setInterval to run in - the
// same sweeps run instead via Vercel Cron hitting /api/v1/internal/cron/*
// (see vercel.json and src/routes/internal.routes.ts).
if (!process.env.VERCEL) {
  startPayoutScheduler();
  startRentReminderScheduler();
}
