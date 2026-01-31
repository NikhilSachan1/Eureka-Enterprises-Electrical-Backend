import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { CreateConfigurationDto, GetConfigurationDto } from './dto/configuration.dto';

@ApiTags('Configurations')
@ApiBearerAuth('JWT-auth')
@Controller('configurations')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new configuration',
    description: 'Creates a new system configuration with the provided details.',
  })
  async create(@Body() createConfigurationDto: CreateConfigurationDto) {
    return await this.configurationService.create(createConfigurationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all configurations',
    description:
      'Retrieves a list of all system configurations based on the provided query parameters.',
  })
  async findAll(@Query() getConfigurationDto: GetConfigurationDto) {
    return await this.configurationService.findAll(getConfigurationDto);
  }
}
