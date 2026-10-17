/**
 * How wide a non-office user's reach is, for one module.
 *
 * `SELF` is the default everywhere and is exactly what the hardcoded interceptor did before this
 * existed — so turning the feature on is a deliberate act, and leaving it alone changes nothing
 * for anybody.
 */
export enum ManageScope {
  /** Only your own rows. Today's behaviour. */
  SELF = 'self',
  /** Your own, plus the members named in `user_module_delegations`. */
  DELEGATED = 'delegated',
  /** No restriction — how the office roles already work. */
  ALL = 'all',
}

/**
 * The modules this actually governs, with the config key that sets each one's scope.
 *
 * Deliberately a short, explicit list rather than the whole `permission/modules` config: a
 * delegation row may name any module, but only the ones below are read by any code path. Adding a
 * module here without wiring its endpoints would be a lie.
 */
export const DELEGATABLE_MODULES = {
  EXPENSE: 'expense',
  FUEL: 'fuel',
} as const;

export type DelegatableModule = (typeof DELEGATABLE_MODULES)[keyof typeof DELEGATABLE_MODULES];

/** Which config key holds the scope for each module. */
export const MODULE_SCOPE_CONFIG_KEY: Record<DelegatableModule, string> = {
  [DELEGATABLE_MODULES.EXPENSE]: 'expense_manage_scope',
  [DELEGATABLE_MODULES.FUEL]: 'fuel_manage_scope',
};

/**
 * The permission that makes a forced entry land approved rather than pending.
 *
 * Auto-approval is tied to the ability to *approve*, not the ability to *force*. Without this a
 * delegated employee given `expense.force` would be entering and approving his colleagues' money
 * in one step, with nobody else ever seeing it — and that was already possible before any
 * delegation existed, for anyone granted force through a per-user override.
 */
export const MODULE_APPROVE_PERMISSION: Record<DelegatableModule, string> = {
  [DELEGATABLE_MODULES.EXPENSE]: 'expense.approve',
  [DELEGATABLE_MODULES.FUEL]: 'fuel.approve',
};

export const USER_DELEGATION_ERRORS = {
  NOT_FOUND: 'Delegation not found',
  SELF_DELEGATION: 'A person cannot be delegated to manage their own entries',
  UNKNOWN_MODULE: 'Unknown module "{module}". Delegation is supported for: {supported}',
  MEMBER_NOT_ACTIVE: 'This employee is not active, so nobody can be given their entries to manage',
  MANAGER_NOT_ACTIVE: 'This employee is not active and cannot be made a manager',
  ALREADY_DELEGATED:
    'An open delegation already exists for this pair and module. Withdraw it first, or set an end date on it',
  NOT_ALLOWED_FOR_USER: 'You are not allowed to work on this employee’s {module} entries',
  MEMBER_INACTIVE_FOR_ENTRY:
    'Entries cannot be recorded against an employee who is no longer active',
};

export const USER_DELEGATION_RESPONSES = {
  CREATED: 'Delegation granted',
  WITHDRAWN: 'Delegation withdrawn',
};
