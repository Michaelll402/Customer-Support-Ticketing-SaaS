import { AuthFormShell } from '@/components/auth/auth-form-shell';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Suspense } from 'react';

const SignInFallback = () => (
  <AuthFormShell
    alternateHref="/sign-up"
    alternateLabel="Create one"
    alternatePrompt="Need an account?"
    description="Preparing the sign-in experience and session redirect logic."
    eyebrow="Sign In"
    title="Welcome back"
  >
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Loading sign-in form…
    </div>
  </AuthFormShell>
);

const SignInPage = () => {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
};

export default SignInPage;
