import { CoreError } from './errors';

export interface SafeUrlOptions {
  allowLocalhost?: boolean;
}

const BLOCKED_HOSTS = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'metadata.azure.com',
  'metadata.oraclecloud.com',
  'instance-data',
  'instance-data.ec2.internal',
]);

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.lan',
  '.test',
  '.invalid',
];

const REBIND_SUFFIXES = [
  '.nip.io',
  '.sslip.io',
  '.xip.io',
  '.lvh.me',
  '.localtest.me',
  '.vcap.me',
  '.traefik.me',
];

function blocked(message: string): CoreError {
  return new CoreError('BLOCKED_URL', message);
}

function invalid(message: string): CoreError {
  return new CoreError('INVALID_URL', message);
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;

  const numbers = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
  );
  if (
    numbers.some(
      (value) => !Number.isInteger(value) || value < 0 || value > 255,
    )
  ) {
    return null;
  }

  return numbers as [number, number, number, number];
}

function isBlockedIpv4(
  address: [number, number, number, number],
  allowLocalhost: boolean,
): boolean {
  const [a, b, c] = address;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return !allowLocalhost;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;

  return false;
}

function parseIpv6(host: string): number[] | null {
  let input = host;
  const zone = input.indexOf('%');
  if (zone >= 0) input = input.slice(0, zone);
  if (!input.includes(':')) return null;

  const halves = input.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(':');
    const values: number[] = [];

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      if (group.includes('.')) {
        if (index !== groups.length - 1) return null;
        const ipv4 = parseIpv4(group);
        if (!ipv4) return null;
        values.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
        values.push(Number.parseInt(group, 16));
      }
    }

    return values;
  };

  const left = parseGroups(halves[0]);
  if (!left) return null;

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const right = parseGroups(halves[1]);
  if (!right) return null;

  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;

  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

function isBlockedIpv6(groups: number[], allowLocalhost: boolean): boolean {
  const bytes = groups.flatMap((group) => [group >> 8, group & 0xff]);

  if (bytes.every((byte) => byte === 0)) return true;

  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (loopback) return !allowLocalhost;

  const mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  const compatible =
    bytes.slice(0, 12).every((byte) => byte === 0) && bytes[12] !== 0;
  if (mapped || compatible) {
    return isBlockedIpv4(
      [bytes[12], bytes[13], bytes[14], bytes[15]],
      allowLocalhost,
    );
  }

  if ((bytes[0] & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;
  if (bytes[0] === 0xff) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) {
    return true;
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0) {
    return true;
  }
  if (bytes[0] === 0 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return true;
  }

  return false;
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw invalid('Base URL is required');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalid('Invalid base URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw invalid('Base URL must use http or https');
  }
  if (url.username || url.password) {
    throw invalid('Base URL must not contain credentials');
  }
  if (url.search || url.hash) {
    throw invalid('Base URL must not contain a query or fragment');
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function assertSafeUrl(
  raw: string,
  options: SafeUrlOptions = {},
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw blocked('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw blocked('URL credentials are not allowed');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) throw blocked('URL has no hostname');

  const ipv4 = parseIpv4(hostname);
  if (ipv4) {
    if (isBlockedIpv4(ipv4, options.allowLocalhost === true)) {
      throw blocked('Private or loopback addresses are not allowed');
    }
    return url;
  }

  if (hostname.includes(':')) {
    const ipv6 = parseIpv6(hostname);
    if (!ipv6) throw blocked('Invalid IPv6 address');
    if (isBlockedIpv6(ipv6, options.allowLocalhost === true)) {
      throw blocked('Private or loopback addresses are not allowed');
    }
    return url;
  }

  const host = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;

  if (host === 'localhost') {
    if (options.allowLocalhost === true) return url;
    throw blocked('Loopback addresses are not allowed');
  }
  if (BLOCKED_HOSTS.has(host)) {
    throw blocked('Cloud metadata addresses are not allowed');
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw blocked('Private hostnames are not allowed');
  }
  if (
    REBIND_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
    )
  ) {
    throw blocked('DNS rebinding hosts are not allowed');
  }
  if (!host.includes('.')) {
    throw blocked('Single-label hostnames are not allowed');
  }

  return url;
}
