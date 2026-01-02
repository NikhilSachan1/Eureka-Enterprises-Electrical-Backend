import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PayslipService } from './payslip/payslip.service';
import { GeneratePayrollDto, GenerateBulkPayrollDto, GetPayrollDto, UpdatePayrollDto } from './dto';

@ApiTags('Payroll')
@ApiBearerAuth('JWT-auth')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly payslipService: PayslipService,
  ) {}

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

  @Get(':id/payslip')
  @ApiProduces('application/pdf')
  async downloadPayslip(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.payslipService.generatePayslipPDF(id);

    // Get payroll details for filename
    const payroll = await this.payrollService.findOne(id);
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const filename = `Payslip_${monthNames[payroll.month - 1]}_${payroll.year}_${
      payroll.user?.employeeId || payroll.userId
    }.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post(':id/send-payslip')
  async sendPayslip(@Param('id') id: string) {
    await this.payslipService.generateAndSendPayslip({ payrollId: id, sendEmail: true });
    return { message: 'Payslip sent successfully' };
  }
}
