'use client';

import * as React from 'react';
import { ArrowDownRight } from 'lucide-react';

interface GreetingViewProps {
  renderInputDeck: () => React.ReactNode;
  onPresetPrompt: (text: string) => void;
}

const PRESETS = [
  { title: 'VPS Deployment Steps', desc: 'Detail step-by-step instructions to deploy Next.js and Postgres containers on a VPS.' },
  { title: 'Docker Compose Configurator', desc: 'Create a local Docker Compose script holding Node, Postgres, and Redis nodes.' },
  { title: 'Clean Architecture Pattern', desc: 'Explain domain-driven structure separation inside React typescript environments.' },
  { title: 'Magic Prompt Improver', desc: 'Optimize structural descriptions to provide high details for code modeling.' },
];

export function GreetingView({ renderInputDeck, onPresetPrompt }: GreetingViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center justify-center relative scrollbar-thin">
      <div className="w-full max-w-2xl flex flex-col text-center items-center gap-8 animate-fade-in my-auto">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded bg-emerald-500 flex items-center justify-center text-black text-2xl font-mono font-black scale-95 shadow-md">
            1R
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-5 text-zinc-950 dark:text-white sm:text-4xl">
            ONE ROUTER Central
          </h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-450 max-w-md mt-2 leading-relaxed">
            How Can I Help Your Today?
          </p>
        </div>

        <div className="w-full max-w-2xl z-20">
          {renderInputDeck()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full mt-4">
          {PRESETS.map((p, idx) => (
            <div
              key={idx}
              onClick={() => onPresetPrompt(p.desc)}
              className="p-4 rounded-2xl border bg-white dark:bg-[#0d0d0d] hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/60 text-left transition duration-200 cursor-pointer select-none group"
            >
              <span className="text-xs font-semibold flex items-center justify-between text-zinc-800 dark:text-zinc-200 font-sans group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                {p.title}
                <ArrowDownRight size={14} className="opacity-0 group-hover:opacity-100 transition duration-200 translate-x-1 text-emerald-500" />
              </span>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed truncate">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
