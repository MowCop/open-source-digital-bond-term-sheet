import { supabase } from '@/integrations/supabase/client';

export const emptyNewDeal = () => ({
  issuerName: '', currency: '', size: '', tenor: '', coupon: '',
  issuerRating: '', issuanceType: '', governingLaw: '',
});

export function canCreateNewDeal(issuerName: string, bookrunners: { name: string }[]) {
  return issuerName.trim().length > 0 && bookrunners.some(br => br.name.trim().length > 0);
}

export function fillEmptyIssuer(current: string, extracted: unknown): string {
  return current.trim() || typeof extracted !== 'string' ? current : extracted.trim();
}

/** Reuse existing document readers and extraction service; only the issuer is auto-filled. */
export async function extractNewDealIssuer(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith('.pdf')) {
    const { pdfFileToHtml } = await import('@/lib/pdfToHtml');
    text = (await pdfFileToHtml(file)).text;
  } else if (name.endsWith('.docx')) {
    const { docxFileToHtml } = await import('@/lib/docxToHtml');
    text = (await docxFileToHtml(file)).text;
  } else if (name.endsWith('.xml')) {
    const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The XML file could not be read');
    const nodes = Array.from(doc.getElementsByTagName('*'));
    const issuer = nodes.filter(n => n.localName === 'Party').find(p =>
      Array.from(p.getElementsByTagName('*')).some(n => n.localName === 'PartyRoleType' && n.textContent?.trim() === 'ISSUER'));
    const issuerName = issuer && Array.from(issuer.getElementsByTagName('*')).find(n => n.localName === 'PartyName')?.textContent?.trim();
    if (issuerName) return issuerName;
    text = doc.documentElement.textContent ?? '';
  } else if (/\.html?$/.test(name)) {
    const { stripHtml } = await import('@/lib/htmlText');
    text = stripHtml(await file.text());
  } else {
    text = await file.text();
  }
  if (!text.trim()) return '';
  const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', {
    body: { text: text.slice(0, 150000) },
  });
  if (error || data?.error) throw new Error('Issuer lookup was unsuccessful');
  return fillEmptyIssuer('', data?.keyTerms?.['Issuer Name']);
}