import { CommunicationCategory as C } from '../common/communication-logs/constants/communication-log.constants';
import { NotifyInput } from './dto/notification.dto';

/**
 * Every bell/push text in one place.
 *
 * Each event site calls `notify({ userIds, ...NotificationEvents.x({...}) })` next to its existing
 * email/WhatsApp send. Keeping the words here means they can be reviewed — and reworded — without
 * opening twenty services.
 *
 * Rules for anything added here: plain text, short enough for a lock screen, and never a password,
 * OTP, reset link, bank detail or salary figure.
 */
export type NotificationContent = Omit<NotifyInput, 'userIds' | 'createdBy'>;

/** `local_convence` → `Local Convence` */
export const humanize = (value?: string | null) =>
  (value ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** Whatever money arrives as, it leaves as `₹1,500`. */
export const rupees = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '₹0';
  if (typeof value === 'string' && value.trim().startsWith('₹')) return value.trim();
  return `₹${Number(value).toLocaleString('en-IN')}`;
};

/** `count(3, 'day')` → `3 days`; `count(1, 'entry', 'entries')` → `1 entry`. */
const count = (n: number | string, one: string, many = `${one}s`) =>
  `${n} ${Number(n) === 1 ? one : many}`;

/** `casual_leave`, `CASUAL`, `Casual Leave` → `casual leave` — never "Casual Leave leave". */
const leaveName = (type?: string | null) => {
  const base = humanize(type)
    .replace(/\s*leave$/i, '')
    .toLowerCase();
  return base ? `${base} leave` : 'leave';
};
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A one-day leave reads `on Oct 20`, a range `Oct 20 – Oct 22`. */
const span = (from: string, to: string) => (from === to ? `on ${from}` : `${from} – ${to}`);

/** Today in India, as `YYYY-MM-DD`. A UTC date would roll over at 5:30 AM IST. */
export const istDateKey = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const HANDOVER_TITLES: Record<string, string> = {
  HANDOVER_INITIATED: 'Asset handover started',
  HANDOVER_ACCEPTED: 'Asset handover accepted',
  HANDOVER_REJECTED: 'Asset handover rejected',
  HANDOVER_CANCELLED: 'Asset handover cancelled',
  DEALLOCATED: 'Asset taken back',
};

const handoverMessage = (
  kind: 'asset' | 'vehicle',
  label: string,
  action: string,
  byName: string,
) => {
  const thing = `${kind} ${label}`;
  switch (action) {
    case 'HANDOVER_INITIATED':
      return `${byName} is handing over ${thing} to you — accept or reject it`;
    case 'HANDOVER_ACCEPTED':
      return `${byName} accepted ${thing}`;
    case 'HANDOVER_REJECTED':
      return `${byName} rejected the handover of ${thing}`;
    case 'HANDOVER_CANCELLED':
      return `${byName} cancelled the handover of ${thing}`;
    case 'DEALLOCATED':
      return `${thing[0].toUpperCase()}${thing.slice(1)} was taken back from you by ${byName}`;
    default:
      return `${thing[0].toUpperCase()}${thing.slice(1)} was updated by ${byName}`;
  }
};

/** The title names the kind, so the message only needs the counts and whose they are. */
const EXPIRY_KINDS = {
  calibration: {
    title: 'Calibration due',
    expired: 'expired',
    soon: 'expiring soon',
    company: 'across all assets',
    mine: 'on assets assigned to you',
    category: C.ASSET_CALIBRATION_EXPIRY,
    referenceType: 'asset',
    route: '/assets',
  },
  warranty: {
    title: 'Warranty expiring',
    expired: 'expired',
    soon: 'expiring soon',
    company: 'across all assets',
    mine: 'on assets assigned to you',
    category: C.ASSET_WARRANTY_EXPIRY,
    referenceType: 'asset',
    route: '/assets',
  },
  vehicleDocument: {
    title: 'Vehicle documents expiring',
    expired: 'expired',
    soon: 'expiring soon',
    company: 'across the fleet',
    mine: 'on vehicles assigned to you',
    category: C.VEHICLE_DOCUMENT_EXPIRY,
    referenceType: 'vehicle',
    route: '/vehicles',
  },
  vehicleService: {
    title: 'Vehicle service due',
    expired: 'overdue',
    soon: 'due soon',
    company: 'across the fleet',
    mine: 'on vehicles assigned to you',
    category: C.VEHICLE_SERVICE_DUE,
    referenceType: 'vehicle',
    route: '/vehicles',
  },
  card: {
    title: 'Cards expiring',
    expired: 'expired',
    soon: 'expiring soon',
    company: 'across all cards',
    mine: 'on cards assigned to you',
    category: C.CARD_EXPIRY,
    referenceType: 'card',
    route: '/cards',
  },
};

