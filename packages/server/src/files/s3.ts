import { AwsV4Signer } from 'aws4fetch';
import type { FetchLike } from '@one-router/core';
import type { S3Config } from '../env';
import type { ObjectStorage } from './filesystem';

function objectUrl(config: S3Config, key: string): string {
  const url = new URL(config.endpoint);
  const pathStyle = config.forcePathStyle || url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (pathStyle) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${config.bucket}/${key}`;
  } else {
    url.hostname = `${config.bucket}.${url.hostname}`;
    url.pathname = `/${key}`;
  }
  return url.toString();
}

export function createS3Storage(config: S3Config, fetchImpl?: FetchLike): ObjectStorage {
  const request = async (method: string, key: string, body?: Uint8Array) => {
    const signer = new AwsV4Signer({
      method,
      url: objectUrl(config, key),
      headers: body ? { 'Content-Type': 'application/octet-stream' } : undefined,
      body: body as BodyInit | undefined,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region,
    });
    const signed = await signer.sign();
    return (fetchImpl ?? fetch)(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: signed.body,
      redirect: 'manual',
    });
  };
  return {
    async put(key, bytes) {
      const response = await request('PUT', key, new Uint8Array(bytes));
      await response.body?.cancel();
      if (!response.ok) throw new Error('Unable to store file');
    },
    async get(key) {
      const response = await request('GET', key);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Unable to read file');
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    async delete(key) {
      const response = await request('DELETE', key);
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) throw new Error('Unable to delete file');
    },
  };
}
