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

function signWebhookPayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  return { body, signature };
}

const uniqueSuffix = Date.now();
const landlord = {
  email: `arrears-landlord-${uniqueSuffix}@example.com`,
  phone: `+225122100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Arrears Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `arrears-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225123100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Arrears Other Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `arrears-tenant-${uniqueSuffix}@example.com`,
  phone: `+225124100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Arrears Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let otherLandlordToken: string;
let tenantToken: string;
let propertyId: string;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const otherLandlordRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherLandlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Arrears Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "payouts" WHERE "landlordId" = (SELECT "ownerId" FROM "properties" WHERE id = $1)', [propertyId]);
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    otherLandlord.email,
    tenant.email,
  ]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('GET /api/v1/properties/:id/arrears', () => {
  it('lists a tenant with unpaid rent past the grace period', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, rentAmount: 50000, moveInDate: toDateOnly(tenDaysAgo) });

    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/arrears`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].leaseId).toBe(leaseRes.body.data.id);
    expect(response.body.data[0].tenantEmail).toBe(tenant.email);
    expect(response.body.data[0].balance).toBe(50000);
    expect(response.body.data[0].isLate).toBe(true);
    expect(response.body.data[0].daysOverdue).toBeGreaterThanOrEqual(10);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseRes.body.data.id}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('omits a lease with nothing owed', async () => {
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, rentAmount: 50000, moveInDate: toDateOnly(new Date()) });

    const transactionId = `kpay-arrears-${Date.now()}`;
    mockPost.mockResolvedValueOnce({
      data: { id: transactionId, reference: 'KPAY-ARREARS', status: 'PENDING', gatewayUrl: 'x' },
    });
    const initiateRes = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 50000, returnUrl: 'https://example.com/return' });

    mockGet.mockResolvedValueOnce({ data: { id: transactionId, status: 'COMPLETED', provider: 'MTN_MOMO_CIV' } });
    const { body, signature } = signWebhookPayload({
      event: 'payment.completed',
      paymentId: transactionId,
      reference: 'KPAY-ARREARS',
      status: 'COMPLETED',
      externalId: initiateRes.body.data.id,
    });
    await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-KPAY-Signature', signature)
      .send(body);

    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/arrears`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.find((e: { leaseId: string }) => e.leaseId === leaseRes.body.data.id)).toBeUndefined();

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseRes.body.data.id}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('forbids a different landlord', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/arrears`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects tenants', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/arrears`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(403);
  });
});
