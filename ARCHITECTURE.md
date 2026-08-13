# Backend Architecture Documentation

Technical architecture and design decisions.

## 📐 System Architecture

```
┌─────────────────────────────────────────┐
│         CLIENT LAYER (Frontend)          │
│  ├─ Web (React)                         │
│  └─ Mobile (Flutter)                    │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│        API GATEWAY LAYER                 │
│  ├─ CORS middleware                     │
│  ├─ Rate limiting                       │
│  ├─ Request validation                  │
│  └─ Authentication (JWT)                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│   EXPRESS APPLICATION LAYER              │
│  ├─ Controllers (request handling)      │
│  ├─ Services (business logic)           │
│  ├─ Repositories (data access)          │
│  └─ Middleware (cross-cutting concerns) │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴────────┬──────────────┐
         │                │              │
┌────────▼─────┐  ┌──────▼──────┐  ┌───▼─────────┐
│  PostgreSQL  │  │    Redis    │  │  External   │
│   Database   │  │   Cache     │  │  APIs       │
│              │  │   Sessions  │  │             │
└──────────────┘  └─────────────┘  └─────────────┘
```

## 🔧 Technology Stack

### Core
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.18
- **Language:** TypeScript 5.2
- **ORM:** TypeORM 0.3
- **Database:** PostgreSQL 15
- **Cache:** Redis 7

### Authentication & Security
- **JWT:** jsonwebtoken
- **Password Hashing:** bcryptjs (12 rounds)
- **HTTPS:** helmet
- **CORS:** cors middleware
- **Rate Limiting:** express-rate-limit
- **Input Validation:** express-validator + joi

### Integrations
- **Payment APIs:** Axios (HTTP client)
- **SMS:** Twilio (2FA)
- **Logging:** Winston
- **Monitoring:** DataDog (optional)
- **Error Tracking:** Sentry (optional)

### Testing
- **Unit Tests:** Jest
- **Integration Tests:** Jest + Supertest
- **API Testing:** Postman collection
- **Load Testing:** Artillery or k6

---

## 📁 Project Structure

```
backend-api/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Express app setup
│   │
│   ├── config/
│   │   ├── environment.ts       # Env variables
│   │   ├── database.ts          # PostgreSQL connection
│   │   └── redis.ts             # Redis connection
│   │
│   ├── models/                  # TypeORM entities
│   │   ├── User.ts
│   │   ├── Property.ts
│   │   ├── Payment.ts
│   │   ├── Withdrawal.ts
│   │   ├── Dispute.ts
│   │   └── AuditLog.ts
│   │
│   ├── controllers/             # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── property.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── withdrawal.controller.ts
│   │   └── admin.controller.ts
│   │
│   ├── services/                # Business logic
│   │   ├── auth.service.ts
│   │   ├── payment.service.ts
│   │   ├── withdrawal.service.ts
│   │   ├── email.service.ts
│   │   └── sms.service.ts
│   │
│   ├── repositories/            # Data access layer
│   │   ├── user.repository.ts
│   │   ├── property.repository.ts
│   │   ├── payment.repository.ts
│   │   └── base.repository.ts
│   │
│   ├── middleware/              # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error-handler.ts
│   │   ├── logging.ts
│   │   ├── validation.ts
│   │   └── rate-limiter.ts
│   │
│   ├── routes/                  # API routes
│   │   ├── auth.routes.ts
│   │   ├── property.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── withdrawal.routes.ts
│   │   └── admin.routes.ts
│   │
│   ├── utils/                   # Helper functions
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── validators.ts
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── formatters.ts
│   │
│   └── types/                   # TypeScript types
│       └── index.ts
│
├── tests/
│   ├── unit/
│   │   ├── auth.service.test.ts
│   │   ├── payment.service.test.ts
│   │   └── validators.test.ts
│   ├── integration/
│   │   ├── auth.integration.test.ts
│   │   ├── payment.integration.test.ts
│   │   └── withdrawal.integration.test.ts
│   ├── e2e/
│   │   └── payment.e2e.test.ts
│   └── jest.config.js
│
├── migrations/
│   ├── 001-create-users-table.sql
│   ├── 002-create-properties-table.sql
│   ├── 003-create-payments-table.sql
│   └── run.ts
│
├── .github/workflows/
│   └── ci-cd.yml                # GitHub Actions
│
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
├── README.md
├── ARCHITECTURE.md
└── ROADMAP.md
```

