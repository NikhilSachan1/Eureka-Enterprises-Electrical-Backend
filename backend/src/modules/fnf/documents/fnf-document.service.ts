import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { FnfEntity } from '../entities/fnf.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import {
  FnfDocumentType,
  FNF_DOCUMENT_REF_PREFIX,
  FNF_DOCUMENT_FILE_NAMES,
  FNF_DOCUMENT_EMAIL_FILE_NAMES,
  FNF_DOCUMENT_STORAGE,
  FNF_DOCUMENT_ERRORS,
} from './fnf-document.constants';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from 'src/modules/common/email/constants/email.constants';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import { getRelievingLetterTemplate } from './relieving-letter.template';
import { getExperienceLetterTemplate } from './experience-letter.template';
import { getFnfStatementTemplate } from './fnf-statement.template';
import { generatePayslipHTML } from 'src/modules/payroll/payslip/payslip.template';
import { PayslipData } from 'src/modules/payroll/payslip/payslip.types';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { EmailService } from 'src/modules/common/email/email.service';
import { FnfRepository } from '../fnf.repository';
import { FnfStatus } from '../constants/fnf.constants';
import { ExperienceLetterData, FnfStatementData, RelievingLetterData } from '../fnf.types';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class FnfDocumentService {
  private readonly logger = new Logger(FnfDocumentService.name);

  constructor(
    private readonly fnfRepository: FnfRepository,
    private readonly filesService: FilesService,
    private readonly emailService: EmailService,
    private readonly utilityService: UtilityService,
  ) {}

  async generateAllDocuments(
    fnf: FnfEntity,
    user: UserEntity,
    generatedBy: string,
  ): Promise<{
    relievingLetterKey?: string;
    experienceLetterKey?: string;
    fnfStatementKey?: string;
    payslipKey?: string;
  }> {
    const results: {
      relievingLetterKey?: string;
      experienceLetterKey?: string;
      fnfStatementKey?: string;
      payslipKey?: string;
    } = {};

    const userIdentifier = user.employeeId || user.id;

    try {
      // Generate Relieving Letter
      const relievingPdf = await this.generateRelievingLetter(fnf, user);
      const relievingKey = await this.uploadDocument(
        relievingPdf,
        `${FNF_DOCUMENT_FILE_NAMES.RELIEVING_LETTER}-${userIdentifier}.pdf`,
        user.id,
      );
      results.relievingLetterKey = relievingKey;

      // Generate Experience Letter
      const experiencePdf = await this.generateExperienceLetter(fnf, user);
      const experienceKey = await this.uploadDocument(
        experiencePdf,
        `${FNF_DOCUMENT_FILE_NAMES.EXPERIENCE_LETTER}-${userIdentifier}.pdf`,
        user.id,
      );
      results.experienceLetterKey = experienceKey;

      // Generate FNF Statement
      const fnfPdf = await this.generateFnfStatement(fnf, user);
      const fnfKey = await this.uploadDocument(
        fnfPdf,
        `${FNF_DOCUMENT_FILE_NAMES.FNF_STATEMENT}-${userIdentifier}.pdf`,
        user.id,
      );
      results.fnfStatementKey = fnfKey;

      // Generate Final Payslip
      const payslipPdf = await this.generateFnfPayslip(fnf, user);
      const payslipKey = await this.uploadDocument(
        payslipPdf,
        `${FNF_DOCUMENT_FILE_NAMES.PAYSLIP}-${userIdentifier}.pdf`,
        user.id,
      );
      results.payslipKey = payslipKey;

      // Update FNF record with document keys
      await this.fnfRepository.update(
        { id: fnf.id },
        {
          ...results,
          status: FnfStatus.DOCUMENTS_GENERATED,
          updatedBy: generatedBy,
        },
      );

      this.logger.log(`Generated all FNF documents for user ${user.id}`);

      return results;
    } catch (error) {
      this.logger.error(`Error generating FNF documents: ${error.message}`);
      throw error;
    }
  }

  async generateRelievingLetter(fnf: FnfEntity, user: UserEntity): Promise<Buffer> {
    const data: RelievingLetterData = {
      companyName: COMPANY_DETAILS.NAME,
      companyAddress: COMPANY_DETAILS.FULL_ADDRESS,
      companyLogo: COMPANY_DETAILS.LOGO_URL,
      letterDate: this.formatDate(new Date()),
      refNumber: this.generateRefNumber(FNF_DOCUMENT_REF_PREFIX.RELIEVING_LETTER, fnf.id),
      employeeName: `${user.firstName} ${user.lastName}`,
      employeeId: user.employeeId || user.id.substring(0, 8),
      designation: user.designation || 'Employee',
      department: undefined,
      dateOfJoining: this.formatDate(user.dateOfJoining),
      lastWorkingDate: this.formatDate(fnf.lastWorkingDate),
      exitReason: this.formatExitReason(fnf.exitReason),
    };

    const html = getRelievingLetterTemplate(data);
    return this.generatePdf(html);
  }

  async generateExperienceLetter(fnf: FnfEntity, user: UserEntity): Promise<Buffer> {
    const totalExperience = this.calculateExperience(user.dateOfJoining, fnf.lastWorkingDate);

    const data: ExperienceLetterData = {
      companyName: COMPANY_DETAILS.NAME,
      companyAddress: COMPANY_DETAILS.FULL_ADDRESS,
      companyLogo: COMPANY_DETAILS.LOGO_URL,
      letterDate: this.formatDate(new Date()),
      refNumber: this.generateRefNumber(FNF_DOCUMENT_REF_PREFIX.EXPERIENCE_LETTER, fnf.id),
      employeeName: `${user.firstName} ${user.lastName}`,
      employeeId: user.employeeId || user.id.substring(0, 8),
      designation: user.designation || 'Employee',
      department: undefined,
      dateOfJoining: this.formatDate(user.dateOfJoining),
      lastWorkingDate: this.formatDate(fnf.lastWorkingDate),
      totalExperience,
    };

    const html = getExperienceLetterTemplate(data);
    return this.generatePdf(html);
  }

  async generateFnfStatement(fnf: FnfEntity, user: UserEntity): Promise<Buffer> {
    const data: FnfStatementData = {
      companyName: COMPANY_DETAILS.NAME,
      companyAddress: COMPANY_DETAILS.FULL_ADDRESS,
      companyLogo: COMPANY_DETAILS.LOGO_URL,
      statementDate: this.formatDate(new Date()),
      refNumber: this.generateRefNumber(FNF_DOCUMENT_REF_PREFIX.FNF_STATEMENT, fnf.id),
      employeeName: `${user.firstName} ${user.lastName}`,
      employeeId: user.employeeId || user.id.substring(0, 8),
      designation: user.designation || 'Employee',
      department: undefined,
      dateOfJoining: this.formatDate(user.dateOfJoining),
      lastWorkingDate: this.formatDate(fnf.lastWorkingDate),
      bankAccount: user.accountNumber ? this.maskAccountNumber(user.accountNumber) : undefined,
      panNumber: user.panNumber,
      daysWorked: fnf.daysWorked,
      dailySalary: Number(fnf.dailySalary),
      finalSalary: Number(fnf.finalSalary),
      encashableLeaves: Number(fnf.encashableLeaves),
      leaveEncashmentAmount: Number(fnf.leaveEncashmentAmount),
      serviceYears: Number(fnf.serviceYears),
      gratuityAmount: Number(fnf.gratuityAmount),
      pendingExpenseReimbursement: Number(fnf.pendingExpenseReimbursement),
      pendingFuelReimbursement: Number(fnf.pendingFuelReimbursement),
      pendingReimbursements: Number(fnf.pendingReimbursements),
      otherAdditions: Number(fnf.otherAdditions),
      additionRemarks: fnf.additionRemarks,
      totalEarnings: Number(fnf.totalEarnings),
      noticePeriodDays: fnf.noticePeriodDays,
      noticePeriodRecovery: Number(fnf.noticePeriodRecovery),
      unsettledExpenseCredit: Number(fnf.unsettledExpenseCredit),
      unsettledFuelCredit: Number(fnf.unsettledFuelCredit),
      otherDeductions: Number(fnf.otherDeductions),
      deductionRemarks: fnf.deductionRemarks,
      totalDeductions: Number(fnf.totalDeductions),
      netPayable: Number(fnf.netPayable),
    };

    const html = getFnfStatementTemplate(data);
    return this.generatePdf(html);
  }

  async generateFnfPayslip(fnf: FnfEntity, user: UserEntity): Promise<Buffer> {
    const salaryBreakdown = fnf.salaryBreakdown || {};
    const lastWorkingDate = new Date(fnf.lastWorkingDate);
    const month = lastWorkingDate.getMonth() + 1;
    const year = lastWorkingDate.getFullYear();
    const monthName = this.utilityService.getMonthName(month);

    // Build earnings items from salary breakdown
    const earningsItems = [
      { label: 'Basic Salary', amount: salaryBreakdown.basicProrated || 0 },
      { label: 'House Rent Allowance', amount: salaryBreakdown.hraProrated || 0 },
      { label: 'Food Allowance', amount: salaryBreakdown.foodAllowanceProrated || 0 },
      { label: 'Conveyance Allowance', amount: salaryBreakdown.conveyanceAllowanceProrated || 0 },
      { label: 'Medical Allowance', amount: salaryBreakdown.medicalAllowanceProrated || 0 },
      { label: 'Special Allowance', amount: salaryBreakdown.specialAllowanceProrated || 0 },
    ].filter((item) => item.amount > 0);

    // Add holiday bonus if applicable
    if (salaryBreakdown.holidayBonus > 0) {
      earningsItems.push({ label: 'Holiday Bonus', amount: salaryBreakdown.holidayBonus });
    }

    // Build deductions items
    const deductionItems = [
      { label: 'Provident Fund', amount: salaryBreakdown.employeePfProrated || 0 },
      { label: 'Income Tax (TDS)', amount: salaryBreakdown.tdsProrated || 0 },
      { label: 'ESIC', amount: salaryBreakdown.esicProrated || 0 },
      { label: 'Professional Tax', amount: salaryBreakdown.professionalTaxProrated || 0 },
      { label: 'LOP Deduction', amount: salaryBreakdown.lopDeduction || 0 },
    ].filter((item) => item.amount > 0);

    const totalEarnings = earningsItems.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = deductionItems.reduce((sum, item) => sum + item.amount, 0);
    const paidDays = salaryBreakdown.presentDays + (salaryBreakdown.paidLeaveDays || 0);

    const payslipData: PayslipData = {
      company: {
        name: COMPANY_DETAILS.NAME,
        address: {
          city: COMPANY_DETAILS.ADDRESS.CITY,
          state: COMPANY_DETAILS.ADDRESS.STATE,
          pincode: COMPANY_DETAILS.ADDRESS.PINCODE,
        },
      },
      employee: {
        name: `${user.firstName} ${user.lastName}`,
        employeeId: user.employeeId || 'N/A',
        designation: user.designation || 'Employee',
        dateOfJoining: user.dateOfJoining
          ? new Date(user.dateOfJoining).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
        email: user.email,
        bankAccount: user.accountNumber || 'N/A',
        bankName: user.bankName || 'N/A',
        bankHolderName: user.bankHolderName || `${user.firstName} ${user.lastName}`,
        ifscCode: user.ifscCode || 'N/A',
        uanNumber: user.uanNumber || undefined,
      },
      payPeriod: {
        month,
        year,
        monthName: `${monthName} (Final)`,
        payDate: this.formatDate(fnf.lastWorkingDate),
      },
      attendance: {
        totalDays: salaryBreakdown.totalDaysInMonth || 0,
        workingDays: salaryBreakdown.totalWorkingDaysInMonth || 0,
        presentDays: salaryBreakdown.presentDays || 0,
        paidLeaves: salaryBreakdown.paidLeaveDays || 0,
        lopDays: salaryBreakdown.unpaidLeaveDays || 0,
        holidays: salaryBreakdown.holidays || 0,
        weekoffs: 0,
        holidaysWorked: salaryBreakdown.holidaysWorked || 0,
        paidDays,
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
        grossSalary: salaryBreakdown.grossEarnings || 0,
        totalDeductions: salaryBreakdown.totalDeductions || 0,
        netPayable: salaryBreakdown.netSalary || 0,
        netPayableInWords: this.utilityService.numberToWords(salaryBreakdown.netSalary || 0),
      },
    };

    const html = generatePayslipHTML(payslipData);
    return this.generatePdf(html);
  }

  async getDocumentBuffer(
    fnf: FnfEntity,
    user: UserEntity,
    documentType: FnfDocumentType,
  ): Promise<Buffer> {
    switch (documentType) {
      case FnfDocumentType.RELIEVING_LETTER:
        return this.generateRelievingLetter(fnf, user);
      case FnfDocumentType.EXPERIENCE_LETTER:
        return this.generateExperienceLetter(fnf, user);
      case FnfDocumentType.FNF_STATEMENT:
        return this.generateFnfStatement(fnf, user);
      case FnfDocumentType.PAYSLIP:
        return this.generateFnfPayslip(fnf, user);
      default:
        throw new NotFoundException(FNF_DOCUMENT_ERRORS.INVALID_DOCUMENT_TYPE);
    }
  }

  async sendDocumentsViaEmail(fnf: FnfEntity, user: UserEntity): Promise<void> {
    const userIdentifier = user.employeeId || user.firstName;
    const employeeName = `${user.firstName} ${user.lastName}`;
    const attachments: { filename: string; content: Buffer }[] = [];

    const relievingPdf = await this.generateRelievingLetter(fnf, user);
    attachments.push({
      filename: `${FNF_DOCUMENT_EMAIL_FILE_NAMES.RELIEVING_LETTER}_${userIdentifier}.pdf`,
      content: relievingPdf,
    });

    const experiencePdf = await this.generateExperienceLetter(fnf, user);
    attachments.push({
      filename: `${FNF_DOCUMENT_EMAIL_FILE_NAMES.EXPERIENCE_LETTER}_${userIdentifier}.pdf`,
      content: experiencePdf,
    });

    const fnfPdf = await this.generateFnfStatement(fnf, user);
    attachments.push({
      filename: `${FNF_DOCUMENT_EMAIL_FILE_NAMES.FNF_STATEMENT}_${userIdentifier}.pdf`,
      content: fnfPdf,
    });

    const payslipPdf = await this.generateFnfPayslip(fnf, user);
    attachments.push({
      filename: `${FNF_DOCUMENT_EMAIL_FILE_NAMES.PAYSLIP}_${userIdentifier}.pdf`,
      content: payslipPdf,
    });

    // Send email with attachments
    await this.emailService.sendMail({
      receiverEmails: user.email,
      subject: EMAIL_SUBJECT.FNF_DOCUMENTS.replace('{employeeName}', employeeName),
      template: EMAIL_TEMPLATE.FNF_DOCUMENTS,
      emailData: {
        employeeName,
        companyName: COMPANY_DETAILS.NAME,
      },
      attachments,
    });

    this.logger.log(`Sent FNF documents via email to ${user.email}`);
  }

  // ==================== Private Helper Methods ====================

  private async generatePdf(html: string): Promise<Buffer> {
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
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private async uploadDocument(buffer: Buffer, filename: string, userId: string): Promise<string> {
    const key = `${FNF_DOCUMENT_STORAGE.BASE_PATH}/${userId}/${Date.now()}-${filename}`;
    const uploadedKey = await this.filesService.uploadFile(buffer, key, 'application/pdf');
    return uploadedKey;
  }

  private generateRefNumber(prefix: string, fnfId: string): string {
    return `${prefix}/${new Date().getFullYear()}/${fnfId.substring(0, 8).toUpperCase()}`;
  }

  private formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatExitReason(reason: string): string {
    const reasons: Record<string, string> = {
      RESIGNATION: 'Resignation',
      TERMINATION: 'Termination',
      RETIREMENT: 'Retirement',
      CONTRACT_END: 'Contract End',
      ABSCONDING: 'Absconding',
      MUTUAL_SEPARATION: 'Mutual Separation',
      MEDICAL: 'Medical Reasons',
      DEATH: 'Death',
    };
    return reasons[reason] || reason;
  }

  private calculateExperience(startDate: Date | string, endDate: Date | string): string {
    if (!startDate || !endDate) return 'N/A';

    const start = new Date(startDate);
    const end = new Date(endDate);

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    const parts: string[] = [];
    if (years > 0) {
      parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
    }
    if (months > 0) {
      parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Less than a month';
  }

  private maskAccountNumber(accountNo: string): string {
    if (!accountNo || accountNo.length < 4) return accountNo;
    const lastFour = accountNo.slice(-4);
    return `****${lastFour}`;
  }
}
