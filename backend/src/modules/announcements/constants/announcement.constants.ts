export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum AnnouncementTargetType {
  USER = 'USER',
  ROLE = 'ROLE',
  ALL = 'ALL',
}

export const ANNOUNCEMENT_ERRORS = {
  NOT_FOUND: 'Announcement not found',
  ALREADY_EXISTS: 'Announcement already exists',
  ALREADY_ACKNOWLEDGED: 'Announcement already acknowledged',
  NOT_TARGETED: 'You are not targeted for this announcement',
  CANNOT_PUBLISH_EXPIRED: 'Cannot publish an expired announcement',
  CANNOT_MODIFY_PUBLISHED: 'Cannot modify a published announcement',
  INVALID_DATE_RANGE: 'Start date must be before expiry date',
  TARGET_TYPE_NOT_FOUND: 'Target type not found. Available types: {targetTypes}',
  NOT_PUBLISHED: 'Announcement is not published',
  EXPIRED: 'Announcement has expired',
} as const;

export const ANNOUNCEMENT_SUCCESS_MESSAGES = {
  CREATED: 'Announcement created successfully',
  UPDATED: 'Announcement updated successfully',
  PUBLISHED: 'Announcement published successfully',
  ARCHIVED: 'Announcement archived successfully',
  DELETED: 'Announcement deleted successfully',
  ACKNOWLEDGED: 'Announcement acknowledged successfully',
} as const;

export const ANNOUNCEMENT_FIELD_NAMES = {
  ANNOUNCEMENT: 'Announcement',
  ACKNOWLEDGEMENT: 'Acknowledgement',
} as const;

export enum AnnouncementSortableFields {
  TITLE = 'title',
  STATUS = 'status',
  START_AT = 'startAt',
  EXPIRY_AT = 'expiryAt',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export const ANNOUNCEMENT_SORT_FIELD_MAPPING: Record<string, string> = {
  title: 'a."title"',
  status: 'a."status"',
  startAt: 'a."startAt"',
  expiryAt: 'a."expiryAt"',
  createdAt: 'a."createdAt"',
  updatedAt: 'a."updatedAt"',
};
