# ts-express-api

A production-grade **TypeScript + Express 5** REST API — a URL shortener with click analytics. Built to demonstrate strict TypeScript, layered architecture, JWT auth, Prisma + PostgreSQL, Zod validation, and a fully green test suite.

## Architecture

```
src/
├── server.ts            # entrypoint: loads env, builds Prisma repos, starts Express
├── app.ts               # createApp(dependencies) — dependency-injected Express factory
├── routes/              # auth-routes, url-routes (thin, validation + wiring only)
├── controllers/         # translate HTTP <-> service calls, shape JSON responses
├── services/            # business logic: AuthService, UrlService
├── repositories/        # interfaces + Prisma implementations (swappable)
├── middleware/          # requireAuth (JWT), validate (Zod), error-handler, request-logger
├── schemas/             # Zod request schemas
├── lib/                 # jwt, password (bcrypt), errors, prisma client
└── __tests__/           # 25 vitest + supertest tests (in-memory repositories)
```

The app factory takes repository interfaces as dependencies, so the HTTP layer is tested with fast in-memory fakes — no database needed for `npm test`.

## API endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/health` | – | Liveness probe |
| POST | `/api/auth/register` | – | Register `{email, password}` → 201 `{user, token}` |
| POST | `/api/auth/login` | – | Login → 200 `{user, token}` |
| GET | `/api/urls?page=&limit=&search=&isActive=` | Bearer | List own URLs, paginated |
| POST | `/api/urls` | Bearer | Shorten `{targetUrl, customAlias?}` → 201 |
| GET | `/api/urls/:id` | Bearer | Fetch one URL |
| PATCH | `/api/urls/:id` | Bearer | Update `targetUrl` / `isActive` |
| DELETE | `/api/urls/:id` | Bearer | Delete → 204 |
| GET | `/api/urls/:id/analytics` | Bearer | Click stats `{totalClicks, lastClickedAt, clicksByDay}` |
| GET | `/r/:code` | – | 302 redirect, records a click |

Errors are JSON: `{ error: { code, message }, requestId }` with 400 / 401 / 404 / 409 codes.

## Run locally

```bash
npm install
cp .env.example .env   # set JWT_SECRET and DATABASE_URL
npx prisma migrate deploy
npm run dev            # or: npm run build && npm start
```

## Run with Docker

```bash
docker compose up --build   # api on :3000, postgres on :5432
```

## Tests

```bash
npm test   # 25 vitest + supertest tests, all passing (in-memory repositories)
```

## Notes

- Strict TypeScript (`strict: true`, no implicit `any`).
- Passwords hashed with bcrypt; JWTs signed with HS256.
- Short codes: 8-char random by default, or a custom 4–32 char alias.
- Inactive or unknown codes return 404 on redirect.
