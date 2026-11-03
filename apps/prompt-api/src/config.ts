export interface ApiConfig {
  apiKey: string;
  accessKey: string;
  allowedOrigins: readonly string[];
  port: number;
}

/** Read server-only settings, allowing absent keys while setup is still incomplete. */
export function readConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(environment.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const accessKey = environment.PROMPT_BUILDER_ACCESS_KEY?.trim() ?? '';
  if (accessKey && accessKey.length < 24) throw new Error('PROMPT_BUILDER_ACCESS_KEY must contain at least 24 characters.');
  // Empty entries are ignored; URL validation rejects paths and wildcard origins.
  const allowedOrigins = (environment.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.origin !== origin || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins or local development origins.');
    }
  }
  return { apiKey: environment.OPENAI_API_KEY?.trim() ?? '', accessKey, allowedOrigins, port };
}
