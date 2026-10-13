/** Display only the borrower, leaving the stored deal title unchanged. */
export function shortBorrowerName(issuerName: string): string {
  return issuerName.split(/\s+[–—-]\s+/)[0].trim();
}