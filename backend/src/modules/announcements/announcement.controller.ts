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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async create(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.create(createAnnouncementDto, req.user.id);
  }

  @Get()
  @UseInterceptors(AnnouncementUserInterceptor)
  async findAll(@Query() query: GetAllAnnouncementsDto) {
    return await this.announcementService.findAll(query);
  }

  @Get('unacknowledged')
  async getUnacknowledgedAnnouncements(@Req() req: AuthenticatedRequest) {
    return await this.announcementService.getUnacknowledgedAnnouncements(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.announcementService.findOneOrFail({
      where: { id },
      relations: ['targets'],
    });
  }

  @Get(':id/acknowledgements')
  async getAcknowledgementDetails(@Param('id') id: string) {
    return await this.announcementService.getAcknowledgementDetails(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.update(id, updateAnnouncementDto, req.user.id);
  }

  @Post('acknowledge')
  async acknowledge(
    @Body() acknowledgeDto: AcknowledgeAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.acknowledge(acknowledgeDto.announcementId, req.user.id);
  }

  @Delete('bulk')
  async delete(
    @Body() deleteAnnouncementDto: DeleteAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.announcementService.deleteBulk(deleteAnnouncementDto, req.user.id);
  }
}