---

## 🔐 Security Architecture

### Authentication Flow

```
User Credentials
       ↓
[Express Middleware] → JWT Verification
       ↓
   [Pass/Fail]
       ↓
  [Controller] → Authorized endpoint
```

### JWT Strategy
- **Access Token:** 15 minutes (short-lived)
- **Refresh Token:** 7 days (stored in httpOnly cookie)
- **Signing:** RS256 (asymmetric, safer for microservices)
- **Payload:** userId, email, role

### 2FA Flow

```
1. User attempts login
2. System sends SMS with OTP code
3. User enters OTP
4. System validates against Redis cache
5. Removes OTP (one-time use)
6. Issues JWT tokens
```

### Data Encryption

```
Encrypted Fields:
- CIN (ID number)
- Bank account details
- Phone number

Method: AES-256-CBC
Key: From AWS Secrets Manager
Rotation: Quarterly
```

---

## 🗄️ Database Design

### Core Tables

#### Users
```sql
users
  id UUID PRIMARY KEY
  email VARCHAR(255) UNIQUE
  phone VARCHAR(20) UNIQUE
  passwordHash VARCHAR(255)
  kyc_status ENUM('pending', 'verified', 'rejected')
  aml_risk_score INT DEFAULT 0
  role ENUM('landlord', 'tenant', 'admin')
  createdAt TIMESTAMP
  updatedAt TIMESTAMP
  deletedAt TIMESTAMP (soft delete)
```

#### Properties
```sql
properties
  id UUID PRIMARY KEY
  ownerId UUID (FK → users)
  address VARCHAR(500)
  numberOfApartments INT
  createdAt TIMESTAMP
  updatedAt TIMESTAMP
  deletedAt TIMESTAMP
```

#### Payments
```sql
payments
  id UUID PRIMARY KEY
  tenantId UUID (FK → users)
  propertyId UUID (FK → properties)
  amount DECIMAL(10,2)
  provider ENUM('wave', 'orange', 'mtn')
  transactionId VARCHAR(255) UNIQUE
  status ENUM('pending', 'confirmed', 'failed', 'disputed')
  webhookReceivedAt TIMESTAMP
  createdAt TIMESTAMP
  
Indexes:
  - (tenantId, propertyId)
  - (status, createdAt)
  - transactionId (UNIQUE)
```

### Indexing Strategy
- Primary keys: UNIQUE, CLUSTERED
- Foreign keys: for JOIN performance
- Status columns: for filtering queries
- Dates: for range queries
- Unique fields: for lookups

### Partitioning
- **Payments table:** Partitioned by month (for 3-year retention)
- **Audit logs:** Partitioned by month (for 7-year retention)
- **Others:** No partitioning (smaller tables)

---

## 🔄 API Design Patterns

### Request/Response Format

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "deviceName": "Chrome Mobile"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJh...",
    "refreshToken": "eyJh...",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "role": "landlord"
    }
  },
  "timestamp": "2024-06-24T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "details": {
      "field": "password",
      "reason": "invalid_format"
    }
  },
  "timestamp": "2024-06-24T10:30:00Z"
}
```

### Error Codes

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| INVALID_INPUT | 400 | Validation failed | Check request format |
| UNAUTHORIZED | 401 | Missing/invalid auth | Login again |
| FORBIDDEN | 403 | Not permitted | Check permissions |
| NOT_FOUND | 404 | Resource not found | Verify ID |
| CONFLICT | 409 | Duplicate entry | Check unique fields |
| RATE_LIMITED | 429 | Too many requests | Wait and retry |
| SERVER_ERROR | 500 | Server error | Check logs |

---

## 📊 Data Flow: Payment Example

```
1. Tenant initiates payment
   POST /api/v1/payments/initiate
   └─ Controller receives request
   
2. Validation
   └─ Tenant exists, property valid, amount > 0
   
3. Payment record created
   └─ Status: 'pending'
   └─ Stored in database
   
4. Redirect to payment provider
   └─ Wave or Orange Money
   └─ QR code generated
   └─ User scans QR or clicks link
   
5. User makes payment
   └─ Payment provider handles transaction
   
6. Payment provider sends webhook
   POST /api/v1/webhooks/wave
   └─ Payment status updated to 'confirmed'
   └─ SMS sent to landlord
   └─ Email sent to tenant (receipt)
   
