# Team Task Manager Interview Log

Usage: this is the running technical interview prep file for this project.

How to read each question:

- First learn the term in simple words.
- Then see where that term appears in our code.
- Then read the simple answer.
- Then practice the interview answer out loud.

After you answer in chat, we will update `Answer quality` as `solid`, `shaky`,
or `needs review`.

## Chunk 0: Schema Design

Answer quality: pending

### 1. Explain why `team_members` uses a composite primary key of `(team_id, user_id)` instead of a separate `id` column plus a unique constraint.

Term first:

A primary key is the column, or group of columns, that uniquely identifies one
row in a table.

A composite primary key means the primary key uses more than one column.

Where in our code:

```sql
CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
```

Simple answer:

In `team_members`, the row means "this user belongs to this team."

So the real unique identity is not one random `id`. It is the pair:

```text
team_id + user_id
```

This also stops the same user from being added to the same team twice.

Interview answer:

"I used `(team_id, user_id)` as the primary key because membership is naturally
identified by that pair. A separate `id` column would still require a unique
constraint on `(team_id, user_id)` to prevent duplicate memberships, so the
composite key makes the data rule explicit."

### 2. Defend the choice to put `role team_role` on `team_members` and `role project_role` on `project_members`. What authorization question does that let us answer with joins?

Term first:

RBAC means role-based access control.

It means users can do different things based on their role.

Examples:

- `owner` can manage the team.
- `admin` can invite members.
- `member` can work on tasks.
- `viewer` can only read.

Where in our code:

```sql
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE project_role AS ENUM ('manager', 'contributor', 'viewer');
```

```sql
CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);
```

```sql
CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'contributor',
  PRIMARY KEY (project_id, user_id)
);
```

Simple answer:

The role is stored on the membership table because the role depends on the
relationship.

One user can be an `admin` in one team and only a `member` in another team.

Interview answer:

"I stored roles on `team_members` and `project_members` because permission is not
global to the user. It depends on where the user is a member. This lets the API
answer authorization questions like, 'Can this user update this project?' by
joining `projects` to `project_members` or `team_members`."

### 3. In `tasks`, why does `tasks_completed_status_match` force `completed_at` to be non-null only when `status = 'done'`?

Term first:

A check constraint is a database rule that every row must follow.

If new data breaks the rule, Postgres rejects it.

Where in our code:

```sql
CONSTRAINT tasks_completed_status_match CHECK (
  (status = 'done' AND completed_at IS NOT NULL)
  OR (status <> 'done' AND completed_at IS NULL)
)
```

Simple answer:

This prevents impossible task data.

Bad examples:

```text
status = done, completed_at = null
status = todo, completed_at = 2026-07-09
```

Interview answer:

"I added this check constraint so task completion state stays consistent at the
database level. Express can validate it too, but the database is the final guard.
Even if the API has a bug, Postgres will not store a done task without a
completion timestamp."

### 4. The task board query is slow: `WHERE project_id = $1 AND status = $2 ORDER BY updated_at DESC`. Which index helps, and how would you verify it?

Term first:

An index is like a lookup structure that helps Postgres find rows faster.

Without a useful index, Postgres may scan the whole table.

`EXPLAIN ANALYZE` is a Postgres command that shows how a query actually ran.

Where in our code:

```sql
CREATE INDEX tasks_project_status_idx
ON tasks (project_id, status, updated_at DESC);
```

Simple answer:

This index matches the query because the query:

- Filters by `project_id`.
- Filters by `status`.
- Sorts by `updated_at DESC`.

Interview answer:

"The `tasks_project_status_idx` index is designed for the task board query. I
would verify it with `EXPLAIN ANALYZE` and check whether Postgres uses that index
instead of doing a sequential scan over the whole `tasks` table."

Example check:

```sql
EXPLAIN ANALYZE
SELECT *
FROM tasks
WHERE project_id = $1
  AND status = $2
ORDER BY updated_at DESC;
```

### 5. Why did we create `task_assignees` instead of putting `assigned_to uuid` directly on `tasks`?

Term first:

A one-to-many relationship means one row connects to many rows.

A many-to-many relationship means many rows on both sides can connect to each
other.

Tasks and assignees are many-to-many:

- One task can have many users assigned.
- One user can be assigned to many tasks.

Where in our code:

```sql
CREATE TABLE task_assignees (
  task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
```

Simple answer:

We used `task_assignees` because a task can have more than one assignee.

If we used `tasks.assigned_to`, each task could only have one assignee.

Interview answer:

"I modeled task assignment with a join table because assignment is many-to-many.
The tradeoff is that loading assignees now requires a join, but the schema can
represent real collaboration instead of forcing only one assignee per task."

Example join:

