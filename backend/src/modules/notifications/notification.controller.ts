import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { GetNotificationsDto, RegisterDeviceDto } from './dto/notification.dto';

/**
 * The caller's own bell and devices — nobody else's, ever.
 *
 * No permission beyond being logged in: every query here is pinned to `req.user.id`, so there is
 * nothing a permission would need to guard.
 */
@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'My notifications',
    description:
      'Newest first. `status` = all | unread | read. The response carries `unreadCount` so the ' +
      'badge can be refreshed from the same call.',
  })
  async findMine(@Query() query: GetNotificationsDto, @Request() req: any) {
    return this.notificationService.findMine(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'My unread count',
    description: 'For the bell badge. Cheap enough to poll every minute.',
  })
  async unreadCount(@Request() req: any) {
    return this.notificationService.unreadCount(req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllRead(@Request() req: any) {
    return this.notificationService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one as read',
    description: 'Also what the app calls when a push is tapped. Returns the new unread count.',
  })
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.notificationService.markRead(req.user.id, id);
  }

  @Patch(':id/unread')
  @ApiOperation({ summary: 'Mark one as unread', description: 'Returns the new unread count.' })
  async markUnread(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.notificationService.markUnread(req.user.id, id);
  }

  @Post('devices')
  @ApiOperation({
    summary: 'Register this device for push',
    description:
      'Call after login, on every app start, and whenever firebase_messaging reports a new ' +
      'token. Safe to repeat. `pushEnabled` says whether pushes are currently sent to this ' +
      'platform (Android only for now).',
  })
  async registerDevice(@Body() dto: RegisterDeviceDto, @Request() req: any) {
    return this.notificationService.registerDevice(req.user.id, dto);
  }

  @Delete('devices/:token')
  @ApiOperation({
    summary: 'Unregister this device',
    description: 'Call on logout. URL-encode the token.',
  })
  async removeDevice(@Param('token') token: string, @Request() req: any) {
    return this.notificationService.removeDevice(req.user.id, token);
  }
}
