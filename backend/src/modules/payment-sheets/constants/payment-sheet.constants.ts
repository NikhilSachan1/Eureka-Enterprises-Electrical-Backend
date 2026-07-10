/**
 * Payment Sheet — status, stage and action enums plus error/response messages.
 * See docs/payment-sheet-spec.md for the full design.
 */

// ── Header lifecycle ───────────────────────────────────────────────
export enum PaymentSheetStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ── Per-line lifecycle (accountant level) ──────────────────────────
export enum PaymentSheetItemStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  HOLD = 'HOLD',
  REJECTED = 'REJECTED',
}

export enum BeneficiaryType {
  USER = 'USER',
  VENDOR = 'VENDOR',
}

export enum PaymentSourceType {
  EXPENSE = 'EXPENSE',
  FUEL_EXPENSE = 'FUEL_EXPENSE',
  VENDOR_PAYMENT = 'VENDOR_PAYMENT',
}

// ── Configurable workflow stages (default chain — overridable via config_settings) ──
export enum PaymentSheetStage {
  INITIATION = 'INITIATION',
  HR_REVIEW = 'HR_REVIEW',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  PROCESSING = 'PROCESSING',
}

export type AmountEditPolicy = 'free' | 'decrease-only' | 'none';

export interface ApprovalStageConfig {
  stage: string;
  role: string;
  amountEdit: AmountEditPolicy;
  addRemove: boolean;
  canReturn?: boolean;
  canReject?: boolean;
  processItems?: boolean;
  verifyItems?: boolean;
  rejectItems?: boolean; // stage may reject individual lines (HR/Admin review; accountant uses processItems)
}

/** Fallback chain used when the `payments.approval_flow` config row is absent. */
export const DEFAULT_APPROVAL_FLOW: ApprovalStageConfig[] = [
  {
    stage: PaymentSheetStage.INITIATION,
    role: 'OPERATION_MANAGER',
    amountEdit: 'free',
    addRemove: false,
  },
  {
    stage: PaymentSheetStage.HR_REVIEW,
    role: 'HR',
    amountEdit: 'free',
    addRemove: false,
    canReturn: true,
    canReject: true,
    verifyItems: true,
    rejectItems: true,
  },
  {
    stage: PaymentSheetStage.ADMIN_REVIEW,
    role: 'ADMIN',
    amountEdit: 'decrease-only',
    addRemove: true,
    canReturn: true,
    canReject: true,
    verifyItems: true,
    rejectItems: true,
  },
  {
    stage: PaymentSheetStage.PROCESSING,
    role: 'ACCOUNTS',
    amountEdit: 'none',
    addRemove: false,
    processItems: true,
  },
];

// ── Header workflow transition actions (stage log) ─────────────────
export enum StageAction {
  SUBMIT = 'SUBMIT',
  FORWARD = 'FORWARD',
  RETURN = 'RETURN',
  REJECT = 'REJECT',
  COMPLETE = 'COMPLETE',
}

// ── Item history actions ───────────────────────────────────────────
export enum ItemHistoryAction {
  ITEM_ADDED = 'ITEM_ADDED',
  AMOUNT_EDIT = 'AMOUNT_EDIT',
  ITEM_REMOVED = 'ITEM_REMOVED',
  PAID = 'PAID',
  HOLD = 'HOLD',
  RELEASE = 'RELEASE',
  REJECTED = 'REJECTED',
  VERIFIED = 'VERIFIED',
  UNVERIFIED = 'UNVERIFIED',
}

// ── DB config keys ─────────────────────────────────────────────────
export const PAYMENT_SHEET_CONFIG = {
  MODULE: 'payments',
  APPROVAL_FLOW_KEY: 'payments.approval_flow',
  SHEET_NUMBER_FORMAT_KEY: 'payments.sheet_number_format',
  ADMIN_EDIT_POLICY_KEY: 'payments.admin_edit_policy',
  SHEET_STATUSES_KEY: 'payments.sheet_statuses',
  SHEET_STAGES_KEY: 'payments.sheet_stages',
  ITEM_STATUSES_KEY: 'payments.item_statuses',
} as const;

export const PAYMENT_SHEET_DEFAULTS = {
  SHEET_NUMBER_PREFIX: 'PS',
  SETTLEMENT_CATEGORY: 'Settlement',
  SETTLEMENT_DESCRIPTION: 'Payment sheet settlement',
} as const;

