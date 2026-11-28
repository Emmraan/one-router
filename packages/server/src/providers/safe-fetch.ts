import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { assertSafeUrl, type FetchLike } from '@one-router/core';
import { Agent, fetch as undiciFetch } from 'undici';

type Resolve = (hostname: string) => Promise<LookupAddress[]>;

export function createSafeLookup(resolve: Resolve = (hostname) => lookup(hostname, { all: true })): LookupFunction {
  return (hostname, options, callback) => {
    void resolve(hostname).then((addresses) => {
      if (!addresses.length) throw new Error();
      for (const { address } of addresses) {
        const host = address.includes(':') ? `[${address}]` : address;
        assertSafeUrl(`http://${host}`, { allowLocalhost: hostname.toLowerCase().replace(/\.$/, '') === 'localhost' });
      }
      const family = Number(options.family);
      const selected = family === 4 || family === 6 ? addresses.filter((item) => item.family === family) : addresses;
      if (!selected.length) throw new Error();
      // This is the socket's lookup, not a preflight check followed by an unsafe second resolution.
      if (options.all) callback(null, selected);
      else callback(null, selected[0].address, selected[0].family);
    }).catch(() => callback(new Error('Provider address is not allowed'), ''));
  };
}

const dispatcher = new Agent({ connect: { lookup: createSafeLookup(), timeout: 10_000 } });
// Node's bundled fetch may use a different dispatcher protocol than the installed Agent.
const providerFetch = undiciFetch as unknown as FetchLike;

export const safeProviderFetch: FetchLike = async (input, init) => {
  const raw = input instanceof Request ? input.url : String(input);
  // Core adapters permit literal loopback only for Ollama; all other private literals remain forbidden.
  assertSafeUrl(raw, { allowLocalhost: true });
  return providerFetch(input, { ...init, redirect: 'manual', dispatcher } as RequestInit);
};