```sql
SELECT users.*
FROM task_assignees
JOIN users ON users.id = task_assignees.user_id
WHERE task_assignees.task_id = $1;
```

### 6. What would break if we used `ON DELETE CASCADE` for `tasks.created_by` instead of `ON DELETE RESTRICT`?

Term first:

A foreign key connects one table to another.

`ON DELETE CASCADE` means: if the parent row is deleted, delete the child rows too.

`ON DELETE RESTRICT` means: do not allow deleting the parent row if child rows
still depend on it.

Where in our code:

```sql
created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT
```

Simple answer:

If we used cascade here, deleting a user could delete all tasks that user created.

That would be dangerous because tasks are project history.

Interview answer:

"I used `ON DELETE RESTRICT` for `tasks.created_by` because tasks should not
disappear just because the creator account is removed. If it were cascade,
deleting one user could delete important project work. Restrict protects
historical data."

### 7. Explain why `projects_active_by_team_idx` is a partial index with `WHERE archived_at IS NULL`.

Term first:

A partial index is an index that only includes some rows.

It is useful when most queries only care about one part of a table.

Where in our code:

```sql
CREATE INDEX projects_active_by_team_idx ON projects (team_id, updated_at DESC)
WHERE archived_at IS NULL;
```

Simple answer:

Most screens show active projects, not archived projects.

So this index only stores active projects. That makes it smaller and faster for
the common query.

Interview answer:

"I used a partial index because the common workload is listing active projects by
team. The `WHERE archived_at IS NULL` condition keeps archived projects out of
the index, so the index is smaller. It helps active-project queries, but it does
not help much when searching archived projects."

### 8. Defend using Postgres enums for `task_status` and `team_role` over plain text plus app-level validation.

Term first:

An enum is a type that only allows a fixed list of values.

For example, `task_status` only allows values we define.

Where in our code:

```sql
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
```

Simple answer:

Enums stop bad values from being saved.

Bad values we want to prevent:

```text
inprogress
Done
finished
```

Interview answer:

"I used enums because statuses and roles are core domain values with a fixed set
of allowed options. App validation gives nicer errors, but the enum guarantees
invalid values cannot be stored. The tradeoff is that changing the allowed values
requires a migration."

### 9. Two requests try to create the same team slug at the same time. What handles this safely?

Term first:

A race condition happens when two operations run at the same time and both think
they are safe.

A unique index guarantees that a value cannot appear twice, even during
concurrent requests.

Where in our code:

```sql
CREATE UNIQUE INDEX teams_slug_unique_idx ON teams (slug);
```

Simple answer:

Both requests may pass Express validation, but Postgres is the final authority.

One insert succeeds. The other insert fails because the slug is already taken.

Interview answer:

"The unique index on `teams.slug` protects us from concurrent duplicate slugs.
Even if two requests pass validation at the same time, Postgres enforces
uniqueness. Express should catch the unique violation and return `409 Conflict`."

### 10. If comments grow to millions of rows, what would you inspect first?

Term first:

Scaling means the app still works well when data or traffic grows.

Pagination means loading a small number of rows at a time instead of loading
everything.

Cursor pagination means using the last seen value, like `created_at`, to fetch
the next page.

Where in our code:

```sql
CREATE INDEX comments_task_created_idx ON comments (task_id, created_at ASC)
WHERE deleted_at IS NULL;
```

Simple answer:

I would check whether comment queries use the index and whether we are loading
too many comments at once.

Interview answer:

"At millions of comments, I would first run `EXPLAIN ANALYZE` on the real comment
query and confirm it uses `comments_task_created_idx`. Then I would avoid loading
all comments at once and use cursor pagination by `created_at` with a `LIMIT`."

Example paginated query:

```sql
SELECT *
FROM comments
WHERE task_id = $1
  AND deleted_at IS NULL
  AND created_at > $2
ORDER BY created_at ASC
LIMIT 50;
```

## Chunk 1: Auth Foundation

Answer quality: pending

### 1. In `src/db/pool.ts`, why did we create one shared `pg.Pool` instead of creating a new database connection inside every route?

Term first:

A database connection is a live network connection between Node and Postgres.

A connection pool is a reusable group of database connections.

Opening a new connection is expensive. Reusing a connection is faster.

Where in our code:

```ts
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000
});
```

Simple answer:

We use one shared pool so every request can borrow a database connection and give
it back when the query finishes.

Interview answer:

"I used a shared `pg.Pool` because creating a new Postgres connection per request
is expensive and can overload the database. The pool limits concurrency with
`DB_POOL_MAX`, reuses connections, and gives the app a controlled database access
point."

### 2. In `auth.repository.ts`, why do our SQL queries use `$1`, `$2`, `$3` instead of string concatenation?

Term first:

