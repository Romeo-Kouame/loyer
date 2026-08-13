# Testing Guide

## Test Structure

```
tests/
├── unit/           # Single function/method tests
├── integration/    # Feature/flow tests
└── e2e/           # Full user journey tests
```

## Unit Tests

Test individual functions in isolation.

```typescript
// tests/unit/auth.service.test.ts
import { AuthService } from '../../src/services/auth.service';

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'SecurePassword123';
      const hash = await AuthService.hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should hash different for same input', async () => {
      const password = 'SecurePassword123';
      const hash1 = await AuthService.hashPassword(password);
      const hash2 = await AuthService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Different salts
    });
  });
});
```

## Integration Tests

Test features/flows.

```typescript
// tests/integration/auth.integration.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('Auth Flow', () => {
  it('should register and login user', async () => {
    // Register
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'user@example.com',
        phone: '+22512345678',
        password: 'SecurePassword123',
        name: 'User',
        role: 'landlord'
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.user.email).toBe('user@example.com');

    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'SecurePassword123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();
  });
});
```

## E2E Tests

Test complete user journeys.

```typescript
// tests/e2e/payment.e2e.test.ts
describe('Payment Flow E2E', () => {
  it('should complete full payment journey', async () => {
    // 1. Landlord creates property
    // 2. Landlord adds tenant
    // 3. Tenant initiates payment
    // 4. Payment provider webhook arrives
    // 5. Verify payment confirmed in DB
  });
});
```

## Coverage Requirements

- **Unit Tests:** 80%+
- **Integration Tests:** All critical flows
- **E2E Tests:** All user journeys

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/index.html
```

## Running Tests

```bash
# All tests
npm test

# Specific file
npm test auth.service

# Specific test
npm test -t "should hash password"

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# One test
npm test -- --testNamePattern="should hash password"
```

## Mocking

Mock external dependencies:

```typescript
// Mock database
jest.mock('../../src/repositories/user.repository');

// Mock external API
jest.mock('axios');

// Use in test
mockUserRepository.findById.mockResolvedValue(user);
mockAxios.post.mockResolvedValue({ data: {...} });
```

## Best Practices

1. **Test behavior, not implementation**
2. **One assertion per unit test** (keep it focused)
3. **Use descriptive names** ("should return error if email exists")
4. **Setup/Teardown** for database state
5. **Mock external dependencies** (APIs, databases)
6. **Test edge cases** (empty strings, null, etc)
7. **Don't test third-party libraries** (test your integration only)

---

For detailed examples, check the test files in `tests/`.
