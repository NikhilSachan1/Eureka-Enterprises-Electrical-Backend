export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'text/html',
];

export const ALLOWED_MIME_TYPES: { [key: string]: string[] } = {
  image: ['image/jpeg', 'image/png', 'image/jpg'], // add other image types if needed
  pdf: ['application/pdf'],
  plain: ['text/plain'],
  csv: ['text/csv'],
  json: ['application/json'],
  html: ['text/html'],
};

export const ALLOWED_FILE_CATEGORY = {
  IMAGE: 'image',
  PDF: 'pdf',
  MIXED: 'mixed',
  TXT: 'plain',
  CSV: 'csv',
  JSON: 'json',
  HTML: 'html',
};

export const ALLOWED_MAX_FILE_SIZE: { [key: string]: number } = {
  'image/jpeg': 2 * 1024 * 1024, // 2 MB
  'image/jpg': 2 * 1024 * 1024, // 2 MB
  'image/png': 2 * 1024 * 1024, // 2 MB
  'application/pdf': 10 * 1024 * 1024, // 10 MB
  'text/plain': 10 * 1024 * 1024, // 10 MB
  'text/csv': 10 * 1024 * 1024, // 10 MB
  'application/json': 10 * 1024 * 1024, // 10 MB
  'text/html': 10 * 1024 * 1024, // 10 MB
};

export const FILE_LIMIT = {
  MAXIMUM_FILE_LIMIT: 10,
};

export const FILE_UPLOAD_ERRORS = {
  MAX_FILE_LIMIT_REACHED: 'Maximum file upload limit exceeded.',
  INVALID_FILE_FORMAT: 'Invalid file format',
  FILE_SIZE_EXCEEDED: 'File size exceeded the allowed limit.',
  NO_FILE_UPLOADED: 'No file uploaded',
};

export const FIELD_FORMATS: { [key: string]: string[] } = {
  profilePicture: [ALLOWED_FILE_CATEGORY.IMAGE],
  document: [ALLOWED_FILE_CATEGORY.PDF],
};

export const FOLDER_NAME_PREFIX = 'user_';

export const FIELD_NAMES = {
  PROFILE_PICTURE: 'profilePicture',
  FILE: 'file',
  DOCUMENT: 'document',
};

export const FIELD_NAME_REFORMED = {
  profilePicture: 'Profile Picture.',
  file: 'Uploaded file.',
  document: 'Uploaded document',
};

export const DATABASE_FIELD_NAMES = {
  profilePicture: 'profilePictureUrl',
  document: 'fileKey',
  file: 'file', // This is generic, not a db column
};

export const FILE_ERRORS = {
  UPLOAD: 'Failed to upload file to S3:',
  GET: 'Failed to get file from S3:',
  GENERATE_S3_URL: 'Failed to generate S3 URL:',
  DELETE: 'Failed to delete file from S3:',
};

export const FILE_UPLOAD_FOLDER_NAMES = {
  CALL_RECORDINGS: 'call-recordings',
  CLIENT_DOCUMENTS: 'client-documents',
  CALL_TEAMS: 'call-teams',
};
