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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContractorService } from './contractor.service';
import { CreateContractorDto, UpdateContractorDto, GetContractorDto } from './dto';

@ApiTags('Contractors')
@ApiBearerAuth('JWT-auth')
@Controller('contractors')
export class ContractorController {
  constructor(private readonly contractorService: ContractorService) {}

  @Post()
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createContractorDto: CreateContractorDto,
  ) {
    return await this.contractorService.create(createContractorDto, createdBy);
  }

  @Get()
  async findAll(@Query() query: GetContractorDto) {
    return await this.contractorService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.contractorService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateContractorDto: UpdateContractorDto,
  ) {
    return await this.contractorService.update(id, updateContractorDto, updatedBy);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.contractorService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.contractorService.restore(id);
  }
}
