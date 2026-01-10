/**
 * Script to generate and SEND sample email templates to a specified email address
 * Run: npx ts-node scripts/send-sample-emails.ts [email@example.com]
 *
 * This script generates sample outputs for email templates and sends them
 * to the specified email address for verification in Gmail or other email clients.
 *
 * Environment variables required:
 * - EMAIL_HOST: SMTP host (e.g., smtp.gmail.com)
 * - EMAIL_PORT: SMTP port (e.g., 587)
 * - EMAIL_FROM: Sender email address
 * - EMAIL_PASSWORD: Email password or app password
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { config } from 'dotenv';

// Load environment variables
config();

// Default recipient email
const DEFAULT_RECIPIENT = 'akhil.sachan@coditas.com';

// Get recipient from command line args or use default
const recipientEmail = process.argv[2] || DEFAULT_RECIPIENT;

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

// Email configuration from environment
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
};

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

// --- VEHICLE SERVICE DUE ---
const vehicleServiceDueData = {
  ...COMPANY_DETAILS,
  serviceIntervalKm: '10,000',
  warningKm: '1,000',
  hasOverdue: true,
  hasDueSoon: true,
  totalOverdue: 2,
  totalDueSoon: 1,
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

// --- CARD EXPIRY ---
const cardExpiryData = {
  ...COMPANY_DETAILS,
  hasExpired: true,
  hasExpiringSoon: true,
  totalExpired: 2,
  totalExpiringSoon: 1,
  expiredCards: [
    {
      maskedCardNumber: '**** **** **** 4523',
      cardTypeLabel: 'Petrol Card',
      holderName: 'Vikram Singh',
      expiryDate: '12/2025',
      statusClass: 'expired',
      daysText: 'Expired 10 days ago',
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

// --- WORK ANNIVERSARY MILESTONE ---
const workAnniversaryMilestoneData = {
  ...COMPANY_DETAILS,
  firstName: 'Sunita',
  yearsText: '10 Years',
  yearsOfService: 10,
  dateOfJoining: 'January 10, 2016',
  isMilestone: true,
  milestoneMessage:
    'A decade of dedication, excellence, and unwavering commitment. Your journey with us has been truly inspiring.',
};

// --- FY LEAVE CONFIG REMINDER ---
const fyLeaveConfigReminderData = {
  ...COMPANY_DETAILS,
  daysRemaining: 45,
  nextFinancialYear: '2026-27',
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
  totalExpiringSoon: 1,
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
  totalExpiringSoon: 1,
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

// --- PENDING EXPENSE REMINDER ---
const pendingExpenseReminderData = {
  ...COMPANY_DETAILS,
  totalPending: 5,
  totalAmount: '₹45,000',
  totalRegular: 3,
  totalFuel: 2,
  hasUrgent: true,
  totalUrgent: 2,
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
  ],
};

// ============================================================================
// EMAIL DEFINITIONS - Templates to send
// ============================================================================

interface EmailTemplate {
  templateName: string;
  subject: string;
  data: object;
  category: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  // Approvals
  {
    templateName: 'attendanceApproval',
    subject: '✅ [SAMPLE] Attendance Approved - January 10, 2026',
    data: attendanceApprovedData,
    category: 'Approval',
  },
  {
    templateName: 'attendanceApproval',
    subject: '❌ [SAMPLE] Attendance Rejected - January 10, 2026',
    data: attendanceRejectedData,
    category: 'Approval',
  },
  {
    templateName: 'expenseApproval',
    subject: '✅ [SAMPLE] Expense Approved - EXP-2026-00142',
    data: expenseApprovedData,
    category: 'Approval',
  },
  {
    templateName: 'expenseApproval',
    subject: '❌ [SAMPLE] Expense Rejected - EXP-2026-00143',
    data: expenseRejectedData,
    category: 'Approval',
  },
  {
    templateName: 'fuelExpenseApproval',
    subject: '✅ [SAMPLE] Fuel Expense Approved - FUEL-2026-00089',
    data: fuelExpenseApprovedData,
    category: 'Approval',
  },
  {
    templateName: 'fuelExpenseApproval',
    subject: '❌ [SAMPLE] Fuel Expense Rejected - FUEL-2026-00090',
    data: fuelExpenseRejectedData,
    category: 'Approval',
  },
  {
    templateName: 'leaveApproval',
    subject: '✅ [SAMPLE] Leave Approved - 4 Days',
    data: leaveApprovedData,
    category: 'Approval',
  },
  {
    templateName: 'leaveApproval',
    subject: '❌ [SAMPLE] Leave Rejected - 3 Days',
    data: leaveRejectedData,
    category: 'Approval',
  },

  // Celebrations
  {
    templateName: 'birthdayWish',
    subject: '🎂 [SAMPLE] Happy Birthday Priya!',
    data: birthdayWishData,
    category: 'Celebration',
  },
  {
    templateName: 'workAnniversary',
    subject: '🎉 [SAMPLE] Happy 5th Work Anniversary Rajesh!',
    data: workAnniversaryData,
    category: 'Celebration',
  },

  // Onboarding
  {
    templateName: 'welcomeEmployee',
    subject: '👋 [SAMPLE] Welcome to Eureka Enterprises, Arun!',
    data: welcomeEmployeeData,
    category: 'Onboarding',
  },

  // Auth
  {
    templateName: 'forgetPassword',
    subject: '🔐 [SAMPLE] Reset Your Password',
    data: forgetPasswordData,
    category: 'Authentication',
  },

  // Alerts
  {
    templateName: 'cronFailure',
    subject: '🚨 [SAMPLE] CRON Job Failed: MONTHLY_PAYROLL_GENERATION',
    data: cronFailureData,
    category: 'System Alert',
  },

  // Vehicle
  {
    templateName: 'vehicleServiceDue',
    subject: '🚗 [SAMPLE] Vehicle Service Alert - 2 Overdue, 1 Due Soon',
    data: vehicleServiceDueData,
    category: 'Vehicle',
  },

  // Cards
  {
    templateName: 'cardExpiry',
    subject: '💳 [SAMPLE] Card Expiry Alert - 2 Expired, 1 Expiring Soon',
    data: cardExpiryData,
    category: 'Cards',
  },

  // Attendance Regularization
  {
    templateName: 'attendanceRegularization',
    subject: '🔄 [SAMPLE] Attendance Regularized - January 8, 2026',
    data: attendanceRegularizationData,
    category: 'Attendance',
  },

  // Work Anniversary Milestone
  {
    templateName: 'workAnniversary',
    subject: '🏆 [SAMPLE] Happy 10th Work Anniversary Sunita! (Milestone)',
    data: workAnniversaryMilestoneData,
    category: 'Celebration',
  },

  // FY Leave Config Reminder
  {
    templateName: 'fyLeaveConfigReminder',
    subject: '⚙️ [SAMPLE] Configure Leave Settings for FY 2026-27',
    data: fyLeaveConfigReminderData,
    category: 'Reminders',
  },

  // Vehicle Document Expiry
  {
    templateName: 'vehicleDocumentExpiry',
    subject: '📄 [SAMPLE] Vehicle Document Expiry Alert',
    data: vehicleDocumentExpiryData,
    category: 'Vehicle',
  },

  // Asset Calibration Expiry
  {
    templateName: 'assetCalibrationExpiry',
    subject: '🔧 [SAMPLE] Asset Calibration Due Alert',
    data: assetCalibrationExpiryData,
    category: 'Assets',
  },

  // Asset Warranty Expiry
  {
    templateName: 'assetWarrantyExpiry',
    subject: '🛡️ [SAMPLE] Asset Warranty Expiry Alert',
    data: assetWarrantyExpiryData,
    category: 'Assets',
  },

  // Pending Expense Reminder
  {
    templateName: 'pendingExpenseReminder',
    subject: '💰 [SAMPLE] Pending Expense Approvals - 5 Awaiting Review',
    data: pendingExpenseReminderData,
    category: 'Reminders',
  },

  // Leave Approval Reminder
  {
    templateName: 'leaveApprovalReminder',
    subject: '📋 [SAMPLE] Pending Leave Approvals - 5 Awaiting Review',
    data: leaveApprovalReminderData,
    category: 'Reminders',
  },

  // Attendance Approval Reminder
  {
    templateName: 'attendanceApprovalReminder',
    subject: '⏰ [SAMPLE] Pending Attendance Approvals - 8 Awaiting Review',
    data: attendanceApprovalReminderData,
    category: 'Reminders',
  },
];

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

async function createTransporter(): Promise<nodemailer.Transporter> {
  // Validate required environment variables
  if (!EMAIL_CONFIG.host || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.error('\n❌ Missing email configuration!');
    console.error('Please ensure the following environment variables are set:');
    console.error('  - EMAIL_HOST (e.g., smtp.gmail.com)');
    console.error('  - EMAIL_PORT (e.g., 587)');
    console.error('  - EMAIL_FROM (sender email address)');
    console.error('  - EMAIL_PASSWORD (email password or app password)');
    console.error('\nFor Gmail, use an App Password: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.port === 465,
    auth: EMAIL_CONFIG.auth,
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    process.exit(1);
  }

  return transporter;
}

async function sendEmail(
  transporter: nodemailer.Transporter,
  template: EmailTemplate,
  recipientEmail: string,
): Promise<boolean> {
  const html = renderTemplate(template.templateName, template.data);

  if (!html) {
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"HRMS Sample Emails" <${EMAIL_CONFIG.auth.user}>`,
      to: recipientEmail,
      subject: template.subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`   ✗ Failed to send: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function sendSampleEmails() {
  console.log('═'.repeat(60));
  console.log('📧 HRMS Sample Email Sender');
  console.log('═'.repeat(60));
  console.log(`\n📬 Recipient: ${recipientEmail}`);
  console.log(`📤 Total emails to send: ${EMAIL_TEMPLATES.length}`);
  console.log(`📁 Templates directory: ${TEMPLATES_DIR}\n`);

  const transporter = await createTransporter();

  let successCount = 0;
  let failCount = 0;
  let currentCategory = '';

  for (const template of EMAIL_TEMPLATES) {
    // Print category header when it changes
    if (template.category !== currentCategory) {
      currentCategory = template.category;
      console.log(`\n📂 ${currentCategory} Emails:`);
    }

    const success = await sendEmail(transporter, template, recipientEmail);

    if (success) {
      console.log(`   ✓ Sent: ${template.subject}`);
      successCount++;
    } else {
      console.log(`   ✗ Failed: ${template.subject}`);
      failCount++;
    }

    // Add a small delay between emails to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Email sending complete!');
  console.log('═'.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   • Successfully sent: ${successCount} emails`);
  console.log(`   • Failed: ${failCount} emails`);
  console.log(`   • Total: ${EMAIL_TEMPLATES.length} emails`);
  console.log(`\n📬 Check your inbox at: ${recipientEmail}`);
  console.log('\n💡 Tips for Gmail:');
  console.log('   • Check "Promotions" or "Updates" tabs if emails are not in Primary');
  console.log('   • Search for "SAMPLE" to find all sample emails');
  console.log('   • Emails have [SAMPLE] prefix in subject for easy identification');

  transporter.close();
}

// Run the script
sendSampleEmails().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