SQL injection happens when user input is accidentally treated as SQL code.

Parameterized SQL keeps SQL code and user values separate.

Where in our code:

```ts
await query<UserRow>(
  `
    INSERT INTO users (email, password_hash, display_name)
    VALUES ($1, $2, $3)
    RETURNING id, email, display_name, password_hash, is_active, created_at
  `,
  [params.email, params.passwordHash, params.displayName]
);
```

Simple answer:

`$1`, `$2`, `$3` are placeholders. The real values are passed separately in an
array.

Postgres treats those values as data, not as SQL commands.

Interview answer:

"I used parameterized SQL to prevent SQL injection. The query shape is fixed, and
user input is passed separately as values. I never build SQL by concatenating
request data."

### 3. Why does `register` catch Postgres error code `23505` and return `409 Conflict`?

Term first:

`23505` is the Postgres error code for a unique constraint violation.

`409 Conflict` means the request conflicts with existing data.

Where in our code:

```ts
const POSTGRES_UNIQUE_VIOLATION = '23505';
```

```ts
if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
  throw new HttpError(409, 'Email is already registered', 'EMAIL_TAKEN');
}
```

Simple answer:

If someone registers with an email that already exists, the database rejects the
insert. We turn that database error into a clean API response.

Interview answer:

"I rely on the database unique index as the final protection against duplicate
emails, including concurrent register requests. When Postgres throws `23505`, the
API maps it to `409 Conflict` instead of leaking a raw database error."

### 4. In `auth.service.ts`, why do we store `passwordHash` instead of the user's real password?

Term first:

Hashing changes a password into a one-way value.

One-way means we can check a password later, but we should not be able to turn
the hash back into the original password.

Where in our code:

```ts
const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
```

```ts
const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
```

Simple answer:

We never store real passwords. We store bcrypt hashes.

During login, bcrypt compares the submitted password to the saved hash.

Interview answer:

"I store only `password_hash` because plain-text passwords are a serious security
risk. Bcrypt is intentionally slow and salted, which makes stolen hashes harder
to attack. On login, I compare the submitted password with the stored hash using
`bcrypt.compare`."

### 5. Why does `login` return `Invalid email or password` for both a missing user and a wrong password?

Term first:

User enumeration means attackers can discover which emails are registered.

Where in our code:

```ts
if (!user || !user.isActive) {
  throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
}
```

```ts
if (!passwordMatches) {
  throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
}
```

Simple answer:

We do not reveal whether the email exists.

Interview answer:

"I return the same error for missing users and wrong passwords to avoid user
enumeration. If the API said 'email not found,' attackers could test emails and
build a list of registered users."

### 6. Why does `registerSchema` lowercase emails before inserting into `users.email`?

Term first:

Normalization means converting input into a consistent format before storing it.

Where in our code:

```ts
email: z.string().trim().email().transform((value) => value.toLowerCase())
```

Related database rule:

```sql
CONSTRAINT users_email_lowercase CHECK (email = lower(email))
```

Simple answer:

We store emails lowercase so `Ali@test.com` and `ali@test.com` do not become two
different users.

Interview answer:

"I normalize email in the API and also enforce lowercase email in the database.
The API gives better validation behavior, while the database check constraint
protects data integrity if another code path writes to `users` later."

### 7. What would break if we built the login query with string concatenation?

Term first:

String concatenation means building SQL like:

```ts
`SELECT * FROM users WHERE email = '${email}'`
```

That is dangerous when `email` comes from a request body.

Where in our code:

```ts
WHERE email = $1
```

Simple answer:

An attacker could send input that changes the SQL query.

Interview answer:

"String-concatenated SQL would create SQL injection risk. For login, that could
let an attacker change the `WHERE` clause or bypass normal credential checks.
Using `$1` keeps the SQL structure fixed and passes the email as data."

### 8. How would you scale or harden this auth chunk next?

Term first:

Hardening means making a feature safer against abuse and failures.

Scaling means keeping it reliable as traffic grows.

Where in our code:

Current auth endpoints:

```text
POST /api/auth/register
POST /api/auth/login
```

Simple answer:

Next improvements would be rate limiting, auth middleware, refresh tokens,
tests, and better logging.

Interview answer:

"I would add rate limiting to protect login from brute force attacks, add JWT
verification middleware for protected routes, introduce refresh tokens if the app
needs longer sessions, and write integration tests against a real Postgres test
database. I would also monitor pool usage so `DB_POOL_MAX` matches the database
capacity."

## Chunk 2: Local DB Setup And Frontend Structure

Answer quality: pending

### 1. What is `DATABASE_URL`, and how does our backend use it to connect to Postgres?

Term first:

`DATABASE_URL` is a connection string. It tells Node where the database is and
what credentials to use.

