# FORGE Render deployment guide

## 1. Project architecture

This repository is a single Node + Express app that serves the frontend from `public/` and exposes the API from the same Render web service. The application uses Prisma and is configured for PostgreSQL in production.

## 2. Render service settings

Use a single Render Web Service with the following settings:

- Build command: `npm install && npx prisma generate`
- Start command: `node server.js`
- Node version: 18+
- Health check path: `/api/health`

## 3. PostgreSQL database setup

Create a Render PostgreSQL database and copy its internal connection string into the web service environment variables.

Required environment variables:

- `DATABASE_URL=postgresql://...` from the Render PostgreSQL service
- `JWT_SECRET=replace-with-a-long-random-secret`
- `PORT=10000` (Render usually sets this automatically; you can leave it unset)
- `FRONTEND_URL=https://your-render-app.onrender.com` if you want a specific allowed origin

## 4. Local environment

Use a local PostgreSQL instance for development if you want parity with production. A safe example is:

```env
DATABASE_URL="postgresql://forge_user:replace_with_password@localhost:5432/forge?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=5000
FRONTEND_URL="http://localhost:5000"
FORGE_API_URL=""
```

The app does not hardcode localhost for production. The frontend is designed to use the same-origin API routes by default, which is appropriate for a single Render web service.

## 5. Prisma setup

From the project root:

```powershell
npm install
npx prisma generate
npx prisma db push
```

The Prisma schema is configured for PostgreSQL using the `DATABASE_URL` environment variable.

## 6. Deployment steps

1. Push this repository to GitHub.
2. Create a Render Web Service linked to the repository.
3. Set the Build Command to `npm install && npx prisma generate`.
4. Set the Start Command to `node server.js`.
5. Add the Render PostgreSQL connection string as `DATABASE_URL`.
6. Add `JWT_SECRET`.
7. Deploy the service.
8. Confirm `/api/health` returns HTTP 200.

## 7. Health check

The app exposes:

```http
GET /api/health
```

Expected response:

```json
{ "ok": true }
```

## 8. Local testing

```powershell
npm install
copy .env.example .env
npx prisma generate
npm start
```

Then test:

- `http://localhost:5000/`
- `http://localhost:5000/api/health`
- `http://localhost:5000/api/auth/register` and `http://localhost:5000/api/auth/login`

## 9. Important notes

- Do not commit `.env` or any secrets.
- Keep API calls as relative paths such as `/api/auth/login` when the frontend and backend are served from the same service.
- Keep the existing FORGE UI unchanged.
- Use `DATABASE_URL` from environment variables only.
- The app listens on `0.0.0.0` for Render compatibility.
