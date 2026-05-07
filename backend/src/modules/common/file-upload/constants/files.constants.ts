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
  files: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  vehicleFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  assetFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  fuelExpenseFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  serviceFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  esicDoc: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  aadharDoc: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  panDoc: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  dlDoc: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  siteDocumentFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  po: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  invoice: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  contract: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  workOrder: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  completionCertificate: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  photo: [ALLOWED_FILE_CATEGORY.IMAGE],
  inspectionReport: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  other: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  dsrFiles: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  financialFile: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  vehicleLogStartOdometer: [ALLOWED_FILE_CATEGORY.IMAGE],
  vehicleLogEndOdometer: [ALLOWED_FILE_CATEGORY.IMAGE],
  vehicleLogOther: [ALLOWED_FILE_CATEGORY.IMAGE, ALLOWED_FILE_CATEGORY.PDF],
  orgFiles: [
    ALLOWED_FILE_CATEGORY.IMAGE,
    ALLOWED_FILE_CATEGORY.PDF,
    ALLOWED_FILE_CATEGORY.TXT,
    ALLOWED_FILE_CATEGORY.CSV,
    ALLOWED_FILE_CATEGORY.JSON,
    ALLOWED_FILE_CATEGORY.HTML,
  ],
};

export const FOLDER_NAME_PREFIX = 'user_';

export const FIELD_NAMES = {
  PROFILE_PICTURE: 'profilePicture',
  FILES: 'files',
  DOCUMENT: 'document',
  VEHICLE_FILES: 'vehicleFiles',
  ASSET_FILES: 'assetFiles',
  SERVICE_FILES: 'serviceFiles',
  ESIC_DOC: 'esicDoc',
  AADHAR_DOC: 'aadharDoc',
  PAN_DOC: 'panDoc',
  DL_DOC: 'dlDoc',
  COMPANY_LOGO: 'companyLogo',
  SITE_DOCUMENT_FILES: 'siteDocumentFiles',
  // Site document type specific fields
  SITE_DOC_PO: 'po',
  SITE_DOC_INVOICE: 'invoice',
  SITE_DOC_CONTRACT: 'contract',
  SITE_DOC_WORK_ORDER: 'workOrder',
  SITE_DOC_COMPLETION_CERTIFICATE: 'completionCertificate',
  SITE_DOC_PHOTO: 'photo',
  SITE_DOC_INSPECTION_REPORT: 'inspectionReport',
  SITE_DOC_OTHER: 'other',
  DSR_FILES: 'dsrFiles',
  FINANCIAL_FILE: 'financialFile',
  VEHICLE_LOG_START_ODOMETER: 'vehicleLogStartOdometer',
  VEHICLE_LOG_END_ODOMETER: 'vehicleLogEndOdometer',
  VEHICLE_LOG_OTHER: 'vehicleLogOther',
};

export const FIELD_NAME_REFORMED = {
  profilePicture: 'Profile Picture.',
  file: 'Uploaded file.',
  document: 'Uploaded document',
  files: 'Uploaded files',
};

export const DATABASE_FIELD_NAMES = {
  profilePicture: 'profilePicture',
  document: 'fileKey',
  file: 'file', // This is generic, not a db column
  files: 'fileKeys',
  vehicleFiles: 'vehicleFiles',
  assetFiles: 'assetFiles',
  serviceFiles: 'serviceFiles',
  // Employee document database field names
  esicDoc: 'esicDoc',
  aadharDoc: 'aadharDoc',
  panDoc: 'panDoc',
  dlDoc: 'dlDoc',
  // Vehicle log files
  vehicleLogStartOdometer: 'startOdometerFiles',
  vehicleLogEndOdometer: 'endOdometerFiles',
  vehicleLogOther: 'otherFiles',
  // DSR files
  dsrFiles: 'fileKeys',
  // Org files
  orgFiles: 'orgFileKeys',
  // Financial module file (single attachment per document)
  financialFile: 'fileKey',
};

export const FILE_ERRORS = {
  UPLOAD: 'Failed to upload file to S3:',
  GET: 'Failed to get file from S3:',
  GENERATE_S3_URL: 'Failed to generate S3 URL:',
  DELETE: 'Failed to delete file from S3:',
  FILE_NOT_FOUND: 'File not found in S3 for the given key.',
};

export const FILE_UPLOAD_FOLDER_NAMES = {
  EXPENSE_FILES: 'expense-files',
  VEHICLE_FILES: 'vehicle-files',
  ASSET_FILES: 'asset-files',
  FUEL_EXPENSE_FILES: 'fuel-expense-files',
  EMPLOYEE_FILES: 'employee-files',
  PROFILE_PICTURES: 'profile-pictures',
  VEHICLE_SERVICE_FILES: 'vehicle-service-files',
  COMPANY_LOGOS: 'company-logos',
  SITE_DOCUMENT_FILES: 'site-document-files',
  DSR_FILES: 'dsr-files',
  VEHICLE_LOG_FILES: 'vehicle-log-files',
  ORG_FILES: 'org-files',
  FINANCIAL_FILES: 'financial-files',
};
