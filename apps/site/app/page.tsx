import { Wordmark } from '@one-router/ui/brand';
import commands from '../../../scripts/docs-commands.json';
import { LivePreview } from '../components/live-preview';
import { npmPackage, repository, vercelDeploy } from '../lib/site';

export default function Home() {
  return <>
    <header className="site-header">
      <a href="/" aria-label="ONE ROUTER home"><Wordmark /></a>
      <nav aria-label="Main navigation"><a href="#workspace">Preview</a><a href="#install">Install</a><a href="/docs/">Docs</a><a href={repository}>GitHub</a></nav>
    </header>
    <main>
      <section className="site-hero">
        <p className="eyebrow">SELF-HOSTED AI CHAT AND API GATEWAY</p>
        <h1>Your models.<br />One place to work.</h1>
        <p>Connect your AI providers in one workspace. Switch models mid-conversation or use the same providers from any OpenAI-compatible client.</p>
        <div className="site-actions"><a className="button button-primary" href="#install">Install ONE ROUTER</a><a className="button" href="#workspace">Try the workspace</a></div>
      </section>
      <section id="workspace" className="site-showcase" aria-labelledby="preview-title">
        <div className="showcase-caption"><div><h2 id="preview-title">See the workspace in action</h2><p>Switch models, send a sample message, or change the theme.</p></div><span>Interactive preview · sample replies</span></div>
        <LivePreview />
      </section>
      <section className="site-principles">
        <h2>Chat and route requests from the same setup</h2>
        <dl>
          <div><dt>Bring your providers</dt><dd>Use OpenAI, Anthropic, Gemini, Ollama, or an OpenAI-compatible endpoint. <a href="/docs/providers/">Configure providers</a></dd></div>
          <div><dt>Work across models</dt><dd>Search and pin chats, attach files, and keep temporary chats out of history until you save them. <a href="/docs/web-ui/">See the workspace guide</a></dd></div>
          <div><dt>Use one API</dt><dd>Point your editor, scripts, or SDK at one OpenAI-compatible endpoint. Use aliases to keep model names stable in your clients. <a href="/docs/gateway/">Connect a client</a></dd></div>
          <div><dt>Keep your data portable</dt><dd>Run a single-owner instance with server-side encryption and export an encrypted archive to move it later. <a href="/docs/backup/">Back up your data</a></dd></div>
        </dl>
      </section>
      <section className="site-principles site-install" id="install">
        <h2>Run it on your machine or host it</h2>
        <dl>
          <div><dt>npm</dt><dd><pre><code>{commands['npm-quick-start'].command}</code></pre><p>The npm package will be available with the first release. Until then, use Docker or <a href="/docs/installation/#build-from-source">build from source</a>.</p><a href="/docs/quick-start/">Read the quick start</a></dd></div>
          <div><dt>Docker</dt><dd><pre><code>{commands['docker-start'].command}</code></pre><p>Set up the Compose environment before starting. The data volume persists across upgrades.</p><a className="button" href="/docs/docker/">Set up Docker</a></dd></div>
          <div><dt>VPS or Vercel</dt><dd><p>Run on a VPS behind HTTPS, or deploy to Vercel with Turso.</p><div className="site-actions"><a className="button" href="/docs/vps/">Set up a VPS</a><a className="button" href={vercelDeploy}>Deploy to Vercel</a></div><a href="/docs/vercel/">Read the Vercel setup guide</a></dd></div>
        </dl>
      </section>
    </main>
    <footer className="site-footer">
      <Wordmark />
      <nav aria-label="Footer"><a href="/docs/">Documentation</a><a href={repository}>GitHub</a><a href={npmPackage}>npm</a><a href={`${repository}/blob/main/LICENSE`}>MIT License</a></nav>
    </footer>
  </>;
}
