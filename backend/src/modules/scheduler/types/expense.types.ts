/**
 * Types for CRON 16: Pending Expense Approval Reminders
 *
 * Handles both regular expenses and fuel expenses that are pending approval.
 */

export enum ExpenseType {
  REGULAR = 'REGULAR',
  FUEL = 'FUEL',
}

export interface PendingExpenseAlert {
  expenseId: string;
  expenseType: ExpenseType;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: Date;
  daysPending: number;
  createdAt: Date;
  // Fuel expense specific
  vehicleRegistrationNo?: string;
  fuelLiters?: number;
}

export interface PendingExpenseCount {
  regular: number;
  fuel: number;
  total: number;
  urgent: number; // Pending for more than X days
}

export interface PendingExpenseResult {
  totalExpensesProcessed: number;
  pendingCounts: PendingExpenseCount;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface ExpenseEmailItem {
  expenseId: string;
  expenseType: string;
  expenseTypeLabel: string;
  employeeName: string;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  daysPending: number;
  daysText: string;
  statusClass: 'urgent' | 'pending';
  // Fuel expense specific
  vehicleRegistrationNo?: string;
  fuelLiters?: string;
  isFuelExpense: boolean;
}

export interface EmployeeExpenseGroup {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  expenses: ExpenseEmailItem[];
  totalAmount: number;
  expenseCount: number;
}

export interface PendingExpenseEmailData {
  currentYear: number;
  adminPortalUrl: string;
  totalPending: number;
  totalUrgent: number;
  totalRegular: number;
  totalFuel: number;
  totalAmount: string;
  urgentExpenses: ExpenseEmailItem[];
  pendingExpenses: ExpenseEmailItem[];
  employeeGroups: EmployeeExpenseGroup[];
  hasUrgent: boolean;
  hasPending: boolean;
  urgentThresholdDays: number;
}

export interface ExpenseQueryResult {
  id: string;
  expenseType: ExpenseType;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: Date;
  createdAt: Date;
  daysPending: number;
  // Fuel specific
  vehicleRegistrationNo?: string;
  fuelLiters?: number;
}
