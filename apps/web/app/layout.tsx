import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ONE ROUTER',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  description:
    'A single local workspace that routes chats across OpenAI, Anthropic, Gemini, and Ollama.',
};

// The theme lives in a cookie so the first paint matches the server setting
// without a flash. The React layer keeps the cookie in sync afterwards.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|;)\\s*one_router_theme=(dark|light|system)(?:;|$)/);var t=m?m[1]:'dark';document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
