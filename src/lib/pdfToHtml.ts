import { stripHtml } from './htmlText';
import { supabase } from '@/integrations/supabase/client';

/**
 * Convert a PDF to formatted HTML by reconstructing layout from pdf.js text
 * items. Detects headings, bullets, two-column "label: value" rows (typical of
 * term sheets), simple tables, and preserves inline bold runs and centered
 * title blocks. Falls back to a rasterized page snapshot for image-only pages.
 */
export async function pdfFileToHtml(file: File): Promise<{ html: string; text: string }> {
  const pdfjs: any = await import('pdfjs-dist');
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  type Item = { str: string; x: number; y: number; w: number; h: number; bold: boolean };
  type Line = { y: number; h: number; items: Item[]; left: number; right: number };

  // Pass 1: collect lines per page (used for header/footer detection).
  const pagesLines: Line[][] = [];
  const pageWidths: number[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    pageWidths.push(viewport.width);

    const items: Item[] = (content.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.length > 0)
      .map(it => {
        const tr = it.transform as number[];
        const h = Math.abs(tr[3] || tr[0] || 10);
        const fontName = String(it.fontName || '');
        return {
          str: it.str,
          x: tr[4],
          y: tr[5],
          w: it.width || 0,
          h,
          bold: /bold|black|heavy|semibold/i.test(fontName),
        };
      });

    if (items.length === 0) {
      pagesLines.push([]);
      continue;
    }

    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines: Line[] = [];
    for (const it of items) {
      const tol = Math.max(2, it.h * 0.4);
      const last = lines[lines.length - 1];
      if (last && Math.abs(it.y - last.y) < tol) {
        last.items.push(it);
        last.h = Math.max(last.h, it.h);
      } else {
        lines.push({ y: it.y, h: it.h, items: [it], left: 0, right: 0 });
      }
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      line.left = line.items[0].x;
      const lastIt = line.items[line.items.length - 1];
      line.right = lastIt.x + (lastIt.w || 0);
    }
    pagesLines.push(lines);
  }

  // If the PDF has essentially no extractable text (scanned / image-based),
  // OCR every page via the vision-model edge function.
  const totalItems = pagesLines.reduce((n, l) => n + l.reduce((m, ln) => m + ln.items.length, 0), 0);
  const avgItemsPerPage = totalItems / Math.max(1, pagesLines.length);
  if (totalItems === 0 || avgItemsPerPage < 5) {
    const ocr = await ocrAllPages(doc);
    if (ocr && ocr.html) return ocr;
    // fall through to normal pipeline (which will produce image fallback)
  }

  // Detect repeating headers/footers: same text at similar Y on >= 50% of pages.
  const repeatCounts = new Map<string, number>();
  for (const lines of pagesLines) {
    const seen = new Set<string>();
    for (const line of lines) {
      const txt = line.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      // Bucket Y to 10pt to allow slight drift.
      const key = `${Math.round(line.y / 10)}|${txt}`;
      if (!seen.has(key)) {
        seen.add(key);
        repeatCounts.set(key, (repeatCounts.get(key) || 0) + 1);
      }
    }
  }
  const totalPages = pagesLines.length;
  const isRepeating = (line: Line) => {
    const txt = line.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!txt) return false;
    // Standalone page numbers
    if (/^\d{1,3}$/.test(txt) && totalPages > 1) return true;
    if (/^page\s+\d+/i.test(txt) && totalPages > 1) return true;
    const key = `${Math.round(line.y / 10)}|${txt}`;
    return totalPages > 1 && (repeatCounts.get(key) || 0) / totalPages >= 0.5;
  };

  const htmlPages: string[] = [];

  for (let p = 0; p < pagesLines.length; p++) {
    const page = await doc.getPage(p + 1);
    const allLines = pagesLines[p];
    const pageW = pageWidths[p];

    // Optional logo / image-only page detection.
    let topImage = '';
    let pageImageFallback = '';
    try {
      const ops = await page.getOperatorList();
      const hasImage = ops.fnArray.some(
        (fn: number) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject,
      );
      if (hasImage && allLines.length > 0) {
        const img = await renderPageImage(page, 1.2);
        if (img) topImage = `<p style="text-align:center"><img src="${img}" alt="Page ${p + 1} image" style="max-width:60%"/></p>`;
      } else if (allLines.length === 0) {
        const img = await renderPageImage(page, 1.5);
        if (img) pageImageFallback = `<p><img src="${img}" alt="Page ${p + 1}" style="max-width:100%"/></p>`;
      }
    } catch {
      // ignore
    }

    if (allLines.length === 0) {
      if (pageImageFallback) htmlPages.push(pageImageFallback);
      continue;
    }

    // Filter headers/footers.
    const lines = allLines.filter(l => !isRepeating(l));
    if (lines.length === 0) continue;

    // Per-page median font size for heading heuristic.
    const sizes = lines.flatMap(l => l.items.map(i => i.h)).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] || 10;
    const medianGap = computeMedianGap(lines);

    const out: string[] = [];
    if (topImage) out.push(topImage);

    let i = 0;
    let bulletBuffer: string[] = [];
    const flushBullets = () => {
      if (bulletBuffer.length) {
        out.push(`<ul>${bulletBuffer.map(b => `<li>${b}</li>`).join('')}</ul>`);
        bulletBuffer = [];
      }
    };

    while (i < lines.length) {
      // 1) Key/value block detection (≥3 consecutive lines that look like "Label: value" or two-column).
      const kvBlock = collectKVBlock(lines, i);
      if (kvBlock.length >= 3) {
        flushBullets();
        out.push(renderKVTable(kvBlock));
        i += kvBlock.length;
        continue;
      }

      // 2) Table block (≥2 consecutive lines with multiple wide-gap columns).
      const tableLines: Line[] = [];
      let j = i;
      while (j < lines.length && isTableLine(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      if (tableLines.length >= 2) {
        flushBullets();
        out.push(linesToTable(tableLines));
        i = j;
        continue;
      }

      const line = lines[i];
      const text = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) { i++; continue; }

      // 3) Bullet list detection.
      const bulletMatch = text.match(/^([•·●○◦▪■\-–]|[oO])\s+(.+)$/) || text.match(/^\((?:[ivxlcIVXLC]+|[a-zA-Z]|\d+)\)\s+(.+)$/);
      if (bulletMatch) {
        const itemText = bulletMatch[2] || bulletMatch[1];
        bulletBuffer.push(escapeHtml(itemText));
        i++;
        continue;
      }
      flushBullets();

      // 4) Heading / paragraph classification.
      const maxSize = Math.max(...line.items.map(it => it.h));
      const allBold = line.items.every(it => it.bold);
      const lineCenter = (line.left + line.right) / 2;
      const isCentered = Math.abs(lineCenter - pageW / 2) < pageW * 0.12 && (line.right - line.left) < pageW * 0.7;
      const isAllCaps = text.length <= 80 && text === text.toUpperCase() && /[A-Z]/.test(text);

      let html: string;
      if (maxSize > median * 1.6) {
        html = `<h1${isCentered ? ' style="text-align:center"' : ''}>${renderInline(line)}</h1>`;
      } else if (maxSize > median * 1.25 || (allBold && isCentered)) {
        html = `<h2${isCentered ? ' style="text-align:center"' : ''}>${renderInline(line)}</h2>`;
      } else if (isAllCaps && allBold) {
        html = `<h3>${escapeHtml(text)}</h3>`;
      } else {
        // Soft-wrap merging: join following non-blank lines into the same paragraph
        // until a gap >1.5×medianGap or a structural change.
        const paraLines: Line[] = [line];
        let k = i + 1;
        while (k < lines.length) {
          const prev = paraLines[paraLines.length - 1];
          const next = lines[k];
          const gap = prev.y - next.y;
          if (gap > medianGap * 1.6) break;
          const nextText = next.items.map(it => it.str).join(' ').trim();
          if (!nextText) break;
          // Stop if next line is clearly a heading, bullet, KV row, or table row.
          const nextMax = Math.max(...next.items.map(it => it.h));
          if (nextMax > median * 1.25) break;
          if (/^([•·●○◦▪■\-–]|[oO])\s+/.test(nextText)) break;
          if (isTableLine(next)) break;
          if (looksLikeKV(next)) break;
          paraLines.push(next);
          k++;
        }
        html = `<p${isCentered ? ' style="text-align:center"' : ''}>${paraLines.map(renderInline).join(' ')}</p>`;
        i = k;
        out.push(html);
        continue;
      }
      out.push(html);
      i++;
    }
    flushBullets();

    htmlPages.push(out.join('\n'));
  }

  const html = htmlPages.join('\n');
  return { html, text: stripHtml(html) };

  // --- helpers ---

  function renderInline(line: Line): string {
    // Build runs, merging adjacent items with the same bold state.
    const parts: string[] = [];
    let curBold = line.items[0].bold;
    let curText = '';
    const flush = () => {
      const t = escapeHtml(curText.replace(/\s+/g, ' ').trim());
      if (!t) return;
      parts.push(curBold ? `<strong>${t}</strong>` : t);
    };
    for (let k = 0; k < line.items.length; k++) {
      const it = line.items[k];
      const prev = line.items[k - 1];
      const needsSpace = prev && it.x - (prev.x + (prev.w || 0)) > 1 && !curText.endsWith(' ') && !it.str.startsWith(' ');
      if (it.bold !== curBold) {
        flush();
        curBold = it.bold;
        curText = (needsSpace ? ' ' : '') + it.str;
      } else {
        curText += (needsSpace ? ' ' : '') + it.str;
      }
    }
    flush();
    return parts.join('');
  }

  function looksLikeKV(line: Line): boolean {
    if (line.items.length < 2) return false;
    // Find a large internal gap (>= 25pt) splitting line into left/right groups.
    let splitIdx = -1;
    let bestGap = 0;
    for (let k = 1; k < line.items.length; k++) {
      const prev = line.items[k - 1];
      const gap = line.items[k].x - (prev.x + (prev.w || 0));
      if (gap > bestGap) { bestGap = gap; splitIdx = k; }
    }
    if (bestGap < 20 || splitIdx < 1) return false;
    const leftText = line.items.slice(0, splitIdx).map(i => i.str).join(' ').trim();
    const rightText = line.items.slice(splitIdx).map(i => i.str).join(' ').trim();
    if (!leftText || !rightText) return false;
    // Left side should look like a label: short, often ends with ':'.
    if (leftText.length > 60) return false;
    return /:\s*$/.test(leftText) || leftText.split(/\s+/).length <= 6;
  }

  function collectKVBlock(lines: Line[], start: number): Line[] {
    const block: Line[] = [];
    let k = start;
    while (k < lines.length && looksLikeKV(lines[k])) {
      block.push(lines[k]);
      k++;
    }
    return block;
  }

  function renderKVTable(block: Line[]): string {
    const rows = block.map(line => {
      // Re-detect split point per line.
      let splitIdx = 1;
      let bestGap = 0;
      for (let k = 1; k < line.items.length; k++) {
        const prev = line.items[k - 1];
        const gap = line.items[k].x - (prev.x + (prev.w || 0));
        if (gap > bestGap) { bestGap = gap; splitIdx = k; }
      }
      const leftLine: Line = { ...line, items: line.items.slice(0, splitIdx) };
      const rightLine: Line = { ...line, items: line.items.slice(splitIdx) };
      const leftText = leftLine.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim().replace(/:\s*$/, '');
      return `<tr><td>${escapeHtml(leftText)}</td><td>${renderInline(rightLine)}</td></tr>`;
    });
    return `<table class="pdf-kv">${rows.join('')}</table>`;
  }

  function isTableLine(line: Line): boolean {
    if (line.items.length < 3) return false;
    let gaps = 0;
    for (let k = 1; k < line.items.length; k++) {
      const prev = line.items[k - 1];
      const gap = line.items[k].x - (prev.x + (prev.w || 0));
      if (gap > 30) gaps++;
    }
    return gaps >= 2;
  }

  function linesToTable(lines: Line[]): string {
    // Cluster X positions to define columns.
    const xs: number[] = [];
    for (const line of lines) {
      for (let k = 0; k < line.items.length; k++) {
        if (k === 0 || line.items[k].x - (line.items[k - 1].x + (line.items[k - 1].w || 0)) > 25) {
          xs.push(line.items[k].x);
        }
      }
    }
    xs.sort((a, b) => a - b);
    const cols: number[] = [];
    for (const x of xs) {
      if (!cols.length || x - cols[cols.length - 1] > 25) cols.push(x);
    }
    if (cols.length < 2) return '';

    const rows = lines.map(line => {
      const cells: string[] = cols.map(() => '');
      for (const item of line.items) {
        let colIdx = 0;
        for (let c = 0; c < cols.length; c++) {
          if (item.x + 1 >= cols[c]) colIdx = c;
        }
        cells[colIdx] = (cells[colIdx] ? cells[colIdx] + ' ' : '') + item.str;
      }
      return '<tr>' + cells.map(c => `<td style="border:1px solid #999;padding:4px 8px;vertical-align:top">${escapeHtml(c.trim())}</td>`).join('') + '</tr>';
    });
    return `<table style="border-collapse:collapse;width:100%;margin:8px 0">${rows.join('')}</table>`;
  }

  function computeMedianGap(lines: Line[]): number {
    const gaps: number[] = [];
    for (let k = 1; k < lines.length; k++) {
      const g = lines[k - 1].y - lines[k].y;
      if (g > 0 && g < 100) gaps.push(g);
    }
    if (!gaps.length) return 14;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  }
}

async function ocrAllPages(doc: any): Promise<{ html: string; text: string } | null> {
  try {
    const pages: Array<{ pageNumber: number; imageBase64: string }> = [];
    const maxPages = Math.min(doc.numPages, 25);
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const dataUrl = await renderPageImage(page, 2.0);
      if (dataUrl) pages.push({ pageNumber: p, imageBase64: dataUrl });
    }
    if (pages.length === 0) return null;
    const { data, error } = await supabase.functions.invoke('pdf-ocr-to-html', { body: { pages } });
    if (error) {
      console.error('OCR edge function error', error);
      return null;
    }
    if (!data || typeof data.html !== 'string') return null;
    return { html: data.html, text: data.text || stripHtml(data.html) };
  } catch (err) {
    console.error('ocrAllPages failed', err);
    return null;
  }
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