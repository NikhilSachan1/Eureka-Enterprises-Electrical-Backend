/** Where a device receives pushes. Android and web are sent to today — see `PUSH_PLATFORMS_ENABLED`. */
export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

/**
 * Platforms that actually receive pushes right now.
 *
 * iOS devices may still register — the app can ship that code early — but nothing is sent to them
 * until iOS is added here and an SNS platform application (or an APNs setup in Firebase) exists.
 */
export const PUSH_PLATFORMS_ENABLED: DevicePlatform[] = [
  DevicePlatform.ANDROID,
  DevicePlatform.WEB,
];

export enum NotificationReadFilter {
  ALL = 'all',
  UNREAD = 'unread',
  READ = 'read',
}

/** Column limits, enforced before insert so an over-long template never fails the event. */
export const NOTIFICATION_LIMITS = {
  TITLE: 120,
  MESSAGE: 500,
  ROUTE: 255,
  DEDUPE_KEY: 160,
};

export const NOTIFICATION_ERRORS = {
  NOT_FOUND: 'Notification not found',
  DEVICE_NOT_FOUND: 'Device not registered',
};

export const NOTIFICATION_RESPONSES = {
  READ: 'Notification marked as read',
  UNREAD: 'Notification marked as unread',
  ALL_READ: 'All notifications marked as read',
  DEVICE_REGISTERED: 'Device registered',
  DEVICE_REMOVED: 'Device removed',
};

/** SNS error codes meaning the token is dead and will never work again. */
export const SNS_DEAD_ENDPOINT_ERRORS = ['EndpointDisabledException', 'EndpointDisabled'];

export const PUSH_PROVIDER = 'AWS_SNS';
