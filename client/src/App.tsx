import { useState } from 'react';
import { login, register } from './features/auth/authApi.js';
import { LoginPage } from './features/auth/pages/LoginPage.js';
import { RegisterPage } from './features/auth/pages/RegisterPage.js';
import { clearSession, loadSession, saveSession } from './features/auth/session.js';
import type { AuthResponse } from './features/auth/types.js';
import { Workspace } from './features/workspace/Workspace.js';

type AuthMode = 'login' | 'register';
type AuthEntryPoint = 'login' | 'register' | 'restored';

export function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => loadSession());
  const [mode, setMode] = useState<AuthMode>('login');
  const [authEntryPoint, setAuthEntryPoint] = useState<AuthEntryPoint>('restored');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuth(
    action: () => Promise<AuthResponse>,
    entryPoint: AuthEntryPoint
  ) {
    setError(null);
    setIsSubmitting(true);

    try {
      const nextSession = await action();
      saveSession(nextSession);
      setAuthEntryPoint(entryPoint);
      setSession(nextSession);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : 'Authentication failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setMode('login');
    setAuthEntryPoint('restored');
  }

  if (session) {
    return (
      <Workspace
        session={session}
        entryPoint={authEntryPoint}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Organization Operations</p>
        <h1>Organization Task Manager</h1>
        <p>
          Manage organizations, users, projects, tasks, ownership, and delivery
          in one focused app.
        </p>
      </section>

      <section className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button
            type="button"
            className={mode === 'login' ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Register
          </button>
        </div>

        {error ? <p className="error-message">{error}</p> : null}

        {mode === 'login' ? (
          <LoginPage
            disabled={isSubmitting}
            onSubmit={(input) => handleAuth(() => login(input), 'login')}
          />
        ) : (
          <RegisterPage
            disabled={isSubmitting}
            onSubmit={(input) => handleAuth(() => register(input), 'register')}
          />
        )}
      </section>
    </main>
  );
}
