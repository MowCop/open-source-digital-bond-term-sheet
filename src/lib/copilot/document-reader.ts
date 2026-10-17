import { unzipSync, strFromU8 } from "fflate";
import { validateDocument, MAX_DOCUMENT_TEXT } from "./documents";

export async function readDocument(file: File): Promise<string> {
  validateDocument(file.name, file.size);
  let text = "";
  if (/\.pdf$/i.test(file.name)) {
    if (!(await file.slice(0, 5).text()).startsWith("%PDF-"))
      throw new Error("This file is not a valid PDF.");
    const math = Math as Math & {
      sumPrecise?: (values: Iterable<number>) => number;
    };
    if (!math.sumPrecise)
      math.sumPrecise = (values) =>
        Array.from(values).reduce((sum, value) => sum + value, 0);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker =
      await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await loading.promise;
    try {
      if (pdf.numPages > 50)
        throw new Error(
          "PDFs are limited to 50 pages. Split this document before uploading.",
        );
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("");
        if (!pageText.trim())
          throw new Error(
            `Page ${n} has no readable text. Scanned documents need OCR before uploading.`,
          );
        text += `[Page ${n}]\n${pageText}\n\n`;
        if (text.length > MAX_DOCUMENT_TEXT)
          throw new Error(
            "Document exceeds 60,000 characters. Split it before uploading.",
          );
      }
    } finally {
      await loading.destroy();
    }
  } else if (/\.docx$/i.test(file.name)) {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => {
        if (entry.originalSize > 2 * 1024 * 1024)
          throw new Error("Word document contains oversized content.");
        return /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(
          entry.name,
        );
      },
    });
    for (const [name, bytes] of Object.entries(files)) {
      const doc = new DOMParser().parseFromString(
        strFromU8(bytes),
        "application/xml",
      );
      if (doc.querySelector("parsererror"))
        throw new Error("This Word document could not be read.");
      const paragraphs = [...doc.getElementsByTagName("w:p")].map((p) =>
        [...p.getElementsByTagName("w:t")]
          .map((t) => t.textContent ?? "")
          .join(""),
      );
      text += `[${name}]\n${paragraphs.join("\n")}\n\n`;
    }
  } else {
    text = await file.text();
  }
  validateDocument(file.name, file.size, text);
  return text;
}
