'use client';

import * as React from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useProviders } from '../hooks/use-providers';
import { useChats } from '../hooks/use-chats';

export function ConnectionStatus() {
  const [offline, setOffline] = React.useState(false);
  const fetching = useIsFetching();
  const providers = useProviders();
  const chats = useChats();
  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (offline) return <p role="status" className="status-notice">You are offline. Reconnect to send messages and sync your workspace.</p>;
  if (providers.error || chats.error) return <div role="alert" className="status-notice error-notice flex justify-between items-center gap-4">Could not load your workspace.<button className="button" disabled={fetching > 0} onClick={() => { void providers.refetch(); void chats.refetch(); }}>Retry</button></div>;
  return null;
}