Where in our code:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5433/team_task_manager
```

This lives in:

```text
server/.env
```

```ts
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX
});
```

Simple answer:

The backend reads `DATABASE_URL` from `.env`, gives it to `pg.Pool`, and `pg`
uses it to connect to the local Postgres database.

Interview answer:

"The backend does not hardcode database credentials in query files. It reads
`DATABASE_URL` from environment config, validates it in `env.ts`, and passes it
to `pg.Pool`. That keeps connection details configurable across local,
production, and test environments."

### 2. Why did we add `docker-compose.yml` for Postgres?

Term first:

Docker lets us run infrastructure like Postgres in a container.

Docker Compose lets us describe that local infrastructure in a file.

Where in our code:

```yaml
services:
  db:
    image: postgres:16-alpine
    ports:
      - '5433:5432'
```

Simple answer:

It gives us a repeatable local database. We do not have to manually install and
configure Postgres on every machine.

Interview answer:

"I added Docker Compose so local Postgres setup is repeatable. The backend still
connects through the normal Postgres TCP port, but Docker controls the database
version, database name, credentials, and persistent volume."

### 3. What is a migration runner, and why did we add `src/db/migrate.ts`?

Term first:

A migration is a database change saved as a file.

A migration runner applies those files in order and remembers which ones already
ran.

Where in our code:

```ts
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)
```

Simple answer:

`migrate.ts` applies SQL files from `server/db/migrations` and records them in
`schema_migrations` so the same migration does not run twice.

Interview answer:

"Because this project uses raw SQL, I added a small migration runner that applies
SQL files directly through `pg`. It tracks applied filenames in
`schema_migrations`, which gives us repeatable schema changes without an ORM."

### 4. Why is `schema_migrations` important?

Term first:

State tracking means remembering what already happened.

For migrations, we need to remember which schema files were already applied.

Where in our code:

```ts
await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
  file
]);
```

Simple answer:

Without `schema_migrations`, running `npm run db:migrate` twice might try to
create the same tables again and fail.

Interview answer:

"The `schema_migrations` table is the source of truth for migration state. It
prevents duplicate migration execution and lets the app know which raw SQL files
have already changed the database."

### 5. Why did we add `GET /health/db` instead of only `GET /health`?

Term first:

A health check is an endpoint that tells us whether part of the system is alive.

A DB health check confirms the app can actually query Postgres.

Where in our code:

```ts
app.get('/health/db', async (_req, res, next) => {
  const result = await query(`
    SELECT
      current_database() AS database_name,
      now() AS server_time
  `);
});
```

Simple answer:

`/health` only proves Express is running. `/health/db` proves Express can talk to
Postgres.

Interview answer:

"I added a DB health endpoint because an API process can be alive while the
database connection is broken. This endpoint runs a real SQL query, so it checks
the dependency that most backend routes need."

### 6. Why create a separate `client/` folder?

Term first:

Frontend and backend are separate apps in a PERN project.

The frontend runs in the browser. The backend runs in Node.

Where in our code:

```text
client/
├── src/api
├── src/features/auth
├── src/App.tsx
└── vite.config.ts
```

Simple answer:

The `client/` folder keeps React code separate from Express code.

Interview answer:

"I separated the React client from the Express backend because they have
different runtimes, dependencies, and build tools. The frontend calls backend
HTTP endpoints rather than importing backend code directly."

### 7. Why does `client/vite.config.ts` proxy `/api` to `localhost:4000`?

Term first:

A dev proxy forwards browser requests from the frontend dev server to the
backend server.

Where in our code:

```ts
proxy: {
  '/api': 'http://localhost:4000',
  '/health': 'http://localhost:4000'
}
```

Simple answer:

During development, React runs on port `5173` and Express runs on port `4000`.
The proxy lets the frontend call `/api/auth/login` without hardcoding the backend
URL everywhere.

Interview answer:

"The Vite proxy keeps frontend API calls clean during local development and
avoids scattering backend URLs across components. In production, we can configure
the API base URL differently."

## Chunk 3: Authenticated Teams API

Answer quality: pending

### 1. In `requireAuth`, why do we read the user from the JWT instead of accepting `userId` in the request body?

Term first:

Authentication proves who is making the request.

A request body is user-controlled input. The client can put anything there.

Where in our code:

```ts
const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
```

```ts
(req as typeof req & { user: AuthenticatedUser }).user = user;
```

Simple answer:

We trust the signed JWT, not a `userId` sent by the client.

Interview answer:

"I derive the current user from the verified JWT because request bodies are not
trusted identity. If the API accepted `userId` from the body, one user could try
to act as another user. The middleware verifies the token, checks the user is
still active, and attaches the authenticated user to the request."

  ### 2. Why does `createTeamWithOwner` use a transaction?

  Term first:

  A transaction groups multiple database writes together.

  Either all writes commit, or all writes roll back.

  Where in our code:

  ```ts
  return withTransaction(async (client) => {
    const teamResult = await client.query(...);
    await client.query(...);
    return toTeamSummary(team);
  });
  ```

  Simple answer:

  Creating a team requires two writes:

  - Insert the team.
  - Insert the owner membership.

  They must succeed together.

  Interview answer:

  "I wrapped team creation in a transaction because inserting into `teams` and
  `team_members` is one logical operation. Without a transaction, a failure after
  the team insert could leave a team with no owner. The rollback prevents partial
  data."

### 3. In `listTeamsForUser`, why use joins and aggregates instead of separate queries per team?

Term first:

N+1 means one initial query, then one extra query for each row returned.

It gets slower as the number of rows grows.

Where in our code:

```sql
FROM team_members AS requester
JOIN teams AS t
  ON t.id = requester.team_id
