# Database Migrations

All SQL migration files go here.

## How to Run

```bash
npm run db:migrate
```

## Creating New Migrations

1. Create file: `XXX-description-of-change.sql`
2. Write SQL
3. Run migrations
4. Test locally
5. Commit to git

## Naming Convention

`NNN-short-description.sql`

Examples:
- `001-create-users-table.sql`
- `002-create-properties-table.sql`
- `003-add-kyc-status-to-users.sql`

## Examples

### Create Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Alter Table
```sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD CONSTRAINT fk_users_role CHECK (role IN ('admin', 'user'));
```

### Create Index
```sql
CREATE INDEX idx_users_email ON users(email);
```

---

All migrations are run in order when you execute `npm run db:migrate`.
