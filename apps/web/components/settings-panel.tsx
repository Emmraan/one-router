'use client';

import * as React from 'react';
import { Dialog } from '@one-router/ui/dialog';
import { useTheme } from '../hooks/use-settings';
import { changePasswordRequest } from '../lib/api';
import type { Theme } from '../lib/theme';

export function SettingsPanel({ open, onClose, onOpenData }: { open: boolean; onClose: () => void; onOpenData: () => void }) {
  const { theme, setTheme, themeError, savingTheme } = useTheme();
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  return <Dialog open={open} onClose={onClose} title="Settings" description="Appearance, security, and your data." className="settings-dialog">
    <div className="dialog-body space-y-7">
      <section><h3 className="font-semibold mb-4">Workspace</h3><div className="flex items-center justify-between gap-6">
        <label htmlFor="appearance">Appearance<p className="muted text-xs mt-1">Use a light, dark, or system theme.</p></label>
        <select id="appearance" className="field !w-36" value={theme} disabled={savingTheme} onChange={(event) => setTheme(event.target.value as Theme)}>
          <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </div>{themeError && <p role="alert" className="error-notice mt-3">Could not save appearance. Try again.</p>}</section>
      <section className="border-t border-[var(--border)] pt-6"><h3 className="font-semibold">Change password</h3>
        <form className="mt-4 space-y-4" onSubmit={async (event) => {
          event.preventDefault(); setError(''); setSaved(false);
          const form = event.currentTarget; const data = new FormData(form);
          if (data.get('newPassword') !== data.get('confirmPassword')) { setError('New passwords do not match.'); return; }
          setSaving(true);
          try { await changePasswordRequest({ currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')), confirmation: String(data.get('confirmPassword')) }); setSaved(true); form.reset(); }
          catch { setError('Could not change password. Check your current password and try again.'); }
          finally { setSaving(false); }
        }}>
          <label className="block">Current password<input className="field mt-2" type="password" name="currentPassword" autoComplete="current-password" required /></label>
          <label className="block">New password<input className="field mt-2" type="password" name="newPassword" autoComplete="new-password" minLength={12} maxLength={1024} required /></label>
          <label className="block">Confirm new password<input className="field mt-2" type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={1024} required /></label>
          <p className="muted text-xs">At least 12 characters. Other sessions will be signed out.</p>
          {error && <p role="alert" className="error-notice">{error}</p>}{saved && <p role="status">Password updated.</p>}
          <button className="button" disabled={saving}>{saving ? 'Changing password…' : 'Change password'}</button>
        </form>
      </section>
      <section className="border-t border-[var(--border)] pt-6"><h3 className="font-semibold">Your data</h3><p className="muted my-2">Export an encrypted archive or import an existing workspace.</p><button className="button" onClick={() => { onClose(); onOpenData(); }}>Import / export</button></section>
    </div>
  </Dialog>;
}
