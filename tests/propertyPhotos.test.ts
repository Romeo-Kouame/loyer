import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `photo-landlord-${uniqueSuffix}@example.com`,
  phone: `+225088000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Photo Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `photo-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225089000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Photo Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `photo-tenant-${uniqueSuffix}@example.com`,
  phone: `+225090000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Photo Tenant',
  password: 'password123',
  role: 'tenant',
};
const unrelatedTenant = {
  email: `photo-unrelated-tenant-${uniqueSuffix}@example.com`,
  phone: `+225091000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Unrelated Photo Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let otherLandlordToken: string;
let tenantToken: string;
let unrelatedTenantToken: string;
let propertyId: string;
let photoId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const otherLandlordRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherLandlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const unrelatedRes = await request(app).post('/api/v1/auth/register').send(unrelatedTenant);
  unrelatedTenantToken = unrelatedRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Photo Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'C1',
      rentAmount: 50000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3, $4)', [
    landlord.email,
    otherLandlord.email,
    tenant.email,
    unrelatedTenant.email,
  ]);
  await pool.end();
});

describe('POST /api/v1/properties/:id/photos', () => {
  it('rejects a non-owner landlord', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .attach('photo', Buffer.from('fake-jpeg-bytes'), { filename: 'front.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(403);
  });

  it('rejects a disallowed file type', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .attach('photo', Buffer.from('not-a-photo'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(response.status).toBe(400);
  });

  it('lets the owner upload a photo', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .attach('photo', Buffer.from('fake-jpeg-bytes'), { filename: 'front.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeDefined();
    photoId = response.body.data.id;
  });
});

describe('Viewing photos', () => {
  it('forbids a tenant with no lease on the property', async () => {
    const listRes = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${unrelatedTenantToken}`);
    expect(listRes.status).toBe(403);
  });

  it('lets the owner, and the leased tenant, list and view photos', async () => {
    const asOwner = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.data.some((p: { id: string }) => p.id === photoId)).toBe(true);

    const asTenant = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(asTenant.status).toBe(200);

    const fileRes = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos/${photoId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(fileRes.status).toBe(200);

    const coverRes = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos/cover`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(coverRes.status).toBe(200);
  });
});

describe('DELETE /api/v1/properties/:id/photos/:photoId', () => {
  it('rejects a non-owner landlord', async () => {
    const response = await request(app)
      .delete(`/api/v1/properties/${propertyId}/photos/${photoId}`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);
    expect(response.status).toBe(403);
  });

  it('lets the owner delete the photo, after which it 404s', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/properties/${propertyId}/photos/${photoId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(deleteRes.status).toBe(204);

    const fileRes = await request(app)
      .get(`/api/v1/properties/${propertyId}/photos/${photoId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(fileRes.status).toBe(404);
  });
});
