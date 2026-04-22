import { AuthFormShell } from '@/components/auth/auth-form-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { Suspense } from 'react';

const SignUpFallback = () => (
  <AuthFormShell
    alternateHref="/sign-in"
    alternateLabel="Sign in"
    alternatePrompt="Already have an account?"
    description="Preparing the registration experience and session redirect logic."
    eyebrow="Sign Up"
    title="Create your customer account"
  >
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Loading sign-up form…
    </div>
  </AuthFormShell>
);

const SignUpPage = () => {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpForm />
    </Suspense>
  );
};

export default SignUpPage;
