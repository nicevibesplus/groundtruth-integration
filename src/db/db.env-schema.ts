import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function asBool(v: string | undefined, defaultValue = false): boolean {
  if (v == null) return defaultValue;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function isProbablyUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export const envDB = {
  DATABASE_URL: (() => {
    const url = required('DATABASE_URL');
    if (!isProbablyUrl(url)) {
      throw new Error(`DATABASE_URL is not a valid URL: ${url}`);
    }
    return url;
  })(),
  PG_CLIENT_SSL: asBool(process.env.PG_CLIENT_SSL, false),
} as const;