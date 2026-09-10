import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `agreement-landlord-${uniqueSuffix}@example.com`,
  phone: `+225085000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Agreement Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `agreement-tenant-${uniqueSuffix}@example.com`,
  phone: `+225086000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Agreement Tenant',
  password: 'password123',
  role: 'tenant',
};
const otherTenant = {
  email: `agreement-other-tenant-${uniqueSuffix}@example.com`,
  phone: `+225087000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Agreement Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let tenantToken: string;
let otherTenantToken: string;
let propertyId: string;
let leaseId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const otherTenantRes = await request(app).post('/api/v1/auth/register').send(otherTenant);
  otherTenantToken = otherTenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Agreement Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  const leaseRes = await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'B2',
      rentAmount: 90000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: false,
      depositAmount: 90000,
    });
  leaseId = leaseRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [landlord.email, tenant.email, otherTenant.email]);
  await pool.end();
});

describe('GET /api/v1/properties/:id/leases/:leaseId/agreement', () => {
  it('forbids a user who is not a party to the lease', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement`)
      .set('Authorization', `Bearer ${otherTenantToken}`);
    expect(response.status).toBe(403);
  });

  it('generates the agreement snapshotting the lease terms, unsigned by default', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.rentAmount).toBe(90000);
    expect(response.body.data.depositAmount).toBe(90000);
    expect(response.body.data.landlordSignedAt).toBeNull();
    expect(response.body.data.tenantSignedAt).toBeNull();
    expect(response.body.data.isFullyExecuted).toBe(false);
  });

  it('returns the same agreement id on repeat calls (does not regenerate)', async () => {
    const first = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement`)
      .set('Authorization', `Bearer ${landlordToken}`);
    const second = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(second.body.data.id).toBe(first.body.data.id);
  });
});

describe('POST /api/v1/properties/:id/leases/:leaseId/agreement/sign', () => {
  it('rejects a user who is not a party to the lease', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement/sign`)
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .send({ fullName: 'Impostor' });
    expect(response.status).toBe(403);
  });

  it('lets the tenant sign, then the landlord, marking it fully executed', async () => {
    const tenantSign = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement/sign`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ fullName: tenant.name });
    expect(tenantSign.status).toBe(200);
    expect(tenantSign.body.data.tenantSignedAt).not.toBeNull();
    expect(tenantSign.body.data.landlordSignedAt).toBeNull();
    expect(tenantSign.body.data.isFullyExecuted).toBe(false);

    const landlordSign = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement/sign`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ fullName: landlord.name });
    expect(landlordSign.status).toBe(200);
    expect(landlordSign.body.data.tenantSignedAt).not.toBeNull();
    expect(landlordSign.body.data.landlordSignedAt).not.toBeNull();
    expect(landlordSign.body.data.isFullyExecuted).toBe(true);
  });

  it('rejects signing a second time from the same party', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/agreement/sign`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ fullName: tenant.name });
    expect(response.status).toBe(409);
  });

  it('rejects an empty full name', async () => {
    const freshLeaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        tenantEmail: otherTenant.email,
        unitLabel: 'B3',
        rentAmount: 45000,
        moveInDate: new Date().toISOString().slice(0, 10),
        installmentsAllowed: false,
      });
    const freshLeaseId = freshLeaseRes.body.data.id;

    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${freshLeaseId}/agreement/sign`)
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .send({ fullName: '   ' });
    expect(response.status).toBe(400);
  });
});
