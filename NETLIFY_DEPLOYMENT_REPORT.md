# Netlify deployment report for FORGE

## 1. Root cause of the 404

The deployed Netlify site is a static frontend-only deployment, but this application is built as a split architecture: a static HTML/CSS/JS frontend in `public/` plus an Express + Prisma backend server in `server.js` and a SQLite database. Netlify does not run the Express server in the static deployment. Because the site was being deployed as if it were a self-contained app, there was no backend process running and the frontend assets were not being published from the correct directory. The result was a standard Netlify 404 for routes and assets that were never generated at the static publish root.

## 2. Current deployment architecture

Current implementation before fix:

- Frontend: static files in `public/`
- Backend: Express server in `server.js`
- Database: SQLite configured via Prisma in `prisma/schema.prisma`
- Local dev: same origin at `http://localhost:5000`
- Production intent: separate frontend + separate API/backend

This is not compatible with Netlify hosting the frontend alone unless the API is moved to a separate Node host and the frontend is configured to call the API URL explicitly.

## 3. Required production architecture

Preferred architecture:

- Netlify: frontend static site
- Render/Railway/Fly.io/etc.: Node API + Prisma + PostgreSQL
- Browse to Netlify URL for the UI
- API calls go to the deployed backend URL

Local development keeps the same-origin backend at `http://localhost:5000`.

## 4. Files that need to change

- `server.js` — production-safe CORS and health checks
- `public/app.js` — centralized API base URL helper, no hardcoded localhost in production code
- `public/index.html` — loads the generated config script before app logic
- `public/config.js` — generated runtime API base URL for frontend
- `prisma/schema.prisma` — remains Prisma-compatible, with PostgreSQL production URL support via `DATABASE_URL`
- `.env.example` — local + deployment variable examples
- `netlify.toml` — correct publish directory and redirects
- `.gitignore` — ignore `.env`, secrets, and database files
- `scripts/write-config.js` — generate `public/config.js` during build

## 5. Backend deployment requirements

The backend must be deployed separately on a real Node host. Requirements:

- Node.js 18+
- `npm install`
- `npx prisma generate`
- `npx prisma db push`
- `PORT` from environment
- `JWT_SECRET` from environment
- `DATABASE_URL` for PostgreSQL in production
- `FRONTEND_URL` allowed in CORS
- `/api/health` must return HTTP 200

Do not run the Express server as a Netlify function or a long-lived background server on Netlify.

## 6. Database deployment requirements

SQLite is acceptable for local development only.

Production database requirements:

- PostgreSQL (recommended)
- Prisma datasource uses `DATABASE_URL`
- No committed local SQLite file such as `dev.db`
- Multi-user data remains isolated by `userId` on every table

## 7. Environment variables required

Local development:

- `DATABASE_URL="file:./dev.db"`
- `JWT_SECRET="..."`
- `PORT=5000`
- `FRONTEND_URL="http://localhost:5000"`
- `FORGE_API_URL="http://127.0.0.1:5000"`

Production backend:

- `DATABASE_URL="postgresql://..."`
- `JWT_SECRET="...long-random-secret..."`
- `PORT=3000` or provider default
- `FRONTEND_URL="https://your-netlify-site.netlify.app"`

Production frontend (Netlify):

- `FORGE_API_URL="https://your-backend-domain.example.com"`

Do not expose database credentials or JWT secrets in browser code.

## 8. Frontend API URL requirements

The frontend must not assume same-origin API calls in production. All frontend requests should go through a single helper that reads a configured value such as `window.FORGE_API_URL` and prefixes requests to it.

This prevents API calls from accidentally targeting `localhost:5000` after deploy.

## 9. Netlify configuration requirements

Netlify must be configured to publish the static frontend directory and to serve a SPA fallback:

- Build command: `npm install && npx prisma generate && npm run build`
- Publish directory: `public`
- Redirect: `/*` -> `/index.html` with status 200

The generated `public/config.js` must be included before `public/app.js` so the runtime knows which backend URL to use.

## 10. Implementation summary

The app was fixed to support the intended deployment model by:

- keeping the Express backend for local development and production API hosting
- adding a production-safe CORS policy
- adding a health endpoint that checks database availability
- centralizing frontend API base URL resolution
- generating `public/config.js` from the environment at build time
- adding Netlify publish configuration for the static frontend

This preserves the existing FORGE interface and makes deployment architecture correct without redesigning the UI.
