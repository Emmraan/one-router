'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
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
    if (isPending || !status?.authenticated) return;
    router.replace(status.mustChangePassword ? '/change-password' : '/');
  }, [status, isPending, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!password) {
      setError('Enter your password.');
      return;
    }
    try {
      const result = await login.mutateAsync(password);
      router.replace(result.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Unable to reach the server.');
    }
  };

  if (isPending) return <LoadingScreen label="Checking session..." />;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4 font-sans text-gray-900 dark:text-zinc-300">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-emerald-500 text-black font-mono font-bold text-xs tracking-tighter">1R</div>
          <div>
            <span className="font-bold text-sm tracking-tight text-zinc-950 dark:text-white">ONE ROUTER</span>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Local First Routing</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0d0d0d] p-6 shadow-sm">
          <h1 className="text-base font-bold text-zinc-950 dark:text-white">Sign in</h1>
          <p className="text-xs text-zinc-500 mt-1">Enter the owner password for this instance.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3" id="login-form">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            {error && (
              <p className="p-2.5 rounded-lg text-[11px] bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30" role="alert" id="login-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 text-xs font-bold transition disabled:opacity-60 cursor-pointer"
              id="login-submit"
            >
              <LogIn size={14} />
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}