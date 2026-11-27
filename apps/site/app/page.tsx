import { Wordmark } from '@one-router/ui/brand';
import { LivePreview } from '../components/live-preview';

export default function Home() {
  return <>
    <header className="site-header"><a href="#" aria-label="ONE ROUTER home"><Wordmark /></a><a href="#workspace">Try the workspace</a></header>
    <main>
      <section className="site-hero"><p className="eyebrow">SELF-HOSTED. SINGLE OWNER.</p><h1>Your models.<br />One place to work.</h1><p>Connect your AI providers, keep your conversations together, and choose the right model for the task.</p><a className="button button-primary" href="#workspace">Explore the workspace <span aria-hidden="true">↓</span></a></section>
      <section id="workspace" className="site-showcase" aria-labelledby="preview-title"><div className="showcase-caption"><div><h2 id="preview-title">A familiar place to think.</h2><p>Search models, attach files, or start a temporary chat.</p></div><span>Interactive preview · sample replies</span></div><LivePreview /></section>
      <section className="site-principles"><h2>Built around your setup.</h2><dl><div><dt>Your providers</dt><dd>Use OpenAI, Anthropic, Gemini, Ollama, or a compatible endpoint. Switch models from the same conversation.</dd></div><div><dt>Your conversations</dt><dd>Search, pin, and restore chats. Keep a temporary chat in memory until you choose to save it.</dd></div><div><dt>Your data</dt><dd>Encrypted storage and portable encrypted archives. Host the workspace on your own infrastructure.</dd></div></dl></section>
    </main>
    <footer className="site-footer"><Wordmark /><p>A workspace for your AI providers.</p></footer>
  </>;
}
