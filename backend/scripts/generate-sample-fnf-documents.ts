/**
 * Script to generate sample FNF documents (Relieving Letter, Experience Letter, FNF Statement) for preview
 * Run: npx ts-node scripts/generate-sample-fnf-documents.ts
 */

import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Import the templates
import { getRelievingLetterTemplate } from '../src/modules/fnf/documents/relieving-letter.template';
import { getExperienceLetterTemplate } from '../src/modules/fnf/documents/experience-letter.template';
import { getFnfStatementTemplate } from '../src/modules/fnf/documents/fnf-statement.template';
import { generatePayslipHTML } from '../src/modules/payroll/payslip/payslip.template';
import {
  RelievingLetterData,
  ExperienceLetterData,
  FnfStatementData,
} from '../src/modules/fnf/fnf.types';
import { PayslipData } from '../src/modules/payroll/payslip/payslip.types';
import { COMPANY_DETAILS } from '../src/utils/master-constants/master-constants';

// Company details
const COMPANY = {
  name: COMPANY_DETAILS.NAME,
  address: COMPANY_DETAILS.FULL_ADDRESS,
  logo: COMPANY_DETAILS.LOGO_URL,
};

// Sample employee data
const EMPLOYEE = {
  name: 'Akhil Sachan',
  id: 'EMP-11039',
  designation: 'Senior Software Engineer',
  department: 'Engineering',
  dateOfJoining: '15 July 2020',
  lastWorkingDate: '31 December 2025',
  email: 'akhil.sachan@coditas.com',
  bankAccount: '****5268',
  panNumber: 'ABCDE1234F',
  uanNumber: '101851845539',
};

// Sample Relieving Letter Data
const relievingLetterData: RelievingLetterData = {
  companyName: COMPANY.name,
  companyAddress: COMPANY.address,
  companyLogo: COMPANY.logo,
  letterDate: '31 December 2025',
  refNumber: 'RL/2025/FNF-001',
  employeeName: EMPLOYEE.name,
  employeeId: EMPLOYEE.id,
  designation: EMPLOYEE.designation,
  department: EMPLOYEE.department,
  dateOfJoining: EMPLOYEE.dateOfJoining,
  lastWorkingDate: EMPLOYEE.lastWorkingDate,
  exitReason: 'Resignation',
};

// Sample Experience Letter Data
const experienceLetterData: ExperienceLetterData = {
  companyName: COMPANY.name,
  companyAddress: COMPANY.address,
  companyLogo: COMPANY.logo,
  letterDate: '31 December 2025',
  refNumber: 'EXP/2025/FNF-001',
  employeeName: EMPLOYEE.name,
  employeeId: EMPLOYEE.id,
  designation: EMPLOYEE.designation,
  department: EMPLOYEE.department,
  dateOfJoining: EMPLOYEE.dateOfJoining,
  lastWorkingDate: EMPLOYEE.lastWorkingDate,
  totalExperience: '5 years 5 months',
};

// Sample FNF Statement Data
const fnfStatementData: FnfStatementData = {
  companyName: COMPANY.name,
  companyAddress: COMPANY.address,
  companyLogo: COMPANY.logo,
  statementDate: '31 December 2025',
  refNumber: 'FNF/2025/001',
  employeeName: EMPLOYEE.name,
  employeeId: EMPLOYEE.id,
  designation: EMPLOYEE.designation,
  department: EMPLOYEE.department,
  dateOfJoining: EMPLOYEE.dateOfJoining,
  lastWorkingDate: EMPLOYEE.lastWorkingDate,
  bankAccount: EMPLOYEE.bankAccount,
  panNumber: EMPLOYEE.panNumber,
  // Earnings
  daysWorked: 22,
  dailySalary: 4500,
  finalSalary: 99000,
  encashableLeaves: 15,
  leaveEncashmentAmount: 67500,
  serviceYears: 5.46,
  gratuityAmount: 138462,
  pendingExpenseReimbursement: 8500,
  pendingFuelReimbursement: 4000,
  pendingReimbursements: 0,
  otherAdditions: 5000,
  additionRemarks: 'Performance bonus',
  totalEarnings: 322462,
  // Deductions
  noticePeriodDays: 0,
  noticePeriodRecovery: 0,
  unsettledExpenseCredit: 3500,
  unsettledFuelCredit: 1500,
  otherDeductions: 0,
  deductionRemarks: '',
  totalDeductions: 5000,
  // Net
  netPayable: 317462,
};

// Sample Final Payslip Data
const finalPayslipData: PayslipData = {
  company: {
    name: COMPANY.name,
    address: {
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411014',
    },
  },
  employee: {
    name: EMPLOYEE.name,
    employeeId: EMPLOYEE.id,
    designation: EMPLOYEE.designation,
    department: EMPLOYEE.department,
    dateOfJoining: '15/07/2020',
    email: EMPLOYEE.email,
    bankAccount: '337201505268',
    bankName: 'State Bank of India',
    bankHolderName: EMPLOYEE.name,
    ifscCode: 'SBIN0001234',
    uanNumber: EMPLOYEE.uanNumber,
  },
  payPeriod: {
    month: 12,
    year: 2025,
    monthName: 'December (Final)',
    payDate: '31/12/2025',
  },
  attendance: {
    totalDays: 31,
    workingDays: 22,
    presentDays: 20,
    paidLeaves: 2,
    lopDays: 0,
    holidays: 3,
    weekoffs: 8,
    holidaysWorked: 1,
    paidDays: 22,
  },
  earnings: {
    items: [
      { label: 'Basic Salary', amount: 40909 },
      { label: 'House Rent Allowance', amount: 16364 },
      { label: 'Special Allowance', amount: 27273 },
      { label: 'Conveyance Allowance', amount: 2455 },
      { label: 'Medical Allowance', amount: 1909 },
      { label: 'Holiday Bonus', amount: 4500 },
    ],
    total: 93410,
  },
  deductions: {
    items: [
      { label: 'Provident Fund', amount: 4909 },
      { label: 'Professional Tax', amount: 200 },
      { label: 'Income Tax (TDS)', amount: 6636 },
    ],
    total: 11745,
  },
  summary: {
    grossSalary: 93410,
    totalDeductions: 11745,
    netPayable: 81665,
    netPayableInWords: 'Eighty One Thousand Six Hundred Sixty Five Rupees Only',
  },
  leaveBalance: {
    earned: 0,
    casual: 0,
    sick: 0,
    total: 0,
  },
};

