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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async create(@Body() createDto: CreateSalaryStructureDto, @Request() req: any) {
    const createdBy = req?.user?.id;
    return await this.salaryStructureService.create(createDto, createdBy);
  }

  @Get()
  @UseInterceptors(SalaryStructureUserInterceptor)
  async findAll(@Query() query: GetSalaryStructureDto) {
    return await this.salaryStructureService.findAll(query);
  }

  @Get('user/:userId')
  @UseInterceptors(SalaryStructureParamUserInterceptor)
  async findByUserId(@Param('userId') userId: string) {
    return await this.salaryStructureService.findActiveByUserId(userId);
  }

  @Get('user/:userId/history')
  @UseInterceptors(SalaryStructureParamUserInterceptor)
  async getSalaryHistory(@Param('userId') userId: string) {
    return await this.salaryStructureService.findSalaryHistory(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.salaryStructureService.findOne(id);
  }

  @Get(':id/change-history')
  async getChangeHistory(@Param('id') id: string) {
    return await this.salaryStructureService.getChangeHistory(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSalaryStructureDto,
    @Request() req: any,
  ) {
    const updatedBy = req?.user?.id;
    return await this.salaryStructureService.update(id, updateDto, updatedBy);
  }

  @Post('increment')
  async applyIncrement(@Body() incrementDto: ApplyIncrementDto, @Request() req: any) {
    const appliedBy = req?.user?.id;
    return await this.salaryStructureService.applyIncrement(incrementDto, appliedBy, req.timezone);
  }
}
