import { createHmac, createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  StorageSignedUrlResult,
  StorageUploadInput,
  StorageUploadResult,
} from './storage.types';

interface StorageConfig {
  accessKey: string;
  bucket: string;
  endpoint: string;
  port: number;
  secretKey: string;
  useSsl: boolean;
}

const S3_ALGORITHM = 'AWS4-HMAC-SHA256';
const S3_REGION = 'us-east-1';
const S3_SERVICE = 's3';
const SIGNED_URL_EXPIRES_SECONDS = 300;

const hmac = (key: Buffer | string, value: string) =>
  createHmac('sha256', key).update(value).digest();

const sha256Hex = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');

const encodePathSegment = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const encodeQueryValue = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const formatAmzDate = (date: Date) =>
  date.toISOString().replace(/[:-]|\.\d{3}/g, '');

const formatDateStamp = (date: Date) =>
  date.toISOString().slice(0, 10).replace(/-/g, '');

const buildContentDisposition = (filename: string): string => {
  // RFC 6266: a quoted ASCII fallback (control characters, quotes, and
  // backslashes neutralized) plus an RFC 5987 UTF-8 parameter so non-ASCII
  // names survive. The whole value is signed and returned by storage as the
  // response Content-Disposition header.
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'download';

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
};

@Injectable()
export class StorageService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const config = this.getConfig();
    const now = new Date();
    const payloadHash = sha256Hex(input.buffer);
    const pathname = this.buildObjectPath(config.bucket, input.key);
    const headers = this.buildUploadHeaders({
      config,
      contentLength: input.buffer.length,
      mimeType: input.mimeType,
      now,
      payloadHash,
      pathname,
    });
    const response = await fetch(this.buildObjectUrl(config, input.key), {
      method: 'PUT',
      headers,
      body: input.buffer,
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Attachment upload failed in object storage.',
      );
    }

    return {
      key: input.key,
    };
  }

  async getSignedUrl(
    key: string,
    options: { downloadFilename?: string } = {},
  ): Promise<StorageSignedUrlResult> {
    const config = this.getConfig();
    const now = new Date();
    const objectPath = this.buildObjectPath(config.bucket, key);
    const host = this.buildHost(config);
    const protocol = config.useSsl ? 'https' : 'http';
    const amzDate = formatAmzDate(now);
    const dateStamp = formatDateStamp(now);
    const credentialScope = `${dateStamp}/${S3_REGION}/${S3_SERVICE}/aws4_request`;
    const credential = `${config.accessKey}/${credentialScope}`;
    const signedHeaders = 'host';

    const queryParams: Array<[string, string]> = [
      ['X-Amz-Algorithm', S3_ALGORITHM],
      ['X-Amz-Credential', credential],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(SIGNED_URL_EXPIRES_SECONDS)],
      ['X-Amz-SignedHeaders', signedHeaders],
    ];

    if (options.downloadFilename) {
      // Signed response override so storage returns `Content-Disposition:
      // attachment`, forcing a download instead of inline rendering and
      // mitigating stored-XSS via attacker-controlled file content.
      queryParams.push([
        'response-content-disposition',
        buildContentDisposition(options.downloadFilename),
      ]);
    }

    const canonicalRequest = [
      'GET',
      objectPath,
      this.canonicalQueryString(queryParams),
      `host:${host}\n`,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      S3_ALGORITHM,
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');
    const signature = this.sign(stringToSign, dateStamp, config.secretKey);

    // Build the returned URL with the SAME encoder and ordering used for the
    // signature so the request query string matches the signed canonical query
    // byte-for-byte (URLSearchParams form-encoding would diverge on spaces).
    const finalQuery = this.canonicalQueryString([
      ...queryParams,
      ['X-Amz-Signature', signature],
    ]);

    return {
      expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
      url: `${protocol}://${host}${objectPath}?${finalQuery}`,
    };
  }

  async delete(key: string): Promise<void> {
    const config = this.getConfig();
    const now = new Date();
    const payloadHash = sha256Hex('');
    const pathname = this.buildObjectPath(config.bucket, key);
    const headers = this.buildSignedHeaders({
      config,
      method: 'DELETE',
      now,
      payloadHash,
      pathname,
    });
    const response = await fetch(this.buildObjectUrl(config, key), {
      method: 'DELETE',
      headers,
    });

    if (!response.ok && response.status !== 404) {
      throw new InternalServerErrorException(
        'Attachment deletion failed in object storage.',
      );
    }
  }

  private getConfig(): StorageConfig {
    const storage = this.configService.get<StorageConfig>('storage');

    if (!storage) {
      throw new InternalServerErrorException(
        'Storage configuration is missing.',
      );
    }

    return storage;
  }

  private buildObjectUrl(config: StorageConfig, key: string) {
    const protocol = config.useSsl ? 'https' : 'http';

    return `${protocol}://${this.buildHost(config)}${this.buildObjectPath(
      config.bucket,
      key,
    )}`;
  }

  private buildHost(config: StorageConfig) {
    return `${config.endpoint}:${config.port}`;
  }

  private buildObjectPath(bucket: string, key: string) {
    return `/${encodePathSegment(bucket)}/${key
      .split('/')
      .map(encodePathSegment)
      .join('/')}`;
  }

  private buildUploadHeaders(input: {
    config: StorageConfig;
    contentLength: number;
    mimeType: string;
    now: Date;
    payloadHash: string;
    pathname: string;
  }) {
    return {
      ...this.buildSignedHeaders({
        config: input.config,
        method: 'PUT',
        now: input.now,
        payloadHash: input.payloadHash,
        pathname: input.pathname,
      }),
      'content-length': String(input.contentLength),
      'content-type': input.mimeType,
    };
  }

  private buildSignedHeaders(input: {
    config: StorageConfig;
    method: 'DELETE' | 'PUT';
    now: Date;
    payloadHash: string;
    pathname: string;
  }) {
    const amzDate = formatAmzDate(input.now);
    const dateStamp = formatDateStamp(input.now);
    const credentialScope = `${dateStamp}/${S3_REGION}/${S3_SERVICE}/aws4_request`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders = [
      `host:${this.buildHost(input.config)}`,
      `x-amz-content-sha256:${input.payloadHash}`,
      `x-amz-date:${amzDate}`,
      '',
    ].join('\n');
    const canonicalRequest = [
      input.method,
      input.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      input.payloadHash,
    ].join('\n');
    const stringToSign = [
      S3_ALGORITHM,
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');
    const signature = this.sign(
      stringToSign,
      dateStamp,
      input.config.secretKey,
    );

    return {
      authorization: `${S3_ALGORITHM} Credential=${input.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      host: this.buildHost(input.config),
      'x-amz-content-sha256': input.payloadHash,
      'x-amz-date': amzDate,
    };
  }

  private canonicalQueryString(
    entries: ReadonlyArray<readonly [string, string]>,
  ): string {
    // AWS SigV4 requires the query parameters sorted by code point (byte
    // order), not locale order, and each key/value RFC-3986 percent-encoded.
    return [...entries]
      .sort((left, right) => {
        if (left[0] !== right[0]) {
          return left[0] < right[0] ? -1 : 1;
        }
        return left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0;
      })
      .map(
        ([key, value]) => `${encodeQueryValue(key)}=${encodeQueryValue(value)}`,
      )
      .join('&');
  }

  private sign(stringToSign: string, dateStamp: string, secretKey: string) {
    const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
    const regionKey = hmac(dateKey, S3_REGION);
    const serviceKey = hmac(regionKey, S3_SERVICE);
    const signingKey = hmac(serviceKey, 'aws4_request');

    return createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  }
}
