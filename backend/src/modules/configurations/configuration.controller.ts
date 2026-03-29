import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import {
  CreateConfigurationDto,
  GetConfigurationDto,
  CreateConfigurationWithSettingsDto,
  UpdateConfigurationDto,
} from './dto/configuration.dto';
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

  @Post('with-settings')
  @ApiOperation({
    summary: 'Create configuration with config settings',
    description:
      'Creates a new configuration and optionally creates config settings for it in a single transaction.',
  })
  async createWithSettings(@Body() dto: CreateConfigurationWithSettingsDto) {
    return await this.configurationService.createWithSettings(dto);
  }

  @Get('details')
  @ApiOperation({
    summary: 'Get configurations with active config settings only',
    description:
      'List configurations with filtering (module, key/label search, pagination, sorting). Only includes configSettings where isActive = true.',
  })
  async findAllWithActiveConfigSettings(@Query() getConfigurationDto: GetConfigurationDto) {
    return await this.configurationService.findAllWithActiveConfigSettings(getConfigurationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a configuration by ID',
    description: 'Retrieves a system configuration by its unique identifier.',
  })
  async findOne(@Param('id') id: string) {
    return await this.configurationService.findOneById(id);
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a configuration',
    description:
      'Updates configuration metadata (module, key, label, valueType, etc.). Key must remain unique.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateConfigurationDto: UpdateConfigurationDto,
  ) {
    return await this.configurationService.update(id, updateConfigurationDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a configuration by ID',
    description: 'Deletes a system configuration by its unique identifier.',
  })
  async delete(@Param('id') id: string) {
    return await this.configurationService.delete(id);
  }
}
