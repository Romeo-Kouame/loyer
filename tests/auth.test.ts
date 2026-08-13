import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const testUser = {
  email: `auth-test-${uniqueSuffix}@example.com`,
  phone: `+225070000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Auth Test User',
  password: 'password123',
  role: 'tenant',
};

afterAll(async () => {
  await pool.query('DELETE FROM "users" WHERE email = $1', [testUser.email]);
  await pool.end();
});

describe('POST /api/v1/auth/register', () => {
  it('creates a new user and returns tokens', async () => {
    const response = await request(app).post('/api/v1/auth/register').send(testUser);

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.tokens.refreshToken).toBeDefined();
  });

  it('rejects a duplicate email', async () => {
    const response = await request(app).post('/api/v1/auth/register').send(testUser);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(response.status).toBe(200);
    expect(response.body.data.tokens.accessToken).toBeDefined();
  });

  it('rejects incorrect credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
