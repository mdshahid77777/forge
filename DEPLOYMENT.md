# FORGE deployment guide

## 1. GitHub repository setup

1. Create a GitHub repository.
2. Commit the project.
3. Push the repository to GitHub.

## 2. Netlify frontend deployment

### Netlify settings

- Build command: `npm install && npx prisma generate && npm run build`
- Publish directory: `public`
- Node version: 18+
- Environment variables:
  - `FORGE_API_URL=https://your-backend-domain.example.com`

### Netlify build behavior

The project publishes the static frontend from `public/` and uses the generated `public/config.js` file to point API requests at the correct backend domain.

## 3. Backend deployment

Choose a Node host such as Render, Railway, Fly.io, or another provider that supports long-running Node servers.

### Example Render settings

- Build command: `npm install && npx prisma generate`
- Start command: `npm start`
- Environment variables:
  - `DATABASE_URL=postgresql://...`
  - `JWT_SECRET=...`
  - `FRONTEND_URL=https://your-netlify-site.netlify.app`
  - `PORT=10000` or provider default

## 4. PostgreSQL database

Use a managed PostgreSQL database in production.

### Prisma initialization

Run the following commands on the production backend environment:

```powershell
npm install
npx prisma generate
npx prisma db push
```

## 5. Environment variables

### Backend

```powershell
$env:DATABASE_URL="postgresql://user:password@host:5432/dbname"
$env:JWT_SECRET="replace-with-a-long-random-secret"
$env:FRONTEND_URL="https://your-netlify-site.netlify.app"
$env:PORT="3000"
```

### Frontend (Netlify)

```powershell
FORGE_API_URL=https://your-backend-domain.example.com
```

## 6. CORS

The backend must allow requests from the Netlify frontend only. The app uses `FRONTEND_URL` to explicitly allow the deployed frontend origin while keeping the rest blocked.

## 7. First deployment

1. Deploy the backend first.
2. Confirm `/api/health` returns HTTP 200.
3. Deploy the Netlify frontend and set `FORGE_API_URL`.
4. Verify the UI loads and the browser network tab shows API calls to the backend URL, not to `localhost:5000`.

## 8. Local development commands

Run these from the project root:

```powershell
npm install
copy .env.example .env
npx prisma generate
npx prisma db push
npm start
```

Then visit:

- `http://localhost:5000`
- `http://localhost:5000/api/health`

## 9. Production database initialization

On the backend host, run:

```powershell
npm install
npx prisma generate
npx prisma db push
```

## 10. Testing production API

Check the deployed backend:

```powershell
curl https://your-backend-domain.example.com/api/health
```

Expected result:

```json
{ "ok": true, "service": "FORGE" }
```

## 11. Testing production frontend

1. Open the Netlify URL.
2. Register a new account.
3. Log in.
4. Confirm requests go to the configured backend URL.
5. Verify the UI remains the same design and all sections remain available.

## 12. Frontend build command

```powershell
npm install
npm run build
```

## 13. Production notes

- Keep the UI design unchanged.
- Do not add fake data.
- Do not hardcode `localhost` in production frontend code.
- Ensure every API request uses a centralized base URL helper.
