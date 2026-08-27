// Usage:
// Creates repeatable demo data for local development. Run after migrations with:
// npm run db:seed

import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../db/pool.js';

const passwordHash = await bcrypt.hash('Password123!', 12);

type UserSeed = {
  email: string;
  displayName: string;
};

type SeededUser = UserSeed & {
  id: string;
};

const users: UserSeed[] = [
  { email: 'owner@teamtask.dev', displayName: 'Olivia Owner' },
  { email: 'admin@teamtask.dev', displayName: 'Amir Admin' },
  { email: 'member@teamtask.dev', displayName: 'Mina Member' }
];

await withTransaction(async (client) => {
  const seededUsers = new Map<string, SeededUser>();

  for (const user of users) {
    const result = await client.query<SeededUser>(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
        SET
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name
        RETURNING id, email, display_name AS "displayName"
      `,
      [user.email, passwordHash, user.displayName]
    );

    seededUsers.set(user.email, result.rows[0]);
  }

  const owner = seededUsers.get('owner@teamtask.dev')!;
  const admin = seededUsers.get('admin@teamtask.dev')!;
  const member = seededUsers.get('member@teamtask.dev')!;

  const teamResult = await client.query<{ id: string }>(
    `
      INSERT INTO teams (name, slug, created_by)
      VALUES ('Tixora Demo', 'tixora-demo', $1)
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING id
    `,
    [owner.id]
  );
  const teamId = teamResult.rows[0].id;

  await client.query(
    `
      INSERT INTO team_members (team_id, user_id, role)
      VALUES
        ($1, $2, 'owner'),
        ($1, $3, 'admin'),
        ($1, $4, 'member')
      ON CONFLICT (team_id, user_id) DO UPDATE
      SET role = EXCLUDED.role
    `,
    [teamId, owner.id, admin.id, member.id]
  );

  const existingProject = await client.query<{ id: string }>(
    `
      SELECT id
      FROM projects
      WHERE team_id = $1
        AND lower(name) = lower('Website Launch')
        AND archived_at IS NULL
      LIMIT 1
    `,
    [teamId]
  );

  const projectResult = existingProject.rows[0]
    ? await client.query<{ id: string }>(
        `
          UPDATE projects
          SET description = 'Coordinate launch tasks across engineering, product, and QA.'
          WHERE id = $1
          RETURNING id
        `,
        [existingProject.rows[0].id]
      )
    : await client.query<{ id: string }>(
        `
          INSERT INTO projects (team_id, name, description, created_by)
          VALUES (
            $1,
            'Website Launch',
            'Coordinate launch tasks across engineering, product, and QA.',
            $2
          )
          RETURNING id
        `,
        [teamId, owner.id]
      );
  const projectId = projectResult.rows[0].id;

  await client.query(
    `
      DELETE FROM tasks
      WHERE project_id = $1
        AND title IN (
          'Finalize launch checklist',
          'QA production smoke suite'
        )
    `,
    [projectId]
  );

  await client.query(
    `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES
        ($1, $2, 'manager'),
        ($1, $3, 'contributor'),
        ($1, $4, 'contributor')
      ON CONFLICT (project_id, user_id) DO UPDATE
      SET role = EXCLUDED.role
    `,
    [projectId, owner.id, admin.id, member.id]
  );

  const taskOneResult = await client.query<{ id: string }>(
    `
      INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        priority,
        created_by,
        due_at
      )
      VALUES (
        $1,
        'Finalize launch checklist',
        'Confirm release blockers, owner assignments, and launch window.',
        'in_progress',
        'high',
        $2,
        now() + interval '3 days'
      )
      RETURNING id
    `,
    [projectId, owner.id]
  );

  const taskTwoResult = await client.query<{ id: string }>(
    `
      INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        priority,
        created_by,
        due_at
      )
      VALUES (
        $1,
        'QA production smoke suite',
        'Run smoke checks for auth, project creation, task updates, and comments.',
        'todo',
        'urgent',
        $2,
        now() + interval '1 day'
      )
      RETURNING id
    `,
    [projectId, admin.id]
  );

  const taskOneId = taskOneResult.rows[0].id;
  const taskTwoId = taskTwoResult.rows[0].id;

  await client.query(
    `
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      VALUES
        ($1, $2, $4),
        ($1, $3, $4),
        ($5, $3, $4)
      ON CONFLICT (task_id, user_id) DO NOTHING
    `,
    [taskOneId, admin.id, member.id, owner.id, taskTwoId]
  );

  await client.query(
    `
      INSERT INTO comments (task_id, author_id, body)
      VALUES
        ($1, $2, 'Checklist is almost ready. Waiting on QA confirmation.'),
        ($1, $3, 'I will verify the API flows after the latest migration.'),
        ($4, $3, 'QA smoke suite is queued for today.')
    `,
    [taskOneId, owner.id, admin.id, taskTwoId]
  );

  console.log('Seed complete');
  console.log({
    login: {
      owner: 'owner@teamtask.dev',
      admin: 'admin@teamtask.dev',
      member: 'member@teamtask.dev',
      password: 'Password123!'
    },
    teamSlug: 'tixora-demo',
    projectId,
    taskIds: [taskOneId, taskTwoId]
  });
});

await pool.end();
