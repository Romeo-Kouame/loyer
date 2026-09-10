import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `notif-landlord-${uniqueSuffix}@example.com`,
  phone: `+225092000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Notification Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `notif-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225093000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Notification Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `notif-tenant-${uniqueSuffix}@example.com`,
  phone: `+225094000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Notification Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordId: string;
let landlordToken: string;
let otherLandlordToken: string;
let tenantToken: string;
let propertyId: string;
let leaseId: string;
let notificationAId: string;
let notificationBId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;
  landlordId = landlordRes.body.data.user.id;

  const otherLandlordRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherLandlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Notification Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  const leaseRes = await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'D1',
      rentAmount: 55000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
  leaseId = leaseRes.body.data.id;

  const inserted = await pool.query(
    `INSERT INTO "notifications" ("userId", type, title, body, "propertyId")
     VALUES ($1, 'test_event', 'Premier événement', 'Détails A', $2),
            ($1, 'test_event', 'Second événement', 'Détails B', $2)
     RETURNING id`,
    [landlordId, propertyId]
  );
  notificationAId = inserted.rows[0].id;
  notificationBId = inserted.rows[1].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    otherLandlord.email,
    tenant.email,
  ]);
  await pool.end();
});

describe('Landlord in-app notification center', () => {
  it('lists the landlord\'s notifications with an unread count', async () => {
    const listRes = await request(app)
      .get('/api/v1/landlord/notifications')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((n: { id: string }) => n.id);
    expect(ids).toEqual(expect.arrayContaining([notificationAId, notificationBId]));
    expect(listRes.body.data.find((n: { id: string }) => n.id === notificationAId).isRead).toBe(false);

    const unreadRes = await request(app)
      .get('/api/v1/landlord/notifications/unread-count')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(unreadRes.body.data.count).toBeGreaterThanOrEqual(2);
  });

  it("does not let another landlord mark someone else's notification as read", async () => {
    await request(app)
      .patch(`/api/v1/landlord/notifications/${notificationAId}/read`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);

    const row = await pool.query('SELECT "readAt" FROM "notifications" WHERE id = $1', [notificationAId]);
    expect(row.rows[0].readAt).toBeNull();
  });

  it('marks a single notification as read', async () => {
    const response = await request(app)
      .patch(`/api/v1/landlord/notifications/${notificationAId}/read`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(204);

    const row = await pool.query('SELECT "readAt" FROM "notifications" WHERE id = $1', [notificationAId]);
    expect(row.rows[0].readAt).not.toBeNull();
  });

  it('marks every remaining notification as read', async () => {
    const response = await request(app)
      .post('/api/v1/landlord/notifications/read-all')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(204);

    const unreadRes = await request(app)
      .get('/api/v1/landlord/notifications/unread-count')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(unreadRes.body.data.count).toBe(0);
  });
});

describe('Tenant reminder notifications', () => {
  it('starts empty for a tenant with no reminders sent yet', async () => {
    const response = await request(app).get('/api/v1/tenant/notifications').set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('rejects a non-tenant', async () => {
    const response = await request(app)
      .get('/api/v1/tenant/notifications')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('lists a reminder once one has been recorded for the tenant\'s lease', async () => {
    await pool.query(
      `INSERT INTO "rent_reminders" ("leaseId", "periodDueDate", "reminderType") VALUES ($1, CURRENT_DATE, 'due_soon_3')`,
      [leaseId]
    );

    const response = await request(app).get('/api/v1/tenant/notifications').set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].reminderType).toBe('due_soon_3');
  });
});
