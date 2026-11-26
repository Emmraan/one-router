'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useAuthStatus, useChangePassword } from '../../../hooks/use-auth';
import { ApiError } from '../../../lib/api';
import { LoadingScreen } from '../../../components/loading-screen';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: status, isPending } = useAuthStatus();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState('');
  const [details, setDetails] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (isPending) return;
    if (!status?.authenticated) router.replace('/login');
  }, [status, isPending, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setDetails([]);
    if (!currentPassword || !newPassword || !confirmation) {
      setError('Fill in all three fields.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('The new password and confirmation do not match.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword, confirmation });
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetails(err.details ?? []);
      } else {
        setError('Unable to reach the server.');
      }
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
          <h1 className="text-base font-bold text-zinc-950 dark:text-white">Set a new password</h1>
          <p className="text-xs text-zinc-500 mt-1">This instance requires a password change before use.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3" id="change-password-form">
            {([
              ['Current password', 'current-password', currentPassword, setCurrentPassword, 'change-current-password'],
              ['New password', 'new-password', newPassword, setNewPassword, 'change-new-password'],
              ['Confirm new password', 'new-password', confirmation, setConfirmation, 'change-confirm-password'],
            ] as const).map(([label, autoComplete, value, setValue, id]) => (
              <div key={id} className="flex flex-col gap-1.5">
                <label htmlFor={id} className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest font-mono">
                  {label}
                </label>
                <input
                  id={id}
                  type="password"
                  autoComplete={autoComplete}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111111] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            ))}

            <p className="text-[10px] text-zinc-400">Use at least 12 characters.</p>

            {error && (
              <div className="p-2.5 rounded-lg text-[11px] bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30" role="alert" id="change-password-error">
                <p>{error}</p>
                {details.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {details.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 text-xs font-bold transition disabled:opacity-60 cursor-pointer"
              id="change-password-submit"
            >
              <KeyRound size={14} />
              {changePassword.isPending ? 'Saving...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}