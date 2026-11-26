import { extractText } from 'unpdf';
import { HttpError } from '../errors';

const MAX_PDF_TEXT = 200_000;

export async function extractPdfText(bytes: Buffer): Promise<string> {
  try {
    const result = await extractText(new Uint8Array(bytes), { mergePages: true });
    const text = result.text.replace(/\u0000/g, '').trim();
    if (!text) {
      throw new HttpError(400, 'The PDF contains no readable text', 'ATTACHMENT_UNREADABLE');
    }
    return text.length > MAX_PDF_TEXT ? text.slice(0, MAX_PDF_TEXT) : text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The PDF could not be read', 'ATTACHMENT_UNREADABLE');
  }
}
