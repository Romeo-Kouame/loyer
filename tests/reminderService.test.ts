import request from 'supertest';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockPost, get: mockGet }),
}));

import app from '../src/app';
import { pool } from '../src/config/database';
import { sendDueReminders } from '../src/services/reminder.service';

const uniqueSuffix = Date.now();
const landlord = {
  email: `reminder-landlord-${uniqueSuffix}@example.com`,
  phone: `+225127100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Reminder Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `reminder-tenant-${uniqueSuffix}@example.com`,
  phone: `+225128100${uniqueSuffix.toString().slice(-4)}`,
  name: 'Reminder Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let propertyId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  await request(app).post('/api/v1/auth/register').send(tenant);

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Reminder Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "rent_reminders" WHERE "leaseId" IN (SELECT id FROM "leases" WHERE "propertyId" = $1)', [propertyId]);
  await pool.query('DELETE FROM "leases" WHERE "propertyId" = $1', [propertyId]);
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2)', [landlord.email, tenant.email]);
  await pool.end();
});

describe('sendDueReminders', () => {
  it('sends a due-soon reminder 7 days before the next due date, once', async () => {
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, unitLabel: 'A1', rentAmount: 50000, moveInDate: '2026-01-01' });
    const leaseId = leaseRes.body.data.id;

    const asOf = new Date('2026-01-25T00:00:00.000Z');
    const first = await sendDueReminders(asOf);
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const reminderRow = await pool.query(
      `SELECT * FROM "rent_reminders" WHERE "leaseId" = $1 AND "reminderType" = 'due_soon_7'`,
      [leaseId]
    );
    expect(reminderRow.rowCount).toBe(1);

    const second = await sendDueReminders(asOf);
    const stillOne = await pool.query(
      `SELECT COUNT(*) AS count FROM "rent_reminders" WHERE "leaseId" = $1 AND "reminderType" = 'due_soon_7'`,
      [leaseId]
    );
    expect(Number(stillOne.rows[0].count)).toBe(1);
    expect(second.sent).toBe(0);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });

  it('sends an overdue reminder 7 days after the due date when unpaid', async () => {
    const leaseRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ tenantEmail: tenant.email, unitLabel: 'A1', rentAmount: 50000, moveInDate: '2026-01-01' });
    const leaseId = leaseRes.body.data.id;

    const asOf = new Date('2026-01-08T00:00:00.000Z');
    const result = await sendDueReminders(asOf);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const reminderRow = await pool.query(
      `SELECT * FROM "rent_reminders" WHERE "leaseId" = $1 AND "reminderType" = 'overdue_7'`,
      [leaseId]
    );
    expect(reminderRow.rowCount).toBe(1);

    await request(app)
      .delete(`/api/v1/properties/${propertyId}/leases/${leaseId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
  });
});
