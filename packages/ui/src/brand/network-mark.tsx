import type { SVGProps } from 'react';

export function NetworkMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <path d="M19.79 17.45A19 19 0 0 1 44.21 17.45M50.71 28.7A19 19 0 0 1 38.5 49.85M25.5 49.85A19 19 0 0 1 13.29 28.7" />
      </g>
      <g fill="currentColor"><circle cx="32" cy="13" r="5.5" /><circle cx="48.45" cy="41.5" r="5.5" /><circle cx="15.55" cy="41.5" r="5.5" /></g>
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return <span className="wordmark"><NetworkMark width={28} height={28} />{!compact && <span>ONE ROUTER</span>}</span>;
}
