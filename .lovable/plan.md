## Why the error appears

`PdfEditor` shows "Adobe PDF Embed client ID is not configured" only when `resolveClientId()` in `src/lib/adobeConfig.ts` returns an empty string. The function currently does an **exact** hostname match against three hosts. Anything else — including a stale cached bundle from before the IDs were wired in, or a Lovable preview served under a slightly different host (`preview--…lovable.app`, `*.lovableproject.com`, custom subdomain, etc.) — falls through to `''` and triggers the error screen.

## Fix

1. **Make hostname resolution forgiving** in `src/lib/adobeConfig.ts`:
   - Keep the explicit map for the three registered production-ish hosts.
   - Add suffix-based fallbacks so **any** Lovable preview URL (`*.lovable.app`, `*.lovableproject.com`) uses the preview client ID `480511be7dd940b6b512278b413699e2`, which is already registered for `id-preview--…lovable.app`. (Adobe accepts wildcard-style domains tied to the registered apex.)
   - Fall back to the preview ID for `localhost` / `127.0.0.1` so local dev works.
   - Production custom domain (`eurobondmarkets.com` + `www.`) keeps its own ID.

2. **Surface the resolved hostname in the error message** so future "not configured" failures tell us exactly which host Adobe sees — no guesswork next time.

3. **Ask the user to hard-refresh** (Cmd/Ctrl + Shift + R) after the change to flush any cached bundle.

## Files touched

- `src/lib/adobeConfig.ts` — add suffix-match fallback, export current hostname for diagnostics.
- `src/components/PdfEditor.tsx` — include the detected hostname in the "not configured" message.

## Out of scope

- Re-registering with Adobe. The preview key already covers `id-preview--…lovable.app`; we only widen the *client-side* match. If Adobe rejects a non-registered host at runtime you'll get a different (Adobe-side) error and we can register that exact host then.
- Any change to viewing/annotation behaviour, persistence, or audit logging.

## Verification

After applying, hard-refresh the preview and click the eye icon on the Aldar PDF again. Expect the Adobe viewer to render. If it still errors, the new message will include the hostname Adobe is rejecting, which we then register at acrobatservices.adobe.com.
