import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PayslipService } from './payslip/payslip.service';
import {
  GeneratePayrollDto,
  GenerateBulkPayrollDto,
  GetPayrollDto,
  UpdatePayrollDto,
  GetSalaryReportDto,
  BulkCancelPayrollDto,
  BulkUpdatePayrollStatusDto,
} from './dto';
import { PAYROLL_RESPONSES } from './constants/payroll.constants';
import { PayrollUserInterceptor } from './interceptors/payroll-user.interceptor';
import { PayrollPayslipUserInterceptor } from './interceptors/payroll-payslip-user.interceptor';

@ApiTags('Payroll')
@ApiBearerAuth('JWT-auth')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly payslipService: PayslipService, // Kept for send-payslip endpoint
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

  @Post('bulk-cancel')
  @ApiBody({ type: BulkCancelPayrollDto })
  async bulkCancel(@Body() bulkCancelDto: BulkCancelPayrollDto, @Request() req: any) {
    const cancelledBy = req?.user?.id;
    const result = await this.payrollService.bulkCancel(
      bulkCancelDto.payrollIds,
      cancelledBy,
      bulkCancelDto.reason,
    );
    return {
      message: PAYROLL_RESPONSES.BULK_CANCELLED.replace(
        '{success}',
        String(result.success),
      ).replace('{failed}', String(result.failed)),
      ...result,
    };
  }

  @Post('bulk-status-update')
  @ApiBody({ type: BulkUpdatePayrollStatusDto })
  async bulkUpdateStatus(@Body() bulkUpdateDto: BulkUpdatePayrollStatusDto, @Request() req: any) {
    const updatedBy = req?.user?.id;
    const result = await this.payrollService.bulkUpdateStatus(
      bulkUpdateDto.payrollIds,
      bulkUpdateDto.targetStatus,
      updatedBy,
    );
    return {
      message: PAYROLL_RESPONSES.BULK_STATUS_UPDATED.replace(
        '{success}',
        String(result.success),
      ).replace('{failed}', String(result.failed)),
      ...result,
    };
  }

  @Get()
  @UseInterceptors(PayrollUserInterceptor)
  async findAll(@Query() query: GetPayrollDto) {
    return await this.payrollService.findAll(query);
  }

  @Get('summary/:month/:year')
  async getSummary(@Param('month') month: string, @Param('year') year: string) {
    return await this.payrollService.getSummary(parseInt(month), parseInt(year));
  }

  @Get('salary-report')
  async getSalaryReport(@Query() query: GetSalaryReportDto) {
    return await this.payrollService.getSalaryReport(query);
  }

  @Get('user/:userId/:month/:year')
  @UseInterceptors(PayrollPayslipUserInterceptor)
  async findByUserMonthYear(
    @Param('userId') userId: string,
    @Param('month') month: string,
    @Param('year') year: string,
  ) {
    return await this.payrollService.findByUserMonthYear(userId, parseInt(month), parseInt(year));
  }

  @Get('user/:userId/:month/:year/payslip')
  @UseInterceptors(PayrollPayslipUserInterceptor)
  @ApiProduces('application/pdf')
  async downloadPayslipByUserMonthYear(
    @Param('userId') userId: string,
    @Param('month') month: string,
    @Param('year') year: string,
    @Res() res: Response,
  ) {
    const { pdfBuffer, filename } = await this.payrollService.generatePayslipPdfByUserMonthYear(
      userId,
      parseInt(month),
      parseInt(year),
    );
    this.sendPdfResponse(res, pdfBuffer, filename);
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
    const { pdfBuffer, filename } = await this.payrollService.generatePayslipPdf(id);
    this.sendPdfResponse(res, pdfBuffer, filename);
  }

  @Post(':id/send-payslip')
  async sendPayslip(@Param('id') id: string) {
    await this.payslipService.generateAndSendPayslip({ payrollId: id, sendEmail: true });
    return { message: 'Payslip sent successfully' };
  }

  private sendPdfResponse(res: Response, pdfBuffer: Buffer, filename: string): void {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
