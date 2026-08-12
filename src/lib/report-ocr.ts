/**
 * ArogyaOS — Medical Report Intelligence
 *
 * Client-side OCR for lab reports.
 *  - PDF  → pdfjs-dist text-layer extraction; scanned PDFs fall back to
 *           rendering pages and running Tesseract over each page image.
 *  - Image → Tesseract OCR (png/jpeg/webp/bmp/tiff).
 *
 * Both libraries are loaded lazily so the rest of the app stays light.
 */

export interface OcrResult {
  text: string;
  sourceType: "pdf" | "image";
  pageCount?: number;
}

const MIN_PDF_TEXT_LENGTH = 80;

export function isSupportedReportFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "application/pdf") return true;
  if (/^image\/(png|jpe?g|webp|bmp|tiff?)/.test(type)) return true;
  return /\.(pdf|png|jpe?g|webp|bmp|tif|tiff)$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

function fileToCanvasDataUrl(file: File, maxDim = 2400): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image file."));
    };
    img.src = objectUrl;
  });
}

async function ocrImages(
  images: string[],
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress?.(Math.round(message.progress * 100));
      }
    },
  });

  try {
    const parts: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(image);
      const pageText = (data.text ?? "").trim();
      if (pageText) parts.push(pageText);
    }
    return parts.join("\n");
  } finally {
    await worker.terminate();
  }
}

/* ------------------------------------------------------------------ */
/* PDFs                                                                */
/* ------------------------------------------------------------------ */

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  return pdfjs;
}

type PdfJs = Awaited<ReturnType<typeof loadPdfjs>>;

async function renderPageToDataUrl(
  pdf: PdfJs,
  doc: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function extractPdfText(
  pdf: PdfJs,
  doc: import("pdfjs-dist").PDFDocumentProxy,
): Promise<string> {
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(pageText);
    page.cleanup();
  }
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function extractTextFromFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<OcrResult> {
  const isPdf =
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name) ||
    !/^image\//.test(file.type);

  if (!isPdf) {
    onProgress?.(5);
    const dataUrl = await fileToCanvasDataUrl(file);
    const text = await ocrImages([dataUrl], (p) => onProgress?.(5 + p * 0.9));
    return { text: text.trim(), sourceType: "image" };
  }

  onProgress?.(2);
  const pdf = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdf.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const text = await extractPdfText(pdf, doc);

    // Scanned PDF (no text layer) → render each page and OCR it.
    if (text.trim().length < MIN_PDF_TEXT_LENGTH) {
      const pages: string[] = [];
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        onProgress?.(Math.round((pageNum / doc.numPages) * 40));
        pages.push(await renderPageToDataUrl(pdf, doc, pageNum));
      }
      const ocrText = await ocrImages(pages, (p) =>
        onProgress?.(40 + p * 0.55),
      );
      return { text: ocrText.trim(), sourceType: "pdf", pageCount: doc.numPages };
    }

    return { text: text.trim(), sourceType: "pdf", pageCount: doc.numPages };
  } finally {
    void loadingTask.destroy();
  }
}
