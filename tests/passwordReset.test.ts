import request from 'supertest';

const mockSendEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/utils/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const user = {
  email: `password-reset-${uniqueSuffix}@example.com`,
  phone: `+225073000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Password Reset User',
  password: 'password123',
  role: 'tenant',
};

function extractTokenFromLastEmail(): string {
  const html = mockSendEmail.mock.calls[mockSendEmail.mock.calls.length - 1][0].html as string;
  const match = html.match(/token=([a-f0-9]+)/);
  if (!match) {
    throw new Error('No reset token found in the sent email');
  }
  return match[1];
}

beforeAll(async () => {
  await request(app).post('/api/v1/auth/register').send(user);
});

afterAll(async () => {
  await pool.query('DELETE FROM "users" WHERE email = $1', [user.email]);
  await pool.end();
});

beforeEach(() => {
  mockSendEmail.mockClear();
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('responds with the same generic message for a known and an unknown email', async () => {
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'no-such-account@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data.message).toBe(unknown.body.data.message);
  });

  it('only sends an email for a known account', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'no-such-account@example.com' });
    expect(mockSendEmail).not.toHaveBeenCalled();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(extractTokenFromLastEmail()).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects an invalid payload', async () => {
    const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('rejects an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'newpassword123' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'whatever-token', newPassword: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('resets the password with a valid token and lets the user log in with it', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const token = extractTokenFromLastEmail();

    const resetResponse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'brandNewPassword123' });
    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.updated).toBe(true);

    const oldPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'brandNewPassword123' });
    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.body.data.tokens.accessToken).toBeDefined();
  });

  it('rejects reusing the same token a second time', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const token = extractTokenFromLastEmail();

    const firstUse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'anotherPassword123' });
    expect(firstUse.status).toBe(200);

    const secondUse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'yetAnotherPassword123' });
    expect(secondUse.status).toBe(401);
  });

  it('invalidates a still-outstanding older link once a newer one is used', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const olderToken = extractTokenFromLastEmail();

    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const newerToken = extractTokenFromLastEmail();

    const usedNewer = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: newerToken, newPassword: 'finalPassword123' });
    expect(usedNewer.status).toBe(200);

    const attemptOlder = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: olderToken, newPassword: 'shouldNotWork123' });
    expect(attemptOlder.status).toBe(401);
  });
});
