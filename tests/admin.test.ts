import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const admin = {
  email: `admin-test-${uniqueSuffix}@example.com`,
  phone: `+225074000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Admin Test User',
  password: 'password123',
};
const landlord = {
  email: `admin-guard-landlord-${uniqueSuffix}@example.com`,
  phone: `+225075000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Admin Guard Landlord',
  password: 'password123',
  role: 'landlord',
};

let adminToken: string;
let landlordToken: string;
let landlordId: string;
let propertyId: string;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(admin.password, 10);
  await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role) VALUES ($1, $2, $3, $4, 'admin')`,
    [admin.email, admin.phone, admin.name, passwordHash]
  );
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: admin.password });
  adminToken = adminLogin.body.data.tokens.accessToken;

  const landlordRegister = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRegister.body.data.tokens.accessToken;
  landlordId = landlordRegister.body.data.user.id;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Admin Detail Test Property, Abidjan', numberOfApartments: 2 });
  propertyId = propertyRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [admin.email, landlord.email]);
  await pool.end();
});

describe('GET /api/v1/admin/overview', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/v1/admin/overview');
    expect(response.status).toBe(401);
  });

  it('rejects a non-admin user', async () => {
    const response = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns platform-wide counts for an admin', async () => {
    const response = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalLandlords).toBeGreaterThanOrEqual(1);
    expect(typeof response.body.data.totalTenants).toBe('number');
    expect(typeof response.body.data.confirmedPaymentsAmount).toBe('number');
  });
});

describe('GET /api/v1/admin/users', () => {
  it('rejects a non-admin user', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('lists users for an admin, filterable by role', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ role: 'landlord', pageSize: 50 })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.users.some((u: { email: string }) => u.email === landlord.email)).toBe(true);
    expect(response.body.data.users.every((u: { role: string }) => u.role === 'landlord')).toBe(true);
  });
});

describe('GET /api/v1/admin/users/:id', () => {
  it('rejects a non-admin user', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/users/${landlordId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('returns 404 for an unknown user', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });

  it("returns the user's full detail with their properties, but no password hash", async () => {
    const response = await request(app)
      .get(`/api/v1/admin/users/${landlordId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(landlord.email);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.properties.some((p: { id: string }) => p.id === propertyId)).toBe(true);
    expect(response.body.data.leases).toEqual([]);
  });
});
