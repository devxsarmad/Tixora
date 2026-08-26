// Usage:
// User directory business logic. Keeps routes thin and avoids exposing inactive
// users or password fields.

import { searchUsers } from './user.repository.js';
import type { ListUsersQuery } from './user.schemas.js';

export function listUsers(params: {
  requesterId: string;
  query: ListUsersQuery;
}) {
  return searchUsers({
    requesterId: params.requesterId,
    queryText: params.query.q
  });
}
