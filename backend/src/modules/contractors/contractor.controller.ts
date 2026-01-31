import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ContractorService } from './contractor.service';
import {
  CreateContractorDto,
  UpdateContractorDto,
  GetContractorDto,
  BulkDeleteContractorDto,
} from './dto';

@ApiTags('Contractors')
@ApiBearerAuth('JWT-auth')
@Controller('contractors')
export class ContractorController {
  constructor(private readonly contractorService: ContractorService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a contractor',
    description: 'Creates a new contractor record in the system.',
  })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createContractorDto: CreateContractorDto,
  ) {
    return await this.contractorService.create(createContractorDto, createdBy);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all contractors',
    description: 'Retrieves a list of contractors with optional filtering and pagination.',
  })
  async findAll(@Query() query: GetContractorDto) {
    return await this.contractorService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a contractor by ID',
    description: 'Retrieves a specific contractor by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.contractorService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a contractor',
    description: 'Updates an existing contractor record with new information.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateContractorDto: UpdateContractorDto,
  ) {
    return await this.contractorService.update(id, updateContractorDto, updatedBy);
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete contractors',
    description: 'Deletes multiple contractors in bulk based on the provided contractor IDs.',
  })
  @ApiBody({ type: BulkDeleteContractorDto })
  async bulkDelete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteContractorDto,
  ) {
    return await this.contractorService.bulkDelete(bulkDeleteDto.contractorIds, deletedBy);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a contractor',
    description: 'Soft deletes a contractor by its unique identifier.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.contractorService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Restore a deleted contractor',
    description: 'Restores a previously soft-deleted contractor back to active status.',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.contractorService.restore(id);
  }
}
