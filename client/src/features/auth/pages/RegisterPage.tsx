import { zodResolver } from '@hookform/resolvers/zod';
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
          autoComplete="new-password"
        />
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
