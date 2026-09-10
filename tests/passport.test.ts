import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const tenant = {
  email: `passport-tenant-${uniqueSuffix}@example.com`,
  phone: `+225076000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Passport Tenant',
  password: 'password123',
  role: 'tenant',
};
const landlord = {
  email: `passport-landlord-${uniqueSuffix}@example.com`,
  phone: `+225077000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Passport Landlord',
  password: 'password123',
  role: 'landlord',
};

let tenantToken: string;
let landlordToken: string;

beforeAll(async () => {
  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [tenant.email, landlord.email]);
  await pool.end();
});

describe('GET /api/v1/tenant/passport/link', () => {
  it('rejects a non-tenant user', async () => {
    const response = await request(app)
      .get('/api/v1/tenant/passport/link')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('creates a share token for a tenant and returns the same one on repeat calls', async () => {
    const first = await request(app).get('/api/v1/tenant/passport/link').set('Authorization', `Bearer ${tenantToken}`);
    expect(first.status).toBe(200);
    expect(typeof first.body.data.token).toBe('string');

    const second = await request(app).get('/api/v1/tenant/passport/link').set('Authorization', `Bearer ${tenantToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data.token).toBe(first.body.data.token);
  });
});

describe('GET /api/v1/passport/:token (public)', () => {
  it('returns 404 for an unknown token', async () => {
    const response = await request(app).get('/api/v1/passport/not-a-real-token');
    expect(response.status).toBe(404);
  });

  it('returns the tenant summary for a valid token, with no auth required', async () => {
    const linkRes = await request(app).get('/api/v1/tenant/passport/link').set('Authorization', `Bearer ${tenantToken}`);
    const token = linkRes.body.data.token;

    const response = await request(app).get(`/api/v1/passport/${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.tenantName).toBe(tenant.name);
    expect(typeof response.body.data.score).toBe('number');
  });
});

describe('DELETE /api/v1/tenant/passport/link', () => {
  it('revokes the current token so it can no longer be used, and issues a new one afterwards', async () => {
    const linkRes = await request(app).get('/api/v1/tenant/passport/link').set('Authorization', `Bearer ${tenantToken}`);
    const revokedToken = linkRes.body.data.token;

    const revokeRes = await request(app)
      .delete('/api/v1/tenant/passport/link')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(revokeRes.status).toBe(200);

    const publicRes = await request(app).get(`/api/v1/passport/${revokedToken}`);
    expect(publicRes.status).toBe(404);

    const newLinkRes = await request(app).get('/api/v1/tenant/passport/link').set('Authorization', `Bearer ${tenantToken}`);
    expect(newLinkRes.status).toBe(200);
    expect(newLinkRes.body.data.token).not.toBe(revokedToken);
  });
});
