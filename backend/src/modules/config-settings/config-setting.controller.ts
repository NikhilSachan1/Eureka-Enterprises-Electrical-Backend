import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigSettingService } from './config-setting.service';
import { CreateConfigSettingDto, GetConfigSettingDto } from './dto';

@ApiTags('Config Settings')
@ApiBearerAuth('JWT-auth')
@Controller('config-settings')
export class ConfigSettingController {
  constructor(private readonly configSettingService: ConfigSettingService) {}

  @Post()
  async create(@Body() createConfigSettingDto: CreateConfigSettingDto) {
    return await this.configSettingService.create(createConfigSettingDto);
  }

  @Get()
  async findAll(@Query() getConfigSettingDto: GetConfigSettingDto) {
    return await this.configSettingService.findAll(getConfigSettingDto);
  }
}
