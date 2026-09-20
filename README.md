# FORGE — Production Multi-User Build

This rebuild keeps the visual direction of the uploaded Aura references but deliberately gives each workspace its own composition:

- **Today:** dense command-center / admin composition
- **Fitness:** training workspace with exercise library + set logger + rest timer
- **Nutrition:** editorial fuel/macro workspace
- **Study:** subject/block logging workspace
- **Focus:** distraction-free timer console
- **Placement:** six-lane pipeline
- **Salah:** prayer control surface with calculated times
- **Wellness:** visual timeline / photo entries
- **Analytics:** reporting/data table
- **Coach Forge:** data-context conversation workspace
- **Settings:** personalization/control panel

## Multi-user data isolation

Authentication is email/password with bcrypt hashing and JWT sessions. Every business table contains `userId`, and every API query is scoped to the authenticated user. There are no seeded demo metrics, meals, workouts, tasks, placements, prayers or wellness records.

## Run on Windows

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:

```bat
npm install
copy .env.example .env
npx prisma generate
npx prisma db push
npm start
```

Open `http://localhost:5000`.

For development:

```bat
npm run dev
```

## Production deployment

The default database is SQLite for zero-configuration local use. For a hosted multi-user deployment, use a managed PostgreSQL database and change the Prisma datasource provider/url accordingly, then run `prisma db push` (or migrations in a controlled production workflow). Set a strong `JWT_SECRET`.

The frontend and API are served by the same Express process, so there is no CORS dependency.

## Important data behavior

- No fake values are inserted.
- New accounts start empty.
- User customization is stored in the database.
- JSON export contains the authenticated user's data only.
- Wellness photos are stored as data URLs for simple deployment; for serious production usage, replace this with object storage (S3/R2/etc.) while retaining the same `WellnessEntry` ownership model.
- Coach Forge currently uses a deterministic, data-grounded local coaching engine. The API boundary is isolated so an OpenAI-compatible provider can be plugged in without redesigning the UI.
- Salah uses a local astronomical calculation based on the selected city's coordinates. The schedule is recalculated on refresh instead of merely adding a visual offset.

## API groups

`/api/auth`, `/api/settings`, `/api/metrics`, `/api/tasks`, `/api/exercises`, `/api/workouts`, `/api/meals`, `/api/focus`, `/api/study`, `/api/placements`, `/api/wellness`, `/api/salah`, `/api/coach`, `/api/export`, `/api/health`.
