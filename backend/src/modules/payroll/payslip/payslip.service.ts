import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PayslipData, GeneratePayslipOptions } from './payslip.types';
import { generatePayslipHTML } from './payslip.template';
import { PayrollRepository } from '../payroll.repository';
import { EmailService } from 'src/modules/common/email/email.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from 'src/modules/common/email/constants/email.constants';
import { PAYSLIP_CONSTANTS } from './payslip.constants';

@Injectable()
export class PayslipService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly emailService: EmailService,
  ) {}

  async generatePayslipPDF(payrollId: string): Promise<Buffer> {
    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId },
      relations: ['user'],
    });

    if (!payroll) {
      throw new NotFoundException(PAYSLIP_CONSTANTS.ERRORS.PAYROLL_NOT_FOUND);
    }

    const payslipData = this.mapPayrollToPayslipData(payroll);
    const html = generatePayslipHTML(payslipData);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  async generateAndSendPayslip(options: GeneratePayslipOptions): Promise<void> {
    const { payrollId, sendEmail = true } = options;

    const payroll = await this.payrollRepository.findOne({
      where: { id: payrollId },
      relations: ['user'],
    });

    if (!payroll) {
      throw new NotFoundException(PAYSLIP_CONSTANTS.ERRORS.PAYROLL_NOT_FOUND);
    }

    const pdfBuffer = await this.generatePayslipPDF(payrollId);
    const monthName = this.getMonthName(payroll.month);
    const monthYear = `${monthName} ${payroll.year}`;

    if (sendEmail && payroll.user?.email) {
      const netPayableFormatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(payroll.netPayable));

      await this.emailService.sendMail({
        receiverEmails: payroll.user.email,
        subject: EMAIL_SUBJECT.PAYSLIP.replace('{monthYear}', monthYear),
        template: EMAIL_TEMPLATE.PAYSLIP,
        emailData: {
          firstName: payroll.user.firstName,
          employeeName: `${payroll.user.firstName} ${payroll.user.lastName}`,
          monthYear,
          netPayable: netPayableFormatted,
          companyName: PAYSLIP_CONSTANTS.COMPANY.NAME,
          currentYear: new Date().getFullYear(),
        },
        attachments: [
          {
            filename: `Payslip_${monthName}_${payroll.year}_${
              payroll.user.employeeId || payroll.user.id
            }.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      Logger.log(
        PAYSLIP_CONSTANTS.LOGS.SENT_SUCCESS.replace('{email}', payroll.user.email).replace(
          '{monthYear}',
          monthYear,
        ),
      );
    }
  }

  private mapPayrollToPayslipData(payroll: any): PayslipData {
    const user = payroll.user;
    const monthName = this.getMonthName(payroll.month);

    // Calculate earnings
    const earningsItems = [
      { label: 'Basic Salary', amount: Number(payroll.basicProrated) },
      { label: 'House Rent Allowance (HRA)', amount: Number(payroll.hraProrated) },
      { label: 'Food Allowance', amount: Number(payroll.foodAllowanceProrated) },
      { label: 'Conveyance Allowance', amount: Number(payroll.conveyanceAllowanceProrated) },
      { label: 'Medical Allowance', amount: Number(payroll.medicalAllowanceProrated) },
      { label: 'Special Allowance', amount: Number(payroll.specialAllowanceProrated) },
    ].filter((item) => item.amount > 0);

    // Add holiday bonus if applicable
    if (Number(payroll.holidayBonus) > 0) {
      earningsItems.push({ label: 'Holiday Bonus', amount: Number(payroll.holidayBonus) });
    }

    // Add other bonuses
    if (Number(payroll.totalBonus) > 0 && payroll.bonusDetails?.length > 0) {
      payroll.bonusDetails.forEach((bonus: any) => {
        if (bonus.amount > 0) {
          earningsItems.push({ label: `${bonus.type} Bonus`, amount: Number(bonus.amount) });
        }
      });
    }

    // Calculate deductions
    const deductionItems = [
      { label: 'Employee PF', amount: Number(payroll.employeePf) },
      { label: 'TDS', amount: Number(payroll.tds) },
      { label: 'ESIC', amount: Number(payroll.esic) },
      { label: 'Professional Tax', amount: Number(payroll.professionalTax) },
      { label: 'LOP Deduction', amount: Number(payroll.lopDeduction) },
    ].filter((item) => item.amount > 0);

    const totalEarnings = earningsItems.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = deductionItems.reduce((sum, item) => sum + item.amount, 0);

    // Build summary text for holiday leaves
    let summaryNotes = '';
    if (payroll.holidayLeavesCredited > 0) {
      summaryNotes = `Holiday Leaves Credited: ${payroll.holidayLeavesCredited}`;
      Logger.log(summaryNotes);
    }

    return {
      company: {
        name: PAYSLIP_CONSTANTS.COMPANY.NAME,
        address: {
          city: PAYSLIP_CONSTANTS.COMPANY.ADDRESS.CITY,
          state: PAYSLIP_CONSTANTS.COMPANY.ADDRESS.STATE,
          pincode: PAYSLIP_CONSTANTS.COMPANY.ADDRESS.PINCODE,
        },
      },
      employee: {
        name: `${user.firstName} ${user.lastName}`,
        employeeId: user.employeeId || 'N/A',
        designation: user.designation || 'Employee',
        dateOfJoining: user.dateOfJoining
          ? new Date(user.dateOfJoining).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'N/A',
        email: user.email,
        bankAccount: user.accountNumber ? `XXXX${user.accountNumber.slice(-4)}` : 'N/A',
        bankName: user.bankName || 'N/A',
        bankHolderName: user.bankHolderName || `${user.firstName} ${user.lastName}`,
        ifscCode: user.ifscCode || 'N/A',
      },
      payPeriod: {
        month: payroll.month,
        year: payroll.year,
        monthName,
      },
      attendance: {
        totalDays: payroll.totalDays,
        workingDays: payroll.workingDays,
        presentDays: payroll.presentDays,
        paidLeaves: payroll.paidLeaveDays,
        lopDays: payroll.unpaidLeaveDays,
        holidays: payroll.holidays,
        weekoffs: payroll.weekoffs,
        holidaysWorked: payroll.holidaysWorked,
      },
      earnings: {
        items: earningsItems,
        total: totalEarnings,
      },
      deductions: {
        items: deductionItems,
        total: totalDeductions,
      },
      summary: {
        grossSalary: Number(payroll.grossEarnings),
        totalDeductions: Number(payroll.totalDeductions),
        netPayable: Number(payroll.netPayable),
        netPayableInWords: this.numberToWords(Number(payroll.netPayable)),
        holidayLeavesCredited: payroll.holidayLeavesCredited || 0,
      },
    };
  }

  private getMonthName(month: number): string {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months[month - 1] || '';
  }

  private numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = [
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    if (num === 0) return 'Zero Rupees Only';

    num = Math.round(num);
    let words = '';

    // Crores
    if (num >= 10000000) {
      words += this.convertBelowThousand(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }

    // Lakhs
    if (num >= 100000) {
      words += this.convertBelowThousand(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }

    // Thousands
    if (num >= 1000) {
      words += this.convertBelowThousand(Math.floor(num / 1000)) + ' Thousand ';
      num %= 1000;
    }

    // Hundreds
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }

    // Tens and ones
    if (num > 0) {
      if (num < 10) {
        words += ones[num];
      } else if (num < 20) {
        words += teens[num - 10];
      } else {
        words += tens[Math.floor(num / 10)];
        if (num % 10 > 0) {
          words += ' ' + ones[num % 10];
        }
      }
    }

    return words.trim() + ' Rupees Only';
  }

  private convertBelowThousand(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = [
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    let result = '';

    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) result += ' ' + ones[num];
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += ones[num];
    }

    return result.trim();
  }
}
