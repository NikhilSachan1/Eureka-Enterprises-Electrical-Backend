export const LEAVE_BALANCE_ERRORS = {
  NOT_FOUND: 'Leave balance not found',
  INVALID_SORT_FIELD: 'Invalid sort field, it should be one of the following: ',
};

export const LEAVE_BALANCE_FIELD_NAMES = {
  LEAVE_BALANCE: 'Leave balance',
};

export const LEAVE_BALANCE_SORT_FIELDS = {
  totalAllocated: 'leave_balances."totalAllocated"',
  consumed: 'leave_balances."consumed"',
  createdAt: 'leave_balances."createdAt"',
  userFirstName: 'u."firstName"',
  userLastName: 'u."lastName"',
  userEmail: 'u."email"',
} as const;
