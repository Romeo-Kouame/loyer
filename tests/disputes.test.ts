import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.KPAY_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.PAYOUT_RESERVE_HOLD_HOURS = '48';

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
  email: `dispute-landlord-${uniqueSuffix}@example.com`,
  phone: `+225114100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Dispute Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `dispute-tenant-${uniqueSuffix}@example.com`,
  phone: `+225115100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Dispute Tenant',
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
    [`dispute-admin-${uniqueSuffix}@example.com`, `+225116100${uniqueSuffix.toString().slice(-4)}`, 'Dispute Admin']
  );
  adminToken = jwt.sign(
    { userId: adminResult.rows[0].id, email: 'admin', role: 'admin' },
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Dispute Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'A1',
      rentAmount: 50000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
});

afterAll(async () => {
  await pool.query('DELETE FROM "refunds" WHERE "paymentId" IN (SELECT id FROM "payments" WHERE "propertyId" = $1)', [
    propertyId,
  ]);
  await pool.query('DELETE FROM "payouts" WHERE "landlordId" = $1', [landlordId]);
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    tenant.email,
    `dispute-admin-${uniqueSuffix}@example.com`,
  ]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

async function confirmAPayment(amount = 10000): Promise<string> {
  mockPost.mockResolvedValueOnce({
    data: { id: `kpay-pay-${Date.now()}-${Math.random()}`, reference: `KPAY-REF-${Date.now()}`, status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/x' },
  });

  const initiateRes = await request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ propertyId, amount, returnUrl: 'https://example.com/return' });

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

describe('POST /api/v1/payments/:id/dispute', () => {
  it('lets the tenant dispute a confirmed payment and holds its payout', async () => {
    const paymentId = await confirmAPayment();

    const response = await request(app)
      .post(`/api/v1/payments/${paymentId}/dispute`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ reason: 'I never received a receipt for this payment' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('disputed');

    const payoutRow = await pool.query('SELECT status, "holdReason" FROM "payouts" WHERE "paymentId" = $1', [
      paymentId,
    ]);
    expect(payoutRow.rows[0].status).toBe('on_hold');
    expect(payoutRow.rows[0].holdReason).toBe('payment_disputed');
  });

  it('rejects disputing a non-confirmed payment', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: `kpay-pending-${Date.now()}`, reference: 'KPAY-REF-P', status: 'PENDING', gatewayUrl: 'x' },
    });
    const initiateRes = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 5000, returnUrl: 'https://example.com/return' });

    const response = await request(app)
      .post(`/api/v1/payments/${initiateRes.body.data.id}/dispute`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ reason: 'Testing dispute on pending payment' });

    expect(response.status).toBe(400);
  });

  it('rejects an unrelated user', async () => {
    const paymentId = await confirmAPayment();

    const otherRes = await request(app).post('/api/v1/auth/register').send({
      email: `dispute-other-${uniqueSuffix}@example.com`,
      phone: `+225117100${uniqueSuffix.toString().slice(-4)}`,
      name: 'Other Tenant',
      password: 'password123',
      role: 'tenant',
    });

    const response = await request(app)
      .post(`/api/v1/payments/${paymentId}/dispute`)
      .set('Authorization', `Bearer ${otherRes.body.data.tokens.accessToken}`)
      .send({ reason: 'Not my payment but trying anyway' });

    expect(response.status).toBe(403);

    await pool.query('DELETE FROM "users" WHERE email = $1', [`dispute-other-${uniqueSuffix}@example.com`]);
  });
});

describe('Admin dispute resolution', () => {
  it('rejects non-admins from listing disputes', async () => {
    const response = await request(app).get('/api/v1/admin/disputes').set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(403);
  });

  it('resolving as confirmed reinstates the payment and resumes the payout', async () => {
    const paymentId = await confirmAPayment();
    await request(app)
      .post(`/api/v1/payments/${paymentId}/dispute`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ reason: 'Dispute to be rejected by admin' });

    const listRes = await request(app).get('/api/v1/admin/disputes').set('Authorization', `Bearer ${adminToken}`);
    const ids = listRes.body.data.payments.map((p: { id: string }) => p.id);
    expect(ids).toContain(paymentId);

    const response = await request(app)
      .patch(`/api/v1/admin/disputes/${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'confirmed', notes: 'Payment verified as legitimate' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('confirmed');

    const payoutRow = await pool.query('SELECT status, "holdReason" FROM "payouts" WHERE "paymentId" = $1', [
      paymentId,
    ]);
    expect(payoutRow.rows[0].status).toBe('pending');
    expect(payoutRow.rows[0].holdReason).toBeNull();
  });

  it('resolving as refunded marks the payment refunded and creates a refund record', async () => {
    const paymentId = await confirmAPayment();
    await request(app)
      .post(`/api/v1/payments/${paymentId}/dispute`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ reason: 'Dispute to be refunded by admin' });

    const response = await request(app)
      .patch(`/api/v1/admin/disputes/${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'refunded', notes: 'Confirmed duplicate charge' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('refunded');

    const payoutRow = await pool.query('SELECT status FROM "payouts" WHERE "paymentId" = $1', [paymentId]);
    expect(payoutRow.rows[0].status).toBe('failed');

    const refundListRes = await request(app)
      .get('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${adminToken}`);
    const refund = refundListRes.body.data.refunds.find((r: { paymentId: string }) => r.paymentId === paymentId);
    expect(refund).toBeDefined();
    expect(refund.status).toBe('pending');

    const completeRes = await request(app)
      .post(`/api/v1/admin/refunds/${refund.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adminNotes: 'Refunded via K-Pay dashboard' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('completed');

    const completeAgainRes = await request(app)
      .post(`/api/v1/admin/refunds/${refund.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(completeAgainRes.status).toBe(409);
  });

  it('rejects resolving a non-disputed payment', async () => {
    const paymentId = await confirmAPayment();

    const response = await request(app)
      .patch(`/api/v1/admin/disputes/${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'confirmed' });

    expect(response.status).toBe(409);
  });
});
