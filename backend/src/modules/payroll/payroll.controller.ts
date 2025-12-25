import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto, GenerateBulkPayrollDto, GetPayrollDto, UpdatePayrollDto } from './dto';

@ApiTags('Payroll')
@ApiBearerAuth('JWT-auth')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  async generatePayroll(@Body() generateDto: GeneratePayrollDto, @Request() req: any) {
    const generatedBy = req?.user?.id;
    return await this.payrollService.generatePayroll(generateDto, generatedBy);
  }

  @Post('generate-bulk')
  async generateBulkPayroll(@Body() generateDto: GenerateBulkPayrollDto, @Request() req: any) {
    const generatedBy = req?.user?.id;
    return await this.payrollService.generateBulkPayroll(generateDto, generatedBy);
  }

  @Get()
  async findAll(@Query() query: GetPayrollDto) {
    return await this.payrollService.findAll(query);
  }

  @Get('summary/:month/:year')
  async getSummary(@Param('month') month: string, @Param('year') year: string) {
    return await this.payrollService.getSummary(parseInt(month), parseInt(year));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.payrollService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdatePayrollDto })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePayrollDto, @Request() req: any) {
    const updatedBy = req?.user?.id;
    return await this.payrollService.update(id, updateDto, updatedBy);
  }
}
