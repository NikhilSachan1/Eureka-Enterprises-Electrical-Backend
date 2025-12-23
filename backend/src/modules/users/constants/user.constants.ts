export enum UsersEntityFields {
  ID = 'id',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  EMAIL = 'email',
  PASSWORD = 'password',
  CONTACT_NUMBER = 'contactNumber',
  PROFILE_PICTURE_URL = 'profilePictureUrl',
  STATUS = 'status',
  PASSWORD_UPDATED_AT = 'passwordUpdatedAt',
}

export const USERS_ERRORS = {
  NOT_FOUND: 'User not found',
  GOOGLE_PROFILE_CHANGE:
    'Changing profile picture is not supported for accounts signed in with Google.',
  USER_NOT_ARCHIVED_TO_DELETE: 'User must be archived before deletion.',
  USER_ALREADY_ARCHIVED: 'User is already archived.',
  USER_ALREADY_ACTIVE: 'User is already active.',
  CHANGE_PASSWORD_CURRENT_PASSWORD: 'Current password is incorrect.',
  PASSWORDS_DO_NOT_MATCH: 'New password and confirm password do not match.',
  INVALID_AADHAR: 'Invalid Aadhar number. Must be 12 digits.',
  INVALID_PAN: 'Invalid PAN number. Format: ABCDE1234F',
  INVALID_IFSC: 'Invalid IFSC code. Format: ABCD0123456',
  INVALID_PINCODE: 'Invalid pincode. Must be 6 digits.',
  INVALID_PHONE: 'Invalid phone number format.',
  INVALID_ACCOUNT_NUMBER: 'Invalid account number. Must be 9-18 digits.',
  INVALID_PASSOUT_YEAR: 'Invalid passout year.',
  FUTURE_DATE_NOT_ALLOWED: 'Future date is not allowed.',
  DOB_MUST_BE_18_YEARS: 'Employee must be at least 18 years old.',
};

export const USER_DTO_ERRORS = {
  INVALID_SORT_FIELD: 'The provided sort field is invalid. Please choose from the following:',
  INVALID_ROLE: 'Invalid role. Please choose from the following:',
  INVALID_STATUS: 'The provided status is invalid. Please choose from the following:',
};

export const USER_FIELD_NAMES = {
  USER: 'User',
};

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export const USERS_RESPONSES = {
  PASSWORD_UPDATED: 'Password updated successfully.',
  EMPLOYEE_CREATED: 'Employee created successfully.',
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',
  ROLE_NOT_FOUND: 'Role not found.',
  BULK_DELETE_PROCESSED:
    'Bulk delete processed for {length} users. Success: {success}, Failed: {error}',
  USER_DELETE_SUCCESS: 'User deleted successfully.',
};

export enum UserSortFields {
  CREATED_AT = 'createdAt',
}

export const VALIDATION_PATTERNS = {
  AADHAR: /^\d{12}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  PINCODE: /^\d{6}$/,
  PHONE: /^(\+91)?[6-9]\d{9}$/,
  ACCOUNT_NUMBER: /^\d{9,18}$/,
  ESIC: /^\d{17}$/,
  DL: /^[A-Z]{2}[\-]?\d{2}[\-]?\d{4}[\-]?\d{7}$/,
};
