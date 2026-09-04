import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_EXPIRED_EVENT } from './api/http.js';
import tixoraLogo from './assests/tixora-logo.jpeg';
import { login, register } from './features/auth/authApi.js';
import { LoginPage } from './features/auth/pages/LoginPage.js';
import { RegisterPage } from './features/auth/pages/RegisterPage.js';
import { clearSession, loadSession, saveSession } from './features/auth/session.js';
import type { AuthResponse } from './features/auth/types.js';
import { Workspace } from './features/workspace/Workspace.js';

type AuthMode = 'login' | 'register';
type AuthEntryPoint = 'login' | 'register' | 'restored';

function getInitialAuthMode(pathname: string): AuthMode {
  return pathname === '/register' ? 'register' : 'login';
}

function navigateTo(pathname: string, replace = false) {
  if (window.location.pathname === pathname) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthResponse | null>(() => loadSession());
  const [mode, setMode] = useState<AuthMode>(() => getInitialAuthMode(window.location.pathname));
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
      await queryClient.cancelQueries();
      queryClient.clear();
      saveSession(nextSession);
      setAuthEntryPoint(entryPoint);
      setSession(nextSession);
      navigateTo(entryPoint === 'register' ? '/setup' : '/board', true);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : 'Authentication failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function endSession(message?: string) {
    clearSession();
    void queryClient.cancelQueries();
    queryClient.clear();
    setSession(null);
    setMode('login');
    setAuthEntryPoint('restored');
    setError(message ?? null);
    navigateTo('/login', true);
  }

  function updateSession(nextSession: AuthResponse) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout(message?: string) {
    endSession(typeof message === 'string' ? message : undefined);
  }

  useEffect(() => {
    function handlePopState() {
      if (!loadSession()) {
        setMode(getInitialAuthMode(window.location.pathname));
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      endSession('Your session expired. Please log in again.');
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [queryClient]);

  useEffect(() => {
    if (session) return;
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      navigateTo('/login', true);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const authOrLegacyRoute = ['/login', '/register', '/workspace', '/'];
    if (authOrLegacyRoute.includes(window.location.pathname)) {
      navigateTo('/board', true);
    }
  }, [session]);

  if (session) {
    return (
      <Workspace
        key={session.user.id}
        session={session}
        entryPoint={authEntryPoint}
        onLogout={handleLogout}
        onSessionChange={updateSession}
      />
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-brand-title">
          <img src={tixoraLogo} alt="Tixora-AI logo" className="auth-logo" />
          <div>
            <p className="eyebrow">Organization Operations</p>
            <h1>Tixora-AI</h1>
          </div>
        </div>
        <p>
          Manage organizations, projects, tickets, delivery, and AI-assisted project operations in one focused app.
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
              navigateTo('/login');
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
              navigateTo('/register');
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
