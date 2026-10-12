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
