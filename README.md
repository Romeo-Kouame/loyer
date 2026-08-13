# Plateforme Gestion des Loyers - Backend API

Backend application for the rent management platform.

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
├── config/          # Configuration files
├── models/          # TypeORM entities
├── controllers/     # Request handlers
├── services/        # Business logic
├── repositories/    # Database queries
├── middleware/      # Express middleware
├── routes/          # API routes
├── utils/           # Helper functions
└── types/           # TypeScript interfaces

tests/               # Test files
migrations/          # Database migrations
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

### Authentication (To be implemented)
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh token

### Properties (To be implemented)
- `GET /api/v1/properties` - List properties
- `POST /api/v1/properties` - Create property
- `GET /api/v1/properties/:id` - Get property details
- `PUT /api/v1/properties/:id` - Update property

### Payments (To be implemented)
- `GET /api/v1/payments` - List payments
- `POST /api/v1/payments/initiate` - Initiate payment
- `POST /api/v1/webhooks/wave` - Wave webhook
- `POST /api/v1/webhooks/orange` - Orange Money webhook

### Withdrawals (To be implemented)
- `GET /api/v1/withdrawals` - List withdrawals
- `POST /api/v1/withdrawals` - Request withdrawal

## Documentation

- See `ROADMAP.md` for development roadmap
- See `ARCHITECTURE.md` for technical architecture

## Support

For questions or issues, please refer to the main project documentation.
