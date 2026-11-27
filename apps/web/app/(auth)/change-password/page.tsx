'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@one-router/ui/brand';
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
  React.useEffect(() => { if (!isPending && !status?.authenticated) router.replace('/login'); }, [status, isPending, router]);
  async function onSubmit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setDetails([]);
    if (!currentPassword || !newPassword || !confirmation) { setError('Fill in all three fields.'); return; }
    if (newPassword !== confirmation) { setError('The new password and confirmation do not match.'); return; }
    try { await changePassword.mutateAsync({ currentPassword, newPassword, confirmation }); router.replace('/'); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to reach the server. Try again.'); if (cause instanceof ApiError) setDetails(cause.details ?? []); }
  }
  if (isPending) return <LoadingScreen label="Checking session..." />;
  return <main className="auth-page"><div className="auth-panel"><Wordmark />
    <h1>Set a new password</h1><p className="muted leading-relaxed">Choose your own password before opening this workspace.</p>
    <form id="change-password-form" onSubmit={onSubmit} className="mt-7 space-y-4">
      {([
        ['Current password', 'current-password', currentPassword, setCurrentPassword, 'change-current-password'],
        ['New password', 'new-password', newPassword, setNewPassword, 'change-new-password'],
        ['Confirm new password', 'new-password', confirmation, setConfirmation, 'change-confirm-password'],
      ] as const).map(([label, autoComplete, value, setValue, id]) => <label key={id} className="field-label" htmlFor={id}>{label}<input className="field" id={id} type="password" autoComplete={autoComplete} required value={value} onChange={(event) => setValue(event.target.value)} /></label>)}
      <p className="muted text-xs">Use at least 12 characters.</p>
      {error && <div className="error-notice" role="alert" id="change-password-error"><p>{error}</p>{details.length > 0 && <ul className="list-disc pl-4 mt-2">{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}</div>}
      <button className="button primary w-full" id="change-password-submit" disabled={changePassword.isPending}>{changePassword.isPending ? 'Saving...' : 'Update password'}</button>
    </form>
  </div></main>;
}
