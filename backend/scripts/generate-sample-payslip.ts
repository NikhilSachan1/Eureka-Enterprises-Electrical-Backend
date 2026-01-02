/**
 * Script to generate a sample payslip PDF for preview
 * Run: npx ts-node scripts/generate-sample-payslip.ts
 */

import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Import the template generator
import { generatePayslipHTML } from '../src/modules/payroll/payslip/payslip.template';
import { PayslipData } from '../src/modules/payroll/payslip/payslip.types';

// Sample payslip data
const samplePayslipData: PayslipData = {
  company: {
    name: 'Eureka Enterprises Pvt Ltd',
    address: {
      city: 'Jhansi',
      state: 'Uttar Pradesh',
      pincode: '284001',
    },
  },
  employee: {
    name: 'Akhil Sachan',
    employeeId: '11039',
    designation: 'Software Engineer',
    department: 'Engineering',
    dateOfJoining: '11/07/2022',
    email: 'akhil.sachan@example.com',
    bankAccount: '337201501268',
    bankName: 'State Bank of India',
    bankHolderName: 'Akhil Sachan',
    ifscCode: 'SBIN0001234',
    uanNumber: '101851845539',
  },
  payPeriod: {
    month: 10,
    year: 2025,
    monthName: 'October',
    payDate: '31/10/2025',
  },
  attendance: {
    totalDays: 31,
    workingDays: 23,
    presentDays: 21,
    paidLeaves: 2,
    lopDays: 0,
    holidays: 2,
    weekoffs: 8,
    holidaysWorked: 0,
    paidDays: 23,
  },
  earnings: {
    items: [
      { label: 'Basic Salary', amount: 52500 },
      { label: 'House Rent Allowance', amount: 21000 },
      { label: 'Special Allowance', amount: 35000 },
      { label: 'Conveyance Allowance', amount: 3200 },
      { label: 'Medical Allowance', amount: 2500 },
      { label: 'Other Allowance', amount: 12317 },
    ],
    total: 126517,
  },
  deductions: {
    items: [
      { label: 'Provident Fund', amount: 6300 },
      { label: 'Professional Tax', amount: 200 },
      { label: 'Income Tax (TDS)', amount: 8500 },
      { label: 'ESIC', amount: 0 },
    ],
    total: 15000,
  },
  summary: {
    grossSalary: 126517,
    totalDeductions: 15000,
    netPayable: 111517,
    netPayableInWords: 'One Lakh Eleven Thousand Five Hundred Seventeen Rupees Only',
    holidayLeavesCredited: 0,
  },
  leaveBalance: {
    earned: 12,
    casual: 5,
    sick: 3,
    total: 20,
  },
};

async function generateSamplePayslip() {
  console.log('🚀 Generating sample payslip...\n');

  // Generate HTML
  const html = generatePayslipHTML(samplePayslipData);

  // Save HTML for debugging
  const htmlPath = path.join(__dirname, 'sample-payslip.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML saved to: ${htmlPath}`);

  // Generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(__dirname, 'sample-payslip.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    console.log(`📑 PDF saved to: ${pdfPath}`);
    console.log('\n✅ Sample payslip generated successfully!');
    console.log('\n📊 Payslip Summary:');
    console.log(`   Employee: ${samplePayslipData.employee.name}`);
    console.log(
      `   Period: ${samplePayslipData.payPeriod.monthName} ${samplePayslipData.payPeriod.year}`,
    );
    console.log(`   Gross Earnings: ₹${samplePayslipData.earnings.total.toLocaleString('en-IN')}`);
    console.log(
      `   Total Deductions: ₹${samplePayslipData.deductions.total.toLocaleString('en-IN')}`,
    );
    console.log(`   Net Payable: ₹${samplePayslipData.summary.netPayable.toLocaleString('en-IN')}`);
    if (samplePayslipData.summary.holidayLeavesCredited) {
      console.log(
        `   Holiday Leaves Credited: ${samplePayslipData.summary.holidayLeavesCredited} day(s)`,
      );
    }
  } finally {
    await browser.close();
  }
}

generateSamplePayslip().catch(console.error);
