import { describe, expect, it } from 'vitest';
import { createSafeLookup } from './safe-fetch';
import type { LookupAddress, LookupOptions } from 'node:dns';

async function lookup(addresses: LookupAddress[], options: LookupOptions = { all: true }, hostname = 'provider.example') {
  const resolve = async () => addresses;
  return new Promise((accept, reject) => createSafeLookup(resolve)(hostname, options, (error, address, family) => {
    if (error) reject(error);
    else accept({ address, family });
  }));
}

describe('provider connection DNS validation', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1'])(
    'rejects a public hostname resolving to %s', async (address) => {
      await expect(lookup([{ address, family: address.includes(':') ? 6 : 4 }])).rejects.toThrow('Provider address is not allowed');
    },
  );

  it('rejects mixed public/private answers rather than trying the private fallback', async () => {
    await expect(lookup([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.2', family: 4 }]))
      .rejects.toThrow('Provider address is not allowed');
  });

  it('returns only the validated answer set to the socket connector', async () => {
    const addresses = [{ address: '93.184.216.34', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
    await expect(lookup(addresses)).resolves.toEqual({ address: addresses, family: undefined });
    await expect(lookup(addresses, { family: 4 })).resolves.toEqual({ address: addresses[0].address, family: 4 });
  });

  it('checks each new connection so a later private answer cannot rebind', async () => {
    let count = 0;
    const resolve = async () => [{ address: ++count === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }];
    const safeLookup = createSafeLookup(resolve);
    const connect = () => new Promise((accept, reject) => safeLookup('provider.example', { all: true }, (error, addresses) => {
      if (error) reject(error); else accept(addresses);
    }));
    await expect(connect()).resolves.toHaveLength(1);
    await expect(connect()).rejects.toThrow('Provider address is not allowed');
  });

  it.each(['localhost', 'localhost.', 'LOCALHOST'])('preserves explicit %s support for Ollama but not private LAN addresses', async (hostname) => {
    await expect(lookup([{ address: '127.0.0.1', family: 4 }], { all: true }, hostname)).resolves.toBeDefined();
    await expect(lookup([{ address: '10.0.0.1', family: 4 }], { all: true }, hostname)).rejects.toThrow();
  });

  it('fails closed on empty answers and does not expose DNS failure text', async () => {
    await expect(lookup([])).rejects.toThrow('Provider address is not allowed');
    const resolve = async (): Promise<LookupAddress[]> => { throw new Error('sensitive resolver details'); };
    await expect(new Promise((accept, reject) => createSafeLookup(resolve)('provider.example', {}, (error, address) => {
      if (error) reject(error); else accept(address);
    }))).rejects.toThrow('Provider address is not allowed');
  });
});
