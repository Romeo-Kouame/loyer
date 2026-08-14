import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';
import { config } from '../src/config/environment';

const uniqueSuffix = Date.now();
const tenant = {
  email: `kyc-tenant-${uniqueSuffix}@example.com`,
  phone: `+225094100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Kyc Tenant',
  password: 'password123',
  role: 'tenant',
};
const otherTenant = {
  email: `kyc-other-${uniqueSuffix}@example.com`,
  phone: `+225095100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Kyc Other',
  password: 'password123',
  role: 'tenant',
};

const fakeImage = Buffer.from('fake-image-content');

let tenantId: string;
let tenantToken: string;
let otherTenantToken: string;
let adminToken: string;
let adminUserId: string;

beforeAll(async () => {
  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;
  tenantId = tenantRes.body.data.user.id;

  const otherRes = await request(app).post('/api/v1/auth/register').send(otherTenant);
  otherTenantToken = otherRes.body.data.tokens.accessToken;

  const adminResult = await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, 'x', 'admin')
     RETURNING id`,
    [`kyc-admin-${uniqueSuffix}@example.com`, `+225096100${uniqueSuffix.toString().slice(-4)}`, 'Kyc Admin']
  );
  adminUserId = adminResult.rows[0].id;
  adminToken = jwt.sign({ userId: adminUserId, email: 'admin', role: 'admin' }, config.jwt.secret, {
    expiresIn: '15m',
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM "audit_logs" WHERE "userId" = $1', [tenantId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    tenant.email,
    otherTenant.email,
    `kyc-admin-${uniqueSuffix}@example.com`,
  ]);
  await pool.end();
});

describe('POST /api/v1/kyc', () => {
  it('accepts a valid document and sets status to pending', async () => {
    const response = await request(app)
      .post('/api/v1/kyc')
      .set('Authorization', `Bearer ${tenantToken}`)
      .attach('document', fakeImage, { filename: 'id.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.data.kycStatus).toBe('pending');
  });

  it('rejects a disallowed file type', async () => {
    const response = await request(app)
      .post('/api/v1/kyc')
      .set('Authorization', `Bearer ${tenantToken}`)
      .attach('document', fakeImage, { filename: 'id.txt', contentType: 'text/plain' });

    expect(response.status).toBe(400);
  });

  it('rejects a missing file', async () => {
    const response = await request(app).post('/api/v1/kyc').set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/kyc/document/:userId', () => {
  it('lets the owner view their own document', async () => {
    const response = await request(app)
      .get(`/api/v1/kyc/document/${tenantId}`)
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(200);
  });

  it('forbids another user from viewing it', async () => {
    const response = await request(app)
      .get(`/api/v1/kyc/document/${tenantId}`)
      .set('Authorization', `Bearer ${otherTenantToken}`);

    expect(response.status).toBe(403);
  });

  it('lets an admin view it', async () => {
    const response = await request(app)
      .get(`/api/v1/kyc/document/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
  });
});

describe('Admin KYC review', () => {
  it('rejects non-admins listing submissions', async () => {
    const response = await request(app).get('/api/v1/admin/kyc').set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(403);
  });

  it('lists pending submissions', async () => {
    const response = await request(app).get('/api/v1/admin/kyc').set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.users.map((u: { id: string }) => u.id);
    expect(ids).toContain(tenantId);
  });

  it('approves a submission', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/kyc/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    expect(response.status).toBe(200);
    expect(response.body.data.kycStatus).toBe('verified');

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tenantToken}`);
    expect(me.body.data.kycStatus).toBe('verified');
  });

  it('rejects reviewing an already-reviewed submission', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/kyc/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    expect(response.status).toBe(409);
  });
});
