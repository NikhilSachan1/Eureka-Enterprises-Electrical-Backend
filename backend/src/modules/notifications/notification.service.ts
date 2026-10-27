import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationLogService } from '../common/communication-logs/communication-log.service';
import {
  CommunicationCategory,
  CommunicationChannel,
  CommunicationStatus,
} from '../common/communication-logs/constants/communication-log.constants';
import { GetNotificationsDto, NotifyInput, RegisterDeviceDto } from './dto/notification.dto';
import {
  DevicePlatform,
  NOTIFICATION_ERRORS,
  NOTIFICATION_LIMITS,
  NOTIFICATION_RESPONSES,
  NotificationReadFilter,
  PUSH_PROVIDER,
} from './constants/notification.constants';
import { FcmPushService, PushMessage, PushResult } from './push/fcm-push.service';
import { EmailService } from '../common/email/email.service';
import { EMAIL_TEMPLATE } from '../common/email/constants/email.constants';
import { Environments } from 'env-configs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

interface DeviceRow {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
}

/**
 * The bell, and the pushes that mirror it.
 *
 * `notify()` is what every event calls, next to its existing email/WhatsApp send. It writes one
 * row per recipient and pushes those same words to each of their devices. The bell and the push
 * therefore cannot disagree: there is only one copy of the text.
 *
 * It never throws. A notification is a side effect of something that already happened — an
 * expense approved, a leave applied — and that thing must not fail because a phone was
 * unreachable. Errors are logged and swallowed, exactly as the email and WhatsApp sends do.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly push: FcmPushService,
    private readonly communicationLogService: CommunicationLogService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Record it in each recipient's bell, then push it.
   *
   * Resolves once the rows are written; the pushes carry on in the background so a slow SNS call
   * never holds up the request that caused the notification.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const userIds = [
        ...new Set(input.userIds.filter((id): id is string => !!id && UUID.test(id))),
      ];
      if (!userIds.length) return;

      const title = clip(input.title.trim(), NOTIFICATION_LIMITS.TITLE);
      const message = clip(input.message.trim(), NOTIFICATION_LIMITS.MESSAGE);
      // A reference that is not a uuid would fail the insert and lose the whole notification;
      // keep it, just not in the uuid column.
      const referenceId =
        input.referenceId && UUID.test(input.referenceId) ? input.referenceId : null;
      const data =
        input.referenceId && !referenceId
          ? { ...(input.data ?? {}), referenceKey: input.referenceId }
          : input.data ?? null;

      const rows: Array<{ id: string; userId: string }> = await this.dataSource.query(
        `INSERT INTO notifications
           ("userId", title, message, category, "referenceType", "referenceId", route, data,
            "dedupeKey", "createdBy")
         SELECT u."id", $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10
           FROM users u
          WHERE u."id" = ANY($1::uuid[]) AND u."deletedAt" IS NULL AND u."status" = 'ACTIVE'
         ON CONFLICT ("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL DO NOTHING
         RETURNING "id", "userId"`,
        [
          userIds,
          title,
          message,
          input.category,
          input.referenceType ?? null,
          referenceId,
          input.route ? clip(input.route, NOTIFICATION_LIMITS.ROUTE) : null,
          data ? JSON.stringify(data) : null,
          input.dedupeKey ? clip(input.dedupeKey, NOTIFICATION_LIMITS.DEDUPE_KEY) : null,
          input.createdBy ?? null,
        ],
      );
      if (!rows.length) return;

      void this.pushRows(rows, { ...input, title, message, referenceId }).catch((error) =>
        this.logger.warn(`Push fan-out failed: ${error?.message ?? error}`),
      );
      if (input.email) {
        void this.emailRows(rows, { ...input, title, message, referenceId }).catch((error) =>
          this.logger.warn(`Notification email failed: ${error?.message ?? error}`),
        );
      }
    } catch (error) {
      this.logger.warn(`Notification "${input.title}" not recorded: ${error?.message ?? error}`);
    }
  }

  /**
   * `notify()` for senders that only know email addresses — the cron digests, which go to the
   * configured `notification_emails` list, and payment-sheet stage mails.
   *
   * Each address is matched to an active user (case-insensitively). An address that is no user —
   * an ops mailbox, a vendor — simply gets no bell; its email is unaffected.
   */
  async notifyEmails(
    emails: Array<string | null | undefined>,
    content: Omit<NotifyInput, 'userIds'>,
  ): Promise<void> {
    try {
      const list = [...new Set(emails.filter(Boolean).map((e) => String(e).trim().toLowerCase()))];
      if (!list.length) return;
      const rows: Array<{ id: string }> = await this.dataSource.query(
        `SELECT "id" FROM users
          WHERE LOWER("email") = ANY($1::text[]) AND "deletedAt" IS NULL AND "status" = 'ACTIVE'`,
        [list],
      );
      await this.notify({ ...content, userIds: rows.map((r) => r.id) });
    } catch (error) {
      this.logger.warn(`Notification "${content.title}" not recorded: ${error?.message ?? error}`);
    }
  }

  // ─── email ───────────────────────────────────────────────────────────────

  /**
   * The bell text as an email, one per recipient whose row was written — so a deduplicated
   * notification is not emailed twice either. Sent to the address on the user now, which after an
   * email change is the new one.
   */
  private async emailRows(
    rows: Array<{ id: string; userId: string }>,
    content: NotifyInput & { referenceId: string | null },
  ): Promise<void> {
    const users: Array<{ id: string; email: string; firstName: string; lastName: string }> =
      await this.dataSource.query(
        `SELECT "id", "email", "firstName", "lastName" FROM users
          WHERE "id" = ANY($1::uuid[]) AND "email" IS NOT NULL`,
        [rows.map((r) => r.userId)],
      );
    const base = (Environments.FE_BASE_URL ?? '').replace(/\/+$/, '');
    const link = base && content.route ? `${base}/${content.route.replace(/^\/+/, '')}` : base;

    for (const user of users) {
      await this.emailService.sendMail({
        receiverEmails: user.email,
        subject: content.title,
        template: EMAIL_TEMPLATE.NOTIFICATION,
        category: content.category as CommunicationCategory,
        emailData: {
          firstName: user.firstName,
          employeeName: `${user.firstName} ${user.lastName ?? ''}`.trim(),
          title: content.title,
          message: content.message,
          link,
          referenceId: content.referenceId ?? undefined,
          referenceType: content.referenceType,
        },
      });
    }
  }

  // ─── push ────────────────────────────────────────────────────────────────

  private async pushRows(
    rows: Array<{ id: string; userId: string }>,
    content: NotifyInput & { referenceId: string | null },
  ): Promise<void> {
    const devices: DeviceRow[] = await this.dataSource.query(
      `SELECT "id", "userId", "token", "platform"
         FROM user_devices
        WHERE "userId" = ANY($1::uuid[]) AND "isActive" = true AND "deletedAt" IS NULL`,
      [rows.map((r) => r.userId)],
    );

    for (const device of devices) {
      if (!this.push.isActiveFor(device.platform)) continue;
      const notificationId = rows.find((r) => r.userId === device.userId)?.id;
      await this.pushToDevice(
        device,
        {
          title: content.title,
          body: content.message,
          data: {
            notificationId: notificationId ?? '',
            category: content.category,
            route: content.route ?? '',
            referenceType: content.referenceType ?? '',
            referenceId: content.referenceId ?? '',
          },
        },
        content,
      );
    }
  }

  private async pushToDevice(device: DeviceRow, message: PushMessage, content: NotifyInput) {
    const startedAt = Date.now();
    const result: PushResult = await this.push.send(device.platform, device.token, message);

    if (!result.ok && result.dead) {
      await this.dataSource.query(
        `UPDATE user_devices SET "isActive" = false, "updatedAt" = now() WHERE "id" = $1`,
        [device.id],
      );
    }

    // Logged like every email and WhatsApp, so "did they get it" has one place to look.
    await this.communicationLogService
      .create({
        channel: CommunicationChannel.PUSH_NOTIFICATION,
        status: result.ok ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
        category: content.category as CommunicationCategory,
        recipientId: device.userId,
        recipientContact: `${device.platform}:${device.id}`,
        subject: message.title,
        messageContent: message.body,
        referenceId: message.data.referenceId || undefined,
        referenceType: content.referenceType,
        provider: PUSH_PROVIDER,
        externalMessageId: result.ok ? result.messageId : undefined,
        errorCode: result.ok ? undefined : result.code,
        errorMessage: result.ok ? undefined : result.error,
        responseTimeMs: Date.now() - startedAt,
        sentAt: result.ok ? new Date() : undefined,
      })
      .catch((error) => this.logger.warn(`Push log not written: ${error?.message ?? error}`));
  }

  // ─── the bell ────────────────────────────────────────────────────────────

  async findMine(userId: string, query: GetNotificationsDto) {
    const status = query.status ?? NotificationReadFilter.ALL;
    const pageSize = query.pageSize ?? 10;
    const page = query.page ?? 1;
    // null = every row; true/false = only read / only unread.
    const isRead =
      status === NotificationReadFilter.ALL ? null : status === NotificationReadFilter.READ;

    const [records, [{ total }], [{ unread }]] = await Promise.all([
      this.dataSource.query(
        `SELECT "id", "title", "message", "category", "referenceType", "referenceId", "route",
                "data", "isRead", "readAt", "createdAt"
           FROM notifications
          WHERE "userId" = $1 AND "deletedAt" IS NULL
            AND ($2::boolean IS NULL OR "isRead" = $2::boolean)
          ORDER BY "createdAt" DESC
          LIMIT $3 OFFSET $4`,
        [userId, isRead, pageSize, (page - 1) * pageSize],
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS total FROM notifications
          WHERE "userId" = $1 AND "deletedAt" IS NULL
            AND ($2::boolean IS NULL OR "isRead" = $2::boolean)`,
        [userId, isRead],
      ),
      this.dataSource.query(
        `SELECT count(*)::int AS unread FROM notifications
          WHERE "userId" = $1 AND "deletedAt" IS NULL AND "isRead" = false`,
        [userId],
      ),
    ]);

    return { records, totalRecords: total, unreadCount: unread };
  }

  async unreadCount(userId: string) {
    const [{ count }] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM notifications
        WHERE "userId" = $1 AND "deletedAt" IS NULL AND "isRead" = false`,
      [userId],
    );
    return { count };
  }

  /**
   * Somebody else's id answers exactly like an id that does not exist — 404 — so the endpoint
   * cannot be used to learn which notification ids are real.
   */
  async markRead(userId: string, id: string) {
    const [rows] = await this.dataSource.query(
      `UPDATE notifications
          SET "isRead" = true, "readAt" = COALESCE("readAt", now()),
              "updatedAt" = now(), "updatedBy" = $2
        WHERE "id" = $1 AND "userId" = $2 AND "deletedAt" IS NULL
        RETURNING "id"`,
      [id, userId],
    );
    if (!rows?.length) throw new NotFoundException(NOTIFICATION_ERRORS.NOT_FOUND);
    return { message: NOTIFICATION_RESPONSES.READ, id, ...(await this.unreadCount(userId)) };
  }

  async markUnread(userId: string, id: string) {
    const [rows] = await this.dataSource.query(
      `UPDATE notifications
          SET "isRead" = false, "readAt" = NULL, "updatedAt" = now(), "updatedBy" = $2
        WHERE "id" = $1 AND "userId" = $2 AND "deletedAt" IS NULL
        RETURNING "id"`,
      [id, userId],
    );
    if (!rows?.length) throw new NotFoundException(NOTIFICATION_ERRORS.NOT_FOUND);
    return { message: NOTIFICATION_RESPONSES.UNREAD, id, ...(await this.unreadCount(userId)) };
  }

  async markAllRead(userId: string) {
    const [, updated] = await this.dataSource.query(
      `UPDATE notifications
          SET "isRead" = true, "readAt" = now(), "updatedAt" = now(), "updatedBy" = $1
        WHERE "userId" = $1 AND "deletedAt" IS NULL AND "isRead" = false`,
      [userId],
    );
    return { message: NOTIFICATION_RESPONSES.ALL_READ, updated: Number(updated) || 0, count: 0 };
  }

  // ─── devices ─────────────────────────────────────────────────────────────

  /**
   * Called at login and whenever the app starts or FCM rotates the token.
   *
   * Upserts on the token. If it belonged to someone else, it now belongs to this user — the phone
   * changed hands, and the previous owner must stop receiving pushes on it.
   */
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const [device]: DeviceRow[] = await this.dataSource.query(
      `INSERT INTO user_devices
         ("userId", "token", "platform", "deviceName", "appVersion", "lastSeenAt", "isActive",
          "createdBy")
       VALUES ($1, $2, $3, $4, $5, now(), true, $1)
       ON CONFLICT ("token") DO UPDATE
         SET "userId" = EXCLUDED."userId",
             "platform" = EXCLUDED."platform",
             "deviceName" = COALESCE(EXCLUDED."deviceName", user_devices."deviceName"),
             "appVersion" = COALESCE(EXCLUDED."appVersion", user_devices."appVersion"),
             "lastSeenAt" = now(),
             "isActive" = true,
             "deletedAt" = NULL,
             "updatedAt" = now(),
             "updatedBy" = EXCLUDED."userId"
       RETURNING "id", "userId", "token", "platform"`,
      [userId, dto.token, dto.platform, dto.deviceName ?? null, dto.appVersion ?? null],
    );

    return {
      message: NOTIFICATION_RESPONSES.DEVICE_REGISTERED,
      id: device.id,
      pushEnabled: this.push.isActiveFor(device.platform),
    };
  }

  /** Called at logout, so the phone stops receiving pushes for an account no longer on it. */
  async removeDevice(userId: string, token: string) {
    const [rows] = await this.dataSource.query(
      `UPDATE user_devices SET "isActive" = false, "updatedAt" = now(), "updatedBy" = $2
        WHERE "token" = $1 AND "userId" = $2 AND "deletedAt" IS NULL
        RETURNING "id"`,
      [token, userId],
    );
    if (!rows?.length) throw new NotFoundException(NOTIFICATION_ERRORS.DEVICE_NOT_FOUND);
    return { message: NOTIFICATION_RESPONSES.DEVICE_REMOVED };
  }

  // ─── retention ───────────────────────────────────────────────────────────

  /** Soft-deletes notifications older than `days`. Returns how many. */
  async purgeOlderThan(days: number): Promise<number> {
    const [, removed] = await this.dataSource.query(
      `UPDATE notifications SET "deletedAt" = now()
        WHERE "deletedAt" IS NULL AND "createdAt" < now() - ($1 || ' days')::interval`,
      [String(days)],
    );
    return Number(removed) || 0;
  }

  /**
   * Switches off devices not seen for `days`, keeping each user's most recently seen device.
   *
   * Several rows for one user are normal — a reinstall or cleared app data gives the phone a new
   * token, and registering it never retires the old one, because one person may also really have
   * a phone and a tablet. Those old rows are what this clears. The newest is always kept: a user
   * who simply hasn't opened the app in a while should still get pushes.
   *
   * Soft delete, so a token that turns up again (the same install, logging back in) is revived by
   * the upsert in `registerDevice` rather than refused by the unique index.
   */
  async deactivateStaleDevices(days: number): Promise<number> {
    const [, removed] = await this.dataSource.query(
      `WITH ranked AS (
         SELECT "id", "lastSeenAt",
                ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "lastSeenAt" DESC, "createdAt" DESC) AS rn
           FROM user_devices
          WHERE "isActive" = true AND "deletedAt" IS NULL
       )
       UPDATE user_devices d
          SET "isActive" = false, "deletedAt" = now(), "updatedAt" = now()
         FROM ranked r
        WHERE d."id" = r."id"
          AND r.rn > 1
          AND r."lastSeenAt" < now() - ($1 || ' days')::interval`,
      [String(days)],
    );
    return Number(removed) || 0;
  }
}
