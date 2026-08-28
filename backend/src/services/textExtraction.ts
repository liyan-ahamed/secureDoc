import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_EXTRACTED_TEXT_LENGTH = 10_000;

const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Produces a small, searchable plaintext index from the original upload buffer.
 * Extraction failures intentionally do not affect uploads.
 */
export const extractSearchableText = async (buffer: Buffer, mimeType: string): Promise<string | null> => {
  try {
    let text: string;

    if (mimeType === PDF_MIME_TYPE) {
      const parser = new PDFParse({ data: buffer });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (mimeType === DOCX_MIME_TYPE) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      return null;
    }

    const normalizedText = text.trim();
    return normalizedText ? normalizedText.slice(0, MAX_EXTRACTED_TEXT_LENGTH) : null;
  } catch (error) {
    console.warn(`[Text extraction] Could not extract ${mimeType}:`, error);
    return null;
  }
};