LEFT JOIN team_members AS all_members
  ON all_members.team_id = t.id
LEFT JOIN projects AS p
  ON p.team_id = t.id
```

Simple answer:

One SQL query returns the team list, the user's role, member counts, and project
counts.

Interview answer:

"I used a joined aggregate query to avoid N+1 database access. The route can
return each team with role and counts in one round trip, which is more predictable
as the number of teams grows."

### 4. What does `COUNT(DISTINCT all_members.user_id)` protect against in the team list query?

Term first:

A join can multiply rows.

If a team has multiple members and multiple projects, joining both tables can
create duplicate combinations.

Where in our code:

```sql
COUNT(DISTINCT all_members.user_id)::int AS member_count
```

Simple answer:

`DISTINCT` prevents over-counting members when joins create duplicate rows.

Interview answer:

"Because the query joins both members and projects, rows can multiply. I used
`COUNT(DISTINCT ...)` so counts reflect unique members and projects rather than
the multiplied join result."

### 5. Why does `findTeamDetailForUser` join `team_members AS requester` before returning a team?

Term first:

Authorization answers: is this authenticated user allowed to access this data?

Where in our code:

```sql
JOIN team_members AS requester
  ON requester.team_id = t.id
 AND requester.user_id = $2
WHERE t.slug = $1
```

Simple answer:

The query only returns the team if the requester is a member.

Interview answer:

"I put the membership check inside the SQL query so unauthorized teams are not
loaded and filtered later in application code. If the user is not a member, the
query returns no row and the service returns `404`."

### 6. Why return `404 Team not found` instead of `403 Forbidden` when a user requests a team they do not belong to?

Term first:

Information disclosure means revealing data the user should not know.

Where in our code:

```ts
if (!team) {
  throw new HttpError(404, 'Team not found', 'TEAM_NOT_FOUND');
}
```

Simple answer:

We do not confirm whether the team exists if the user is not a member.

Interview answer:

"For this endpoint, I return `404` to avoid revealing whether a private team slug
exists. A `403` would confirm the resource exists but the user lacks access."

### 7. Why does duplicate team slug handling rely on Postgres error `23505`?

Term first:

`23505` is the Postgres code for unique constraint violation.

Where in our code:

```ts
if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
  throw new HttpError(409, 'Team slug is already taken', 'TEAM_SLUG_TAKEN');
}
```

Simple answer:

Postgres is the final authority for uniqueness, especially during concurrent
requests.

Interview answer:

"Even if the API checks availability, two concurrent requests can race. The
unique index on `teams.slug` is the real guarantee. The service catches `23505`
and maps it to a stable `409 Conflict` API response."

### 8. How would you optimize the Teams API if a user belongs to hundreds of teams?

Term first:

Pagination limits how many rows the API returns at once.

Indexes help Postgres find and order rows efficiently.

Where in our code:

Current route:

```text
GET /api/teams
```

Simple answer:

Add cursor pagination and inspect the query plan with `EXPLAIN ANALYZE`.

Interview answer:

"I would add cursor pagination to `GET /api/teams`, likely ordered by
`updated_at` and `id`, and verify with `EXPLAIN ANALYZE` whether indexes support
the query. I would also watch the aggregate cost because counts across members
and projects may become expensive at higher scale."

## Chunk 5: Projects API And RBAC

Answer quality: pending

### 1. In `createProjectForTeam`, why do we insert into both `projects` and `project_members` inside one transaction?

Term first:

A transaction makes multiple database writes behave like one unit.

If one write fails, the whole operation rolls back.

Where in our code:

```ts
return withTransaction(async (client) => {
  const projectResult = await client.query(...);
  await client.query(...);
  return toProjectSummary(project);
});
```

Simple answer:

Creating a project also needs to make the creator a project `manager`.

If the project insert succeeds but the membership insert fails, the project would
have no manager.

Interview answer:

"I used a transaction because project creation is not just one row. The `projects`
row and the `project_members` manager row must be committed together. If either
write fails, rollback prevents a project from existing without a manager."

### 2. Why does project creation check `team_members.role` before inserting a project?

Term first:

Authorization decides whether an authenticated user is allowed to perform an
action.

Where in our code:

```sql
FROM teams AS t
JOIN team_members AS tm
  ON tm.team_id = t.id
 AND tm.user_id = $2
