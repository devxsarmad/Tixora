// Usage:
// Frontend TypeScript types for auth API responses.

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
};
