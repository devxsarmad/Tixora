import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginFormSchema, type LoginFormValues } from '../authSchemas.js';

type LoginPageProps = {
  disabled: boolean;
  onSubmit: (input: LoginFormValues) => Promise<void>;
};

export function LoginPage({ disabled, onSubmit }: LoginPageProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: ''
    },
    resolver: zodResolver(loginFormSchema)
  });

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
      <label>
        Email
        <input
          type="email"
          {...register('email')}
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? (
          <span className="field-error">{errors.email.message}</span>
        ) : null}
      </label>
      <label>
        Password
        <div className="password-field">
          <input
            type={isPasswordVisible ? 'text' : 'password'}
            {...register('password')}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
          />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
        </div>
        {errors.password ? (
          <span className="field-error">{errors.password.message}</span>
        ) : null}
      </label>
      <button type="submit" disabled={disabled}>
        Login
      </button>
    </form>
  );
}