WHERE t.slug = $1
```

```ts
function canCreateProject(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}
```

Simple answer:

Only team `owner` and `admin` can create projects.

Interview answer:

"I check the authenticated user's team membership in SQL before creating the
project. That prevents users from creating projects in teams they do not belong
to, and it enforces that only `owner` and `admin` roles can create projects."

### 3. Why did we add `projects_active_team_name_unique_idx` as a partial unique index?

Term first:

A unique index prevents duplicate values.

A partial index only includes rows that match a condition.

Where in our code:

```sql
CREATE UNIQUE INDEX projects_active_team_name_unique_idx
ON projects (team_id, lower(name))
WHERE archived_at IS NULL;
```

Simple answer:

One team cannot have two active projects with the same name.

Archived projects do not block name reuse.

Interview answer:

"I used a partial unique index because the business rule only applies to active
projects. `lower(name)` makes the uniqueness case-insensitive, and
`WHERE archived_at IS NULL` lets archived project names be reused later."

### 4. Why does `listProjectsForTeam` use joins and `COUNT(DISTINCT ...)`?

Term first:

Joins combine related tables.

`COUNT(DISTINCT ...)` counts unique values after joins may duplicate rows.

Where in our code:

```sql
COUNT(DISTINCT pm.user_id)::int AS member_count,
COUNT(DISTINCT tasks.id)::int AS task_count
```

Simple answer:

The query returns projects with member counts and task counts in one round trip,
without over-counting duplicated join rows.

Interview answer:

"I used a joined aggregate query to avoid N+1 queries. Since joining project
members and tasks can multiply rows, `COUNT(DISTINCT ...)` keeps the counts
accurate."

### 5. In `findProjectDetailForUser`, why is team membership checked inside the SQL query?

Term first:

Pushing authorization into the query means unauthorized rows are never returned
from the database.

Where in our code:

```sql
JOIN team_members AS tm
  ON tm.team_id = p.team_id
 AND tm.user_id = $2
WHERE p.id = $1
```

Simple answer:

If the user is not a member of the team, the query returns no project.

Interview answer:

"The membership join makes access control part of the query shape. The API does
not fetch a project first and then decide if the user can see it; unauthorized
projects simply do not come back from Postgres."

### 6. Why can a project `manager` update/archive a project even if they are not a team `admin`?

Term first:

RBAC can exist at different scopes.

A team role applies across the team. A project role applies to one project.

Where in our code:

```ts
return (
  params.team_role === 'owner' ||
  params.team_role === 'admin' ||
  params.project_role === 'manager'
);
```

Simple answer:

A project manager has permission over that project, even without admin power
over the whole team.

Interview answer:

"I separated team-level and project-level roles. Team owners/admins can manage
all team projects, while a project `manager` can manage only the specific project
they are assigned to."

### 7. What would break if we trusted `teamSlug` alone without checking `team_members`?

Term first:

A route parameter is user input.

User input identifies what the user wants, not what the user is allowed to do.

Where in our code:

```ts
const params = teamSlugParamSchema.parse(req.params);
```

```sql
JOIN team_members AS tm
  ON tm.team_id = t.id
 AND tm.user_id = $2