const REMINDER_KINDS = {
  expense: {
    title: 'Expenses waiting for approval',
    one: 'expense',
    many: 'expenses',
    category: C.EXPENSE_APPROVAL_REMINDER,
    referenceType: 'expense',
    route: '/expenses',
  },
  attendance: {
    title: 'Attendance waiting for approval',
    one: 'attendance entry',
    many: 'attendance entries',
    category: C.ATTENDANCE_APPROVAL_REMINDER,
    referenceType: 'attendance',
    route: '/attendance',
  },
  leave: {
    title: 'Leave waiting for approval',
    one: 'leave application',
    many: 'leave applications',
    category: C.LEAVE_APPROVAL_REMINDER,
    referenceType: 'leave_application',
    route: '/leaves',
  },
};

const PAYMENT_SHEET_VERBS: Record<string, string> = {
  SUBMIT: 'submitted',
  FORWARD: 'forwarded',
  RETURN: 'returned',
  REJECT: 'rejected',
  COMPLETE: 'completed',
};

const decided = (approved: boolean) => (approved ? 'approved' : 'rejected');
const withRemarks = (text: string, remarks?: string | null) =>
  remarks?.trim() ? `${text} — "${remarks.trim()}"` : text;

const ROUTES = {
  EXPENSES: '/expenses',
  FUEL: '/fuel-expenses',
  ATTENDANCE: '/attendance',
  LEAVES: '/leaves',
  ASSETS: '/assets',
  VEHICLES: '/vehicles',
  CARDS: '/cards',
  PAYROLL: '/payroll',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
};

