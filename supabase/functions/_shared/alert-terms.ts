// Mirrors termsHash in src/lib/newIssueAlerts.ts — keep both in step.
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
export function termsHash(state: unknown): string {
  const s = (state && typeof state === 'object' ? state : {}) as Record<string, unknown>;
  const text = stable({ stage: s.stage ?? null, f: s.f ?? {}, parties: s.parties ?? [], ids: s.ids ?? [], ratings: s.ratings ?? [], contacts: s.contacts ?? [] });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + ':' + text.length;
}
