// Utilities for working with the rich-text body content stored as HTML.

/** Strip all HTML tags from a string, decode common entities, collapse whitespace. */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (!/<[a-z!\/][^>]*>/i.test(html)) return html; // already plain text
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Preserve paragraph / line breaks visually.
      doc.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach(el => {
        el.append('\n');
      });
      // Table cells need explicit separators or "<td>Issuer</td><td>Aldar</td>"
      // collapses to "IssuerAldar" and label-based extraction breaks.
      doc.querySelectorAll('td, th').forEach(el => {
        el.append('\t');
      });
      doc.querySelectorAll('tr').forEach(el => {
        el.append('\n');
      });
      return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      /* fall through */
    }
  }
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True if the string contains any HTML markup (used to decide rendering path). */
export function isHtml(s: string): boolean {
  return !!s && /<[a-z!\/][^>]*>/i.test(s);
}