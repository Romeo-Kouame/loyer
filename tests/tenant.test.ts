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
  email: `tenant-portal-landlord-${uniqueSuffix}@example.com`,
  phone: `+225120100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Tenant Portal Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `tenant-portal-tenant-${uniqueSuffix}@example.com`,
  phone: `+225121100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Tenant Portal Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let tenantToken: string;
let propertyId: string;
let leaseId: string;

function signWebhookPayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  return { body, signature };
}

async function confirmAPayment(amount = 10000): Promise<string> {
  mockPost.mockResolvedValueOnce({
    data: { id: `kpay-tenant-${Date.now()}-${Math.random()}`, reference: `KPAY-REF-${Date.now()}`, status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/x' },
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

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Tenant Portal Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  const leaseRes = await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ tenantEmail: tenant.email, unitLabel: 'A1', rentAmount: 50000, moveInDate: new Date().toISOString().slice(0, 10), installmentsAllowed: true });
  leaseId = leaseRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "payouts" WHERE "landlordId" = (SELECT "ownerId" FROM "properties" WHERE id = $1)', [propertyId]);
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [landlord.email, tenant.email]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('GET /api/v1/tenant/me', () => {
  it("returns the tenant's active leases with balance info", async () => {
    const response = await request(app).get('/api/v1/tenant/me').set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].leaseId).toBe(leaseId);
    expect(response.body.data[0].address).toBe('Tenant Portal Test Property, Abidjan');
    expect(response.body.data[0].balance.rentAmount).toBe(50000);
    expect(response.body.data[0].balance.balance).toBe(50000);
  });

  it('rejects landlords', async () => {
    const response = await request(app).get('/api/v1/tenant/me').set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/tenant/me');
    expect(response.status).toBe(401);
  });
});

describe('GET /api/v1/tenant/history', () => {
  it('lists the payments made by the tenant', async () => {
    const paymentId = await confirmAPayment(15000);

    const response = await request(app).get('/api/v1/tenant/history').set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBeGreaterThanOrEqual(1);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.pageSize).toBe(20);
    const ids = response.body.data.payments.map((p: { id: string }) => p.id);
    expect(ids).toContain(paymentId);
  });

  it('rejects landlords', async () => {
    const response = await request(app).get('/api/v1/tenant/history').set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });
});
