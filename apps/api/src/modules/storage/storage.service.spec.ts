import 'reflect-metadata';

import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageService } from './storage.service';

const storageConfig = {
  accessKey: 'minioadmin',
  bucket: 'attachments',
  endpoint: 'localhost',
  port: 9000,
  secretKey: 'minioadmin',
  useSsl: false,
};

const buildService = () => {
  const configService = {
    get: vi.fn((key: string) =>
      key === 'storage' ? storageConfig : undefined,
    ),
  } as unknown as ConfigService;

  return new StorageService(configService);
};

describe('StorageService.getSignedUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces a presigned GET URL with the standard SigV4 query parameters', async () => {
    const service = buildService();

    const result = await service.getSignedUrl('tickets/abc/uuid-file.png');

    expect(result.expiresInSeconds).toBe(300);
    const url = new URL(result.url);
    expect(url.protocol).toBe('http:');
    expect(url.host).toBe('localhost:9000');
    expect(url.pathname).toBe('/attachments/tickets/abc/uuid-file.png');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    // No download override requested -> no response-content-disposition.
    expect(url.searchParams.get('response-content-disposition')).toBeNull();
  });

  it('adds a signed attachment Content-Disposition override when a filename is provided', async () => {
    const service = buildService();

    const result = await service.getSignedUrl('tickets/abc/uuid-file.png', {
      downloadFilename: 'Quarterly Report.pdf',
    });

    const url = new URL(result.url);
    const disposition = url.searchParams.get('response-content-disposition');
    expect(disposition).not.toBeNull();
    // URL parsing decodes the percent-encoding back to the raw header value.
    expect(disposition).toContain('attachment;');
    expect(disposition).toContain('filename="Quarterly Report.pdf"');
    expect(disposition).toContain("filename*=UTF-8''");
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs the Content-Disposition override (omitting it changes the signature)', async () => {
    const service = buildService();

    const withDisposition = await service.getSignedUrl('tickets/abc/file.png', {
      downloadFilename: 'file.png',
    });
    const withoutDisposition = await service.getSignedUrl(
      'tickets/abc/file.png',
    );

    const withSig = new URL(withDisposition.url).searchParams.get(
      'X-Amz-Signature',
    );
    const withoutSig = new URL(withoutDisposition.url).searchParams.get(
      'X-Amz-Signature',
    );

    expect(withSig).not.toBe(withoutSig);
  });

  it('neutralizes quotes and control characters in the ASCII filename fallback', async () => {
    const service = buildService();

    const result = await service.getSignedUrl('tickets/abc/file.png', {
      downloadFilename: 'in"jec\ttion.png',
    });

    const disposition = new URL(result.url).searchParams.get(
      'response-content-disposition',
    );
    // The quoted fallback must not contain a raw double-quote that could break
    // out of the header parameter.
    const fallback = disposition?.match(/filename="([^"]*)"/)?.[1];
    expect(fallback).toBe('in_jec_tion.png');
  });
});
