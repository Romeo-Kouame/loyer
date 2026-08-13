# Contributing Guide

## Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create feature branch: `git checkout -b feature/your-feature`

## Development

```bash
npm run dev      # Start dev server
npm test         # Run tests
npm run lint     # Check code quality
npm run format   # Auto-format code
```

## Commit Convention

Use conventional commits:
```
feat: add new feature
fix: fix a bug
docs: update documentation
test: add tests
refactor: refactor code
perf: improve performance
```

## Code Quality

- ESLint must pass: `npm run lint`
- Tests must pass: `npm test`
- Coverage must be > 80%
- TypeScript strict mode enabled

## Pull Request

1. Create PR against `main` branch
2. Fill PR template
3. Wait for CI/CD to pass
4. Request review from 2+ maintainers
5. Merge only after approval

## Reporting Bugs

Create an issue with:
- Clear title
- Reproduction steps
- Expected vs actual behavior
- Environment info
- Screenshots if applicable

---

For questions, contact the team.
