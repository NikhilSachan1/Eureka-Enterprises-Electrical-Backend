import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { CreateConfigurationDto, GetConfigurationDto } from './dto/configuration.dto';

@ApiTags('Configurations')
@ApiBearerAuth('JWT-auth')
@Controller('configurations')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Post()
  async create(@Body() createConfigurationDto: CreateConfigurationDto) {
    return await this.configurationService.create(createConfigurationDto);
  }

  @Get()
  async findAll(@Query() getConfigurationDto: GetConfigurationDto) {
    return await this.configurationService.findAll(getConfigurationDto);
  }
}
