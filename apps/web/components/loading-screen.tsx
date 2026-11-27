import { Wordmark } from '@one-router/ui/brand';

export function LoadingScreen({ label = 'Opening your workspace...' }: { label?: string }) {
  return <div className="grid min-h-dvh place-content-center gap-5 bg-[var(--surface)] text-center" role="status"><Wordmark /><p className="muted text-xs">{label}</p></div>;
}
