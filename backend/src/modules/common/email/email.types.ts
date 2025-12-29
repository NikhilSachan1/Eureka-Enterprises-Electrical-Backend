export interface IMailOptions {
  receiverEmails: string | string[];
  subject: string;
  template: string;
  emailData: IEmailDataValues;
}

export interface IEmailDataValues {
  // Common
  currentYear?: number;

  // Forget Password
  firstName?: string;
  lastName?: string;
  resetPasswordLink?: string;

  // FY Leave Config Reminder
  daysRemaining?: number;
  nextFinancialYear?: string;
  adminPortalUrl?: string;
}
