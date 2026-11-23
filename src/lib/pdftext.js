// Extrae el texto de un PDF en el navegador (para plantillas grandes que no caben completas en la base de datos).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function pdfToText(file, onProgress) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let last = null, line = '';
    const lines = [];
    for (const it of tc.items) {
      const y = Math.round(it.transform?.[5] ?? 0);
      if (last !== null && Math.abs(y - last) > 3) { lines.push(line.trim()); line = ''; }
      line += it.str + (it.hasEOL ? '\n' : ' ');
      last = y;
    }
    lines.push(line.trim());
    pages.push(`--- Página ${i}\n` + lines.filter(Boolean).join('\n'));
    onProgress?.(i, doc.numPages);
  }
  return { text: pages.join('\n\n').replace(/[ \t]+/g, ' '), pages: doc.numPages };
}
