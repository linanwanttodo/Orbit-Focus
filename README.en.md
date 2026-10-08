# Orbit Focus - Full-Stack Focus Timer and Task Board

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="client/public/home-dial.webp" alt="Orbit Focus focus dial" width="220">
</p>

Orbit Focus is a React + TypeScript full-stack productivity app with a focus countdown, future-date reminders, a task board and statistics, plus account login that exists in code but is currently hidden in the UI.

This release **stores data in the browser only**: everything lives in versioned localStorage and no request is ever sent to a server. The backend API and the frontend login logic are fully kept in the repository (`api/core/`, `AuthContext`, `AuthDialog`); only the sign-in entry point is hidden, ready to be re-enabled once authentication is configured.

The GitHub OAuth and QQ number/password login code for cloud mode is kept in the repository as well.

## Tech stack

### Frontend

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Light and dark themes
- Chinese, English and Russian
- Digital clock and flip clock

### Backend

- Platform-agnostic API core: `api/core/`
- Cloudflare Workers + D1
- Express + SQLite/PostgreSQL
- GitHub OAuth + HS256 JWT
- Per-user data isolation

## Page structure

Top navigation:

```text
Home | Focus | Stats | Settings
```

Secondary navigation on the Focus page:

```text
Time | Countdown | Future | Todo
```

- `Countdown` is the timer's custom countdown
- `Future` holds important dates and target-day reminders
- `Todo` shows the task board by default
- Settings lets you switch between the task board and a simple checklist

## Features

- Digital clock / flip clock, with system landscape lock plus a gyroscope CSS-rotation fallback on phones and tablets
- Custom countdown computed from an absolute deadline
- A naturally finished countdown records one focus session automatically
- Future dates: exams, deadlines, target days
- Three-column task board: todo, in progress, done
- Task descriptions, drag to change status
- Today's focus, weekly total, streak and a yearly heatmap
- Statistics use the visitor's browser timezone for calendar days
- Browser-only storage, usable without signing in
- GitHub OAuth and QQ number/password login implemented on the backend (UI entry point currently hidden)
- Docker self-hosting

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The app works out of the box with no backend configuration. To re-enable login, restore
`<AuthButton />` in `App.tsx` as described in the [architecture notes](docs/architecture.md),
and set `JWT_SECRET` in `server/.env` (on Cloudflare use `wrangler secret put`).

## Validation and tests

```bash
npm run validate
npm test
npm run build
```

## Cloudflare deployment

The project uses the D1 binding `orbit_focus_db` from `wrangler.toml`.

Because the current database uses a fresh schema with no historical migration, the
recommended deployment is to delete the old empty D1 database and recreate it:

```bash
npx wrangler d1 delete orbit_focus_db
npx wrangler d1 create orbit_focus_db
npx wrangler d1 execute orbit_focus_db --remote --file=./api/cloudflare/schema.sql
npx wrangler secret put JWT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npm run build
npx wrangler deploy
```

The GitHub OAuth App callback URL:

```text
https://<worker-domain>/api/auth/github/callback
```

Post-deployment check:

```bash
curl https://<worker-domain>/api/health
```

See the [deployment guide](docs/deployment.md) for the full steps.

## Docker self-hosting

```bash
cp .env.docker.example .env
# edit .env, at minimum set JWT_SECRET
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

The SQLite file is stored on the host at `./data/orbit-focus.db` by default; you can switch
to PostgreSQL in `.env`.

See [Docker self-hosting](docs/docker-deployment.md) for the full steps.

## Documentation

The reference docs are written in Chinese.

| Document | Contents |
|---|---|
| [Local development](docs/development.md) | Environment, running, testing and debugging |
| [Architecture](docs/architecture.md) | Data model, authentication, API, timer and frontend structure |
| [Deployment](docs/deployment.md) | Cloudflare D1, Express and database initialization |
| [Docker](docs/docker-deployment.md) | Self-hosting, OAuth, backup and operations |

## Data notes for this version

This version does not migrate old databases or old localStorage data. When upgrading from an
older version, back up first, then delete the old database in a test environment and recreate
it with the latest schema.

## License

MIT
