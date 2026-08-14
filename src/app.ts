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

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use(errorHandler);

export default app;
