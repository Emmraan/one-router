'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from '../../hooks/use-auth';
import { LoadingScreen } from '../../components/loading-screen';

// Gates the authenticated app behind a live session. A 401 anywhere rewrites
// the auth cache (see lib/query.ts), which redirects back to /login here.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: status, isPending } = useAuthStatus();

  React.useEffect(() => {
    if (isPending) return;
    if (!status?.authenticated) {
      router.replace('/login');
    } else if (status.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [status, isPending, router]);

  if (isPending) return <LoadingScreen />;
  if (!status?.authenticated || status.mustChangePassword) return null;
  return <>{children}</>;
}