export const PAYMENT_SHEET_ERRORS = {
  NOT_FOUND: 'Payment sheet not found',
  ITEM_NOT_FOUND: 'Payment sheet item not found',
  EMPTY_SHEET: 'Cannot submit a payment sheet with no items',
  NOT_DRAFT: 'Only a DRAFT or RETURNED sheet can be edited or submitted',
  NOT_EDITABLE_STAGE: 'You are not authorized to act on this sheet at its current stage',
  AMOUNT_EXCEEDS_PENDING: 'Amount cannot exceed the beneficiary current pending amount',
  AMOUNT_MUST_BE_POSITIVE: 'Amount must be greater than zero',
  AMOUNT_INCREASE_NOT_ALLOWED: 'Amount can only be decreased at this stage',
  AMOUNT_EDIT_NOT_ALLOWED: 'Amount editing is not allowed at this stage',
  ADD_REMOVE_NOT_ALLOWED: 'Adding or removing beneficiaries is not allowed at this stage',
  REASON_REQUIRED: 'A reason is required for this action',
  NOT_PROCESSING_STAGE: 'The sheet must be at the processing stage for this action',
  REJECT_NOT_ALLOWED_STAGE: 'Items can only be rejected at a review or processing stage',
  DELETE_NOT_ALLOWED: 'You are not allowed to delete this payment sheet',
  DELETE_AFTER_SUBMIT: 'A payment sheet can only be deleted before it is submitted for review',
  HAS_SETTLED_ITEMS: 'Cannot delete: this sheet has paid or on-hold items',
  ITEM_ALREADY_REJECTED: 'This line has been rejected and can no longer be modified',
  ITEM_NOT_PENDING: 'Only a PENDING item can be paid',
  ITEM_NOT_ON_HOLD: 'Only a HOLD item can be released',
  HOLD_NOT_OWNER: 'Only the accountant who placed the hold can release it',
  DUPLICATE_BENEFICIARY: 'This beneficiary + source is already on the sheet',
  VENDOR_TRANSFER_DETAILS_REQUIRED:
    'utrNumber and transferDate are required for each vendor book-payment transfer',
  VENDOR_ALLOCATION_MISMATCH: 'Provided transfers do not match the vendor book-payment allocations',
  PAYMENT_DETAILS_REQUIRED: 'paymentMode and paidDate are required to pay this item',
  CATEGORY_REQUIRED: 'category is required to pay an expense item',
  PENDING_CONFLICT: 'Live pending is now lower than the amount to pay; reconcile the sheet first',
  ALREADY_TERMINAL: 'This sheet is already in a terminal state',
  NOT_A_VERIFY_STAGE: 'Verification is not applicable at the current stage',
  ITEMS_NOT_ALL_VERIFIED: 'All items must be verified before forwarding',
  ALREADY_VERIFIED: 'This item is already verified for the current stage',
  ITEM_NOT_VERIFIED: 'This item is not verified for the current stage',
  EDIT_LOCKED_VERIFIED:
    'This item has been verified by a later stage and can no longer be edited or removed here',
} as const;

export const PAYMENT_SHEET_RESPONSES = {
  CREATED: 'Payment sheet created successfully',
  UPDATED: 'Payment sheet updated successfully',
  SUBMITTED: 'Payment sheet submitted',
  FORWARDED: 'Payment sheet forwarded to the next stage',
  RETURNED: 'Payment sheet returned to the initiator',
  REJECTED: 'Payment sheet rejected',
  CANCELLED: 'Payment sheet cancelled',
  DELETED: 'Payment sheet deleted',
  ITEM_ADDED: 'Beneficiary added to the sheet',
  ITEM_UPDATED: 'Item amount updated',
  ITEM_REMOVED: 'Beneficiary removed from the sheet',
  ITEM_PAID: 'Item marked as paid',
  ITEM_HELD: 'Item placed on hold',
  ITEM_RELEASED: 'Item released from hold',
  ITEM_REJECTED: 'Item rejected',
  ITEM_VERIFIED: 'Item verified',
  ITEM_UNVERIFIED: 'Item verification removed',
  ALL_VERIFIED: 'All items verified for the current stage',
  COMPLETED: 'Payment sheet completed',
  PDF_GENERATING: 'Payment sheet PDF is being generated; try again in a moment',
} as const;

// Permission names (seeded via migration). One permission per endpoint/action.
export const PAYMENT_SHEET_PERMISSIONS = {
  // reads
  VIEW_LIST: 'financials.payment-sheets.view-list',
  VIEW_DETAIL: 'financials.payment-sheets.view-detail',
  RECONCILE: 'financials.payment-sheets.reconcile',
  DOWNLOAD: 'financials.payment-sheets.download',
  // initiator
  CREATE: 'financials.payment-sheets.create',
  UPDATE: 'financials.payment-sheets.update',
  SYNC_AMOUNTS: 'financials.payment-sheets.sync-amounts',
  SUBMIT: 'financials.payment-sheets.submit',
  // item editing
  ITEM_ADD: 'financials.payment-sheets.item-add',
  ITEM_EDIT: 'financials.payment-sheets.item-edit',
  ITEM_REMOVE: 'financials.payment-sheets.item-remove',
  // review verification
  BENEFICIARY_VERIFY: 'financials.payment-sheets.beneficiary-verify',
  BENEFICIARY_UNVERIFY: 'financials.payment-sheets.beneficiary-unverify',
  // workflow transitions
  FORWARD: 'financials.payment-sheets.forward',
  RETURN: 'financials.payment-sheets.return',
  SHEET_REJECT: 'financials.payment-sheets.sheet-reject',
  DELETE: 'financials.payment-sheets.delete',
  // accountant processing
  ITEM_PAY: 'financials.payment-sheets.item-pay',
  ITEM_HOLD: 'financials.payment-sheets.item-hold',
  ITEM_RELEASE: 'financials.payment-sheets.item-release',
  ITEM_REJECT: 'financials.payment-sheets.item-reject',
} as const;
