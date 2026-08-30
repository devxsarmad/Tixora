# Tixora-AI

Tixora-AI is a full-stack AI project management platform built with the PERN stack. It combines a Jira-style workspace for organizations, projects, tickets, comments, permissions, and activity tracking with an agentic assistant called Ask Tixora that can understand workspace context and help users inspect or act on project work.

The goal is to move beyond a traditional full-stack task manager into an AI-assisted delivery workspace where teams can manage tickets manually or ask the assistant to answer questions, summarize workload, find blockers, count tickets, create tasks, and update task state with server-side permission checks.

## End Goal

Tixora-AI should become a professional, AI-native project operations system with:

- Organization-based workspaces with role-aware access control
- Projects scoped under organizations with separate project membership
- Jira-style tickets with statuses, priorities, due dates, assignees, comments, and activity history
- Server-enforced permissions for organization members, project members, and task assignees
- Ask Tixora, an AI assistant that can retrieve workspace context, call approved backend tools, and perform safe project actions
- Reliable semantic search and grounded answers using task/comment embeddings
- Clean, maintainable React feature modules backed by a structured Express/PostgreSQL API

## Stack

- PostgreSQL
- pgvector for assistant embeddings
- Express
- React
- Node.js
- Raw SQL with `pg`
- React Query for server state
- React Hook Form + Zod on the frontend
- Zod validation on the backend
- OpenAI APIs for embeddings and assistant reasoning

No ORM. No Prisma. No Sequelize. No Knex.

## Core Product Model

Tixora-AI follows this hierarchy:

`Organization -> Projects -> Tasks`

Organization membership and project membership are separate layers:

- Organization owners/admins can manage the organization and access projects
- Organization members only see projects they are explicitly added to
- Project members can be managers, contributors, or viewers
- Task assignees must come from valid project members
- Comments and task events create the collaboration and audit trail around each ticket

## Current Feature Set

- JWT register/login
- Organization onboarding and workspace routing
- Organization member management
- Project list, create, edit, archive, and project access management
- Task board with create, edit, status updates, filters, drag/drop, assignees, and comments
- Calendar and activity views mapped from project tasks
- Ask Tixora assistant panel
- Assistant task counting, workload summary, overdue task lookup, task creation, and status update tools
- pgvector-backed embedding storage for semantic retrieval
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
└── loging.md            Personalized project/interview study log
```

There is no root `package.json` on purpose. The frontend and backend are separate apps, so each one owns its own dependencies and scripts.

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

## Ask Tixora

Ask Tixora is the AI layer of the product. It uses retrieved task/comment context plus approved backend tools so the assistant can answer questions and perform safe actions inside the current organization/project scope.

Current assistant capabilities include:

- Count accessible tickets
- List overdue tickets
- Summarize a member's workload
- Create tickets
- Update ticket status
- Ground answers in retrieved task and comment context

Assistant actions are still enforced by backend permissions. The frontend filtering is convenience only, not security.

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
