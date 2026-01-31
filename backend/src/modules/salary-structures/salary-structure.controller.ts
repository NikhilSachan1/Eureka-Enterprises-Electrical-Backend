import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SalaryStructureService } from './salary-structure.service';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  ApplyIncrementDto,
  GetSalaryStructureDto,
} from './dto';
import { SalaryStructureUserInterceptor } from './interceptors/salary-structure-user.interceptor';
import { SalaryStructureParamUserInterceptor } from './interceptors/salary-structure-param-user.interceptor';

@ApiTags('Salary Structures')
@ApiBearerAuth('JWT-auth')
@Controller('salary-structures')
export class SalaryStructureController {
  constructor(private readonly salaryStructureService: SalaryStructureService) {}

  @Post()
  @ApiOperation({
    summary: 'Create salary structure',
    description: 'Creates a new salary structure for an employee.',
  })
  async create(@Body() createDto: CreateSalaryStructureDto, @Request() req: any) {
    const createdBy = req?.user?.id;
    return await this.salaryStructureService.create(createDto, createdBy);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all salary structures',
    description: 'Retrieves a list of salary structures with optional filtering and pagination.',
  })
  @UseInterceptors(SalaryStructureUserInterceptor)
  async findAll(@Query() query: GetSalaryStructureDto) {
    return await this.salaryStructureService.findAll(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get active salary structure by user ID',
    description: 'Retrieves the active salary structure for a specific user.',
  })
  @UseInterceptors(SalaryStructureParamUserInterceptor)
  async findByUserId(@Param('userId') userId: string) {
    return await this.salaryStructureService.findActiveByUserId(userId);
  }

  @Get('user/:userId/history')
  @ApiOperation({
    summary: 'Get salary history by user ID',
    description: 'Retrieves the complete salary history for a specific user.',
  })
  @UseInterceptors(SalaryStructureParamUserInterceptor)
  async getSalaryHistory(@Param('userId') userId: string) {
    return await this.salaryStructureService.findSalaryHistory(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get salary structure by ID',
    description: 'Retrieves a specific salary structure by its ID.',
  })
  async findOne(@Param('id') id: string) {
    return await this.salaryStructureService.findOne(id);
  }

  @Get(':id/change-history')
  @ApiOperation({
    summary: 'Get salary structure change history',
    description: 'Retrieves the change history for a specific salary structure.',
  })
  async getChangeHistory(@Param('id') id: string) {
    return await this.salaryStructureService.getChangeHistory(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update salary structure',
    description: 'Updates an existing salary structure with the provided data.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSalaryStructureDto,
    @Request() req: any,
  ) {
    const updatedBy = req?.user?.id;
    return await this.salaryStructureService.update(id, updateDto, updatedBy);
  }

  @Post('increment')
  @ApiOperation({
    summary: 'Apply salary increment',
    description:
      'Applies a salary increment to an employee based on the provided increment details.',
  })
  async applyIncrement(@Body() incrementDto: ApplyIncrementDto, @Request() req: any) {
    const appliedBy = req?.user?.id;
    return await this.salaryStructureService.applyIncrement(incrementDto, appliedBy, req.timezone);
  }
}
