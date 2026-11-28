import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { engines, packageManager } from '../../../../../package.json';
import { source } from '../../../lib/docs-source';

const NodeVersion = () => <code>{engines.node}</code>;
const PnpmVersion = () => <code>{packageManager.split('@')[1]}</code>;
type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const url = `${page.url}/`;
  const { title, description } = page.data;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'ONE ROUTER', url, title, description, images: ['/og.png'] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
  };
}

export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const Body = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody><Body components={{ ...defaultMdxComponents, NodeVersion, PnpmVersion }} /></DocsBody>
    </DocsPage>
  );
}
