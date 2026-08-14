# Plateforme Gestion des Loyers - Backend API

Backend application for the rent management platform.

## Status

This README describes the current, working state of the API. `ARCHITECTURE.md` and `ROADMAP.md`
describe the broader target design (withdrawals, disputes, audit log, etc.) - treat anything not
listed under "API Endpoints" below as **not built yet**, regardless of what those files say.

## Quick Start

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose (optional)
- PostgreSQL 15
- Redis 7

### Setup

1. Clone the repository
```bash
git clone <repo>
cd backend-api
```

2. Install dependencies
```bash
npm install
```

3. Setup environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start infrastructure (Docker)
```bash
docker-compose up -d
```

5. Run migrations
```bash
npm run db:migrate
```

6. Start development server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## Project Structure

```
src/
├── config/          # Environment loading, pg Pool
├── controllers/     # Request handlers
├── services/        # Business logic
├── repositories/    # Database queries (plain SQL via pg, no ORM)
├── middleware/      # Auth, validation, error handling
├── routes/          # API routes
├── utils/           # Logger, typed error classes
└── types/           # TypeScript interfaces

tests/               # Jest + Supertest integration tests
migrations/          # Raw SQL migrations, applied by src/migrations/run.ts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers

## API Endpoints

### Health
- `GET /health` - Check API status

### Authentication
- `POST /api/v1/auth/register` - Register user (landlord or tenant)
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get the authenticated user's profile

### Properties
- `POST /api/v1/properties` - Create property (landlord only)
- `GET /api/v1/properties` - List properties: a landlord's own properties, or a tenant's leased
  properties, depending on the authenticated user's role
- `GET /api/v1/properties/:id` - Get property details (owner, a tenant with an active lease, or
  admin)

### Leases
A lease is what links a tenant to a property they're allowed to pay rent on - a property can have
several apartments/tenants over time, so this isn't just a single column on `properties`.

- `POST /api/v1/properties/:id/leases` - Assign a tenant to a property by email (landlord/owner
  only)
- `DELETE /api/v1/properties/:id/leases/:leaseId` - End a lease (landlord/owner only), revoking
  that tenant's access to the property and to initiating further payments on it

### Payments
Payments are processed through the [K-Pay](https://kpay.site) aggregator (MTN/Orange Money,
Côte d'Ivoire only - Wave is not supported by K-Pay). The account is configured in GATEWAY mode:
the tenant is redirected to a hosted K-Pay page and picks their operator there. A tenant can only
pay for a property they have an active lease on.

- `POST /api/v1/payments/initiate` - Create a payment for a property (tenant only, must have an
  active lease), returns a `gatewayUrl` to redirect the tenant to
- `GET /api/v1/payments/:id` - Get payment status (polls K-Pay live while `pending`)
- `POST /api/v1/payments/webhook` - K-Pay payment notification (HMAC-SHA256 signed)

### Not implemented yet
Withdrawals, disputes, audit log, KYC verification flow, and everything else described in
`ARCHITECTURE.md`/`ROADMAP.md` beyond what's listed above.

## Documentation

- See `ROADMAP.md` for development roadmap
- See `ARCHITECTURE.md` for technical architecture

## Support

For questions or issues, please refer to the main project documentation.
