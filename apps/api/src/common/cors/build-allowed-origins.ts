const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export const buildAllowedOrigins = (configuredOrigin: string): string[] => {
  try {
    const parsed = new URL(configuredOrigin);

    if (!LOCALHOST_HOSTNAMES.has(parsed.hostname)) {
      return [configuredOrigin];
    }

    const mirror = new URL(configuredOrigin);
    mirror.hostname =
      parsed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';

    return [parsed.origin, mirror.origin];
  } catch {
    return [configuredOrigin];
  }
};
