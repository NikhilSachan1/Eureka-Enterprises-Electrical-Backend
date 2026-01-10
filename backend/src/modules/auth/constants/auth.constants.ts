export const AUTH_REDIRECT_ROUTES = {
  RESET_PASSWORD_SUCCESS_REDIRECT: 'reset-password?resetToken={resetToken}&email={email}',
  RESET_PASSWORD_FAILURE_REDIRECT: 'reset-password?expired=true&email=',
  TOKEN_VALIDATION: 'auth/validate/',
};

export const AUTH_ERRORS = {
  EMAIL_NOT_EXISTS: 'This account does not exist.',
  INVALID_CREDENTIALS: 'The credentials you provided are invalid. Please try again.',
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',
  PASSWORDS_DO_NOT_MATCH:
    'Password and confirm password do not match. Please ensure both fields are identical.',
  RESET_PASSWORD_LINK_EXPIRED:
    'Password reset link expired. Please request a new one to reset your password',
  CHANGE_PASSWORD_CURRENT_PASSWORD:
    "The current password you entered is incorrect. If you've forgotten it, please reset your password.",
  INVITATION_EMAIL_MISMATCH: 'Email does not match with the invitation email',
  USER_ARCHIVED: 'This account is inactive. Contact admin.',
  ROLE_NOT_FOUND: 'Role not found.',
  SERVICE_TEMPORARILY_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
  // Multi-role authentication errors
  USER_HAS_NO_ROLES: 'User has no roles assigned. Please contact administrator.',
  INVALID_ACTIVE_ROLE: 'The requested role is not assigned to this user.',
  ACTIVE_ROLE_REQUIRED: 'Active role header (X-Active-Role) is required.',
  ROLE_SWITCH_UNAUTHORIZED: 'You are not authorized to switch to this role.',
  USER_NOT_AUTHENTICATED: 'User not authenticated.',
  ACCESS_DENIED_REQUIRED_ROLES:
    'Access denied. Required roles: {requiredRoles}. Your active role: {activeRole}.',
  // Refresh token errors
  INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token. Please sign in again.',
  REFRESH_TOKEN_REVOKED: 'Refresh token has been revoked. Please sign in again.',
  REFRESH_TOKEN_EXPIRED: 'Refresh token has expired. Please sign in again.',
  REFRESH_TOKEN_NOT_FOUND: 'Refresh token not found. Please sign in again.',
};

export const AUTH_RESPONSES = {
  PASSWORD_RESET: 'Your password has been reset successfully.',
  PASSWORD_UPDATED: 'Your password has been updated successfully.',
  FORGET_PASSWORD:
    'A password reset link has been successfully sent to your email. Please check your inbox to continue.',
  SIGNUP_SUCCESS: 'Signup successfully, please login to continue.',
  SIGN_OUT_SUCCESS: 'Signed out successfully.',
  ROLE_SWITCHED: 'Role switched successfully.',
  TOKEN_REFRESHED: 'Token refreshed successfully.',
  ALL_SESSIONS_REVOKED: 'All sessions have been revoked successfully.',
};

export const AUTH_DTO_ERRORS = {
  PASSWORD_LENGTH: 'Password must be at least 8 characters long',
  PASSWORD_STRENGTH:
    'Password must include uppercase letters, lowercase letters, numbers, and special characters',
};

export const ACTIVE_ROLE_HEADER = 'x-active-role';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const SOURCE_TYPE_HEADER = 'x-source-type';
export const CLIENT_TYPE_HEADER = 'x-client-type';
export const TIMEZONE_HEADER = 'x-timezone';

export const REQUIRED_HEADERS = {
  ACTIVE_ROLE: ACTIVE_ROLE_HEADER,
  CORRELATION_ID: CORRELATION_ID_HEADER,
  SOURCE_TYPE: SOURCE_TYPE_HEADER,
  CLIENT_TYPE: CLIENT_TYPE_HEADER,
  TIMEZONE: TIMEZONE_HEADER,
};

export const HEADER_ERRORS = {
  MISSING_ACTIVE_ROLE: 'Missing required header: X-Active-Role',
  MISSING_CORRELATION_ID: 'Missing required header: X-Correlation-Id',
  MISSING_SOURCE_TYPE: 'Missing required header: X-Source-Type',
  MISSING_CLIENT_TYPE: 'Missing required header: X-Client-Type',
  MISSING_TIMEZONE: 'Missing required header: X-Timezone',
  MISSING_REQUIRED_HEADERS: 'Missing required headers: {headers}',
};
