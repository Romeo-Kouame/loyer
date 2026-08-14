import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';
import { config } from '../src/config/environment';

const uniqueSuffix = Date.now();
const tenant = {
  email: `audit-tenant-${uniqueSuffix}@example.com`,
  phone: `+225090100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Audit Tenant',
  password: 'password123',
  role: 'tenant',
};

let tenantId: string;
let tenantToken: string;
let adminToken: string;
let adminUserId: string;

beforeAll(async () => {
  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;
  tenantId = tenantRes.body.data.user.id;

  await request(app).post('/api/v1/auth/login').send({ email: tenant.email, password: 'wrong-password' });

  const adminResult = await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, 'x', 'admin')
     RETURNING id`,
    [`audit-admin-${uniqueSuffix}@example.com`, `+225091100${uniqueSuffix.toString().slice(-4)}`, 'Audit Admin']
  );
  adminUserId = adminResult.rows[0].id;
  adminToken = jwt.sign({ userId: adminUserId, email: 'admin', role: 'admin' }, config.jwt.secret, {
    expiresIn: '15m',
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM "audit_logs" WHERE "userId" IN ($1, $2)', [tenantId, adminUserId]);
  await pool.query('DELETE FROM "users" WHERE id IN ($1, $2)', [tenantId, adminUserId]);
  await pool.end();
});

describe('Audit logging', () => {
  it('records registration and login events', async () => {
    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ userId: tenantId })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const actions = response.body.data.logs.map((log: { action: string }) => log.action);
    expect(actions).toContain('user.registered');
    expect(actions).toContain('user.login_failed');
  });

  it('filters by action', async () => {
    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ userId: tenantId, action: 'user.registered' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.logs).toHaveLength(1);
    expect(response.body.data.logs[0].action).toBe('user.registered');
  });

  it('rejects non-admins', async () => {
    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/admin/audit-logs');
    expect(response.status).toBe(401);
  });
});
