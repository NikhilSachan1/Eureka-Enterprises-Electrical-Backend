import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Param,
  Delete,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  DeleteAnnouncementDto,
  GetAllAnnouncementsDto,
  AcknowledgeAnnouncementDto,
} from './dto';
import { AuthenticatedRequest } from './announcement.types';
import { AnnouncementUserInterceptor } from './interceptors';

@ApiTags('Announcements')
@ApiBearerAuth('JWT-auth')
@Controller('announcement')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new announcement',
    description:
      'Creates a new announcement with the provided details. The announcement will be associated with the authenticated user.',
  })
  async create(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.create(createAnnouncementDto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all announcements',
    description:
      'Retrieves a list of all announcements based on the provided query parameters. Results are filtered based on user permissions.',
  })
  @UseInterceptors(AnnouncementUserInterceptor)
  async findAll(@Query() query: GetAllAnnouncementsDto) {
    return await this.announcementService.findAll(query);
  }

  @Get('unacknowledged')
  @ApiOperation({
    summary: 'Get unacknowledged announcements',
    description:
      'Retrieves all announcements that the authenticated user has not yet acknowledged.',
  })
  async getUnacknowledgedAnnouncements(@Req() req: AuthenticatedRequest) {
    return await this.announcementService.getUnacknowledgedAnnouncements(req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get announcement by ID',
    description: 'Retrieves a specific announcement by its ID, including its target relations.',
  })
  async findOne(@Param('id') id: string) {
    return await this.announcementService.findOneOrFail({
      where: { id },
      relations: ['targets'],
    });
  }

  @Get(':id/acknowledgements')
  @ApiOperation({
    summary: 'Get announcement acknowledgement details',
    description:
      'Retrieves detailed information about all acknowledgements for a specific announcement.',
  })
  async getAcknowledgementDetails(@Param('id') id: string) {
    return await this.announcementService.getAcknowledgementDetails(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an announcement',
    description:
      'Updates an existing announcement with the provided details. The update is associated with the authenticated user.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.update(id, updateAnnouncementDto, req.user.id);
  }

  @Post('acknowledge')
  @ApiOperation({
    summary: 'Acknowledge an announcement',
    description: 'Marks an announcement as acknowledged by the authenticated user.',
  })
  async acknowledge(
    @Body() acknowledgeDto: AcknowledgeAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.acknowledge(acknowledgeDto.announcementId, req.user.id);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Delete multiple announcements',
    description:
      'Deletes multiple announcements in bulk. The deletion is associated with the authenticated user.',
  })
  async delete(
    @Body() deleteAnnouncementDto: DeleteAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.deleteBulk(deleteAnnouncementDto, req.user.id);
  }
}
