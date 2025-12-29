export interface IMailOptions {
  receiverEmails: string | string[];
  subject: string;
  template: string;
  emailData: IEmailDataValues;
}

export interface IEmailDataValues {
  firstName?: string;
  lastName?: string;
  resetPasswordLink?: string;
  currentYear?: number;
}
