import { stripHtml } from './htmlText';

/**
 * Convert a PDF to HTML using pdf.js, reconstructing layout heuristically:
 *  - groups text items into lines by Y position
 *  - infers headings from font size (largest = h1, large = h2)
 *  - infers <strong> from fontName containing "Bold"
 *  - detects simple tables when multiple consecutive lines share column gaps
 *  - renders pages that contain image XObjects as <img> snapshots above the
 *    reconstructed text, preserving logos
 */
export async function pdfFileToHtml(file: File): Promise<{ html: string; text: string }> {
  const pdfjs: any = await import('pdfjs-dist');
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const pages: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // Group items into lines by Y position
    type Item = { str: string; x: number; y: number; w: number; h: number; bold: boolean };
    const items: Item[] = (content.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.length > 0)
      .map(it => {
        const tr = it.transform as number[];
        const x = tr[4];
        const y = tr[5];
        const h = Math.abs(tr[3] || tr[0] || 10);
        const fontName = String(it.fontName || '');
        const bold = /bold|black|heavy/i.test(fontName);
        return { str: it.str, x, y, w: it.width || 0, h, bold };
      });

    if (items.length === 0) {
      // Try image fallback for image-only pages
      const img = await renderPageImage(page);
      if (img) pages.push(`<p><img src="${img}" alt="Page ${p}" style="max-width:100%"/></p>`);
      continue;
    }

    // Page width for centering detection
    const viewport = page.getViewport({ scale: 1 });
    const pageW = viewport.width;

    // Sort by Y desc (PDF origin bottom-left), then X asc
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    // Cluster into lines (items within 3pt vertically)
    const lines: Item[][] = [];
    let current: Item[] = [];
    let currentY = items[0].y;
    for (const it of items) {
      if (Math.abs(it.y - currentY) < 3) {
        current.push(it);
      } else {
        lines.push(current);
        current = [it];
        currentY = it.y;
      }
    }
    if (current.length) lines.push(current);

    // Re-sort each line by X
    lines.forEach(l => l.sort((a, b) => a.x - b.x));

    // Determine median font size for heading heuristic
    const sizes = items.map(i => i.h).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] || 10;

    // Optional logo/image at top of page
    const ops = await page.getOperatorList().catch(() => null);
    let topImage = '';
    if (ops) {
      const hasImage = ops.fnArray.some(
        (fn: number) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject,
      );
      if (hasImage) {
        const img = await renderPageImage(page, 1.2);
        if (img) topImage = `<p style="text-align:center"><img src="${img}" alt="Page ${p} image" style="max-width:60%"/></p>`;
      }
    }

    const html: string[] = [];
    if (topImage) html.push(topImage);

    let i = 0;
    while (i < lines.length) {
      // Detect a table block: ≥2 consecutive lines with ≥2 items spaced by big X gaps
      const tableLines: Item[][] = [];
      let j = i;
      while (j < lines.length && isTableLine(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      if (tableLines.length >= 2) {
        html.push(linesToTable(tableLines));
        i = j;
        continue;
      }

      const line = lines[i];
      const text = line.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) { i++; continue; }

      const maxSize = Math.max(...line.map(it => it.h));
      const allBold = line.every(it => it.bold);
      const lineLeft = line[0].x;
      const lineRight = line[line.length - 1].x + (line[line.length - 1].w || 0);
      const lineCenter = (lineLeft + lineRight) / 2;
      const isCentered = Math.abs(lineCenter - pageW / 2) < pageW * 0.1;

      if (maxSize > median * 1.6) {
        html.push(`<h1${isCentered ? ' style="text-align:center"' : ''}>${escapeHtml(text)}</h1>`);
      } else if (maxSize > median * 1.25 || (allBold && isCentered)) {
        html.push(`<h2${isCentered ? ' style="text-align:center"' : ''}>${escapeHtml(text)}</h2>`);
      } else if (allBold) {
        html.push(`<p${isCentered ? ' style="text-align:center"' : ''}><strong>${escapeHtml(text)}</strong></p>`);
      } else {
        html.push(`<p${isCentered ? ' style="text-align:center"' : ''}>${escapeHtml(text)}</p>`);
      }
      i++;
    }

    pages.push(html.join('\n'));
  }

  const html = pages.join('\n<hr/>\n');
  return { html, text: stripHtml(html) };
}

function isTableLine(line: { str: string; x: number; w: number }[]): boolean {
  if (line.length < 2) return false;
  // Look for a clear gap between groups (>30pt)
  for (let k = 1; k < line.length; k++) {
    const prev = line[k - 1];
    const gap = line[k].x - (prev.x + (prev.w || 0));
    if (gap > 30) return true;
  }
  return false;
}

function linesToTable(lines: { str: string; x: number; w: number }[][]): string {
  // Determine column boundaries by clustering X positions across all lines
  const xs: number[] = [];
  for (const line of lines) {
    for (let k = 0; k < line.length; k++) {
      if (k === 0 || line[k].x - (line[k - 1].x + (line[k - 1].w || 0)) > 30) {
        xs.push(line[k].x);
      }
    }
  }
  xs.sort((a, b) => a - b);
  // Cluster X positions into columns
  const cols: number[] = [];
  for (const x of xs) {
    if (!cols.length || x - cols[cols.length - 1] > 25) cols.push(x);
  }
  if (cols.length < 2) cols.push(...xs.slice(0, 2));

  const rows: string[] = [];
  for (const line of lines) {
    const cells: string[] = cols.map(() => '');
    for (const item of line) {
      // Assign each item to the nearest column whose start is <= item.x
      let colIdx = 0;
      for (let c = 0; c < cols.length; c++) {
        if (item.x + 1 >= cols[c]) colIdx = c;
      }
      cells[colIdx] = (cells[colIdx] ? cells[colIdx] + ' ' : '') + item.str;
    }
    rows.push(
      '<tr>' +
        cells
          .map(
            c =>
              `<td style="border:1px solid #999;padding:4px 8px;vertical-align:top">${escapeHtml(c.trim())}</td>`,
          )
          .join('') +
        '</tr>',
    );
  }
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0">${rows.join('')}</table>`;
}

async function renderPageImage(page: any, scale = 1.0): Promise<string | null> {
  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
