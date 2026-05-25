import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface PageInput {
  pageNumber: number;
  imageBase64: string; // data URL or raw base64 JPEG/PNG
}

const SYSTEM_PROMPT = `You are an expert document layout reconstructor.
Given an image of one page of a financial term sheet / bond offering / press release, output clean semantic HTML that visually matches the page.

Rules:
- Use <h1>/<h2>/<h3> for section titles and headings (largest text on the page = h1).
- Use <p> for paragraphs. Preserve bold runs with <strong>.
- For two-column "Label: value" rows (very common in term sheets — Issuer, Issuer Rating, Format, Pricing Date, Coupon, etc.), output a single table with class "pdf-kv": <table class="pdf-kv"><tr><td>Label</td><td>Value</td></tr>...</table>. Group consecutive label/value rows in ONE such table.
- For real grid tables (multiple columns of data), use a normal <table> with <tr>/<td>.
- Use <ul>/<li> for bullet lists.
- Do NOT include <html>, <head>, <body>, <style>, <script>, or any CSS. Output only the body fragment.
- Do NOT add commentary, explanations, or markdown fences. Output raw HTML only.
- Do NOT invent content. Transcribe exactly what is visible on the page.
- Skip page numbers, running headers/footers, and watermarks.`;

async function ocrPage(apiKey: string, page: PageInput): Promise<string> {
  const imageUrl = page.imageBase64.startsWith('data:')
    ? page.imageBase64
    : `data:image/jpeg;base64,${page.imageBase64}`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Reconstruct page ${page.pageNumber} as HTML.` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  let html: string = data?.choices?.[0]?.message?.content ?? '';
  // Strip code fences if model wraps in them.
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return html;
}

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const { pages } = (await req.json()) as { pages: PageInput[] };
    if (!Array.isArray(pages) || pages.length === 0) {
      return new Response(JSON.stringify({ error: 'pages[] required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cap to a reasonable size to avoid runaway costs/timeouts.
    const MAX_PAGES = 25;
    const work = pages.slice(0, MAX_PAGES);

    const htmlParts: string[] = [];
    for (const p of work) {
      try {
        const part = await ocrPage(apiKey, p);
        if (part) htmlParts.push(part);
      } catch (err) {
        console.error('Page OCR failed', p.pageNumber, err);
        htmlParts.push(`<p><em>Page ${p.pageNumber} could not be processed.</em></p>`);
      }
    }

    const html = htmlParts.join('\n');
    return new Response(JSON.stringify({ html, text: htmlToText(html), pageCount: work.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('pdf-ocr-to-html error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});