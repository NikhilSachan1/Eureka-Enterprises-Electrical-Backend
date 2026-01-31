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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Generate payroll',
    description: 'Generates payroll for a specific month and year for employees.',
  })
  async generatePayroll(@Body() generateDto: GeneratePayrollDto, @Request() req: any) {
    const generatedBy = req?.user?.id;
    return await this.payrollService.generatePayroll(generateDto, generatedBy);
  }

  @Post('generate-bulk')
  @ApiOperation({
    summary: 'Generate bulk payroll',
    description: 'Generates payroll for multiple employees in a specific month and year.',
  })
  async generateBulkPayroll(@Body() generateDto: GenerateBulkPayrollDto, @Request() req: any) {
    const generatedBy = req?.user?.id;
    return await this.payrollService.generateBulkPayroll(generateDto, generatedBy);
  }

  @Post('bulk-cancel')
  @ApiOperation({
    summary: 'Bulk cancel payroll',
    description: 'Cancels multiple payroll records in bulk with an optional reason.',
  })
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
  @ApiOperation({
    summary: 'Bulk update payroll status',
    description: 'Updates the status of multiple payroll records in bulk.',
  })
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
  @ApiOperation({
    summary: 'Get all payroll records',
    description: 'Retrieves a paginated list of payroll records with optional filtering.',
  })
  @UseInterceptors(PayrollUserInterceptor)
  async findAll(@Query() query: GetPayrollDto) {
    return await this.payrollService.findAll(query);
  }

  @Get('summary/:month/:year')
  @ApiOperation({
    summary: 'Get payroll summary',
    description: 'Retrieves payroll summary statistics for a specific month and year.',
  })
  async getSummary(@Param('month') month: string, @Param('year') year: string) {
    return await this.payrollService.getSummary(parseInt(month), parseInt(year));
  }

  @Get('salary-report')
  @ApiOperation({
    summary: 'Get salary report',
    description: 'Generates a salary report with optional filtering by date range and employees.',
  })
  async getSalaryReport(@Query() query: GetSalaryReportDto) {
    return await this.payrollService.getSalaryReport(query);
  }

  @Get('user/:userId/:month/:year')
  @ApiOperation({
    summary: 'Get payroll by user and period',
    description: 'Retrieves payroll record for a specific user, month, and year.',
  })
  @UseInterceptors(PayrollPayslipUserInterceptor)
  async findByUserMonthYear(
    @Param('userId') userId: string,
    @Param('month') month: string,
    @Param('year') year: string,
  ) {
    return await this.payrollService.findByUserMonthYear(userId, parseInt(month), parseInt(year));
  }

  @Get('user/:userId/:month/:year/payslip')
  @ApiOperation({
    summary: 'Download payslip by user and period',
    description: 'Downloads the payslip PDF for a specific user, month, and year.',
  })
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
  @ApiOperation({
    summary: 'Get payroll by ID',
    description: 'Retrieves a specific payroll record by its ID.',
  })
  async findOne(@Param('id') id: string) {
    return await this.payrollService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update payroll',
    description: 'Updates an existing payroll record with the provided data.',
  })
  @ApiBody({ type: UpdatePayrollDto })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePayrollDto, @Request() req: any) {
    const updatedBy = req?.user?.id;
    return await this.payrollService.update(id, updateDto, updatedBy);
  }

  @Get(':id/payslip')
  @ApiOperation({
    summary: 'Download payslip by payroll ID',
    description: 'Downloads the payslip PDF for a specific payroll record.',
  })
  @ApiProduces('application/pdf')
  async downloadPayslip(@Param('id') id: string, @Res() res: Response) {
    const { pdfBuffer, filename } = await this.payrollService.generatePayslipPdf(id);
    this.sendPdfResponse(res, pdfBuffer, filename);
  }

  @Post(':id/send-payslip')
  @ApiOperation({
    summary: 'Send payslip via email',
    description: 'Generates and sends the payslip PDF to the employee via email.',
  })
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
