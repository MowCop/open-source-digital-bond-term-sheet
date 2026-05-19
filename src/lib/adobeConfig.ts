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
export const ADOBE_EMBED_CLIENT_ID: string =
  (import.meta.env.VITE_ADOBE_EMBED_CLIENT_ID as string | undefined) ?? '';

export const isAdobeEmbedConfigured = (): boolean =>
  typeof ADOBE_EMBED_CLIENT_ID === 'string' && ADOBE_EMBED_CLIENT_ID.length > 0;