import crypto from 'crypto';
import request from 'supertest';

process.env.KPAY_WEBHOOK_SECRET = 'test-webhook-secret';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockPost, get: mockGet }),
}));

import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `dashboard-landlord-${uniqueSuffix}@example.com`,
  phone: `+225125100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Dashboard Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `dashboard-tenant-${uniqueSuffix}@example.com`,
  phone: `+225126100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Dashboard Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let landlordId: string;
let tenantToken: string;
let propertyOneId: string;
let propertyTwoId: string;

function signWebhookPayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  return { body, signature };
}

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;
  landlordId = landlordRes.body.data.user.id;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const propertyOneRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Dashboard Test Property One, Abidjan', numberOfApartments: 1 });
  propertyOneId = propertyOneRes.body.data.id;

  const propertyTwoRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Dashboard Test Property Two, Abidjan', numberOfApartments: 1 });
  propertyTwoId = propertyTwoRes.body.data.id;

  await request(app)
    .post(`/api/v1/properties/${propertyOneId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'A1',
      rentAmount: 60000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
});

afterAll(async () => {
  await pool.query('DELETE FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
  await pool.query('DELETE FROM "payments" WHERE "propertyId" IN ($1, $2)', [propertyOneId, propertyTwoId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" IN ($1, $2)', [propertyOneId, propertyTwoId]);
  await pool.query('DELETE FROM "properties" WHERE id IN ($1, $2)', [propertyOneId, propertyTwoId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [landlord.email, tenant.email]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('GET /api/v1/landlord/dashboard', () => {
  it('aggregates properties, tenants, payments and outstanding balance', async () => {
    // Confirm a partial payment (20000 of 60000 due) so the collected total and
    // the outstanding balance are both non-zero and independently verifiable.
    const transactionId = `kpay-dashboard-${Date.now()}`;
    mockPost.mockResolvedValueOnce({
      data: { id: transactionId, reference: 'KPAY-DASHBOARD', status: 'PENDING', gatewayUrl: 'x' },
    });
    const initiateRes = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId: propertyOneId, amount: 20000, returnUrl: 'https://example.com/return' });

    mockGet.mockResolvedValueOnce({ data: { id: transactionId, status: 'COMPLETED', provider: 'MTN_MOMO_CIV' } });
    const { body, signature } = signWebhookPayload({
      event: 'payment.completed',
      paymentId: transactionId,
      reference: 'KPAY-DASHBOARD',
      status: 'COMPLETED',
      externalId: initiateRes.body.data.id,
    });
    await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-KPAY-Signature', signature)
      .send(body);

    // A second, still-pending payment so pendingPayments is non-zero too.
    mockPost.mockResolvedValueOnce({
      data: { id: `kpay-dashboard-pending-${Date.now()}`, reference: 'KPAY-PENDING', status: 'PENDING', gatewayUrl: 'x' },
    });
    await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId: propertyOneId, amount: 5000, returnUrl: 'https://example.com/return' });

    const response = await request(app)
      .get('/api/v1/landlord/dashboard')
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalProperties).toBe(2);
    expect(response.body.data.totalTenants).toBe(1);
    expect(response.body.data.totalCollectedThisMonth).toBeGreaterThanOrEqual(20000);
    expect(response.body.data.pendingPayments).toBeGreaterThanOrEqual(1);
    expect(response.body.data.outstandingBalance).toBeGreaterThanOrEqual(40000);
  });

  it('rejects tenants', async () => {
    const response = await request(app)
      .get('/api/v1/landlord/dashboard')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/landlord/dashboard');
    expect(response.status).toBe(401);
  });
});

