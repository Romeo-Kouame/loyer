process.env.CRON_SECRET = 'test-cron-secret';

import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

afterAll(async () => {
  await pool.end();
});

describe('GET /api/v1/internal/cron/*', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await request(app).get('/api/v1/internal/cron/payouts');
    expect(response.status).toBe(401);
  });

  it('rejects a request with the wrong secret', async () => {
    const response = await request(app)
      .get('/api/v1/internal/cron/reminders')
      .set('Authorization', 'Bearer not-the-secret');
    expect(response.status).toBe(401);
  });

  it('runs the payouts sweep with the correct secret', async () => {
    const response = await request(app)
      .get('/api/v1/internal/cron/payouts')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(response.status).toBe(200);
    expect(typeof response.body.data.processed).toBe('number');
  });

  it('runs the reminders sweep with the correct secret', async () => {
    const response = await request(app)
      .get('/api/v1/internal/cron/reminders')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(response.status).toBe(200);
    expect(typeof response.body.data.sent).toBe('number');
  });
});
