process.env.KPAY_WEBHOOK_SECRET = 'test-webhook-secret';

import crypto from 'crypto';
import request from 'supertest';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockPost, get: mockGet }),
}));

import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const tenant = {
  email: `payments-tenant-${uniqueSuffix}@example.com`,
  phone: `+225071000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Payments Tenant',
  password: 'password123',
  role: 'tenant',
};
const landlord = {
  email: `payments-landlord-${uniqueSuffix}@example.com`,
  phone: `+225072000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Payments Landlord',
  password: 'password123',
  role: 'landlord',
};

let tenantToken: string;
let landlordToken: string;
let propertyId: string;

beforeAll(async () => {
  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;
  const tenantId = tenantRes.body.data.user.id;

  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;
  const landlordId = landlordRes.body.data.user.id;

  const propertyResult = await pool.query(
    `INSERT INTO "properties" ("ownerId", address, "numberOfApartments") VALUES ($1, $2, $3) RETURNING id`,
    [landlordId, 'Test Address, Abidjan', 2]
  );
  propertyId = propertyResult.rows[0].id;

  await pool.query(
    `INSERT INTO "leases" ("propertyId", "tenantId", status) VALUES ($1, $2, 'active')`,
    [propertyId, tenantId]
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [tenant.email, landlord.email]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('POST /api/v1/payments/initiate', () => {
  it('creates a pending payment and returns the K-Pay gateway URL', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'kpay-id-1',
        reference: 'KPAY-REF-1',
        status: 'PENDING',
        gatewayUrl: 'https://kpay.site/pay/abc',
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 5000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.provider).toBeNull();
    expect(response.body.data.gatewayUrl).toBe('https://kpay.site/pay/abc');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/payments/init',
      expect.objectContaining({ amount: 5000, returnUrl: 'https://example.com/return' })
    );
  });

  it('rejects landlords (only tenants can pay)', async () => {
    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ propertyId, amount: 5000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(403);
  });

  it('rejects an unknown property', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId: '00000000-0000-0000-0000-000000000000',
        amount: 5000,
        returnUrl: 'https://example.com/return',
      });

    expect(response.status).toBe(404);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rejects a tenant with no active lease on the property', async () => {
    const otherPropertyResult = await pool.query(
      `INSERT INTO "properties" ("ownerId", address, "numberOfApartments")
       SELECT "ownerId", 'Unleased Property, Abidjan', 1 FROM "properties" WHERE id = $1
       RETURNING id`,
      [propertyId]
    );
    const unleasedPropertyId = otherPropertyResult.rows[0].id;

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId: unleasedPropertyId, amount: 5000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(403);
    expect(mockPost).not.toHaveBeenCalled();

    await pool.query('DELETE FROM "properties" WHERE id = $1', [unleasedPropertyId]);
  });

  it('rejects a missing returnUrl', async () => {
    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 5000 });

    expect(response.status).toBe(400);
  });

  it('marks the payment failed if K-Pay initiation errors out', async () => {
    mockPost.mockRejectedValueOnce(new Error('network error'));

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 5000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(502);
  });
});

describe('GET /api/v1/payments/:id', () => {
  it('polls K-Pay and updates the payment when it has settled', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'kpay-id-2', reference: 'KPAY-REF-2', status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/xyz' },
    });

    const initiateRes = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 7000, returnUrl: 'https://example.com/return' });

    mockGet.mockResolvedValueOnce({
      data: { id: 'kpay-id-2', status: 'COMPLETED', provider: 'MTN_MOMO_CIV' },
    });

    const statusRes = await request(app)
      .get(`/api/v1/payments/${initiateRes.body.data.id}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('confirmed');
    expect(statusRes.body.data.provider).toBe('mtn');
  });
});

describe('POST /api/v1/payments/webhook', () => {
  it('updates the payment status when the signature is valid', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'kpay-id-3', reference: 'KPAY-REF-3', status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/w' },
    });

    const initiateRes = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 3000, returnUrl: 'https://example.com/return' });

    mockGet.mockResolvedValueOnce({ data: { id: 'kpay-id-3', status: 'COMPLETED', provider: 'ORANGE_CIV' } });

    const payload = JSON.stringify({
      event: 'payment.completed',
      paymentId: 'kpay-id-3',
      reference: 'KPAY-REF-3',
      status: 'COMPLETED',
      externalId: initiateRes.body.data.id,
    });
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex');

    const webhookRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-KPAY-Signature', signature)
      .send(payload);

    expect(webhookRes.status).toBe(200);

    const statusRes = await request(app)
      .get(`/api/v1/payments/${initiateRes.body.data.id}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(statusRes.body.data.status).toBe('confirmed');
    expect(statusRes.body.data.provider).toBe('orange');
  });

  it('rejects an invalid signature', async () => {
    const payload = JSON.stringify({ event: 'payment.completed', paymentId: 'x', externalId: 'x', status: 'COMPLETED' });

    const response = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-KPAY-Signature', 'not-the-right-signature')
      .send(payload);

    expect(response.status).toBe(401);
  });
});
