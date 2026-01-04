/**
 * Script to generate sample approval email HTML files for preview
 * Run: npx ts-node scripts/generate-sample-approval-emails.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

// Register custom Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

// Template directory path
const TEMPLATES_DIR = path.join(__dirname, '../src/modules/common/email/templates');
const OUTPUT_DIR = path.join(__dirname, 'approval-email-samples');

// Company details for templates
const COMPANY_DETAILS = {
  companyName: 'Eureka Enterprises Pvt Ltd',
  companyLogo: 'https://5.imimg.com/data5/AY/VX/BQ/SELLER-107173792/vvv-120x120.jpeg',
  currentYear: new Date().getFullYear(),
  portalUrl: 'https://hrms.eurekaenterprises.com',
};

// Sample data for Attendance Approval
const attendanceApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Rahul Sharma',
  isApproved: true,
  attendanceDate: 'January 3, 2026',
  checkInTime: '09:15 AM',
  checkOutTime: '06:45 PM',
  totalHours: '9h 30m',
  approverName: 'Priya Patel',
  approvalDate: 'January 4, 2026',
  remarks: 'Attendance verified. Keep up the good work!',
};

const attendanceRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Rahul Sharma',
  isApproved: false,
  attendanceDate: 'January 3, 2026',
  checkInTime: '09:15 AM',
  checkOutTime: '06:45 PM',
  totalHours: '9h 30m',
  approverName: 'Priya Patel',
  approvalDate: 'January 4, 2026',
  remarks:
    'Check-in time does not match biometric records. Please submit correct details or contact HR for assistance.',
};

// Sample data for Expense Approval
const expenseApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Amit Kumar',
  isApproved: true,
  expenseId: 'EXP-2026-00142',
  amount: '₹12,500',
  category: 'Travel',
  expenseDate: 'January 2, 2026',
  description: 'Client visit to Mumbai - Flight tickets and cab fare',
  paymentMode: 'Company Card',
  approverName: 'Neha Gupta',
  approvalDate: 'January 4, 2026',
  remarks: 'Approved as per travel policy. Receipts verified.',
};

const expenseRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Amit Kumar',
  isApproved: false,
  expenseId: 'EXP-2026-00143',
  amount: '₹8,750',
  category: 'Entertainment',
  expenseDate: 'January 1, 2026',
  description: 'Team dinner at upscale restaurant',
  paymentMode: 'Personal Card',
  approverName: 'Neha Gupta',
  approvalDate: 'January 4, 2026',
  remarks:
    'Entertainment expenses require prior approval. Please submit a new request with manager pre-approval attached.',
};

// Sample data for Fuel Expense Approval
const fuelExpenseApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Vikram Singh',
  isApproved: true,
  expenseId: 'FUEL-2026-00089',
  amount: '₹4,250',
  fuelLiters: '42.5',
  vehicleNumber: 'UP-32 AB 1234',
  fuelType: 'Diesel',
  fuelTypeClass: 'diesel',
  fuelDate: 'January 3, 2026',
  odometerReading: '45,230',
  pricePerLiter: '₹100.00',
  approverName: 'Rajesh Verma',
  approvalDate: 'January 4, 2026',
  remarks: 'Fuel expense approved. Kilometer reading verified against trip log.',
};

const fuelExpenseRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Vikram Singh',
  isApproved: false,
  expenseId: 'FUEL-2026-00090',
  amount: '₹3,800',
  fuelLiters: '38',
  vehicleNumber: 'UP-32 AB 1234',
  fuelType: 'Petrol',
  fuelTypeClass: 'petrol',
  fuelDate: 'January 2, 2026',
  odometerReading: '44,890',
  pricePerLiter: '₹100.00',
  approverName: 'Rajesh Verma',
  approvalDate: 'January 4, 2026',
  remarks:
    'Odometer reading mismatch detected. The submitted reading is lower than the previous entry. Please verify and resubmit.',
};

// Sample data for Leave Approval
const leaveApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Sneha Reddy',
  isApproved: true,
  applicationId: 'LV-2026-00034',
  leaveType: 'Earned Leave',
  leaveTypeClass: 'earned',
  leaveCategory: 'Planned',
  fromDate: 'January 15, 2026',
  toDate: 'January 18, 2026',
  totalDays: 4,
  reason: 'Family vacation to Goa',
  approverName: 'Ankit Mehta',
  approvalDate: 'January 4, 2026',
  remarks: 'Approved. Please ensure all pending tasks are handed over to your backup.',
};

const leaveRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Sneha Reddy',
  isApproved: false,
  applicationId: 'LV-2026-00035',
  leaveType: 'Casual Leave',
  leaveTypeClass: 'casual',
  leaveCategory: 'Unplanned',
  fromDate: 'January 10, 2026',
  toDate: 'January 12, 2026',
  totalDays: 3,
  reason: 'Personal work',
  approverName: 'Ankit Mehta',
  approvalDate: 'January 4, 2026',
  remarks:
    'Unfortunately, we cannot approve this leave due to critical project deadline on January 11. Please discuss alternative dates with your manager.',
};

// Helper to compile and render template
function renderTemplate(templateName: string, data: object): string {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  return template(data);
}

// Helper to save HTML file
function saveHtml(filename: string, html: string): void {
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, html);
  console.log(`   ✓ ${filename}`);
}

async function generateSampleEmails() {
  console.log('🚀 Generating sample approval email templates...\n');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('📧 Attendance Approval Emails:');
  saveHtml(
    'attendance-approved.html',
    renderTemplate('attendanceApproval', attendanceApprovedData),
  );
  saveHtml(
    'attendance-rejected.html',
    renderTemplate('attendanceApproval', attendanceRejectedData),
  );

  console.log('\n💰 Expense Approval Emails:');
  saveHtml('expense-approved.html', renderTemplate('expenseApproval', expenseApprovedData));
  saveHtml('expense-rejected.html', renderTemplate('expenseApproval', expenseRejectedData));

  console.log('\n⛽ Fuel Expense Approval Emails:');
  saveHtml(
    'fuel-expense-approved.html',
    renderTemplate('fuelExpenseApproval', fuelExpenseApprovedData),
  );
  saveHtml(
    'fuel-expense-rejected.html',
    renderTemplate('fuelExpenseApproval', fuelExpenseRejectedData),
  );

  console.log('\n📋 Leave Approval Emails:');
  saveHtml('leave-approved.html', renderTemplate('leaveApproval', leaveApprovedData));
  saveHtml('leave-rejected.html', renderTemplate('leaveApproval', leaveRejectedData));

  console.log('\n✅ All sample emails generated successfully!');
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📊 Summary:');
  console.log('   • 2 Attendance approval emails (approved + rejected)');
  console.log('   • 2 Expense approval emails (approved + rejected)');
  console.log('   • 2 Fuel expense approval emails (approved + rejected)');
  console.log('   • 2 Leave approval emails (approved + rejected)');
  console.log('   ─────────────────────────────────────────');
  console.log('   Total: 8 sample email templates generated');
}

generateSampleEmails().catch(console.error);
