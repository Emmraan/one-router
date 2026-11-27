'use client';

import { useEffect, useLayoutEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../utils';

export function Dialog({ open, onClose, title, description, children, className, id }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; className?: string; id?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const label = useId();
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return (
    <dialog ref={ref} id={id} aria-labelledby={label} aria-describedby={description ? `${label}-description` : undefined}
      className={cn('or-dialog', className)} onCancel={(event) => { event.preventDefault(); close.current(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((item) => item.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close.current();
      }}>
      <div className="dialog-heading"><div><h2 id={label}>{title}</h2>{description && <p id={`${label}-description`}>{description}</p>}</div>
        <button type="button" className="icon-button" aria-label={`Close ${title}`} onClick={onClose}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
