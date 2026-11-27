import type { ReactNode } from 'react';
import { NetworkMark } from '../brand/network-mark';

export function WorkspaceFrame({ sidebar, header, children }: { sidebar: ReactNode; header: ReactNode; children: ReactNode }) {
  return <div className="workspace-frame">{sidebar}<main className="workspace-main">{header}{children}</main></div>;
}

export function Welcome({ children, onPrompt }: { children: ReactNode; onPrompt: (prompt: string) => void }) {
  return (
    <section className="welcome" aria-labelledby="welcome-heading">
      <NetworkMark className="welcome-mark" width={44} height={44} />
      <p className="eyebrow">YOUR WORKSPACE, YOUR MODELS</p>
      <h1 id="welcome-heading">What are you working on?</h1>
      <p className="welcome-description">Think it through, write it down, or try another perspective.</p>
      {children}
      <div className="prompt-suggestions" aria-label="Suggested prompts">
        {['Explain a concept', 'Review some code', 'Plan a project'].map((prompt) => (
          <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>{prompt}<span aria-hidden="true">↗</span></button>
        ))}
      </div>
    </section>
  );
}
