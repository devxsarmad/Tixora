import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginFormSchema, type LoginFormValues } from '../authSchemas.js';

type LoginPageProps = {
  disabled: boolean;
  onSubmit: (input: LoginFormValues) => Promise<void>;
};

export function LoginPage({ disabled, onSubmit }: LoginPageProps) {
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: 'owner@teamtask.dev',
      password: 'Password123!'
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
        />
        {errors.email ? (
          <span className="field-error">{errors.email.message}</span>
        ) : null}
      </label>
      <label>
        Password
        <input
          type="password"
          {...register('password')}
          autoComplete="current-password"
        />
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
