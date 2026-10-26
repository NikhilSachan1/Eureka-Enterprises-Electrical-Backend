import { Injectable, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Message, Messaging } from 'firebase-admin/messaging';
import { Environments } from 'env-configs';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import {
  DevicePlatform,
  FCM_DEAD_TARGET_ERRORS,
  PUSH_PLATFORMS_ENABLED,
} from '../constants/notification.constants';

export interface PushMessage {
  title: string;
  body: string;
  /** Everything here reaches the app as strings — FCM's rule. */
  data: Record<string, string>;
}

/** `dead` means FCM says this device will never receive anything again. */
export interface PushResult {
  ok: boolean;
  messageId?: string;
  dead?: boolean;
  code?: string;
  error?: string;
}

/** Named, so it can never collide with a default Firebase app initialised elsewhere. */
const FIREBASE_APP_NAME = 'eureka-push';

/**
 * A Firebase Installation ID: 22 URL-safe base64 characters. What `firebase_messaging` 17+ hands
 * the app through `register()` / `onRegistered`, and what FCM now recommends sending to.
 */
const FID = /^[A-Za-z0-9_-]{22}$/;

/** FCM only accepts an https click link, so anything else is left out rather than rejected. */
const httpsOnly = (url?: string) => (url && /^https:\/\//i.test(url) ? url : undefined);

/**
 * Sends pushes straight to Firebase Cloud Messaging with the Firebase Admin SDK.
 *
 * Replaced AWS SNS on 2026-10-26: Firebase moved device targeting to Installation IDs (the `fid`
 * field), deprecating registration tokens, and SNS only knows how to send to a token.
 *
 * Both kinds of target are accepted, because both are still in use:
 *   - a 22-character FID       → sent as `fid` (the Flutter app, firebase_messaging 17+)
 *   - a longer registration token → sent as `token` (deprecated, but the web SDK may still give one)
 *
 * Off unless `PUSH_ENABLED=true` **and** a usable service account is configured, so a missing or
 * placeholder key can never produce a call.
 */
@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);
  private readonly messaging: Messaging | null;

  constructor() {
    this.messaging = Environments.PUSH_ENABLED ? this.connect() : null;
  }

  private connect(): Messaging | null {
    const encoded = Environments.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!encoded || /DUMMY/i.test(encoded)) {
      this.logger.warn(
        'PUSH_ENABLED is true but FIREBASE_SERVICE_ACCOUNT_BASE64 is missing or a placeholder — push stays off',
      );
      return null;
    }
    try {
      const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      const app =
        getApps().find((a) => a.name === FIREBASE_APP_NAME) ??
        initializeApp({ credential: cert(account) }, FIREBASE_APP_NAME);
      this.logger.log(`Push via Firebase project "${account.project_id}"`);
      return getMessaging(app);
    } catch (error) {
      // A bad key must not take the application down — it only means no pushes.
      this.logger.error(
        `FIREBASE_SERVICE_ACCOUNT_BASE64 is not a usable service account: ${error?.message}`,
      );
      return null;
    }
  }

  /** Whether a push to this platform would actually be attempted. */
  isActiveFor(platform: DevicePlatform): boolean {
    return !!this.messaging && PUSH_PLATFORMS_ENABLED.includes(platform);
  }

  /**
   * Where a browser notification opens when clicked: `FE_BASE_URL` + the route, joined without a
   * doubled slash. Undefined unless the result is https — FCM refuses anything else.
   */
  webLink(route?: string): string | undefined {
    const base = (Environments.FE_BASE_URL ?? '').replace(/\/+$/, '');
    if (!base) return undefined;
    const path = (route ?? '').replace(/^\/+/, '');
    return httpsOnly(path ? `${base}/${path}` : base);
  }

  /**
   * The FCM message, shaped for the device it is going to.
   *
   * The target goes in `fid` or `token` depending on what the device registered. Android gets
   * high priority and a sound; a browser gets the click link and the company icon — without the
   * link the click still reaches the site's service worker, which can read `route` from `data`.
   */
  buildMessage(platform: DevicePlatform, target: string, message: PushMessage): Message {
    const base = {
      notification: { title: message.title, body: message.body },
      data: message.data,
    };
    const shaped =
      platform === DevicePlatform.WEB
        ? (() => {
            const link = this.webLink(message.data.route);
            const icon = httpsOnly(COMPANY_DETAILS.LOGO_URL);
            return {
              ...base,
              webpush: {
                ...(icon ? { notification: { icon } } : {}),
                ...(link ? { fcmOptions: { link } } : {}),
              },
            };
          })()
        : { ...base, android: { priority: 'high' as const, notification: { sound: 'default' } } };

    return FID.test(target) ? { ...shaped, fid: target } : { ...shaped, token: target };
  }

  /** One push to one device. Never throws — the caller logs the result. */
  async send(platform: DevicePlatform, target: string, message: PushMessage): Promise<PushResult> {
    if (!this.messaging) {
      return { ok: false, dead: false, code: 'DISABLED', error: 'Push is disabled' };
    }
    try {
      const messageId = await this.messaging.send(this.buildMessage(platform, target, message));
      return { ok: true, messageId };
    } catch (error) {
      const code = error?.code ?? error?.errorInfo?.code ?? 'UNKNOWN';
      return {
        ok: false,
        dead: FCM_DEAD_TARGET_ERRORS.includes(code),
        code,
        error: String(error?.message ?? error).slice(0, 500),
      };
    }
  }
}
