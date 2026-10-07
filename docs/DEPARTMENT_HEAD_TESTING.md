# Department Head Dashboard Testing

The dashboard tests run without a MySQL server. Backend API tests use real Express routes, JWT verification, role/permission middleware, and dashboard controllers with mocked Sequelize models. Frontend tests use Jest, React Testing Library, and mocked HTTP responses. Existing Node.js backend regression tests remain available as a separate command.

## Run the focused suites

From the repository root:

```sh
npm run test:backend:dashboard
npm run test:frontend:dashboard
```

Run the backend regression suite:

```sh
npm test
```

Run the complete frontend test suite:

```sh
npm --prefix frontend test -- --runInBand --watchAll=false
```

## Coverage

Generate HTML, LCOV, and terminal coverage for the dashboard suites:

```sh
npm --prefix backend run test:dashboard -- --coverage
npm --prefix frontend test -- --runInBand --coverage --watchAll=false --runTestsByPath src/components/department/DeptDashboard.test.jsx src/__tests__/authFlow.test.js
```

Reports are written to `backend/coverage` and `frontend/coverage`. The GitHub Actions workflow uploads both reports as the `dashboard-coverage` artifact.

## Test scope

- Frontend: dashboard loading, KPI rendering, chart datasets, activity table, responsive CSS rules, errors including request timeout/401/403, activity search, action/status filters, selectable sorting, pagination, and protected-route authentication/role behavior.
- Backend: valid/missing/invalid/tampered JWTs, role and department-scope authorization, KPI/chart/activity response shapes, department isolation, injection-shaped query input, nested asset scoping, activity ordering, and a 500 ms mocked-DB endpoint budget.
- The frontend smoke test checks the initial dashboard render against a two-second budget. These local/mock performance checks are regression guards, not substitutes for load testing against a production-like MySQL dataset.
