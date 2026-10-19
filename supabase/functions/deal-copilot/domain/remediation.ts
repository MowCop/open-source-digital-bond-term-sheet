// Checker remediation: one row per open Deal Checker finding after a save.
// "proposed" only when an evidenced term correction for that field survived the evidence guard.
export type LiveIn = { l: 'pass' | 'warn' | 'fail'; t: string; ignored?: boolean };
export type CheckerFinding = { check: string; level: 'warn' | 'fail'; resolution: 'proposed' | 'needs_input'; field?: string; note?: string };

export function checkerFindings(raw: unknown, live: LiveIn[], terms: { field: string }[] = []): CheckerFinding[] {
  const ai = Array.isArray(raw) ? raw : [];
  const fields = new Set(terms.map((t) => t.field));
  return live
    .filter((c) => c.l !== 'pass' && !c.ignored)
    .slice(0, 60)
    .map((c) => {
      const hit = ai.find((a: any) => a && typeof a.check === 'string' && a.check.trim() === c.t.trim()) as any;
      const field = typeof hit?.field === 'string' ? hit.field : undefined;
      const proposed = hit?.resolution === 'proposed' && !!field && fields.has(field);
      const note = typeof hit?.note === 'string' ? hit.note.slice(0, 300) : undefined;
      return {
        check: c.t,
        level: c.l as 'warn' | 'fail',
        resolution: proposed ? 'proposed' : 'needs_input',
        ...(proposed ? { field } : {}),
        ...(proposed ? {} : { note: note || 'No document evidence found for a correction.' }),
      };
    });
}
