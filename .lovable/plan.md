The screenshot shows Adobe is rejecting the **runtime editor host**:

`15a55c38-d908-458f-b4b6-1a35e223ab92.lovableproject.com`

The app is currently falling back to the preview Adobe client ID for `*.lovableproject.com`, but Adobe client IDs are domain-locked and that preview key is not authorized for this exact host.

Plan:

1. **Add a dedicated Adobe client ID mapping for the editor host**
   - Add `15a55c38-d908-458f-b4b6-1a35e223ab92.lovableproject.com` to `src/lib/adobeConfig.ts`.
   - Use the same client ID only if you register this exact domain in Adobe.

2. **Remove the unsafe `*.lovableproject.com` fallback**
   - Adobe does not accept arbitrary fallback hosts unless the key is authorized for that specific domain.
   - Keeping the wildcard-style fallback causes the current “not authorized” Adobe modal instead of a helpful in-app error.

3. **Improve the in-app error for unregistered domains**
   - If the app runs on an unregistered hostname, show a clear message naming the exact host to add in Adobe.
   - Keep the download fallback available so users can still access the PDF.

Required Adobe action:

- In Adobe PDF Embed API settings, create/register a client ID for:
  - `15a55c38-d908-458f-b4b6-1a35e223ab92.lovableproject.com`

Once you provide that client ID, I’ll wire it in so the eye-icon PDF viewer works inside the Lovable editor as well as on the published/custom domains.