7. Landlord views payment
   GET /api/v1/payments/:id
   └─ Status shown as 'confirmed'
   └─ Receipt available
```

---

## 🚀 Deployment Architecture

### Development Environment
```
Local Machine
├─ Node.js dev server (ts-node)
├─ PostgreSQL (Docker)
├─ Redis (Docker)
└─ Hot reload enabled
```

### Staging Environment
```
AWS (us-east-1)
├─ RDS PostgreSQL (managed)
├─ ElastiCache Redis (managed)
├─ ECS Fargate (containers)
├─ Application Load Balancer
└─ Monitoring & Logging
```

### Production Environment
```
AWS (multiple regions)
├─ Multi-AZ RDS PostgreSQL
├─ Multi-region ElastiCache
├─ Auto-scaling ECS cluster
├─ CloudFront CDN
├─ WAF protection
└─ 24/7 monitoring + alerts
```

### CI/CD Pipeline

```
Git Push
  ↓
GitHub Actions
  ├─ npm install
  ├─ npm run lint
  ├─ npm test (80%+ coverage)
  ├─ npm run build
  ├─ Docker image build
  ├─ Push to ECR
  ├─ Deploy to staging
  ├─ Run E2E tests
  ├─ Manual approval
  └─ Deploy to production
```

---

## 📈 Performance Optimization

### Query Optimization
- Use indexes on foreign keys
- Avoid N+1 queries (use JOINs)
- Pagination for large datasets (limit 100)
- Caching frequent queries in Redis

### Caching Strategy
- **Session cache:** Redis (24 hours)
- **User cache:** Redis (1 hour)
- **Property list:** Redis (5 minutes)
- **Analytics:** Redis (1 hour)
- **Static data:** CloudFront (1 day)

### Database Optimization
- Connection pooling (max 20 connections)
- Query timeouts (30 seconds)
- Slow query logging (>1 second)
- Regular ANALYZE runs
- Monthly VACUUM/REINDEX

### API Response Time Targets
- Auth endpoints: <200ms
- Read endpoints: <100ms
- Write endpoints: <300ms
- Payment webhooks: <5s
- Admin reports: <2s

---

## 🔍 Monitoring & Alerts

### Metrics to Track
- HTTP response times (P50, P95, P99)
- Error rate (errors/second)
- Database query times
- Redis cache hit rate
- Payment webhook processing time
- Active user sessions
- API uptime

### Alerting Thresholds
- Response time > 500ms (P95): WARNING
- Error rate > 1%: CRITICAL
- Database lag > 100ms: WARNING
- Redis memory > 80%: WARNING
- Uptime < 99.9%: CRITICAL

### Logging
- All requests logged (with duration)
- All errors logged with stack trace
- All database queries logged (dev only)
- Payment webhooks logged
- Admin actions logged (audit trail)

---

## 🧪 Testing Strategy

### Unit Tests (80%+ coverage)
- Services (business logic)
- Repositories (queries)
- Utils (helpers)
- Validators (input)

### Integration Tests
- Payment flow end-to-end
- Withdrawal flow end-to-end
- Authentication flow
- Webhook processing

### E2E Tests
- Critical user flows
- Payment processing
- Withdrawal requests
- Admin operations

### Performance Tests
- Load test: 1000 concurrent users
- Stress test: payment under heavy load
- Database performance: large datasets

---

## 🛡️ Security Best Practices

1. **Input Validation:** All inputs validated before processing
2. **SQL Injection:** Use parameterized queries (TypeORM)
3. **XSS Protection:** Helmet headers, input sanitization
4. **CSRF Protection:** SameSite cookies
5. **Rate Limiting:** 100 req/min per IP
6. **HTTPS:** All traffic encrypted
7. **Secrets:** Never commit to Git, use AWS Secrets Manager
8. **Dependencies:** Regular security updates (Snyk)
9. **Code Review:** 2+ approvers before merge
10. **Penetration Testing:** Annual security audit

---

## 📚 Additional Resources

- **API Spec:** See OpenAPI specification
- **Database Queries:** See migration files
- **Configuration:** See .env.example
- **Development:** See README.md
- **Roadmap:** See ROADMAP.md

---

**Last Updated:** 2026-06-24
**Version:** 1.0
