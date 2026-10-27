import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { DevicePlatform, NotificationReadFilter } from '../constants/notification.constants';

export class GetNotificationsDto extends BaseGetDto {
  @ApiPropertyOptional({
    enum: NotificationReadFilter,
    default: NotificationReadFilter.ALL,
    description: 'Which notifications to list. Newest first either way.',
  })
  @IsOptional()
  @IsEnum(NotificationReadFilter)
  status?: NotificationReadFilter = NotificationReadFilter.ALL;
}

export class RegisterDeviceDto {
  @ApiProperty({
    description:
      'Firebase Installation ID from the app (firebase_messaging register()/onRegistered), ' +
      'or the FCM token from getToken() in the Firebase JS SDK on web',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @ApiProperty({
    enum: DevicePlatform,
    description: 'android and web receive pushes; ios may register early but is not sent to yet',
  })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional({ example: 'Pixel 7' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @ApiPropertyOptional({ example: '1.4.2' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

/** What callers hand to `NotificationService.notify()`. */
export interface NotifyInput {
  /** Everyone who should see it. Duplicates, inactive and deleted users are dropped. */
  userIds: Array<string | null | undefined>;
  title: string;
  message: string;
  /** A `CommunicationCategory` value. */
  category: string;
  referenceType?: string;
  referenceId?: string;
  /** Where a tap should open, e.g. `/expenses/<id>`. */
  route?: string;
  /** Extra fields for the app. Nothing sensitive — see the entity. */
  data?: Record<string, unknown>;
  /** For crons: the same key for the same user is only ever stored once. */
  dedupeKey?: string;
  /** Who caused it, for the audit columns. */
  createdBy?: string;
  /**
   * Also email it: the same title and message, in the generic `notification` template, to each
   * recipient whose bell row was written. For events with no email template of their own.
   */
  email?: boolean;
}
