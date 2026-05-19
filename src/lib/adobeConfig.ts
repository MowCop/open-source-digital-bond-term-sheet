/**
 * Adobe PDF Embed API client ID.
 *
 * Register a free client ID at:
 *   https://acrobatservices.adobe.com/dc-integration-creation-app-cdn/main.html
 *
 * The key is domain-locked, so it is safe to commit to the codebase.
 * Register for these allowed domains:
 *   - id-preview--15a55c38-d908-458f-b4b6-1a35e223ab92.lovable.app
 *   - newissuevault.lovable.app
 *   - eurobondmarkets.com
 *   - localhost (for local dev)
 *
 * The build will read VITE_ADOBE_EMBED_CLIENT_ID first (set in .env), and fall
 * back to the hardcoded value below.
 */
/**
 * Domain-locked client IDs. Adobe validates the key against the page's hostname,
 * so we pick the right one at runtime.
 */
const PREVIEW_CLIENT_ID = '480511be7dd940b6b512278b413699e2';
const NEWISSUEVAULT_CLIENT_ID = '6c4ecfa46b6a419d9a682b7fb1c0dbb6';
const EUROBONDMARKETS_CLIENT_ID = '7dab418524924e81b9015020bfa990e6';

const CLIENT_IDS_BY_HOST: Record<string, string> = {
  'id-preview--15a55c38-d908-458f-b4b6-1a35e223ab92.lovable.app': PREVIEW_CLIENT_ID,
  'newissuevault.lovable.app': NEWISSUEVAULT_CLIENT_ID,
  'eurobondmarkets.com': EUROBONDMARKETS_CLIENT_ID,
  'www.eurobondmarkets.com': EUROBONDMARKETS_CLIENT_ID,
};

export const CURRENT_HOSTNAME: string =
  typeof window !== 'undefined' ? window.location.hostname : '';

function resolveClientId(): string {
  const fromEnv = import.meta.env.VITE_ADOBE_EMBED_CLIENT_ID as string | undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const host = CURRENT_HOSTNAME;
  if (!host) return '';

  if (CLIENT_IDS_BY_HOST[host]) return CLIENT_IDS_BY_HOST[host];

  // Other *.lovable.app hosts (preview--*, etc.) share the preview client ID,
  // which is registered against id-preview--…lovable.app.
  if (host.endsWith('.lovable.app')) {
    return PREVIEW_CLIENT_ID;
  }

  // Local dev
  if (host === 'localhost' || host === '127.0.0.1') {
    return PREVIEW_CLIENT_ID;
  }

  // Custom-domain fallback: subdomains of eurobondmarkets.com
  if (host.endsWith('.eurobondmarkets.com') || host === 'eurobondmarkets.com') {
    return EUROBONDMARKETS_CLIENT_ID;
  }

  return '';
}

export const ADOBE_EMBED_CLIENT_ID: string = resolveClientId();

export const isAdobeEmbedConfigured = (): boolean =>
  typeof ADOBE_EMBED_CLIENT_ID === 'string' && ADOBE_EMBED_CLIENT_ID.length > 0;