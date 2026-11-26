import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ONE ROUTER - Custom Multi-Provider AI Chat Client',
  description:
    'A single local workspace that routes chats across OpenAI, Anthropic, Gemini, and Ollama.',
};

// The theme lives in a cookie so the first paint matches the server setting
// without a flash. The React layer keeps the cookie in sync afterwards.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )one_router_theme=(dark|light)/);var t=m?m[1]:'dark';var r=document.documentElement;if(t==='dark'){r.classList.add('dark')}else{r.classList.remove('dark')}}catch(e){}})();`;

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