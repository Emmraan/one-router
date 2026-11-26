import { RefreshCw } from 'lucide-react';

export function LoadingScreen({ label = 'ONE ROUTER Loading...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center font-sans">
      <RefreshCw size={24} className="text-indigo-600 animate-spin" />
      <p className="text-xs text-zinc-400 mt-2 font-mono">{label}</p>
    </div>
  );
}
