import * as XLSX from "xlsx";
// pdf-parse and mammoth are CommonJS modules, so we require() them at runtime
// to avoid ES module interop issues with some TypeScript configs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require("mammoth");

/**
 * Supported MIME types for in-process text extraction.
 * Files outside this list are stored normally but won't be searchable by content.
 */
const PDF_MIMES = ["application/pdf"];
const WORD_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const EXCEL_MIMES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Extracts plain text from a file buffer before it is uploaded to S3.
 * Returns null if the file type is unsupported or extraction fails.
 *
 * @param buffer   Raw file buffer from multer memoryStorage
 * @param mimeType MIME type of the uploaded file
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  try {
    // ── PDF ──────────────────────────────────────────────────────────────────
    if (PDF_MIMES.includes(mimeType)) {
      const data = await pdfParse(buffer);
      return sanitise(data.text);
    }

    // ── Word Documents (.doc / .docx) ────────────────────────────────────────
    if (WORD_MIMES.includes(mimeType)) {
      const result = await mammoth.extractRawText({ buffer });
      return sanitise(result.value);
    }

    // ── Excel Spreadsheets (.xls / .xlsx) ────────────────────────────────────
    if (EXCEL_MIMES.includes(mimeType)) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const allText: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // sheet_to_csv gives us all cell values as readable text
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        allText.push(csv);
      }

      return sanitise(allText.join("\n"));
    }

    // Unsupported type (images, etc.) — no text to extract
    return null;
  } catch (err) {
    // Never crash the upload because of a failed extraction
    console.warn("[TextExtractor] Extraction failed, continuing without text:", err);
    return null;
  }
}

/**
 * Cleans extracted text:
 * - Collapses multiple whitespace/newlines
 * - Trims leading/trailing whitespace
 * - Caps at 500KB to prevent DB bloat on huge spreadsheets
 */
function sanitise(raw: string): string {
  const MAX_CHARS = 500_000;
  const cleaned = raw
    .replace(/\r\n/g, "\n")       // normalize line endings
    .replace(/[ \t]{2,}/g, " ")   // collapse repeated spaces/tabs
    .replace(/\n{3,}/g, "\n\n")   // collapse excessive blank lines
    .trim();

  return cleaned.length > MAX_CHARS ? cleaned.substring(0, MAX_CHARS) : cleaned;
}
