import request from 'supertest';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockPost, get: mockGet }),
}));

import app from '../src/app';
import { pool } from '../src/config/database';
import { getLeaseBalance } from '../src/services/lease.service';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const uniqueSuffix = Date.now();
const landlord = {
  email: `balance-landlord-${uniqueSuffix}@example.com`,
  phone: `+225079000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Balance Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `balance-tenant-${uniqueSuffix}@example.com`,
  phone: `+225070100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Balance Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let tenantToken: string;
let propertyId: string;
const createdPropertyIds: string[] = [];

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Balance Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;
  createdPropertyIds.push(propertyId);
});

afterAll(async () => {
  await pool.query('DELETE FROM "payments" WHERE "propertyId" = ANY($1)', [createdPropertyIds]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = ANY($1)', [createdPropertyIds]);
  await pool.query('DELETE FROM "properties" WHERE id = ANY($1)', [createdPropertyIds]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [landlord.email, tenant.email]);
  await pool.end();
});

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('GET /api/v1/properties/:id/leases/:leaseId/balance', () => {
  it('is not late on the day rent becomes due', async () => {
    const today = new Date();
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, rentAmount: 50000, moveInDate: toDateOnly(today) });

    const leaseId = leaseRes.body.data.id;

    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/balance`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalDue).toBe(50000);
    expect(response.body.data.totalPaid).toBe(0);
    expect(response.body.data.balance).toBe(50000);
    expect(response.body.data.isLate).toBe(false);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('is late once the grace period has passed with nothing paid', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, rentAmount: 50000, moveInDate: toDateOnly(tenDaysAgo) });

    const leaseId = leaseRes.body.data.id;

    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/balance`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.isLate).toBe(true);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('clamps the due date to the last day of a shorter month', async () => {
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, rentAmount: 50000, moveInDate: '2026-01-31' });

    const leaseId = leaseRes.body.data.id;

    const balance = await getLeaseBalance(leaseId, new Date('2026-03-01T00:00:00.000Z'));

    expect(balance.currentDueDate).toBe('2026-02-28');
    expect(balance.nextDueDate).toBe('2026-03-31');
    expect(balance.totalDue).toBe(100000);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });
});

describe('Partial payments controlled by installmentsAllowed', () => {
  it('accepts a partial payment when installments are allowed', async () => {
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        tenantEmail: tenant.email,
        rentAmount: 50000,
        moveInDate: toDateOnly(new Date()),
        installmentsAllowed: true,
      });

    mockPost.mockResolvedValueOnce({
      data: { id: 'kpay-partial-1', reference: 'KPAY-PARTIAL-1', status: 'PENDING', gatewayUrl: 'https://kpay.site/pay/p1' },
    });

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 10000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(201);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseRes.body.data.id}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('rejects a partial payment when installments are not allowed', async () => {
    await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        tenantEmail: tenant.email,
        rentAmount: 50000,
        moveInDate: toDateOnly(new Date()),
        installmentsAllowed: false,
      });

    const response = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, amount: 10000, returnUrl: 'https://example.com/return' });

    expect(response.status).toBe(400);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
