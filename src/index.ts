import app from './app';
import { config } from './config/environment';
import { startPayoutScheduler } from './jobs/payoutScheduler';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🚀 API ready at http://localhost:${PORT}/api/v1`);
});

startPayoutScheduler();
