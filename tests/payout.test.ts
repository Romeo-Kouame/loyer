import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.KPAY_WEBHOOK_SECRET = 'test-webhook-secret';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockPost, get: mockGet }),
  isAxiosError: () => false,
}));

import app from '../src/app';
import { pool } from '../src/config/database';
import { config } from '../src/config/environment';

const uniqueSuffix = Date.now();
const landlord = {
  email: `payout-landlord-${uniqueSuffix}@example.com`,
  phone: `+225110100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Payout Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `payout-tenant-${uniqueSuffix}@example.com`,
  phone: `+225111100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Payout Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let landlordId: string;
let tenantToken: string;
let adminToken: string;
let propertyId: string;

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

  const adminResult = await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, 'x', 'admin')
     RETURNING id`,
    [`payout-admin-${uniqueSuffix}@example.com`, `+225112100${uniqueSuffix.toString().slice(-4)}`, 'Payout Admin']
  );
  adminToken = jwt.sign(
    { userId: adminResult.rows[0].id, email: 'admin', role: 'admin' },
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Payout Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      rentAmount: 100000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: false,
    });
});

afterAll(async () => {
  await pool.query('DELETE FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    tenant.email,
    `payout-admin-${uniqueSuffix}@example.com`,
  ]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

async function confirmAPayment(): Promise<string> {
  mockPost.mockResolvedValueOnce({
    data: { id: `kpay-pay-${Date.now()}`, reference: `KPAY-REF-${Date.now()}`, status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/x' },
  });

  const initiateRes = await request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ propertyId, amount: 100000, returnUrl: 'https://example.com/return' });

  const paymentId = initiateRes.body.data.id;
  const transactionId = initiateRes.body.data.transactionId;

  mockGet.mockResolvedValueOnce({ data: { id: transactionId, status: 'COMPLETED', provider: 'MTN_MOMO_CIV' } });

  const { body, signature } = signWebhookPayload({
    event: 'payment.completed',
    paymentId: transactionId,
    reference: 'KPAY-REF',
    status: 'COMPLETED',
    externalId: paymentId,
  });

  await request(app)
    .post('/api/v1/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-KPAY-Signature', signature)
    .send(body);

  return paymentId;
}

describe('Payout creation on payment confirmation', () => {
  it('creates an on-hold payout when the landlord is not verified', async () => {
    await confirmAPayment();

    const result = await pool.query('SELECT * FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('on_hold');
    expect(result.rows[0].holdReason).toBe('landlord_not_verified');
    expect(Number(result.rows[0].commissionAmount)).toBeCloseTo(4000, 2);
    expect(Number(result.rows[0].payoutAmount)).toBeCloseTo(96000, 2);
  });
});

describe('PATCH /api/v1/payouts/destination', () => {
  it('lets a landlord set their payout destination', async () => {
    const response = await request(app)
      .patch('/api/v1/payouts/destination')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ payoutProvider: 'mtn', payoutPhoneNumber: '+2250700000001' });

    expect(response.status).toBe(200);
    expect(response.body.data.payoutProvider).toBe('mtn');
  });

  it('rejects tenants', async () => {
    const response = await request(app)
      .patch('/api/v1/payouts/destination')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ payoutProvider: 'mtn', payoutPhoneNumber: '+2250700000001' });

    expect(response.status).toBe(403);
  });
});

describe('Retrying a payout once verified', () => {
  it('attempts the withdrawal once landlord/property are verified and a destination is set', async () => {
    await request(app)
      .patch(`/api/v1/admin/kyc/${landlordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    await request(app)
      .post(`/api/v1/properties/${propertyId}/verification`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .attach('document', Buffer.from('fake-title-deed'), { filename: 'title.pdf', contentType: 'application/pdf' });

    await request(app)
      .patch(`/api/v1/admin/property-verifications/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    const payoutRow = await pool.query('SELECT id FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
    const payoutId = payoutRow.rows[0].id;

    mockPost.mockResolvedValueOnce({
      data: { id: 'kpay-withdraw-1', reference: 'KPAY-WD-REF-1', status: 'PENDING' },
    });

    const response = await request(app)
      .post(`/api/v1/payouts/${payoutId}/retry`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('processing');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/payments/withdraw',
      expect.objectContaining({ amount: 96000, provider: 'MTN_MOMO_CIV', phoneNumber: '+2250700000001' })
    );
  });

  it('rejects retry from a different landlord', async () => {
    const otherRes = await request(app).post('/api/v1/auth/register').send({
      email: `payout-other-${uniqueSuffix}@example.com`,
      phone: `+225113100${uniqueSuffix.toString().slice(-4)}`,
      name: 'Other Landlord',
      password: 'password123',
      role: 'landlord',
    });
    const otherToken = otherRes.body.data.tokens.accessToken;

    const payoutRow = await pool.query('SELECT id, status FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
    const payoutId = payoutRow.rows[0].id;

    const response = await request(app)
      .post(`/api/v1/payouts/${payoutId}/retry`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);

    await pool.query('DELETE FROM "users" WHERE email = $1', [`payout-other-${uniqueSuffix}@example.com`]);
  });
});

describe('Payout webhook', () => {
  it('marks a processing payout as completed', async () => {
    const payoutRow = await pool.query(
      'SELECT id, "transactionId" FROM "payouts" WHERE "landlordId" = $1 AND status = $2',
      [landlordId, 'processing']
    );
    const payout = payoutRow.rows[0];

    const { body, signature } = signWebhookPayload({
      event: 'payout.completed',
      paymentId: payout.transactionId,
      reference: 'KPAY-WD-REF-1',
      status: 'COMPLETED',
      externalId: payout.id,
    });

    const response = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-KPAY-Signature', signature)
      .send(body);

    expect(response.status).toBe(200);

    const updated = await pool.query('SELECT status FROM "payouts" WHERE id = $1', [payout.id]);
    expect(updated.rows[0].status).toBe('completed');
  });
});

describe('GET /api/v1/payouts', () => {
  it("lists the landlord's own payouts", async () => {
    const response = await request(app).get('/api/v1/payouts').set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBeGreaterThanOrEqual(1);
  });
});
