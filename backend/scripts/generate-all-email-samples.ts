/**
 * Comprehensive script to generate sample HTML files for ALL email templates
 * Run: npx ts-node scripts/generate-all-email-samples.ts
 *
 * This script generates sample outputs for every HBS email template in the system,
 * using realistic sample data based on how templates are integrated in the codebase.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

// Register custom Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

Handlebars.registerHelper('ifEquals', function (a, b, options) {
  if (a === b) {
    return options.fn(this);
  }
  return options.inverse ? options.inverse(this) : '';
});

Handlebars.registerHelper('unless', function (conditional, options) {
  if (!conditional) {
    return options.fn(this);
  }
  return options.inverse ? options.inverse(this) : '';
});

// Paths
const TEMPLATES_DIR = path.join(__dirname, '../src/modules/common/email/templates');
const OUTPUT_DIR = path.join(__dirname, 'email-samples');

// ============================================================================
// COMMON DATA
// ============================================================================
const COMPANY_DETAILS = {
  companyName: 'Eureka Enterprises Pvt Ltd',
  companyLogo: 'https://5.imimg.com/data5/AY/VX/BQ/SELLER-107173792/vvv-120x120.jpeg',
  currentYear: new Date().getFullYear(),
  portalUrl: 'https://hrms.eurekaenterprises.com',
  adminPortalUrl: 'https://hrms.eurekaenterprises.com/admin',
};

// ============================================================================
// TEMPLATE DATA DEFINITIONS
// ============================================================================

// --- APPROVAL TEMPLATES ---
const attendanceApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Rahul Sharma',
  isApproved: true,
  attendanceDate: 'January 10, 2026',
  checkInTime: '09:15 AM',
  checkOutTime: '06:45 PM',
  totalHours: '9h 30m',
  approverName: 'Priya Patel',
  approvalDate: 'January 11, 2026',
  remarks: 'Attendance verified. Keep up the good work!',
};

const attendanceRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Rahul Sharma',
  isApproved: false,
  attendanceDate: 'January 10, 2026',
  checkInTime: '09:15 AM',
  checkOutTime: '06:45 PM',
  totalHours: '9h 30m',
  approverName: 'Priya Patel',
  approvalDate: 'January 11, 2026',
  remarks: 'Check-in time does not match biometric records. Please submit correct details.',
};

const expenseApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Amit Kumar',
  isApproved: true,
  expenseId: 'EXP-2026-00142',
  amount: '₹12,500',
  category: 'Travel',
  expenseDate: 'January 8, 2026',
  description: 'Client visit to Mumbai - Flight tickets and cab fare',
  paymentMode: 'Company Card',
  approverName: 'Neha Gupta',
  approvalDate: 'January 10, 2026',
  remarks: 'Approved as per travel policy. Receipts verified.',
};

const expenseRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Amit Kumar',
  isApproved: false,
  expenseId: 'EXP-2026-00143',
  amount: '₹8,750',
  category: 'Entertainment',
  expenseDate: 'January 5, 2026',
  description: 'Team dinner at upscale restaurant',
  paymentMode: 'Personal Card',
  approverName: 'Neha Gupta',
  approvalDate: 'January 10, 2026',
  remarks:
    'Entertainment expenses require prior approval. Please resubmit with manager pre-approval.',
};

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
  fuelDate: 'January 9, 2026',
  odometerReading: '45,230',
  pricePerLiter: '₹100.00',
  approverName: 'Rajesh Verma',
  approvalDate: 'January 10, 2026',
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
  fuelDate: 'January 8, 2026',
  odometerReading: '44,890',
  pricePerLiter: '₹100.00',
  approverName: 'Rajesh Verma',
  approvalDate: 'January 10, 2026',
  remarks: 'Odometer reading mismatch detected. Please verify and resubmit.',
};

const leaveApprovedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Sneha Reddy',
  isApproved: true,
  applicationId: 'LV-2026-00034',
  leaveType: 'Earned Leave',
  leaveTypeClass: 'earned',
  leaveCategory: 'Planned',
  fromDate: 'January 20, 2026',
  toDate: 'January 23, 2026',
  totalDays: 4,
  reason: 'Family vacation to Goa',
  approverName: 'Ankit Mehta',
  approvalDate: 'January 10, 2026',
  remarks: 'Approved. Please ensure pending tasks are handed over to your backup.',
};

const leaveRejectedData = {
  ...COMPANY_DETAILS,
  employeeName: 'Sneha Reddy',
  isApproved: false,
  applicationId: 'LV-2026-00035',
  leaveType: 'Casual Leave',
  leaveTypeClass: 'casual',
  leaveCategory: 'Unplanned',
  fromDate: 'January 15, 2026',
  toDate: 'January 17, 2026',
  totalDays: 3,
  reason: 'Personal work',
  approverName: 'Ankit Mehta',
  approvalDate: 'January 10, 2026',
  remarks: 'Critical project deadline on Jan 16. Please discuss alternative dates.',
};

// --- ATTENDANCE REGULARIZATION ---
const attendanceRegularizationData = {
  ...COMPANY_DETAILS,
  employeeName: 'Deepak Verma',
  attendanceDate: 'January 8, 2026',
  originalStatus: 'ABSENT',
  newStatus: 'PRESENT',
  checkInTime: '09:30 AM',
  checkOutTime: '06:30 PM',
  totalHours: '9h 00m',
  regularizedByName: 'HR Admin',
  regularizedOn: 'January 10, 2026',
  notes: 'Employee was on field duty. Regularized based on manager confirmation.',
};

// --- CELEBRATION TEMPLATES ---
const birthdayWishData = {
  ...COMPANY_DETAILS,
  firstName: 'Priya',
};

const workAnniversaryData = {
  ...COMPANY_DETAILS,
  firstName: 'Rajesh',
  yearsText: '5 Years',
  yearsOfService: 5,
  dateOfJoining: 'January 10, 2021',
  isMilestone: false,
};

const workAnniversaryMilestoneData = {
  ...COMPANY_DETAILS,
  firstName: 'Sunita',
  yearsText: '10 Years',
  yearsOfService: 10,
  dateOfJoining: 'January 10, 2016',
  isMilestone: true,
  milestoneMessage:
    'A decade of dedication, excellence, and unwavering commitment. Your journey with us has been truly inspiring, and we are honored to have you as part of our family.',
};

// --- WELCOME EMPLOYEE ---
const welcomeEmployeeData = {
  ...COMPANY_DETAILS,
  firstName: 'Arun',
  lastName: 'Patel',
  email: 'arun.patel@eurekaenterprises.com',
  tempPassword: 'Temp@2026#Secure',
  employeeId: 'EMP-2026-0142',
  designation: 'Senior Software Engineer',
  department: 'Technology',
  dateOfJoining: '15 Jan 2026',
  reportingManager: 'Vikram Sharma',
  loginUrl: 'https://hrms.eurekaenterprises.com/login',
};

// --- FORGET PASSWORD ---
const forgetPasswordData = {
  ...COMPANY_DETAILS,
  firstName: 'Meera',
  lastName: 'Sharma',
  resetPasswordLink: 'https://hrms.eurekaenterprises.com/reset-password?token=abc123xyz',
};

// --- CRON FAILURE ---
const cronFailureData = {
  ...COMPANY_DETAILS,
  jobName: 'MONTHLY_PAYROLL_GENERATION',
  jobType: 'PAYROLL',
  errorMessage: 'Database connection timeout after 30000ms',
  errorStack: `Error: Database connection timeout
    at PostgresQueryRunner.query (PostgresQueryRunner.ts:331:19)
    at async PayrollCronService.generateMonthlyPayroll (payroll.cron.service.ts:145:5)
    at async CronLogService.execute (cron-log.service.ts:56:12)`,
  startedAt: '2026-01-10T00:00:00.000Z',
  failedAt: '2026-01-10T00:00:35.123Z',
  durationMs: 35123,
  serverName: 'HRMS-PROD-01',
};

// --- FY LEAVE CONFIG REMINDER ---
const fyLeaveConfigReminderData = {
  ...COMPANY_DETAILS,
  daysRemaining: 45,
  nextFinancialYear: '2026-27',
};

// --- VEHICLE SERVICE DUE ---
const vehicleServiceDueData = {
  ...COMPANY_DETAILS,
  serviceIntervalKm: '10,000',
  warningKm: '1,000',
  hasOverdue: true,
  hasDueSoon: true,
  totalOverdue: 2,
  totalDueSoon: 3,
  overdueVehicles: [
    {
      registrationNo: 'UP-32 AB 1234',
      brand: 'Mahindra',
      model: 'Bolero',
      vehicleNumber: 'VH-001',
      assignedTo: 'Vikram Singh',
      lastServiceKm: '32,500 km',
      lastServiceDate: 'November 15, 2025',
      currentOdometerKm: '44,200 km',
      nextServiceDueKm: '42,500 km',
      statusClass: 'overdue',
      kmStatus: '1,700 km overdue',
    },
    {
      registrationNo: 'UP-32 CD 5678',
      brand: 'Tata',
      model: 'Ace',
      vehicleNumber: 'VH-002',
      assignedTo: 'Ramesh Kumar',
      lastServiceKm: '28,000 km',
      lastServiceDate: 'October 20, 2025',
      currentOdometerKm: '39,500 km',
      nextServiceDueKm: '38,000 km',
      statusClass: 'overdue',
      kmStatus: '1,500 km overdue',
    },
  ],
  dueSoonVehicles: [
    {
      registrationNo: 'UP-32 EF 9012',
      brand: 'Mahindra',
      model: 'Scorpio',
      vehicleNumber: 'VH-003',
      assignedTo: 'Sunil Yadav',
      lastServiceKm: '45,000 km',
      lastServiceDate: 'December 10, 2025',
      currentOdometerKm: '54,200 km',
      nextServiceDueKm: '55,000 km',
      statusClass: 'due-soon',
      kmStatus: '800 km remaining',
    },
  ],
};

// --- VEHICLE DOCUMENT EXPIRY ---
const vehicleDocumentExpiryData = {
  ...COMPANY_DETAILS,
  hasExpired: true,
  hasExpiringSoon: true,
  totalExpired: 2,
  totalExpiringSoon: 1,
  expiredVehicles: [
    {
      registrationNo: 'UP-32 AB 1234',
      brand: 'Mahindra',
      model: 'Bolero',
      vehicleNumber: 'VH-001',
      assignedTo: 'Vikram Singh',
      documentType: 'Insurance',
      documentTypeLabel: 'Insurance',
      expiryDate: 'December 31, 2025',
      statusClass: 'expired',
      daysText: 'Expired 10 days ago',
    },
    {
      registrationNo: 'UP-32 CD 5678',
      brand: 'Tata',
      model: 'Ace',
      vehicleNumber: 'VH-002',
      assignedTo: 'Ramesh Kumar',
      documentType: 'PUC',
      documentTypeLabel: 'PUC Certificate',
      expiryDate: 'January 5, 2026',
      statusClass: 'expired',
      daysText: 'Expired 5 days ago',
    },
  ],
  expiringSoonVehicles: [
    {
      registrationNo: 'UP-32 EF 9012',
      brand: 'Mahindra',
      model: 'Scorpio',
      vehicleNumber: 'VH-003',
      assignedTo: 'Sunil Yadav',
      documentType: 'Road Tax',
      documentTypeLabel: 'Road Tax',
      expiryDate: 'January 25, 2026',
      statusClass: 'expiring-soon',
      daysText: 'Expires in 15 days',
    },
  ],
};

// --- ASSET CALIBRATION EXPIRY ---
const assetCalibrationExpiryData = {
  ...COMPANY_DETAILS,
  hasExpired: true,
  hasExpiringSoon: true,
  totalExpired: 1,
  totalExpiringSoon: 2,
  expiredAssets: [
    {
      assetId: 'AST-2024-0042',
      assetName: 'Digital Multimeter',
      category: 'Test Equipment',
      assignedTo: 'Lab Team',
      assignedUserEmail: 'lab@eurekaenterprises.com',
      lastCalibrationDate: 'January 10, 2025',
      calibrationDueDate: 'January 5, 2026',
      statusClass: 'expired',
      daysText: 'Expired 5 days ago',
    },
  ],
  expiringSoonAssets: [
    {
      assetId: 'AST-2024-0043',
      assetName: 'Pressure Gauge',
      category: 'Measuring Instruments',
      assignedTo: 'Production Team',
      assignedUserEmail: 'production@eurekaenterprises.com',
      lastCalibrationDate: 'January 20, 2025',
      calibrationDueDate: 'January 20, 2026',
      statusClass: 'expiring-soon',
      daysText: 'Expires in 10 days',
    },
  ],
};

// --- ASSET WARRANTY EXPIRY ---
const assetWarrantyExpiryData = {
  ...COMPANY_DETAILS,
  hasExpired: true,
  hasExpiringSoon: true,
  totalExpired: 1,
  totalExpiringSoon: 2,
  expiredAssets: [
    {
      assetId: 'AST-2023-0125',
      assetName: 'Dell Laptop XPS 15',
      category: 'IT Equipment',
      assignedTo: 'Rahul Sharma',
      assignedUserEmail: 'rahul.sharma@eurekaenterprises.com',
      purchaseDate: 'January 5, 2024',
      warrantyExpiryDate: 'January 5, 2026',
      statusClass: 'expired',
      daysText: 'Warranty expired 5 days ago',
    },
  ],
  expiringSoonAssets: [
    {
      assetId: 'AST-2023-0126',
      assetName: 'HP Printer LaserJet Pro',
      category: 'Office Equipment',
      assignedTo: 'Admin Office',
      assignedUserEmail: 'admin@eurekaenterprises.com',
      purchaseDate: 'January 25, 2024',
      warrantyExpiryDate: 'January 25, 2026',
      statusClass: 'expiring-soon',
      daysText: 'Warranty expires in 15 days',
    },
  ],
};

// --- CARD EXPIRY ---
const cardExpiryData = {
  ...COMPANY_DETAILS,
  hasExpired: true,
  hasExpiringSoon: true,
  totalExpired: 2,
  totalExpiringSoon: 3,
  expiredCards: [
    {
      maskedCardNumber: '**** **** **** 4523',
      cardTypeLabel: 'Petrol Card',
      holderName: 'Vikram Singh',
      expiryDate: '12/2025',
      statusClass: 'expired',
      daysText: 'Expired 10 days ago',
    },
    {
      maskedCardNumber: '**** **** **** 7890',
      cardTypeLabel: 'Toll Card',
      holderName: 'Fleet Account',
      expiryDate: '01/2026',
      statusClass: 'expired',
      daysText: 'Expired 5 days ago',
    },
  ],
  expiringSoonCards: [
    {
      maskedCardNumber: '**** **** **** 1234',
      cardTypeLabel: 'Fleet Card',
      holderName: 'Ramesh Kumar',
      expiryDate: '02/2026',
      statusClass: 'expiring-soon',
      daysText: 'Expires in 25 days',
    },
  ],
};

// --- PENDING EXPENSE REMINDER ---
const pendingExpenseReminderData = {
  ...COMPANY_DETAILS,
  totalPending: 12,
  totalAmount: '₹87,500',
  totalRegular: 8,
  totalFuel: 4,
  hasUrgent: true,
  totalUrgent: 3,
  urgentThresholdDays: 7,
  hasPending: true,
  urgentExpenses: [
    {
      employeeName: 'Amit Kumar',
      expenseTypeLabel: 'Regular',
      isFuelExpense: false,
      category: 'Travel',
      amount: '₹15,000',
      expenseDate: 'January 2, 2026',
      description: 'Client meeting travel',
      daysText: 'Pending 8 days',
    },
    {
      employeeName: 'Vikram Singh',
      expenseTypeLabel: 'Fuel',
      isFuelExpense: true,
      category: 'Diesel',
      amount: '₹4,500',
      expenseDate: 'December 30, 2025',
      description: 'Vehicle fuel',
      vehicleRegistrationNo: 'UP-32 AB 1234',
      fuelLiters: '45 L',
      daysText: 'Pending 11 days',
    },
  ],
  pendingExpenses: [
    {
      employeeName: 'Sneha Reddy',
      expenseTypeLabel: 'Regular',
      isFuelExpense: false,
      category: 'Office Supplies',
      amount: '₹2,500',
      expenseDate: 'January 8, 2026',
      description: 'Stationery purchase',
      daysText: 'Pending 2 days',
    },
  ],
};

// --- LEAVE APPROVAL REMINDER ---
const leaveApprovalReminderData = {
  ...COMPANY_DETAILS,
  totalPending: 5,
  daysUntilAutoApproval: 3,
  autoApprovalDate: 'February 1, 2026',
  urgencyLevel: 'urgent',
  hasUrgent: true,
  hasPending: true,
  totalUrgent: 2,
  categorySummaries: [
    { displayName: 'Casual Leave', count: 2 },
    { displayName: 'Earned Leave', count: 2 },
    { displayName: 'Sick Leave', count: 1 },
  ],
  urgentLeaves: [
    {
      employeeName: 'Deepak Verma',
      leaveCategory: 'Casual Leave',
      leaveType: 'Full Day',
      fromDate: 'January 15, 2026',
      toDate: 'January 16, 2026',
      totalDays: 2,
      reason: 'Personal work',
      appliedOn: 'January 3, 2026',
      daysText: 'Pending 7 days',
    },
  ],
  pendingLeaves: [
    {
      employeeName: 'Priya Patel',
      leaveCategory: 'Sick Leave',
      leaveType: 'Full Day',
      fromDate: 'January 12, 2026',
      toDate: 'January 12, 2026',
      totalDays: 1,
      reason: 'Not feeling well',
      appliedOn: 'January 10, 2026',
      daysText: 'Applied today',
    },
    {
      employeeName: 'Ankit Mehta',
      leaveCategory: 'Earned Leave',
      leaveType: 'Full Day',
      fromDate: 'January 20, 2026',
      toDate: 'January 22, 2026',
      totalDays: 3,
      reason: 'Family function',
      appliedOn: 'January 9, 2026',
      daysText: 'Pending 1 day',
    },
  ],
};

// --- ATTENDANCE APPROVAL REMINDER ---
const attendanceApprovalReminderData = {
  ...COMPANY_DETAILS,
  totalPending: 8,
  daysUntilAutoApproval: 1,
  autoApprovalDate: 'February 1, 2026',
  urgencyLevel: 'critical',
  hasUrgent: true,
  hasPending: true,
  totalUrgent: 3,
  statusSummaries: [
    { displayName: 'Checked Out', count: 4 },
    { displayName: 'Absent', count: 3 },
    { displayName: 'Half Day', count: 1 },
  ],
  urgentAttendance: [
    {
      employeeName: 'Ramesh Kumar',
      statusDisplayName: 'Absent',
      status: 'absent',
      attendanceDate: 'January 8, 2026',
      notes: 'No check-in recorded',
    },
    {
      employeeName: 'Sunil Yadav',
      statusDisplayName: 'Absent',
      status: 'absent',
      attendanceDate: 'January 9, 2026',
      notes: 'Employee reported sick',
    },
  ],
  pendingAttendance: [
    {
      employeeName: 'Amit Kumar',
      statusDisplayName: 'Checked Out',
      status: 'checkedOut',
      attendanceDate: 'January 9, 2026',
      checkInTime: '09:30 AM',
      checkOutTime: '06:45 PM',
    },
    {
      employeeName: 'Vikram Singh',
      statusDisplayName: 'Half Day',
      status: 'halfDay',
      attendanceDate: 'January 9, 2026',
      checkInTime: '02:00 PM',
      checkOutTime: '06:30 PM',
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function renderTemplate(templateName: string, data: object): string {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
  if (!fs.existsSync(templatePath)) {
    console.error(`   ✗ Template not found: ${templateName}.hbs`);
    return '';
  }
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  return template(data);
}

function saveHtml(subdir: string, filename: string, html: string): void {
  const outputPath = path.join(OUTPUT_DIR, subdir);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  fs.writeFileSync(path.join(outputPath, filename), html);
  console.log(`   ✓ ${subdir}/${filename}`);
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

async function generateAllEmailSamples() {
  console.log('🚀 Generating sample email templates for ALL HBS files...\n');

  // Create main output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let totalGenerated = 0;

  // --- 1. APPROVAL EMAILS ---
  console.log('📧 Approval Emails:');
  saveHtml(
    'approvals',
    'attendance-approved.html',
    renderTemplate('attendanceApproval', attendanceApprovedData),
  );
  saveHtml(
    'approvals',
    'attendance-rejected.html',
    renderTemplate('attendanceApproval', attendanceRejectedData),
  );
  saveHtml(
    'approvals',
    'expense-approved.html',
    renderTemplate('expenseApproval', expenseApprovedData),
  );
  saveHtml(
    'approvals',
    'expense-rejected.html',
    renderTemplate('expenseApproval', expenseRejectedData),
  );
  saveHtml(
    'approvals',
    'fuel-expense-approved.html',
    renderTemplate('fuelExpenseApproval', fuelExpenseApprovedData),
  );
  saveHtml(
    'approvals',
    'fuel-expense-rejected.html',
    renderTemplate('fuelExpenseApproval', fuelExpenseRejectedData),
  );
  saveHtml('approvals', 'leave-approved.html', renderTemplate('leaveApproval', leaveApprovedData));
  saveHtml('approvals', 'leave-rejected.html', renderTemplate('leaveApproval', leaveRejectedData));
  totalGenerated += 8;

  // --- 2. ATTENDANCE REGULARIZATION ---
  console.log('\n🔄 Attendance Regularization:');
  saveHtml(
    'attendance',
    'regularization.html',
    renderTemplate('attendanceRegularization', attendanceRegularizationData),
  );
  totalGenerated += 1;

  // --- 3. CELEBRATIONS ---
  console.log('\n🎉 Celebration Emails:');
  saveHtml('celebrations', 'birthday-wish.html', renderTemplate('birthdayWish', birthdayWishData));
  saveHtml(
    'celebrations',
    'work-anniversary.html',
    renderTemplate('workAnniversary', workAnniversaryData),
  );
  saveHtml(
    'celebrations',
    'work-anniversary-milestone.html',
    renderTemplate('workAnniversary', workAnniversaryMilestoneData),
  );
  totalGenerated += 3;

  // --- 4. ONBOARDING ---
  console.log('\n👋 Onboarding Emails:');
  saveHtml(
    'onboarding',
    'welcome-employee.html',
    renderTemplate('welcomeEmployee', welcomeEmployeeData),
  );
  totalGenerated += 1;

  // --- 5. AUTH ---
  console.log('\n🔐 Authentication Emails:');
  saveHtml('auth', 'forget-password.html', renderTemplate('forgetPassword', forgetPasswordData));
  totalGenerated += 1;

  // --- 6. SYSTEM ALERTS ---
  console.log('\n🚨 System Alert Emails:');
  saveHtml('alerts', 'cron-failure.html', renderTemplate('cronFailure', cronFailureData));
  totalGenerated += 1;

  // --- 7. CONFIGURATION REMINDERS ---
  console.log('\n⚙️ Configuration Reminder Emails:');
  saveHtml(
    'reminders',
    'fy-leave-config-reminder.html',
    renderTemplate('fyLeaveConfigReminder', fyLeaveConfigReminderData),
  );
  totalGenerated += 1;

  // --- 8. VEHICLE EMAILS ---
  console.log('\n🚗 Vehicle Emails:');
  saveHtml(
    'vehicles',
    'service-due.html',
    renderTemplate('vehicleServiceDue', vehicleServiceDueData),
  );
  saveHtml(
    'vehicles',
    'document-expiry.html',
    renderTemplate('vehicleDocumentExpiry', vehicleDocumentExpiryData),
  );
  totalGenerated += 2;

  // --- 9. ASSET EMAILS ---
  console.log('\n📦 Asset Emails:');
  saveHtml(
    'assets',
    'calibration-expiry.html',
    renderTemplate('assetCalibrationExpiry', assetCalibrationExpiryData),
  );
  saveHtml(
    'assets',
    'warranty-expiry.html',
    renderTemplate('assetWarrantyExpiry', assetWarrantyExpiryData),
  );
  totalGenerated += 2;

  // --- 10. CARD EMAILS ---
  console.log('\n💳 Card Emails:');
  saveHtml('cards', 'card-expiry.html', renderTemplate('cardExpiry', cardExpiryData));
  totalGenerated += 1;

  // --- 11. APPROVAL REMINDERS ---
  console.log('\n⏰ Approval Reminder Emails:');
  saveHtml(
    'reminders',
    'pending-expense-reminder.html',
    renderTemplate('pendingExpenseReminder', pendingExpenseReminderData),
  );
  saveHtml(
    'reminders',
    'leave-approval-reminder.html',
    renderTemplate('leaveApprovalReminder', leaveApprovalReminderData),
  );
  saveHtml(
    'reminders',
    'attendance-approval-reminder.html',
    renderTemplate('attendanceApprovalReminder', attendanceApprovalReminderData),
  );
  totalGenerated += 3;

  // --- SUMMARY ---
  console.log('\n' + '═'.repeat(60));
  console.log('✅ All sample emails generated successfully!');
  console.log('═'.repeat(60));
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📊 Summary by Category:');
  console.log('   • Approval emails:           8 files');
  console.log('   • Attendance regularization: 1 file');
  console.log('   • Celebration emails:        3 files');
  console.log('   • Onboarding emails:         1 file');
  console.log('   • Authentication emails:     1 file');
  console.log('   • System alerts:             1 file');
  console.log('   • Configuration reminders:   1 file');
  console.log('   • Vehicle emails:            2 files');
  console.log('   • Asset emails:              2 files');
  console.log('   • Card emails:               1 file');
  console.log('   • Approval reminders:        3 files');
  console.log('   ─────────────────────────────────────');
  console.log(`   Total: ${totalGenerated} sample email templates generated`);
  console.log('\n📂 Directory Structure:');
  console.log('   email-samples/');
  console.log('   ├── alerts/');
  console.log('   ├── approvals/');
  console.log('   ├── assets/');
  console.log('   ├── attendance/');
  console.log('   ├── auth/');
  console.log('   ├── cards/');
  console.log('   ├── celebrations/');
  console.log('   ├── onboarding/');
  console.log('   ├── reminders/');
  console.log('   └── vehicles/');
}

generateAllEmailSamples().catch(console.error);