```

Simple answer:

Someone could guess a team slug and read or create projects in a team they do not
belong to.

Interview answer:

"The slug only identifies the team. It does not prove access. I still join
against `team_members` using the authenticated user ID so guessed slugs do not
grant read or write access."

### 8. How would you optimize this Projects API as data grows?

Term first:

Optimization starts by measuring the real query plan.

`EXPLAIN ANALYZE` shows whether Postgres uses indexes and where time is spent.

Where in our code:

Project list uses:

```sql
WHERE ($3::boolean = true OR p.archived_at IS NULL)
ORDER BY p.updated_at DESC
```

Simple answer:

Add pagination, inspect query plans, and consider whether counts should be
computed live or cached.

Interview answer:

"I would add cursor pagination to project listing, run `EXPLAIN ANALYZE` on the
list query, and verify that the active-project index is used when
`archived_at IS NULL`. If member/task counts became expensive, I would consider
separate count queries, materialized summaries, or cached counters depending on
write frequency."

## Chunk 6: Tasks API And Assignees

Answer quality: pending

### 1. In `createTaskForProject`, why do we create the task and insert assignees inside one transaction?

Term first:

A transaction makes related database writes succeed or fail together.

Where in our code:

```ts
return withTransaction(async (client) => {
  const result = await client.query(...);
  await insertTaskAssignees(client, ...);
  return findTaskByIdForUser(client, ...);
});
```

Simple answer:

Task creation and task assignment are one logical operation when assignees are
sent in the create request.

Interview answer:

"I used a transaction because creating a task with assignees touches both `tasks`
and `task_assignees`. If assignment insertion fails, the task insert should roll
back so the API does not create partial data."

### 2. Why does `findInvalidProjectAssignees` check `project_members` before inserting into `task_assignees`?

Term first:

Authorization is not only about who makes the request. It is also about whether
the target users are allowed to be connected to the resource.

Where in our code:

```sql
SELECT user_id
FROM project_members
WHERE project_id = $1
  AND user_id = ANY($2::uuid[])
```

Simple answer:

Only project members can be assigned to tasks in that project.

Interview answer:

"I validate assignees against `project_members` so a request cannot assign random
users to private project tasks. The join table is the source of truth for who
belongs to a project."

### 3. Why does task access join through `tasks -> projects -> team_members`?

Term first:

Access control should follow ownership boundaries in the schema.

Where in our code:

```sql
FROM tasks AS task
JOIN projects AS p
  ON p.id = task.project_id
JOIN team_members AS tm
  ON tm.team_id = p.team_id
 AND tm.user_id = $2
```

Simple answer:

A task belongs to a project, and a project belongs to a team. Team membership is
the first access boundary.

Interview answer:

"I derive task access through the schema instead of trusting client input. The
query only returns tasks where the authenticated user belongs to the task's team,
so unauthorized tasks are never loaded and filtered later."

### 4. In `updateTaskForUser`, why does changing status to `done` update `completed_at`?

Term first:

A database constraint enforces valid data. The app code must write data that
satisfies that constraint.

Where in our code:

```sql
completed_at = CASE
  WHEN $5::task_status = 'done' AND task.completed_at IS NULL THEN now()
  WHEN $5::task_status IS NOT NULL AND $5::task_status <> 'done' THEN NULL
  ELSE task.completed_at
END
```

Simple answer:

The schema does not allow a `done` task with `completed_at = null`.

Interview answer:

"The update query keeps `status` and `completed_at` consistent with the database
constraint. Moving to `done` sets a completion timestamp, moving away from `done`
clears it, and unrelated updates preserve the existing value."

### 5. Why does `listTasksForProject` support filters with parameterized predicates instead of building SQL from raw request strings?

Term first:

Parameterized SQL keeps user input separate from SQL code.

Where in our code:

```sql
AND ($3::task_status IS NULL OR task.status = $3)
AND ($4::task_priority IS NULL OR task.priority = $4)
```

Simple answer:

The query shape stays fixed. Filter values are passed as parameters.

Interview answer:

"I kept the list query parameterized so filter inputs cannot change the SQL
structure. Optional filters are handled with typed predicates, not by
concatenating request values into SQL."

### 6. Which existing indexes are relevant to task list filters?

Term first:

An index helps Postgres find matching rows faster for common query patterns.

Where in our schema:

```sql
CREATE INDEX tasks_project_status_idx
ON tasks (project_id, status, updated_at DESC);
```

```sql
CREATE INDEX tasks_project_due_idx ON tasks (project_id, due_at)
WHERE due_at IS NOT NULL AND status <> 'done';
```

Simple answer:

Status filtering should benefit from `tasks_project_status_idx`. Due-date filters
should benefit from `tasks_project_due_idx`.

Interview answer:

"The task board path is `project_id + status + updated_at`, so
`tasks_project_status_idx` matches that query shape. Due-date views target
incomplete tasks with due dates, which is why the due-date index is partial."

### 7. What would break if we allowed assignee IDs without checking project membership?

Term first:

Foreign keys only prove a referenced row exists. They do not prove the row should
be related in this business context.

Where in our schema:

```sql
user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE
```

Simple answer:

The database would allow assigning any existing user, even if they are not in the
project.

Interview answer:

"The foreign key only checks that the user exists. It does not check that the
user belongs to the project. That is why the API validates against
`project_members` before inserting into `task_assignees`."

### 8. How would you scale the task list endpoint later?

Term first:

Pagination limits how many rows the API returns at once.

Where in our code:

Current task list:

```text
GET /api/projects/:projectId/tasks
```

Simple answer:

Add cursor pagination, then verify query plans with `EXPLAIN ANALYZE`.

Interview answer:

"I would add cursor pagination using `updated_at` plus `id`, run
`EXPLAIN ANALYZE` for the common status and due-date filters, and watch the cost
of JSON aggregating assignees. If assignee aggregation became expensive, I would
consider a two-query approach or separate task-detail loading."

## Chunk 7: Comments API And Soft Delete

Answer quality: pending

### 1. Why does comment access join through `comments -> tasks -> projects -> team_members`?

Term first:

Access control should follow the ownership chain in the database.

Where in our code:

```sql
FROM comments
JOIN tasks AS task
  ON task.id = comments.task_id
