import { describe, expect, it } from 'vitest';

import { shouldExposeSwagger } from './swagger';

describe('shouldExposeSwagger', () => {
  it('does not expose Swagger in production', () => {
    expect(shouldExposeSwagger('production')).toBe(false);
  });

  it('exposes Swagger in development', () => {
    expect(shouldExposeSwagger('development')).toBe(true);
  });

  it('exposes Swagger in test', () => {
    expect(shouldExposeSwagger('test')).toBe(true);
  });
});
