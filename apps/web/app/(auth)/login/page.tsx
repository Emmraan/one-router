'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@one-router/ui/brand';
import { useAuthStatus, useLogin } from '../../../hooks/use-auth';
import { ApiError } from '../../../lib/api';
import { LoadingScreen } from '../../../components/loading-screen';

export default function LoginPage() {
  const router = useRouter();
  const { data: status, isPending } = useAuthStatus();
  const login = useLogin();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!isPending && status?.authenticated) router.replace(status.mustChangePassword ? '/change-password' : '/');
  }, [status, isPending, router]);
  async function onSubmit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!password) { setError('Enter your password.'); return; }
    try { const result = await login.mutateAsync(password); router.replace(result.mustChangePassword ? '/change-password' : '/'); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to reach the server. Try again.'); }
  }
  if (isPending) return <LoadingScreen label="Checking session..." />;
  return <main className="auth-page"><div className="auth-panel"><Wordmark />
    <h1>Sign in</h1><p className="muted leading-relaxed">Enter the owner password for this workspace.</p>
    <form id="login-form" onSubmit={onSubmit} className="mt-7 space-y-5">
      <label className="field-label" htmlFor="login-password">Password<input className="field" id="login-password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} /></label>
      {error && <p className="error-notice" role="alert" id="login-error">{error}</p>}
      <button className="button primary w-full" id="login-submit" disabled={login.isPending}>{login.isPending ? 'Signing in...' : 'Sign in'}</button>
    </form><p className="muted text-xs mt-7">Your workspace. Your providers. Your conversations.</p>
  </div></main>;
}
