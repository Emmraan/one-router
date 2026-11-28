import type { MetadataRoute } from 'next';
import { source } from '../lib/docs-source';
import { siteUrl } from '../lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/` }, ...source.getPages().map(({ url }) => ({ url: `${siteUrl}${url}/` }))];
}
