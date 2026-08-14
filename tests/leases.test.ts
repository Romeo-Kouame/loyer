import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `leases-landlord-${uniqueSuffix}@example.com`,
  phone: `+225076000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Leases Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `leases-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225077000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `leases-tenant-${uniqueSuffix}@example.com`,
  phone: `+225078000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Leases Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let otherLandlordToken: string;
let tenantToken: string;
let propertyId: string;

const validLeaseTerms = { rentAmount: 50000, moveInDate: '2026-01-15' };

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
    .send({ address: 'Test Leases Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    otherLandlord.email,
    tenant.email,
  ]);
  await pool.end();
});

describe('POST /api/v1/properties/:id/leases', () => {
  it('lets the owning landlord assign a tenant', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, ...validLeaseTerms });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('active');
    expect(response.body.data.rentAmount).toBe('50000.00');
    expect(response.body.data.installmentsAllowed).toBe(false);
  });

  it('rejects a landlord who does not own the property', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .send({ tenantEmail: tenant.email, ...validLeaseTerms });

    expect(response.status).toBe(403);
  });

  it('rejects assigning the same tenant twice', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, ...validLeaseTerms });

    expect(response.status).toBe(409);
  });

  it('rejects an email that is not a tenant account', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: landlord.email, ...validLeaseTerms });

    expect(response.status).toBe(404);
  });

  it('rejects tenants trying to assign themselves', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ tenantEmail: tenant.email, ...validLeaseTerms });

    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/properties (tenant view)', () => {
  it("lists the tenant's leased properties", async () => {
    const response = await request(app).get('/api/v1/properties').set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].propertyId).toBe(propertyId);
  });
});

describe('GET /api/v1/properties/:id (tenant access)', () => {
  it('lets a tenant with an active lease view the property', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/v1/properties/:id/leases/:leaseId', () => {
  it('ends the lease and revokes tenant access', async () => {
    const leaseRes = await pool.query('SELECT id FROM "leases" WHERE "propertyId" = $1', [propertyId]);
    const leaseId = leaseRes.rows[0].id;

    const response = await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ended');

    const accessResponse = await request(app)
      .get(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(accessResponse.status).toBe(403);
  });
});
