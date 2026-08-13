# Plateforme Gestion des Loyers - Development Roadmap

Complete development plan from MVP to full product.

## 📋 Table of Contents
1. [MVP (Phase 1)](#mvp-phase-1)
2. [Phase 2: Enhanced Features](#phase-2-enhanced-features)
3. [Phase 3: Advanced Features](#phase-3-advanced-features)
4. [Phase 4: Expansion](#phase-4-expansion)
5. [Technical Debt & Maintenance](#technical-debt--maintenance)

---

## MVP (Phase 1)
**Timeline:** 4 months (Weeks 1-16)
**Status:** Foundation - CRITICAL FEATURES ONLY

### Sprint 1-2: Infrastructure & Setup (Weeks 1-4)

#### Week 1-2: Foundation
- [ ] Database schema creation (all MVP tables)
- [ ] Express.js boilerplate
- [ ] TypeORM setup with PostgreSQL
- [ ] Redis connection
- [ ] Environment configuration
- [ ] Logging system (Winston)
- [ ] Error handling middleware
- [ ] Request/response formatting

**Deliverables:**
- Working Express server on port 3000
- Connected to PostgreSQL & Redis
- CI/CD pipeline skeleton (GitHub Actions)
- Database migrations working

#### Week 3-4: Authentication System
- [ ] User model (TypeORM entity)
- [ ] Registration endpoint (POST /auth/register)
- [ ] Login endpoint (POST /auth/login)
- [ ] JWT token generation & validation
- [ ] Refresh token logic
- [ ] 2FA SMS integration (Twilio)
- [ ] Password hashing (bcrypt)
- [ ] Auth middleware

**API Endpoints:**
```
POST /api/v1/auth/register
  - email, phone, password, name, role
  - Validation (email unique, strong password)
  - Send verification SMS
  
POST /api/v1/auth/login
  - email, password
  - Return JWT + refresh token
  
POST /api/v1/auth/2fa-verify
  - userId, otp_code
  - Validate SMS code
  
POST /api/v1/auth/refresh
  - refresh_token
  - Return new access token
```

**Tests:** Unit tests for auth service (80%+ coverage)

---

### Sprint 3-4: Core Landlord APIs (Weeks 5-8)

#### Week 5-6: Property Management
- [ ] Property model (TypeORM entity)
- [ ] Create property endpoint
- [ ] List properties endpoint (with pagination)
- [ ] Get property details endpoint
- [ ] Update property endpoint
- [ ] Delete property endpoint
- [ ] Authorization checks (only owner can edit)

**API Endpoints:**
```
POST /api/v1/properties
  - address, numberOfApartments, rentAmounts[]
  - Authorization: landlord only
  
GET /api/v1/properties
  - Query: limit, offset, status
  - Returns paginated list
  
GET /api/v1/properties/:id
  - Returns property details + tenant info
  
PUT /api/v1/properties/:id
  - Update address, apartment count, etc.
  
DELETE /api/v1/properties/:id
  - Soft delete (archive)
```

#### Week 7-8: Tenant Management
- [ ] Tenant-Property Mapping model
- [ ] Add tenant endpoint
- [ ] List tenants for property endpoint
- [ ] Update tenant info endpoint
- [ ] Archive tenant endpoint
- [ ] Tenant validation (email, phone)

**API Endpoints:**
```
POST /api/v1/properties/:id/tenants
  - tenantEmail, tenantPhone, apartmentNumber, rentAmount, dueDate
  
GET /api/v1/properties/:id/tenants
  - Returns all tenants for property
  
PUT /api/v1/properties/:id/tenants/:tenantId
  - Update rent amount, due date, etc.
  
DELETE /api/v1/properties/:id/tenants/:tenantId
  - Archive tenant
```

**Dashboard Endpoint:**
```
GET /api/v1/landlord/dashboard
  - totalCollected (this month)
  - totalProperties
  - totalTenants
  - pendingPayments
  - outstandingBalance
```

---

### Sprint 5: Payment Integration - Phase 1 (Weeks 9-10)

#### Payment Initiation
- [ ] Payment model (TypeORM entity)
- [ ] Payment initiation endpoint
- [ ] Wave API integration (test environment)
- [ ] Orange Money API integration (test environment)
- [ ] QR code generation
- [ ] Payment link generation

**API Endpoints:**
```
POST /api/v1/payments/initiate
  - propertyId, tenantId
  - provider: 'wave' | 'orange' | 'mtn'
  - Returns: redirectUrl, qrCode, paymentId
  
GET /api/v1/payments/:id
  - Returns payment status
```

#### Webhook Handlers
- [ ] Wave webhook receiver
- [ ] Orange Money webhook receiver
- [ ] Signature validation (HMAC)
- [ ] Payment confirmation logic
- [ ] Error handling & retry
- [ ] SMS notification to landlord

**Webhooks:**
```
POST /api/v1/webhooks/wave
  - Receive: transactionId, amount, status, timestamp
  - Validate: HMAC signature
  - Update: payment status in DB
  - Notify: landlord via SMS
  
POST /api/v1/webhooks/orange
  - Same as Wave
```

**Tests:** Integration tests for payment flow

---

### Sprint 6: Withdrawal System (Weeks 11-12)

#### Withdrawal Requests
- [ ] Withdrawal model (TypeORM entity)
- [ ] Request withdrawal endpoint
- [ ] List withdrawals endpoint
- [ ] Withdrawal status tracking
- [ ] Fee calculation (1% platform + bank fees)
- [ ] Bank account validation

**API Endpoints:**
```
POST /api/v1/withdrawals
  - amountRequested
  - bankAccountId
  - Returns: fees breakdown, netAmount, estimatedTime
  
GET /api/v1/withdrawals
  - Query: status, dateRange
  - Returns: paginated list
  
GET /api/v1/withdrawals/:id
  - Returns withdrawal details + status
```

#### Bank Integration (Stub for now)
- [ ] Bank API integration skeleton
- [ ] Mock withdrawal processing
- [ ] Status tracking (pending → processing → completed)
- [ ] Email notifications

---

### Sprint 7: Frontend Tenant Access (Weeks 13-14)

#### Tenant Endpoints
- [ ] Tenant login (simplified)
- [ ] Get rent info endpoint
- [ ] Get payment history endpoint
- [ ] Receipt generation (PDF)

**API Endpoints:**
```
GET /api/v1/tenant/me
  - Returns: currentRent, dueDate, lastPayment, balance
  
GET /api/v1/tenant/history
  - Returns: paginated payment history with receipts
  
GET /api/v1/tenant/receipt/:paymentId
  - Returns: PDF receipt download
```

---

### Sprint 8: Testing & Deployment (Weeks 15-16)

#### Testing
- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests (payment flow, withdrawals)
- [ ] API endpoint tests (Postman collection)
- [ ] Load testing (1000 concurrent users)
- [ ] Security testing (OWASP Top 10)

#### Deployment
- [ ] Docker image creation
- [ ] AWS ECS setup
- [ ] CI/CD pipeline finalization
- [ ] Staging environment
- [ ] Production deployment
- [ ] Monitoring setup (DataDog)
- [ ] Backup strategy

#### Documentation
- [ ] API documentation (Swagger)
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## Phase 2: Enhanced Features
**Timeline:** 8 weeks (Months 5-6)
**Status:** Improvements & Scaling

### 2.1: Advanced Payment Features

#### Partial Payments
```typescript
// Allow tenant to pay 50% now, 50% later
POST /api/v1/payments/partial
  - propertyId, tenantId, amountToPay
  - remainingAmount scheduled for later
  - Email reminders for second payment
```

#### Payment Dispute Resolution
```typescript
// Tenant claims payment failed
POST /api/v1/disputes
  - paymentId, reason, evidence (screenshot)
  - Manual review by support
  - Auto-refund or escalation
```

#### Multi-currency Support
```typescript
// For international landlords
GET /api/v1/exchange-rates
  - XOF ↔ USD ↔ EUR
  - Real-time rates
  - Historical data
```

### 2.2: Debt Management System

#### Payment Tracking & Arrears
```typescript
// Track overdue payments
GET /api/v1/properties/:id/arrears
  - daysOverdue, amountOwed, tenantName
  - Color coding: red (90+ days), orange (30+), green (current)
  
POST /api/v1/arrears/:paymentId/interest
  - Apply late fees
  - Configurable interest rate
```

#### Automated Reminders
```typescript
// Schedule payment reminders
POST /api/v1/reminders/schedule
  - 7 days before due
  - 3 days before due
  - Due date
  - Overdue: 7, 30, 90 days
  
SMS/Email templates implemented
```

### 2.3: Analytics Dashboard

```typescript
GET /api/v1/landlord/analytics
  - collectionRate (% of tenants paid on time)
  - averagePaymentTime
  - outstandingDebts
  - revenue by property
  - trending data (graphs)
  
GET /api/v1/landlord/compare
  - Compare with similar properties
  - Benchmark against city average
  - Risk prediction (ML model)
```

### 2.4: Admin & Compliance

#### KYC/AML Enhanced
```typescript
POST /api/v1/admin/kyc/verify/:userId
  - Manual identity verification
  - Document upload & validation
  - Risk scoring
  - Sanctions list checking
  
GET /api/v1/admin/aml-alerts
  - List suspicious transactions
  - Auto-flag if > 500k FCFA
  - Escalation workflow
```

#### Audit Logging
```typescript
GET /api/v1/admin/audit-logs
  - All user actions logged
  - IP address, timestamp, changes
  - Export for compliance
```

---

## Phase 3: Advanced Features
**Timeline:** 8 weeks (Months 7-9)
**Status:** Premium Features & Scaling

### 3.1: Insurance & Protection

#### Default Insurance
```typescript
// Landlord can insure against non-payment
POST /api/v1/insurance/purchase
  - propertyId, tenantId
  - coverage: 1 month rent
  - premium: 3% of monthly rent
  - claims process documented
```

### 3.2: Property Manager Integration

#### Marketplace
```typescript
// Landlord can delegate to property manager
POST /api/v1/marketplace/managers
  - Register property manager
  - Pricing: 5-10% commission
  - Reviews & ratings
  
GET /api/v1/marketplace/managers
  - Search by location, experience
  - Booking & delegation flow
```

### 3.3: Advanced Analytics & ML

#### Predictive Models
```typescript
GET /api/v1/analytics/risk-score/:tenantId
  - Probability of default
  - Risk factors
  - Recommended actions
  
// Historical data analysis
- Collection patterns by neighborhood
- Seasonal trends
- Economic indicators
```

### 3.4: White-Label Solutions

```typescript
POST /api/v1/partners/agencies
  - Register real estate agency
  - Branded subdomain
  - Commission structure
  - Client management tools
```

---

## Phase 4: Expansion
**Timeline:** Ongoing (Months 10+)
**Status:** Growth & New Markets

### 4.1: Geographic Expansion

#### New Countries
```
Timeline:
- Senegal: Month 10
- Mali: Month 12
- Burkina Faso: Month 14
- Others: Year 2

For each country:
- New payment providers (local mobile money)
- Language support
- Compliance (local regulations)
- Local support team
```

### 4.2: Rental Management

#### Full Property Management Suite
```typescript
// Maintenance tracking
POST /api/v1/maintenance/report
  - Issue type, severity
  - Photo upload
  - Assignment to contractor
  - Status tracking

// Tenant screening
GET /api/v1/screening/credit-check
  - Credit score
  - Rent history
  - References verification
```

### 4.3: Investment Platform

#### Marketplace for Investors
```typescript
// Property listing for short-term rentals (Airbnb-style)
POST /api/v1/investment/listings
  - List property for booking
  - Automated reservation management
  - Commission: 8-12%
  
// Passive income for landlords
- Monthly payout reports
- Tax documentation
- Investment analytics
```

---

## Technical Debt & Maintenance

### Regular Tasks (Monthly)
- [ ] Dependency updates (security patches)
- [ ] Database optimization (analyze slow queries)
- [ ] Performance review (response times)
- [ ] Security audit (OWASP)
- [ ] Backup verification (restore test)

### Quarterly Reviews
- [ ] Architecture review
- [ ] Code quality metrics
- [ ] Load testing
- [ ] Disaster recovery drill
- [ ] User feedback implementation

### Annual Tasks
- [ ] Penetration testing
- [ ] Compliance audit (KYC/AML)
- [ ] SOC2 certification renewal
- [ ] Infrastructure upgrade
- [ ] Strategic planning

---

## Success Metrics

### MVP (Phase 1)
- ✅ 50 API endpoints working
- ✅ 100 propriétaires + 1000 locataires
- ✅ 500k FCFA monthly transactions
- ✅ 99.9% uptime
- ✅ <2s response time
- ✅ 0 security vulnerabilities

### Phase 2
- ✅ 200 proprietaires
- ✅ 50M FCFA monthly transactions
- ✅ Analytics dashboard active
- ✅ <50ms response time (P95)

### Phase 3
- ✅ 400+ propriétaires
- ✅ 200M+ monthly transactions
- ✅ ML models deployed
- ✅ Insurance partnerships signed

### Phase 4
- ✅ 3+ countries
- ✅ 1000+ propriétaires
- ✅ 1B+ FCFA annual transactions
- ✅ Profitabilité operationnelle

---

## Implementation Notes

### For each feature:
1. Write specification in this file
2. Create GitHub issue
3. Design database schema changes
4. Write API spec (OpenAPI)
5. Implement backend
6. Write tests (80%+ coverage)
7. Create frontend requirements
8. Deploy to staging
9. Performance test
10. Production deployment

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint + Prettier
- Unit tests: 80%+ coverage
- Integration tests for critical flows
- Code review: 2+ approvers
- No direct main branch commits

### Performance Standards
- API response: <200ms (P95)
- Database queries: <100ms (P95)
- Payment webhooks: <5s processing
- Uptime: 99.9% monthly

---

## Questions?

For implementation questions or clarifications:
1. Check ARCHITECTURE.md for technical details
2. Review API specification in OpenAPI format
3. Check GitHub issues for current work
4. Ask in team Slack channel

**Last Updated:** 2026-06-24
**Maintained By:** Development Team
