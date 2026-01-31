import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigSettingService } from './config-setting.service';
import { CreateConfigSettingDto, GetConfigSettingDto } from './dto';

@ApiTags('Config Settings')
@ApiBearerAuth('JWT-auth')
@Controller('config-settings')
export class ConfigSettingController {
  constructor(private readonly configSettingService: ConfigSettingService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new config setting',
    description: 'Creates a new configuration setting with the provided details.',
  })
  async create(@Body() createConfigSettingDto: CreateConfigSettingDto) {
    return await this.configSettingService.create(createConfigSettingDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all config settings',
    description:
      'Retrieves a list of all configuration settings based on the provided query parameters.',
  })
  async findAll(@Query() getConfigSettingDto: GetConfigSettingDto) {
    return await this.configSettingService.findAll(getConfigSettingDto);
  }
}