JOIN projects AS p
  ON p.id = task.project_id
JOIN team_members AS tm
  ON tm.team_id = p.team_id
 AND tm.user_id = $2
```

Simple answer:

A comment belongs to a task, a task belongs to a project, and a project belongs
to a team. Team membership decides whether the user can see the comment.

Interview answer:

"I derive comment access through the relational ownership chain instead of
trusting client input. If the authenticated user is not a member of the task's
team, the SQL query returns no comment."

### 2. Why does delete use `deleted_at` instead of physically deleting the comment row?

Term first:

Soft delete means hiding a row without removing it from the database.

Where in our code:

```sql
UPDATE comments
SET deleted_at = now()
WHERE comments.id = $1
```

Simple answer:

Soft delete keeps history while hiding the comment from normal reads.

Interview answer:

"I used soft delete because comments are part of task history. Setting
`deleted_at` preserves auditability while normal reads exclude deleted comments
with `deleted_at IS NULL`."

### 3. Which index supports `GET /api/tasks/:taskId/comments`, and why?

Term first:

An index helps Postgres find and order rows efficiently.

Where in our schema:

```sql
CREATE INDEX comments_task_created_idx ON comments (task_id, created_at ASC)
WHERE deleted_at IS NULL;
```

Simple answer:

The endpoint loads visible comments for one task in chronological order.

Interview answer:

"The `comments_task_created_idx` index matches the comment list query because it
starts with `task_id`, orders by `created_at ASC`, and only includes visible
comments where `deleted_at IS NULL`."

### 4. Why does `listCommentsForTask` fetch `limit + 1` rows?

Term first:

Cursor pagination loads a small page and gives the client a pointer to the next
page.

Where in our code:

```ts
[params.taskId, params.userId, params.after ?? null, params.limit + 1]
```

```ts
const pageRows = result.rows.slice(0, params.limit);
const overflowRow = result.rows[params.limit];
```

Simple answer:

The extra row tells us whether another page exists.

Interview answer:

"Fetching `limit + 1` rows lets the API know if there is another page without
running a separate count query. If the extra row exists, its `created_at` becomes
the next cursor."

### 5. Why can a project `manager` delete someone else's comment but not update it?

Term first:

Moderation and authorship are different permissions.

Where in our code:

```ts
params.userId === params.authorId ||
params.teamRole === 'owner' ||
params.teamRole === 'admin' ||
params.projectRole === 'manager'
```

Simple answer:

Managers can moderate discussion, but editing someone else's words would change
authorship.

Interview answer:

"I allow managers to soft-delete comments for moderation, but only the author can
edit the comment body. That separates moderation control from changing another
user's content."

### 6. What would break if comment reads did not filter `deleted_at IS NULL`?

Term first:

Soft-deleted rows still exist in the table.

Where in our code:

```sql
JOIN comments
  ON comments.task_id = task.id
 AND comments.deleted_at IS NULL
```

Simple answer:

Deleted comments would still appear in the task discussion.

Interview answer:

"Because soft delete keeps rows in the database, every normal read path must
filter `deleted_at IS NULL`. Otherwise deleted comments would leak back into the
API response."

### 7. Why does `createCommentForTask` block comments when the project is archived?

Term first:

Archiving means the resource is no longer actively changed.

Where in our code:

```ts
if (access.archived_at) {
  return 'forbidden';
}
```

Simple answer:

Archived projects should not receive new discussion activity.

Interview answer:

"I block new comments on archived projects because archive state should make the
project read-only for normal collaboration. Existing comments remain readable,
but new writes are forbidden."

### 8. How would you improve comment pagination at very high scale?

Term first:

Stable cursor pagination needs a unique tie-breaker when many rows can share the
same timestamp.

Where in our code:

Current cursor:

```sql
comments.created_at > $3
ORDER BY comments.created_at ASC
```

Simple answer:

Use `(created_at, id)` as the cursor instead of only `created_at`.

Interview answer:

"The current cursor is good groundwork, but at very high write volume I would use
a compound cursor like `(created_at, id)` to avoid ambiguity when multiple
comments share the same timestamp. I would pair that with a matching composite
index if query plans show it is needed."
