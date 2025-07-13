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
  USER_NOT_ARCHIVED_TO_DELETE: 'User is not archived to delete.',
  CHANGE_PASSWORD_CURRENT_PASSWORD: 'Current password is incorrect.',
  PASSWORDS_DO_NOT_MATCH: 'New password and confirm password do not match.',
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
};

export enum UserSortFields {
  CREATED_AT = 'createdAt',
}

export enum UserRecordType {
  USER = 'user',
  INVITATION = 'invitation',
}
