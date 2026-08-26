# Team Task Manager

Usage: start here when you want to run or understand the project structure.

Team Task Manager is a production-oriented PERN project for managing teams,
projects, tasks, comments, authentication, role-based access, and task
assignment.

Stack:

- PostgreSQL
- Express
- React
- Node
- Raw SQL with `pg`
- React Hook Form + Zod on the frontend
- Zod validation on the backend

No ORM. No Prisma. No Sequelize. No Knex.

## Current Feature Set

- JWT register/login
- Team list, create, and detail with members
- Project list, create, edit, and archive
- Task list, create, edit, status updates, filters, and assignee updates
- Comment list, create, edit, and delete
- Raw SQL migrations, joins, indexes, transactions, and connection pooling
- API smoke test covering the core local workflow

## Project Structure

```text
.
├── client/              React + Vite frontend
├── server/              Express + Node backend
│   ├── db/migrations/   Raw SQL migration files
│   └── src/             Backend source code
├── docs/                Architecture and implementation notes
├── docker-compose.yml   Local PostgreSQL database
└── INTERVIEW_LOG.md     Personalized interview study log
```

There is no root `package.json` on purpose. The frontend and backend are separate
apps, so each one owns its own dependencies and scripts.

## Local Database

From the project root:

```bash
docker compose up -d db
npm run db:check --prefix server
npm run db:migrate --prefix server
npm run db:seed --prefix server
```

If your terminal is already inside `server/`, do not use `--prefix server`:

```bash
npm run db:check
npm run db:migrate
npm run db:seed
```

## Backend

Install dependencies:

```bash
npm install --prefix server
```

Run backend:

```bash
npm run dev --prefix server
```

If already inside `server/`:

```bash
npm run dev
```

Run API smoke test after the backend is running:

```bash
npm run smoke --prefix server
```

If already inside `server/`:

```bash
npm run smoke
```

Health checks:

```text
GET http://localhost:4000/health
GET http://localhost:4000/health/db
```

## Frontend

Install dependencies:

```bash
npm install --prefix client
```

Run frontend:

```bash
npm run dev --prefix client
```

Frontend runs on:

```text
http://localhost:5173
```

Seed login:

```text
email: owner@teamtask.dev
password: Password123!
```

## Run Everything Locally

Use three terminals from the project root:

```bash
docker compose up -d db
npm run db:migrate --prefix server
npm run db:seed --prefix server
```

```bash
npm run dev --prefix server
```

```bash
npm run dev --prefix client
```

Then open:

```text
http://localhost:5173
```

## Verification

Backend:

```bash
npm run db:check --prefix server
npm run smoke --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

Frontend:

```bash
npm run typecheck --prefix client
npm run build --prefix client
```
# Tixora
