import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BonusService } from './bonus.service';
import { CreateBonusDto, UpdateBonusDto, GetBonusDto } from './dto';
import { BonusUserInterceptor } from './interceptors/bonus-user.interceptor';

@ApiTags('Bonuses')
@ApiBearerAuth('JWT-auth')
@Controller('bonuses')
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  @Post()
  @ApiOperation({
    summary: 'Create bonus',
    description: 'Creates a new bonus record for an employee.',
  })
  @ApiBody({ type: CreateBonusDto })
  async create(@Body() createDto: CreateBonusDto, @Request() req: any) {
    const createdBy = req?.user?.id;
    return await this.bonusService.create(createDto, createdBy);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all bonuses',
    description: 'Retrieves a paginated list of bonus records with optional filtering.',
  })
  @UseInterceptors(BonusUserInterceptor)
  async findAll(@Query() query: GetBonusDto) {
    return await this.bonusService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get bonus by ID',
    description: 'Retrieves a specific bonus record by its ID.',
  })
  async findOne(@Param('id') id: string) {
    return await this.bonusService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update bonus',
    description: 'Updates an existing bonus record with the provided data.',
  })
  @ApiBody({ type: UpdateBonusDto })
  async update(@Param('id') id: string, @Body() updateDto: UpdateBonusDto, @Request() req: any) {
    const updatedBy = req?.user?.id;
    return await this.bonusService.update(id, updateDto, updatedBy);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete bonus',
    description: 'Deletes a specific bonus record by its ID.',
  })
  async delete(@Param('id') id: string, @Request() req: any) {
    const deletedBy = req?.user?.id;
    return await this.bonusService.delete(id, deletedBy);
  }
}
