import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ONE ROUTER — Your models, one workspace',
  description: 'A self-hosted workspace for your AI providers, conversations, and files.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
