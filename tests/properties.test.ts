import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `properties-landlord-${uniqueSuffix}@example.com`,
  phone: `+225073000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Properties Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `properties-tenant-${uniqueSuffix}@example.com`,
  phone: `+225074000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Properties Tenant',
  password: 'password123',
  role: 'tenant',
};
const otherLandlord = {
  email: `properties-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225075000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Landlord',
  password: 'password123',
  role: 'landlord',
};

let landlordToken: string;
let tenantToken: string;
let otherLandlordToken: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const otherLandlordRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherLandlordRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE address LIKE $1', ['%Test Properties Suite%']);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    tenant.email,
    otherLandlord.email,
  ]);
  await pool.end();
});

describe('POST /api/v1/properties', () => {
  it('lets a landlord create a property', async () => {
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ address: '1 Rue Test Properties Suite, Abidjan', numberOfApartments: 3 });

    expect(response.status).toBe(201);
    expect(response.body.data.address).toBe('1 Rue Test Properties Suite, Abidjan');
    expect(response.body.data.numberOfApartments).toBe(3);
  });

  it('rejects tenants', async () => {
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ address: '2 Rue Test Properties Suite, Abidjan', numberOfApartments: 1 });

    expect(response.status).toBe(403);
  });

  it('rejects an invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ address: 'abc' });

    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/v1/properties')
      .send({ address: '3 Rue Test Properties Suite, Abidjan', numberOfApartments: 1 });

    expect(response.status).toBe(401);
  });
});

describe('GET /api/v1/properties', () => {
  it("lists only the landlord's own properties", async () => {
    await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .send({ address: '4 Rue Test Properties Suite, Abidjan', numberOfApartments: 2 });

    const response = await request(app).get('/api/v1/properties').set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.every((p: { address: string }) => p.address.includes('1 Rue'))).toBe(true);
  });
});

describe('GET /api/v1/properties/:id', () => {
  it('lets the owner fetch their property', async () => {
    const createRes = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ address: '5 Rue Test Properties Suite, Abidjan', numberOfApartments: 1 });

    const response = await request(app)
      .get(`/api/v1/properties/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(createRes.body.data.id);
  });

  it('forbids a different landlord from viewing it', async () => {
    const createRes = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ address: '6 Rue Test Properties Suite, Abidjan', numberOfApartments: 1 });

    const response = await request(app)
      .get(`/api/v1/properties/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);

    expect(response.status).toBe(403);
  });

  it('returns 404 for an unknown property', async () => {
    const response = await request(app)
      .get('/api/v1/properties/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(404);
  });
});
