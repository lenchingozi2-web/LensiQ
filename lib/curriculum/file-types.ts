const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/x-msword': 'doc',
  'application/vnd.ms-word': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
};

export const LECTURE_FILE_ACCEPT = '.pdf,.doc,.docx,.pptx,.txt,application/pdf,application/msword,application/x-msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain';

export function getLectureFileExtension(fileName: string, mimeType = '') {
  const namedExtension = fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? '';
  if (Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, namedExtension)) return namedExtension;
  const normalizedMimeType = mimeType.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, normalizedMimeType) ? EXTENSION_BY_MIME[normalizedMimeType] : '';
}

export function isSupportedLectureFile(fileName: string, mimeType = '') {
  return Boolean(getLectureFileExtension(fileName, mimeType));
}

export function normalizeLectureMimeType(fileName: string, mimeType = '') {
  const extension = getLectureFileExtension(fileName, mimeType);
  return MIME_BY_EXTENSION[extension] ?? (mimeType.trim() || 'application/octet-stream');
}

export function normalizeLectureFileName(fileName: string, mimeType = '') {
  const extension = getLectureFileExtension(fileName, mimeType);
  if (!extension || fileName.toLowerCase().endsWith(`.${extension}`)) return fileName;
  const namedExtension = fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  const hasRecognizedExtension = Boolean(namedExtension && Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, namedExtension));
  if (hasRecognizedExtension) return fileName;
  return `${fileName.trim().replace(/[. ]+$/, '') || 'lecture-material'}.${extension}`;
}

export function isLegacyWordDocument(fileName: string, mimeType = '') {
  return getLectureFileExtension(fileName, mimeType) === 'doc';
}

/** Keep the extension and canonical MIME consistent with the syllabus reservation and private storage bucket. */
export function normalizeStudyDocumentFile(file: File): File | null {
  const originalName = file.name.trim();
  const extension = getLectureFileExtension(originalName, file.type);
  if (!extension) return null;
  const normalizedName = normalizeLectureFileName(originalName, file.type);
  const suffix = `.${extension}`;
  // The ingest endpoint and reservation RPC cap original_name at 180 characters.
  const name = normalizedName.length > 180
    ? normalizedName.slice(0, 180 - suffix.length) + suffix
    : normalizedName;
  const type = normalizeLectureMimeType(name, file.type);
  if (name === file.name && type === file.type) return file;
  return new File([file], name, { type, lastModified: file.lastModified });
}

/** Android document providers may omit both the extension and a useful MIME type.
 * Inspect only the first KiB; the full parser remains responsible for PDF validity.
 */
export async function identifyStudyDocumentFile(file: File): Promise<File | null> {
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const isPdf = header.some((_, index) =>
    index + marker.length <= header.length && marker.every((byte, offset) => header[index + offset] === byte));
  if (isPdf) {
    const trimmed = file.name.trim().replace(/[. ]+$/, '');
    const name = /\.pdf$/i.test(trimmed) ? trimmed : (trimmed || 'lecture-material') + '.pdf';
    return normalizeStudyDocumentFile(new File([file], name, { type: 'application/pdf', lastModified: file.lastModified }));
  }
  return normalizeStudyDocumentFile(file);
}
