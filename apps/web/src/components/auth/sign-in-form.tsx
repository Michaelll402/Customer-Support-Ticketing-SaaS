'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { AuthFormShell } from '@/components/auth/auth-form-shell';
import { useLogin } from '@/hooks/use-auth';
import { useAuthPageSession } from '@/hooks/use-auth-page-session';
import { type SignInInput, signInSchema } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api';

export const SignInForm = () => {
  const router = useRouter();
  const { currentUserQuery, resolvePostAuthPath } = useAuthPageSession();
  const loginMutation = useLogin();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignInInput>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const session = await loginMutation.mutateAsync(values);

    router.push(resolvePostAuthPath(session.user.role));
  });

  if (currentUserQuery.isLoading) {
    return (
      <AuthFormShell
        alternateHref="/sign-up"
        alternateLabel="Create one"
        alternatePrompt="Need an account?"
        description="Checking whether you already have an active support workspace session."
        eyebrow="Sign In"
        title="Welcome back"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading your session state…
        </div>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      alternateHref="/sign-up"
      alternateLabel="Create one"
      alternatePrompt="Need an account?"
      description="Sign in with your existing support workspace credentials. Auth state is established through the backend cookie, then hydrated from `/auth/me`."
      eyebrow="Sign In"
      title="Welcome back"
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-800" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            id="email"
            placeholder="agent@demo.test"
            type="email"
            {...register('email')}
          />
          {errors.email ? (
            <p className="text-sm text-rose-600">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="password"
            >
              Password
            </label>
            <span className="text-xs text-slate-500">
              Demo password: `Password1!`
            </span>
          </div>
          <input
            autoComplete="current-password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            id="password"
            placeholder="Enter your password"
            type="password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-rose-600">{errors.password.message}</p>
          ) : null}
        </div>

        {loginMutation.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getApiErrorMessage(loginMutation.error, 'Unable to sign in.')}
          </div>
        ) : null}

        {currentUserQuery.isError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            We could not verify the current session. Reload the page and try
            again.
          </div>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting || loginMutation.isPending}
          type="submit"
        >
          {isSubmitting || loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm leading-6 text-slate-500">
          New here?{' '}
          <Link
            className="font-semibold text-sky-700 hover:text-sky-800"
            href="/sign-up"
          >
            Create a customer account
          </Link>
          .
        </p>
      </form>
    </AuthFormShell>
  );
};
