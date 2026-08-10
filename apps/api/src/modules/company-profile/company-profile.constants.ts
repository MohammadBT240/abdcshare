/** Shared upload limits for company profile documents (mirrors web DOCUMENT_MAX_BYTES). */
export const COMPANY_PROFILE_MAX_BYTES = 100 * 1024 * 1024;

export const COMPANY_PROFILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
