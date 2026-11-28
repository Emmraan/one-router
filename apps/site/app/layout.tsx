import type { Metadata } from 'next';
import { siteUrl } from '../lib/site';
import './globals.css';

const title = 'ONE ROUTER | Self-hosted AI chat and API gateway';
const description = 'Connect your AI providers in one workspace, or use them through an OpenAI-compatible API. Self-host locally, on a VPS, or on Vercel.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: '%s | ONE ROUTER Docs' },
  description,
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: { type: 'website', url: '/', siteName: 'ONE ROUTER', title, description, images: [{ url: '/og.png', alt: 'ONE ROUTER' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
