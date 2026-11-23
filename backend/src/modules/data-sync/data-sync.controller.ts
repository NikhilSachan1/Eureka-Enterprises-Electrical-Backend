import { Controller, Get, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Roles as RoleEnum } from '../roles/constants/role.constants';
import { DataSyncService } from './data-sync.service';

@ApiTags('Data Sync')
@ApiBearerAuth('JWT-auth')
@Controller('data-sync')
@Roles(RoleEnum.SUPER_ADMIN)
export class DataSyncController {
  constructor(private readonly dataSyncService: DataSyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether this server may pull prod data (UAT only)' })
  async getStatus() {
    return await this.dataSyncService.getStatus();
  }

  @Post('prod-to-uat')
  @ApiOperation({
    summary: 'Replace UAT data with prod data',
    description:
      'Runs only on a *_uat database with DATA_SYNC_ENABLED=true. Log tables and device tokens ' +
      'stay empty, emails / phone numbers are masked, and `migrations` is left untouched. ' +
      'All-or-nothing: on any error UAT is left as it was. Signs everyone out.',
  })
  async syncFromProd(@Request() { user: { id: userId } }: { user: { id: string } }) {
    return await this.dataSyncService.syncFromProd(userId);
  }
}