async function generatePdf(html: string, outputPath: string): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });
  } finally {
    await browser.close();
  }
}

async function generateSampleFnfDocuments() {
  console.log('🚀 Generating sample FNF documents...\n');

  const outputDir = path.join(__dirname, 'fnf-samples');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Generate Relieving Letter
  console.log('📄 Generating Relieving Letter...');
  const relievingHtml = getRelievingLetterTemplate(relievingLetterData);
  const relievingHtmlPath = path.join(outputDir, 'relieving-letter.html');
  const relievingPdfPath = path.join(outputDir, 'relieving-letter.pdf');
  fs.writeFileSync(relievingHtmlPath, relievingHtml);
  await generatePdf(relievingHtml, relievingPdfPath);
  console.log(`   ✅ HTML: ${relievingHtmlPath}`);
  console.log(`   ✅ PDF: ${relievingPdfPath}`);

  // 2. Generate Experience Letter
  console.log('\n📄 Generating Experience Letter...');
  const experienceHtml = getExperienceLetterTemplate(experienceLetterData);
  const experienceHtmlPath = path.join(outputDir, 'experience-letter.html');
  const experiencePdfPath = path.join(outputDir, 'experience-letter.pdf');
  fs.writeFileSync(experienceHtmlPath, experienceHtml);
  await generatePdf(experienceHtml, experiencePdfPath);
  console.log(`   ✅ HTML: ${experienceHtmlPath}`);
  console.log(`   ✅ PDF: ${experiencePdfPath}`);

  // 3. Generate FNF Statement
  console.log('\n📄 Generating FNF Statement...');
  const fnfHtml = getFnfStatementTemplate(fnfStatementData);
  const fnfHtmlPath = path.join(outputDir, 'fnf-statement.html');
  const fnfPdfPath = path.join(outputDir, 'fnf-statement.pdf');
  fs.writeFileSync(fnfHtmlPath, fnfHtml);
  await generatePdf(fnfHtml, fnfPdfPath);
  console.log(`   ✅ HTML: ${fnfHtmlPath}`);
  console.log(`   ✅ PDF: ${fnfPdfPath}`);

  // 4. Generate Final Payslip
  console.log('\n📄 Generating Final Payslip...');
  const payslipHtml = generatePayslipHTML(finalPayslipData);
  const payslipHtmlPath = path.join(outputDir, 'final-payslip.html');
  const payslipPdfPath = path.join(outputDir, 'final-payslip.pdf');
  fs.writeFileSync(payslipHtmlPath, payslipHtml);
  await generatePdf(payslipHtml, payslipPdfPath);
  console.log(`   ✅ HTML: ${payslipHtmlPath}`);
  console.log(`   ✅ PDF: ${payslipPdfPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ All FNF documents generated successfully!');
  console.log('='.repeat(60));
  console.log('\n📊 FNF Settlement Summary:');
  console.log(`   Employee: ${EMPLOYEE.name} (${EMPLOYEE.id})`);
  console.log(`   Designation: ${EMPLOYEE.designation}`);
  console.log(`   Service Period: ${EMPLOYEE.dateOfJoining} - ${EMPLOYEE.lastWorkingDate}`);
  console.log(`   Total Experience: ${experienceLetterData.totalExperience}`);
  console.log('\n💰 Financial Summary:');
  console.log(`   Final Salary: ₹${fnfStatementData.finalSalary.toLocaleString('en-IN')}`);
  console.log(
    `   Leave Encashment: ₹${fnfStatementData.leaveEncashmentAmount.toLocaleString('en-IN')} (${
      fnfStatementData.encashableLeaves
    } days)`,
  );
  console.log(`   Gratuity: ₹${fnfStatementData.gratuityAmount.toLocaleString('en-IN')}`);
  console.log(`   Total Earnings: ₹${fnfStatementData.totalEarnings.toLocaleString('en-IN')}`);
  console.log(`   Total Deductions: ₹${fnfStatementData.totalDeductions.toLocaleString('en-IN')}`);
  console.log(`   Net Payable: ₹${fnfStatementData.netPayable.toLocaleString('en-IN')}`);
  console.log('\n📁 Output Directory:', outputDir);
  console.log('\n📑 Generated Files:');
  console.log('   1. relieving-letter.pdf - Relieving Letter');
  console.log('   2. experience-letter.pdf - Experience Certificate');
  console.log('   3. fnf-statement.pdf - Full & Final Settlement Statement');
  console.log('   4. final-payslip.pdf - Final Month Payslip');
}

generateSampleFnfDocuments().catch(console.error);
