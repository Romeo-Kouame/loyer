import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import { config } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import paymentsRoutes from './routes/payments.routes';
import propertiesRoutes from './routes/properties.routes';
import auditRoutes from './routes/audit.routes';
import kycRoutes from './routes/kyc.routes';
import adminKycRoutes from './routes/adminKyc.routes';
import adminPropertyVerificationRoutes from './routes/adminPropertyVerification.routes';
import payoutRoutes from './routes/payout.routes';
import adminDisputesRoutes from './routes/adminDisputes.routes';
import adminRefundsRoutes from './routes/adminRefunds.routes';
import tenantRoutes from './routes/tenant.routes';
import landlordRoutes from './routes/landlord.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import internalRoutes from './routes/internal.routes';
import messagesRoutes from './routes/messages.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Allows the configured origin plus any Vercel preview URL for this
// frontend project, so preview deployments can be reviewed before the
// change they contain is promoted to production.
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/loyer-frontend-[a-z0-9]+-romeo-kouame-s-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  return origin === config.cors.origin || PREVIEW_ORIGIN_PATTERN.test(origin);
}

// Middleware
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);
// Raw body needed here (before express.json()) to verify the K-Pay webhook signature
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests, please try again later',
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes placeholder
app.get('/api/v1', (req, res) => {
  res.json({ message: 'Plateforme Gestion des Loyers API v1' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/properties', propertiesRoutes);
app.use('/api/v1/admin/audit-logs', auditRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/admin/kyc', adminKycRoutes);
app.use('/api/v1/admin/property-verifications', adminPropertyVerificationRoutes);
app.use('/api/v1/payouts', payoutRoutes);
app.use('/api/v1/admin/disputes', adminDisputesRoutes);
app.use('/api/v1/admin/refunds', adminRefundsRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/landlord', landlordRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/internal', internalRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use(errorHandler);

export default app;
