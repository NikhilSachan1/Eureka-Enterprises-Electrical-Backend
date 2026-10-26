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
 * until iOS is added here and an APNs key is uploaded to the Firebase project.
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

/**
 * FCM error codes meaning the device will never receive anything again — the app was uninstalled,
 * its data cleared, or the value was never a valid target. Such a device is switched off.
 */
export const FCM_DEAD_TARGET_ERRORS = [
  'messaging/installation-id-not-registered',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

export const PUSH_PROVIDER = 'FIREBASE_FCM';

/**
 * A device not seen for this many days is switched off — unless it is its user's most recently
 * seen one. The app re-registers on every start, so `lastSeenAt` is fresh for anything in use;
 * what goes stale is old installs (reinstalls, cleared data, a phone that changed hands).
 */
export const DEVICE_STALE_DAYS = 45;
