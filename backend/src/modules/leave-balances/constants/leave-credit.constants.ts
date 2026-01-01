export const LEAVE_CREDIT_ERRORS = {
  CALENDAR_SETTINGS_NOT_FOUND: 'Calendar settings not found',
  LEAVE_CATEGORIES_CONFIG_NOT_FOUND: 'Leave categories config not found',
  LEAVE_CONFIG_SETTING_ID_NOT_FOUND: 'Leave config setting ID not found',
  FAILED_TO_CREDIT_LEAVES: 'Failed to credit leaves',
};

export const LEAVE_CREDIT_LOG_MESSAGES = {
  SKIPPING_CATEGORY_WITH_ZERO_QUOTA: 'Skipping {category} - annualQuota is 0',
  CREDITING_LEAVES_TO_USER: 'Crediting {allocation} {category} leaves to user {userId}',
  FAILED_TO_CREDIT_LEAVES: 'Failed to credit leaves: {error}',
  USER_JOINED_ON_DATE:
    'User {userId} joined on {dateOfJoining}. FY: {financialYear}, Remaining months: {monthsRemaining}, First month fraction: {firstMonthFraction}, Effective months: {effectiveMonths}',
  LEAVE_CREDIT_FOR_USER: 'Leave credit for user {email} credited {categoriesCredited} categories',
};

export const NOTE_TEMPLATES = {
  JOINING_MONTH_SHARE:
    'Initial credit on joining ({joiningDateStr}). Joining month share: {firstMonthFraction} of monthly quota ({monthlyQuota})',
  PRO_RATA:
    'Initial credit on joining ({joiningDateStr}). Pro-rata: {effectiveMonths} months of {annualQuota} annual quota',
};
