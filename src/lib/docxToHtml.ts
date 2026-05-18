import { stripHtml } from './htmlText';

/**
 * Convert a .docx file to formatted HTML using mammoth, preserving headings,
 * bold/italic, lists, tables and embedded images (inlined as base64 data URIs).
 */
export async function docxFileToHtml(file: File): Promise<{ html: string; text: string }> {
  const mammoth = (await import('mammoth/mammoth.browser')).default as any;
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image: any) => {
        const buf: string = await image.read('base64');
        return { src: `data:${image.contentType};base64,${buf}` };
      }),
      styleMap: [
        "p[style-name='Title'] => h1.doc-title",
        "p[style-name='Subtitle'] => p.doc-subtitle > em",
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
      ],
    },
  );

  const html = result?.value || '';
  return { html, text: stripHtml(html) };
}
