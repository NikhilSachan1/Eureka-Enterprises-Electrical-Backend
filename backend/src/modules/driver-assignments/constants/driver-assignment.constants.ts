export const DRIVER_ASSIGNMENT_ERRORS = {
  NOT_FOUND: 'Driver assignment not found',
  NOT_A_DRIVER: '{name} cannot be assigned as a driver — they do not hold the DRIVER role.',
  // Names the engineer who already holds the driver: without it the second engineer has no idea
  // who to ask for a release.
  ALREADY_CLAIMED:
    '{driver} is already assigned to {engineer} for {date}. Ask them to release the assignment first.',
  SELF_ASSIGNMENT: 'An engineer cannot assign themselves as their own driver.',
  PAYROLL_LOCKED:
    'Payroll for {month}/{year} has already been {status}, so the assignment for {date} cannot be changed. Cancel the payroll first.',
};

export const DRIVER_ASSIGNMENT_RESPONSES = {
  CLAIMED: 'Driver assignment saved',
  RELEASED: 'Driver assignment released',
};
