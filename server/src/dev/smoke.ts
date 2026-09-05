// Usage:
// Runs a basic HTTP smoke test against the local API. Start the server first:
// npm run dev
// Then run:
// npm run smoke

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const email = `smoke-${Date.now()}@teamtask.dev`;
const memberEmail = `smoke-member-${Date.now()}@teamtask.dev`;
const password = 'Password123!';

type AuthResponse = {
  user: {
    id: string;
    email: string;
  };
};

const authCookies = new Map<string, string>();

async function request<T>(
  path: string,
  options: RequestInit & { cookie?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Tixora-Request', '1');

  if (options.cookie) {
    headers.set('Cookie', options.cookie);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed with ${response.status}: ${text}`
    );
  }

  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (cookie && body?.user?.id) authCookies.set(body.user.id, cookie);
  return body as T;
}

async function main() {
  console.log(`Running smoke test against ${API_BASE_URL}`);

  const auth = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      displayName: 'Smoke Tester'
    })
  });

  const memberAuth = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: memberEmail,
      password,
      displayName: 'Smoke Member'
    })
  });

  const cookie = authCookies.get(auth.user.id)!;
  const slug = `smoke-team-${Date.now()}`;

  const teamResponse = await request<{
    team: { id: string; slug: string };
  }>('/api/teams', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      name: 'Smoke Team',
      slug
    })
  });

  await request<{
    team: { id: string; members: Array<{ id: string; email: string }> };
  }>(`/api/teams/${teamResponse.team.slug}`, {
    cookie
  });

  await request<{
    member: { id: string };
  }>(`/api/teams/${teamResponse.team.slug}/members`, {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      email: memberAuth.user.email,
      role: 'member'
    })
  });

  await request(`/api/teams/${teamResponse.team.slug}/members/${memberAuth.user.id}`, {
    method: 'PATCH',
    cookie,
    body: JSON.stringify({
      role: 'admin'
    })
  });

  const projectResponse = await request<{
    project: { id: string };
  }>(`/api/teams/${teamResponse.team.slug}/projects`, {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      name: 'Smoke Project',
      description: 'Created by the API smoke test.'
    })
  });

  await request(`/api/projects/${projectResponse.project.id}`, {
    cookie
  });

  await request(`/api/projects/${projectResponse.project.id}/members`, {
    method: 'PUT',
    cookie,
    body: JSON.stringify({
      userId: memberAuth.user.id,
      role: 'contributor'
    })
  });

  await request(`/api/projects/${projectResponse.project.id}`, {
    method: 'PATCH',
    cookie,
    body: JSON.stringify({
      name: 'Smoke Project Updated',
      description: 'Updated by the API smoke test.'
    })
  });

  const taskResponse = await request<{
    task: { id: string };
  }>(`/api/projects/${projectResponse.project.id}/tasks`, {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      title: 'Smoke task',
      description: 'Created by the API smoke test.',
      priority: 'high',
      status: 'todo',
      dueAt: new Date(Date.now() + 86_400_000).toISOString()
    })
  });

  await request(`/api/tasks/${taskResponse.task.id}`, {
    cookie
  });

  await request(`/api/tasks/${taskResponse.task.id}`, {
    method: 'PATCH',
    cookie,
    body: JSON.stringify({
      status: 'in_progress'
    })
  });

  await request(`/api/tasks/${taskResponse.task.id}/assignees`, {
    method: 'PUT',
    cookie,
    body: JSON.stringify({
      assigneeIds: [auth.user.id]
    })
  });

  await request(`/api/tasks/${taskResponse.task.id}/assignees`, {
    method: 'PUT',
    cookie,
    body: JSON.stringify({
      assigneeIds: [auth.user.id, memberAuth.user.id]
    })
  });

  await request(
    `/api/projects/${projectResponse.project.id}/tasks?status=in_progress&priority=high&assigneeId=${auth.user.id}`,
    {
      cookie
    }
  );

  await request(`/api/projects/${projectResponse.project.id}/tasks?due=upcoming`, {
    cookie
  });

  const commentResponse = await request<{
    comment: { id: string };
  }>(`/api/tasks/${taskResponse.task.id}/comments`, {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      body: 'Smoke comment created successfully.'
    })
  });

  await request(`/api/tasks/${taskResponse.task.id}/comments?limit=10`, {
    cookie
  });

  await request(`/api/comments/${commentResponse.comment.id}`, {
    method: 'PATCH',
    cookie,
    body: JSON.stringify({
      body: 'Smoke comment updated successfully.'
    })
  });

  await request(`/api/comments/${commentResponse.comment.id}`, {
    method: 'DELETE',
    cookie
  });

  await request(`/api/projects/${projectResponse.project.id}/archive`, {
    method: 'POST',
    cookie
  });

  await request(`/api/teams/${teamResponse.team.slug}/projects?includeArchived=true`, {
    cookie
  });

  console.log('Smoke test passed');
  console.log({
    user: auth.user.email,
    member: memberAuth.user.email,
    teamSlug: teamResponse.team.slug,
    projectId: projectResponse.project.id,
    taskId: taskResponse.task.id
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