export const NotificationEvents = {
  // ─── expense ───────────────────────────────────────────────────────────
  expenseForceCreated: (p: {
    expenseId: string;
    amount: string | number;
    category: string;
    byName: string;
  }) => ({
    title: 'Expense added for you',
    message: `${p.byName} added a ${rupees(p.amount)} ${humanize(
      p.category,
    )} expense on your behalf`,
    category: C.EXPENSE_SUBMISSION,
    referenceType: 'expense',
    referenceId: p.expenseId,
    route: ROUTES.EXPENSES,
  }),

  expenseDecided: (p: {
    expenseId: string;
    amount: string | number;
    category: string;
    approved: boolean;
    byName: string;
    remarks?: string;
  }) => ({
    title: `Expense ${decided(p.approved)}`,
    message: withRemarks(
      `Your ${rupees(p.amount)} ${p.category} expense was ${decided(p.approved)} by ${p.byName}`,
      p.remarks,
    ),
    category: C.EXPENSE_APPROVAL,
    referenceType: 'expense',
    referenceId: p.expenseId,
    route: ROUTES.EXPENSES,
    data: { status: decided(p.approved) },
  }),

  // ─── fuel ──────────────────────────────────────────────────────────────
  fuelForceCreated: (p: {
    fuelExpenseId: string;
    amount: string | number;
    vehicleNo: string;
    byName: string;
  }) => ({
    title: 'Fuel entry added for you',
    message: `${p.byName} added a ${rupees(p.amount)} fuel entry for ${p.vehicleNo} on your behalf`,
    category: C.FUEL_EXPENSE_SUBMISSION,
    referenceType: 'fuel_expense',
    referenceId: p.fuelExpenseId,
    route: ROUTES.FUEL,
  }),

  fuelReimbursed: (p: { fuelExpenseId: string; amount: string | number; byName: string }) => ({
    title: 'Fuel reimbursed',
    message: `${rupees(p.amount)} fuel reimbursement processed by ${p.byName}`,
    category: C.FUEL_EXPENSE_REIMBURSEMENT,
    referenceType: 'fuel_expense',
    referenceId: p.fuelExpenseId,
    route: ROUTES.FUEL,
  }),

  fuelDecided: (p: {
    fuelExpenseId: string;
    amount: string | number;
    vehicleNo: string;
    approved: boolean;
    byName: string;
    remarks?: string;
  }) => ({
    title: `Fuel entry ${decided(p.approved)}`,
    message: withRemarks(
      `Your ${rupees(p.amount)} fuel entry for ${p.vehicleNo} was ${decided(p.approved)} by ${
        p.byName
      }`,
      p.remarks,
    ),
    category: C.FUEL_EXPENSE_APPROVAL,
    referenceType: 'fuel_expense',
    referenceId: p.fuelExpenseId,
    route: ROUTES.FUEL,
    data: { status: decided(p.approved) },
  }),

  // ─── attendance ────────────────────────────────────────────────────────
  attendanceDecided: (p: {
    attendanceId: string;
    date: string;
    approved: boolean;
    byName: string;
    remarks?: string;
  }) => ({
    title: `Attendance ${decided(p.approved)}`,
    message: withRemarks(
      `Your attendance for ${p.date} was ${decided(p.approved)} by ${p.byName}`,
      p.remarks,
    ),
    category: C.ATTENDANCE_APPROVAL,
    referenceType: 'attendance',
    referenceId: p.attendanceId,
    route: ROUTES.ATTENDANCE,
    data: { status: decided(p.approved) },
  }),

  attendanceRegularized: (p: { date: string; from: string; to: string; byName: string }) => ({
    title: 'Attendance regularized',
    message: `${p.byName} changed your attendance for ${p.date} from ${humanize(
      p.from,
    )} to ${humanize(p.to)}`,
    category: C.ATTENDANCE_REGULARIZATION,
    referenceType: 'attendance',
    route: ROUTES.ATTENDANCE,
  }),

  attendanceForceCreated: (p: { date: string; status: string; byName: string }) => ({
    title: 'Attendance marked for you',
    message: `${p.byName} marked you ${humanize(p.status)} for ${p.date}`,
    category: C.ATTENDANCE_FORCE_CREATED,
    referenceType: 'attendance',
    route: ROUTES.ATTENDANCE,
  }),

  attendanceDeleted: (p: { date: string; byName: string }) => ({
    title: 'Attendance deleted',
    message: `Your attendance for ${p.date} was deleted by ${p.byName}`,
    category: C.ATTENDANCE_DELETED,
    referenceType: 'attendance',
    route: ROUTES.ATTENDANCE,
  }),

  attendanceAbsent: (p: { date: string; dateKey: string }) => ({
    title: 'Marked absent',
    message: `You were marked absent for ${p.date}`,
    category: C.ATTENDANCE_ABSENT,
    referenceType: 'attendance',
    route: ROUTES.ATTENDANCE,
    dedupeKey: `${C.ATTENDANCE_ABSENT}:${p.dateKey}`,
  }),

  foodAllowanceCredited: (p: { amount: string | number; date: string; forName?: string }) => ({
    title: 'Food allowance credited',
    message: p.forName
      ? `${rupees(p.amount)} food allowance for ${p.date} credited to you for ${p.forName}`
      : `${rupees(p.amount)} food allowance credited for ${p.date}`,
    category: C.FOOD_EXPENSE_CREDITED,
    referenceType: 'expense',
    route: ROUTES.EXPENSES,
  }),

  driverFoodRedirected: (p: { amount: string | number; date: string; engineerName: string }) => ({
    title: 'Food allowance sent to your engineer',
    message: `Your ${rupees(p.amount)} food allowance for ${p.date} was credited to ${
      p.engineerName
    }`,
    category: C.FOOD_EXPENSE_CREDITED,
    referenceType: 'expense',
    route: ROUTES.EXPENSES,
  }),

  // ─── leave ─────────────────────────────────────────────────────────────
  leaveForceApplied: (p: {
    leaveType: string;
    from: string;
    to: string;
    days: number | string;
    byName: string;
  }) => ({
    title: 'Leave applied for you',
    message: `${p.byName} applied ${leaveName(p.leaveType)} ${span(p.from, p.to)} (${count(
      p.days,
      'day',
    )}) for you`,
    category: C.LEAVE_FORCE_APPLIED,
    referenceType: 'leave_application',
    route: ROUTES.LEAVES,
  }),

  leaveDecided: (p: {
    leaveId: string;
    leaveType: string;
    from: string;
    to: string;
    approved: boolean;
    byName: string;
    remarks?: string;
  }) => ({
    title: `Leave ${decided(p.approved)}`,
    message: withRemarks(
      `Your ${leaveName(p.leaveType)} ${span(p.from, p.to)} was ${decided(p.approved)} by ${
        p.byName
      }`,
      p.remarks,
    ),
    category: C.LEAVE_APPROVAL,
    referenceType: 'leave_application',
    referenceId: p.leaveId,
    route: ROUTES.LEAVES,
    data: { status: decided(p.approved) },
  }),

  assetTransaction: (p: {
    assetMasterId: string;
    assetId: string;
    action: string;
    byName: string;
  }) => ({
    title: HANDOVER_TITLES[p.action] ?? 'Asset updated',
    message: handoverMessage('asset', p.assetId, p.action, p.byName),
    category: C.ASSET_TRANSACTION,
    referenceType: 'asset',
    referenceId: p.assetMasterId,
    route: ROUTES.ASSETS,
    data: { action: p.action },
  }),

  vehicleTransaction: (p: {
    vehicleMasterId: string;
    vehicleNo: string;
    action: string;
    byName: string;
  }) => ({
    title: (HANDOVER_TITLES[p.action] ?? 'Asset updated').replace('Asset', 'Vehicle'),
    message: handoverMessage('vehicle', p.vehicleNo, p.action, p.byName),
    category: C.VEHICLE_TRANSACTION,
    referenceType: 'vehicle',
    referenceId: p.vehicleMasterId,
    route: ROUTES.VEHICLES,
    data: { action: p.action },
  }),

  assetLost: (p: {
    assetMasterId: string;
    assetId: string;
    assetName: string;
    byName: string;
    recoveryAmount?: string;
  }) => ({
    title: 'Asset marked lost',
    message:
      `${p.byName} marked ${p.assetName} (${p.assetId}) as lost` +
      (Number(p.recoveryAmount) > 0
        ? ` — ${rupees(p.recoveryAmount)} will be recovered from you`
        : ''),
    category: C.ASSET_TRANSACTION,
    referenceType: 'asset',
    referenceId: p.assetMasterId,
    route: ROUTES.ASSETS,
  }),

  assetRecovered: (p: {
    assetMasterId: string;
    assetId: string;
    assetName: string;
    byName: string;
    refundedAmount?: string;
  }) => ({
    title: 'Asset recovered',
    message:
      `${p.byName} marked ${p.assetName} (${p.assetId}) as recovered` +
      (Number(p.refundedAmount) > 0 ? ` — ${rupees(p.refundedAmount)} refunded to you` : ''),
    category: C.ASSET_TRANSACTION,
    referenceType: 'asset',
    referenceId: p.assetMasterId,
    route: ROUTES.ASSETS,
  }),

  handoverPenalty: (p: { eventId: string; amount: number; itemLabel: string }) => ({
    title: 'Handover penalty added',
    message: `${rupees(p.amount)} penalty added — the handover of ${
      p.itemLabel
    } was not accepted in time`,
    category: C.EXPENSE_SUBMISSION,
    referenceType: 'expense',
    route: ROUTES.EXPENSES,
    dedupeKey: `HANDOVER_PENALTY:${p.eventId}`,
  }),

  // ─── daily expiry digests (crons) ──────────────────────────────────────
  // `scope` keeps an admin's company-wide digest and their own personal one apart, so the
  // dedupe key does not swallow one of them when the same person gets both.
  expiryDigest: (p: {
    kind: 'calibration' | 'warranty' | 'vehicleDocument' | 'vehicleService' | 'card';
    expired: number;
    expiringSoon: number;
    scope: 'company' | 'mine';
  }) => {
    const k = EXPIRY_KINDS[p.kind];
    const parts = [
      p.expired ? `${p.expired} ${k.expired}` : null,
      p.expiringSoon ? `${p.expiringSoon} ${k.soon}` : null,
    ].filter(Boolean);
    return {
      title: k.title,
      // "3 expired and 5 expiring soon across all assets"
      message: `${capitalize(parts.join(' and ') || 'nothing due')} ${k[p.scope]}`,
      category: k.category,
      referenceType: k.referenceType,
      route: k.route,
      data: { expired: p.expired, expiringSoon: p.expiringSoon, scope: p.scope },
      dedupeKey: `${k.category}:${p.scope}:${istDateKey()}`,
    };
  },

  // ─── approval reminders to admins (crons) ──────────────────────────────
  pendingReminder: (p: {
    kind: 'expense' | 'attendance' | 'leave';
    pending: number;
    urgent: number;
    autoApprovalDate?: string;
  }) => {
    const k = REMINDER_KINDS[p.kind];
    return {
      title: k.title,
      message:
        `${count(p.pending, k.one, k.many)} pending` +
        (p.urgent ? `, ${p.urgent} urgent` : '') +
        (p.autoApprovalDate ? ` — auto-approve on ${p.autoApprovalDate}` : ''),
      category: k.category,
      referenceType: k.referenceType,
      route: k.route,
      data: { pending: p.pending, urgent: p.urgent },
      dedupeKey: `${k.category}:${istDateKey()}`,
    };
  },

  fyLeaveConfigReminder: (p: { daysRemaining: number; nextFinancialYear: string }) => ({
    title: 'Set up next year’s leave',
    message: `Leave configuration for ${p.nextFinancialYear} is due — ${count(
      p.daysRemaining,
      'day',
    )} left`,
    category: C.FY_LEAVE_CONFIG_REMINDER,
    referenceType: 'leave_config',
    route: ROUTES.LEAVES,
    dedupeKey: `${C.FY_LEAVE_CONFIG_REMINDER}:${istDateKey()}`,
  }),

  leaveBalanceCredited: (p: {
    leaveCategory: string;
    credited: number;
    total: number;
    month: string;
  }) => ({
    title: 'Leave credited',
    message: `${p.credited} ${leaveName(p.leaveCategory)} credited for ${p.month} — ${
      p.total
    } credited so far this year`,
    category: C.LEAVE_BALANCE_CREDITED,
    referenceType: 'leave_balance',
    route: ROUTES.LEAVES,
    // Year and month, not the month name: "October" alone would block next October's credit,
    // and the unique index still sees rows the retention cron has soft-deleted.
    dedupeKey: `${C.LEAVE_BALANCE_CREDITED}:${p.leaveCategory}:${istDateKey().slice(0, 7)}`,
  }),

  // ─── payroll / HR ──────────────────────────────────────────────────────
  // No amount: this sits on a lock screen.
  payslipReady: (p: { payrollId: string; monthYear: string }) => ({
    title: 'Payslip ready',
    message: `Your payslip for ${p.monthYear} is ready`,
    category: C.PAYSLIP,
    referenceType: 'payroll',
    referenceId: p.payrollId,
    route: ROUTES.PAYROLL,
    dedupeKey: `${C.PAYSLIP}:${p.payrollId}`,
  }),

  paymentSheetStage: (p: {
    sheetId: string;
    sheetNumber: string;
    title?: string;
    action: string;
    audience: string;
  }) => {
    const name =
      p.title && p.title !== p.sheetNumber ? `${p.title} (${p.sheetNumber})` : p.sheetNumber;
    const toInitiator = p.audience === 'INITIATOR';
    const verb = PAYMENT_SHEET_VERBS[p.action] ?? humanize(p.action).toLowerCase();
    return {
      title: toInitiator ? `Payment sheet ${verb}` : 'Payment sheet waiting for you',
      message: toInitiator
        ? `Payment sheet ${name} was ${verb}`
        : `Payment sheet ${name} was ${verb} and is waiting for your review`,
      category: C.OTHER,
      referenceType: 'payment_sheet',
      referenceId: p.sheetId,
      route: `/payment-sheets/${p.sheetId}`,
      data: { action: p.action, audience: p.audience },
    };
  },

  // ─── employee ──────────────────────────────────────────────────────────

  profileUpdated: (p: { userId: string }) => ({
    title: 'Profile updated',
    message: 'Your profile has been updated successfully.',
    category: C.PROFILE_UPDATED,
    referenceType: 'user',
    referenceId: p.userId,
    route: ROUTES.PROFILE,
  }),

  emailChanged: (p: { userId: string }) => ({
    title: 'Email address updated',
    message: 'Your email address has been updated successfully.',
    category: C.EMAIL_CHANGED,
    referenceType: 'user',
    referenceId: p.userId,
    route: ROUTES.PROFILE,
  }),

  birthday: (p: { firstName: string }) => ({
    title: 'Happy birthday! 🎂',
    message: `Wishing you a wonderful year ahead, ${p.firstName}`,
    category: C.BIRTHDAY_WISH,
    referenceType: 'celebration',
    dedupeKey: `${C.BIRTHDAY_WISH}:${istDateKey().slice(0, 4)}`,
  }),

  workAnniversary: (p: { firstName: string; years: number }) => ({
    title: 'Happy work anniversary! 🎉',
    message: `Congratulations on ${p.years} year${p.years === 1 ? '' : 's'} with us, ${
      p.firstName
    }`,
    category: C.WORK_ANNIVERSARY,
    referenceType: 'celebration',
    dedupeKey: `${C.WORK_ANNIVERSARY}:${istDateKey().slice(0, 4)}`,
  }),

  // ─── payment sheet lines & wallet ──────────────────────────────────────

  expensePaid: (p: { amount: string | number; sheetNumber: string; sheetId: string }) => ({
    title: 'Expense payment made',
    message: `${rupees(p.amount)} paid against your expenses — payment sheet ${p.sheetNumber}`,
    category: C.PAYMENT_SHEET_ITEM,
    referenceType: 'payment_sheet',
    referenceId: p.sheetId,
    route: ROUTES.EXPENSES,
  }),

  /** Doc wording: "{name} rejected your (fuel) expense payment. Reason: {reason}". */
  paymentLineRejected: (p: {
    fuel: boolean;
    amount: string | number;
    byName: string;
    reason: string;
    sheetNumber: string;
    sheetId: string;
  }) => ({
    title: p.fuel ? 'Fuel expense payment rejected' : 'Expense payment rejected',
    message: `${p.byName} rejected your ${p.fuel ? 'fuel expense' : 'expense'} payment of ${rupees(
      p.amount,
    )} (payment sheet ${p.sheetNumber}). Reason: ${p.reason.trim()}`,
    category: C.PAYMENT_SHEET_ITEM,
    referenceType: 'payment_sheet',
    referenceId: p.sheetId,
    route: p.fuel ? ROUTES.FUEL : ROUTES.EXPENSES,
  }),

  walletRecharged: (p: { amount: string | number; sheetId: string }) => ({
    title: 'Wallet recharged',
    message: `Your wallet balance has been recharged successfully with ${rupees(p.amount)}.`,
    category: C.WALLET,
    referenceType: 'payment_sheet',
    referenceId: p.sheetId,
  }),

  // ─── approval documents (PO, JMC, Report, Invoice, …) ──────────────────

  /**
   * One builder for every action on every approval document, so the wording stays the same
   * across them. `label` is how the document is called ("PO", "Invoice"); `number` may be missing
   * on a document that has not been numbered yet.
   */
  documentEvent: (p: {
    action: DocumentAction;
    label: string;
    number?: string | null;
    siteName?: string | null;
    byName: string;
    reason?: string | null;
    category: string;
    referenceType: string;
    referenceId: string;
    route: string;
    /** False for documents that are approved the moment they are created (site reports). */
    awaitsApproval?: boolean;
  }) => {
    const doc = p.number ? `${p.label} ${p.number}` : p.label;
    const at = p.siteName ? ` at ${p.siteName}` : '';
    const a = /^[aeiou]/i.test(p.label) ? 'An' : 'A';
    const waiting = p.awaitsApproval === false ? '' : ' and is waiting for approval';
    const text: Record<DocumentAction, [string, string]> = {
      ADDED: [`${p.label} added`, `${doc}${at} was added by ${p.byName}${waiting}`],
      EDITED: [`${p.label} edited`, `${doc}${at} was edited by ${p.byName}`],
      DELETED: [`${p.label} deleted`, `${doc}${at} was deleted by ${p.byName}`],
      APPROVED: [`${p.label} approved`, `Your ${doc}${at} was approved by ${p.byName}`],
      REJECTED: [
        `${p.label} rejected`,
        withRemarks(`Your ${doc}${at} was rejected by ${p.byName}`, p.reason),
      ],
      UNLOCK_REQUESTED: [
        `${p.label} unlock requested`,
        withRemarks(
          `${a} ${p.label} unlock request has been received and requires your attention: ${doc}${at}, requested by ${p.byName}`,
          p.reason,
        ),
      ],
      UNLOCK_GRANTED: [
        `${p.label} unlocked`,
        `Your unlock request for ${doc}${at} was granted by ${p.byName}`,
      ],
      UNLOCK_REJECTED: [
        `${p.label} unlock rejected`,
        `Your unlock request for ${doc}${at} was rejected by ${p.byName}`,
      ],
    };
    const [title, message] = text[p.action];
    return {
      title,
      message,
      category: p.category,
      referenceType: p.referenceType,
      referenceId: p.referenceId,
      route: p.route,
      data: { action: p.action },
    };
  },
};

export type DocumentAction =
  | 'ADDED'
  | 'EDITED'
  | 'DELETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'UNLOCK_REQUESTED'
  | 'UNLOCK_GRANTED'
  | 'UNLOCK_REJECTED';

export const NOTIFICATION_ROUTES = ROUTES;
