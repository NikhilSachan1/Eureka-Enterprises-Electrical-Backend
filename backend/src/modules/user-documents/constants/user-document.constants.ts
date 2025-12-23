export const USER_DOCUMENT_TYPES = {
  AADHAR: 'AADHAR',
  PAN: 'PAN',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  ESIC: 'ESIC',
  PASSPORT: 'PASSPORT',
  UAN: 'UAN',
  VOTER_ID: 'VOTER_ID',
  OFFER_LETTER: 'OFFER_LETTER',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  EDUCATION_CERTIFICATE: 'EDUCATION_CERTIFICATE',
  OTHER: 'OTHER',
};

export const USER_DOCUMENT_ERRORS = {
  NOT_FOUND: 'Document not found',
  INVALID_DOCUMENT_TYPE:
    'Invalid document type. Please use one of the following types: {documentTypes}',
};

export const USER_DOCUMENT_RESPONSES = {
  DOCUMENT_UPLOADED: 'Document uploaded successfully',
  DOCUMENT_DELETED: 'Document deleted successfully',
};
