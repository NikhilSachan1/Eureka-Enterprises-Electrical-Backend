import { Injectable, Logger } from '@nestjs/common';
import {
  CreatePlatformEndpointCommand,
  GetEndpointAttributesCommand,
  PublishCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import { Environments } from 'env-configs';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import {
  DevicePlatform,
  PUSH_PLATFORMS_ENABLED,
  SNS_DEAD_ENDPOINT_ERRORS,
} from '../constants/notification.constants';

export interface PushMessage {
  title: string;
  body: string;
  /** Everything here reaches the app as strings — FCM's rule. */
  data: Record<string, string>;
}

/** `dead` means SNS has disabled the endpoint: the token will never work again. */
export interface PushResult {
  ok: boolean;
  messageId?: string;
  dead?: boolean;
  code?: string;
  error?: string;
}

/** A configured ARN, or undefined if it is missing or still the shipped placeholder. */
const realArn = (arn?: string) => (arn && !/DUMMY/i.test(arn) ? arn : undefined);

/** FCM only accepts an https click link, so anything else is left out rather than rejected. */
const httpsOnly = (url?: string) => (url && /^https:\/\//i.test(url) ? url : undefined);

/**
 * Pushes through AWS SNS, which hands them to FCM — Android phones and web browsers alike.
 *
 * SNS does not replace Firebase: the app and the browser get their tokens from Firebase, and the
 * Firebase service-account key is uploaded to the SNS platform application once. The backend only
 * ever talks to SNS, and only needs permission to publish.
 *
 * Android and web tokens come from the same Firebase project, so one SNS platform application
 * serves both. A separate web ARN can be configured, but is optional and falls back to Android's.
 *
 * Off unless `PUSH_ENABLED=true` **and** a real platform application ARN is configured — so the
 * placeholder values shipped in `.env` can never produce a call.
 */
@Injectable()
export class SnsPushService {
  private readonly logger = new Logger(SnsPushService.name);
  private readonly client: SNSClient | null;
  private readonly arns: Partial<Record<DevicePlatform, string>>;

  constructor() {
    const android = realArn(Environments.AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN);
    this.arns = {
      [DevicePlatform.ANDROID]: android,
      [DevicePlatform.WEB]: realArn(Environments.AWS_SNS_WEB_PLATFORM_APPLICATION_ARN) ?? android,
    };

    if (!Environments.PUSH_ENABLED || !Object.values(this.arns).some(Boolean)) {
      if (Environments.PUSH_ENABLED) {
        this.logger.warn(
          'PUSH_ENABLED is true but the SNS platform ARN is missing or a placeholder — push stays off',
        );
      }
      this.client = null;
      return;
    }

    const key = Environments.AWS_SNS_ACCESS_KEY;
    const secret = Environments.AWS_SNS_SECRET_KEY;
    const hasStaticKeys = !!key && !!secret && !/DUMMY/i.test(key);
    this.client = new SNSClient({
      region: Environments.AWS_SNS_REGION,
      // On AWS the instance/task role is preferred: leave the keys empty and the SDK finds it.
      ...(hasStaticKeys ? { credentials: { accessKeyId: key, secretAccessKey: secret } } : {}),
    });
  }

  /** Whether a push to this platform would actually be attempted. */
  isActiveFor(platform: DevicePlatform): boolean {
    return !!this.client && PUSH_PLATFORMS_ENABLED.includes(platform) && !!this.arns[platform];
  }

  /**
   * The SNS endpoint for a token — created, or found and switched back on.
   *
   * SNS keeps one endpoint per token. Asking again for a token it already knows, with different
   * attributes, is refused with the existing ARN in the message; that endpoint is then updated
   * and re-enabled rather than treated as an error. That is the normal path when the same phone
   * logs in again, or a token SNS had disabled starts working.
   */
  async ensureEndpoint(
    platform: DevicePlatform,
    token: string,
    userId: string,
    knownArn?: string | null,
  ): Promise<string | null> {
    const appArn = this.isActiveFor(platform) ? this.arns[platform] : undefined;
    if (!this.client || !appArn) return null;

    if (knownArn) {
      try {
        const attrs = await this.client.send(
          new GetEndpointAttributesCommand({ EndpointArn: knownArn }),
        );
        const a = attrs.Attributes ?? {};
        if (a.Token !== token || a.Enabled !== 'true' || a.CustomUserData !== userId) {
          await this.client.send(
            new SetEndpointAttributesCommand({
              EndpointArn: knownArn,
              Attributes: { Token: token, Enabled: 'true', CustomUserData: userId },
            }),
          );
        }
        return knownArn;
      } catch (error) {
        if (error?.name !== 'NotFoundException') throw error;
        // Deleted on the SNS side — fall through and make a new one.
      }
    }

    try {
      const created = await this.client.send(
        new CreatePlatformEndpointCommand({
          PlatformApplicationArn: appArn,
          Token: token,
          CustomUserData: userId,
        }),
      );
      return created.EndpointArn ?? null;
    } catch (error) {
      const existing = /Endpoint (arn:aws:sns:\S+) already exists/.exec(
        String(error?.message),
      )?.[1];
      if (!existing) throw error;
      await this.client.send(
        new SetEndpointAttributesCommand({
          EndpointArn: existing,
          Attributes: { Token: token, Enabled: 'true', CustomUserData: userId },
        }),
      );
      return existing;
    }
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
   * The FCM HTTP v1 message, shaped for the device it is going to.
   *
   * Android gets high priority and a sound. A browser gets the click link and the company icon;
   * without the link the click still reaches the site's service worker, which can read `route`
   * from `data` and navigate itself.
   */
  buildFcmMessage(platform: DevicePlatform, message: PushMessage) {
    const base = {
      notification: { title: message.title, body: message.body },
      data: message.data,
    };
    if (platform === DevicePlatform.WEB) {
      const link = this.webLink(message.data.route);
      const icon = httpsOnly(COMPANY_DETAILS.LOGO_URL);
      return {
        ...base,
        webpush: {
          ...(icon ? { notification: { icon } } : {}),
          ...(link ? { fcm_options: { link } } : {}),
        },
      };
    }
    return { ...base, android: { priority: 'high', notification: { sound: 'default' } } };
  }

  /** One push to one endpoint. Never throws — the caller logs the result. */
  async send(
    endpointArn: string,
    message: PushMessage,
    platform: DevicePlatform = DevicePlatform.ANDROID,
  ): Promise<PushResult> {
    if (!this.client)
      return { ok: false, dead: false, code: 'DISABLED', error: 'Push is disabled' };

    // FCM HTTP v1 through SNS: the GCM key carries `fcmV1Message`, for Android and web alike.
    const fcm = { fcmV1Message: { message: this.buildFcmMessage(platform, message) } };

    try {
      const out = await this.client.send(
        new PublishCommand({
          TargetArn: endpointArn,
          MessageStructure: 'json',
          Message: JSON.stringify({ default: message.body, GCM: JSON.stringify(fcm) }),
        }),
      );
      return { ok: true, messageId: out.MessageId };
    } catch (error) {
      const code = error?.name ?? 'UNKNOWN';
      return {
        ok: false,
        // SNS disables an endpoint once FCM says the token is gone. It will not come back on its
        // own; the app re-registering is what revives it.
        dead: SNS_DEAD_ENDPOINT_ERRORS.includes(code),
        code,
        error: String(error?.message ?? error).slice(0, 500),
      };
    }
  }
}
