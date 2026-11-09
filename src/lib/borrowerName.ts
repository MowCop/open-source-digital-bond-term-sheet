import type { Deal } from '@/types/bond';

/** Display only the borrower, leaving the recorded legal issuer unchanged. */
export function shortBorrowerName(issuerName: string): string {
  return issuerName.split(/\s+[–—-]\s+/)[0].trim()
    .replace(/\s+Financing(?:\s+[A-Z][\w.-]*)*\s+(?:LLC|Limited|Ltd|PLC)$/i, '').trim();
}

/** Saved BDT issuer is authoritative; legacy deals alone use the flat name. */
export function dealBorrowerName(deal: Pick<Deal, 'issuerName' | 'bdtState'>): string {
  const state = deal.bdtState;
  if (state?.f && typeof state.f === 'object') {
    const issuer = state.parties?.find((p: { Roles?: string[] }) => p.Roles?.includes('ISSUER'));
    return shortBorrowerName(issuer?.PartyName ?? '');
  }
  return shortBorrowerName(deal.issuerName);
}