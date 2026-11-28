export const siteUrl = 'https://one-router-lac.vercel.app';
export const repository = 'https://github.com/Emmraan/one-router';
export const npmPackage = 'https://www.npmjs.com/package/onerouter';
export const vercelDeploy = `https://vercel.com/new/clone?${new URLSearchParams({
  'repository-url': repository,
  'root-directory': 'apps/web',
  env: 'TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,ONE_ROUTER_ENCRYPTION_KEY,INITIAL_PASSWORD',
  'env-description': 'Use a new Turso database, a stable encryption key and an initial owner password.',
  'env-link': `${siteUrl}/docs/vercel/`,
})}`;
