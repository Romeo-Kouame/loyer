# 🚀 Getting Started - Backend API

**Welcome!** This is the boilerplate for Plateforme Gestion des Loyers backend.

> This guide reflects what's actually implemented today (auth, properties, K-Pay payments).
> `ARCHITECTURE.md` and `ROADMAP.md` describe the broader target design - not all of it exists yet.

## ⚡ Quick Start (5 minutes)

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Start infrastructure (Docker)
docker-compose up -d

# The following services will start:
# - PostgreSQL on :5433 (not the default 5432, to avoid clashing with a
#   locally installed Postgres - see docker-compose.yml)
# - Redis on :6379 (provisioned but not yet used by the app)
```

### 2. Run the Server

```bash
# Start development server
npm run dev

# You should see:
# ✅ Server running on port 3000
# 📍 Environment: development
# 🚀 API ready at http://localhost:3000/api/v1
```

### 3. Test It

```bash
# In another terminal:
curl http://localhost:3000/health

# Response:
# {"status":"ok","timestamp":"2024-06-24T10:30:00Z"}
```

## 📚 Documentation

Read these in order:

1. **ARCHITECTURE.md** - Technical architecture & design
   - How things are organized
   - Technology stack
   - Database design
   - Security approach

2. **ROADMAP.md** - Complete development plan
   - MVP features (Weeks 1-16)
   - Phase 2-4 features
   - Sprint-by-sprint breakdown
   - Success metrics

3. **API Specification** (in OpenAPI format)
   - All endpoints documented
   - Request/response examples
   - Error codes

## 🏗️ Project Structure

```
src/
├── config/        # Environment loading, pg Pool
├── controllers/   # Handle requests
├── services/      # Business logic
├── repositories/  # Database queries (plain SQL via pg, no ORM)
├── middleware/    # Auth, validation, error handling
├── routes/        # API routes
├── utils/         # Logger, typed error classes
└── types/         # TypeScript types

tests/             # Jest + Supertest integration tests
migrations/        # Raw SQL migrations, applied by src/migrations/run.ts
```

## 💻 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Check code quality
npm run format           # Auto-format code

# Testing
npm test                 # Run all tests
npm test -- --watch     # Watch mode

# Database
npm run db:migrate      # Run migrations
npm run db:seed        # Seed test data

# Docker
npm run docker:up      # Start containers
npm run docker:down    # Stop containers

# Production
npm run build          # Build TypeScript
npm start             # Start production server
```

## 🗄️ Database Setup

### First Time

```bash
# Create tables
npm run db:migrate

# Add sample data (optional)
npm run db:seed

# Check database
psql postgresql://user:password@localhost:5433/loyers_db
```

### Connect with GUI

Use DBeaver or pgAdmin:
- Host: localhost
- Port: 5433
- User: user
- Password: password
- Database: loyers_db

## 🧪 Testing

```bash
# Unit tests
npm test

# With coverage
npm test -- --coverage

# Specific file
npm test auth.service

# Watch mode (auto re-run on changes)
npm test -- --watch
```

## 🔑 API Usage Example

### Register User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "landlord@example.com",
    "phone": "+22512345678",
    "password": "SecurePassword123",
    "name": "John Doe",
    "role": "landlord"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "landlord@example.com",
    "password": "SecurePassword123"
  }'

# Returns: { user, tokens: { accessToken, refreshToken } }
```

### Use Token

```bash
curl -X GET http://localhost:3000/api/v1/properties \
  -H "Authorization: Bearer <accessToken>"
```

## 🐛 Troubleshooting

### Port already in use
```bash
# Change port in .env
PORT=3001
```

### Database connection error
```bash
# Check PostgreSQL running
docker-compose ps

# Restart if needed
docker-compose restart postgres
```

### Module not found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Tests failing
```bash
# Clear cache and re-run
npm test -- --clearCache
npm test
```

## 📖 Next Steps

1. **Read ARCHITECTURE.md** - Understand the design
2. **Read ROADMAP.md** - See what needs to be built
3. **Check src/app.ts** - See how Express is setup
4. **Implement first feature** - Start with authentication
5. **Write tests** - Maintain 80%+ coverage
6. **Create API spec** - Document your endpoints

## 🆘 Need Help?

- Check **ARCHITECTURE.md** for technical details
- Check **ROADMAP.md** for implementation plan
- Check **README.md** for API documentation
- Read error messages carefully
- Search GitHub issues
- Ask the team

## 🔗 Useful Links

- Node.js: https://nodejs.org/
- Express: https://expressjs.com/
- node-postgres (pg): https://node-postgres.com/
- PostgreSQL: https://www.postgresql.org/
- Redis: https://redis.io/
- Docker: https://www.docker.com/
- K-Pay API docs: https://kpay.site/documentation

---

**Happy coding!** 🎉

Feel free to modify this boilerplate to fit your needs.

**Questions?** Check the documentation files or ask the team.

---

**Last Updated:** 2026-06-24
