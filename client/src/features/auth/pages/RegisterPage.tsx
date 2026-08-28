import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  registerFormSchema,
  type RegisterFormValues
} from '../authSchemas.js';

type RegisterPageProps = {
  disabled: boolean;
  onSubmit: (input: RegisterFormValues) => Promise<void>;
};

export function RegisterPage({ disabled, onSubmit }: RegisterPageProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<RegisterFormValues>({
    defaultValues: {
      displayName: '',
      email: '',
      password: ''
    },
    resolver: zodResolver(registerFormSchema)
  });

  return (
    <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
      <label>
        Display name
        <input
          type="text"
          {...register('displayName')}
          autoComplete="name"
          placeholder="Jane Doe"
          aria-invalid={Boolean(errors.displayName)}
        />
        {errors.displayName ? (
          <span className="field-error">{errors.displayName.message}</span>
        ) : null}
      </label>
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
            autoComplete="new-password"
            placeholder="Create a secure password"
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
        Create account
      </button>
    </form>
  );
}
