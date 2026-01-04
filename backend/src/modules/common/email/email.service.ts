import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailOptions } from './email.types';
import { Environments } from 'env-configs';
import { ENVIRONMENT_CONFIG } from 'src/utils/config/constants/constants';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';

@Injectable()
export class EmailService {
  constructor(private readonly mailService: MailerService) {}

  async sendMail(emailContext: IMailOptions) {
    try {
      const { receiverEmails, subject, template, emailData, attachments } = emailContext;

      const environment = Environments.APP_ENVIRONMENT;

      if (
        environment === ENVIRONMENT_CONFIG.LOCAL ||
        environment === ENVIRONMENT_CONFIG.DEVELOPMENT
      ) {
        const emails = Array.isArray(receiverEmails) ? receiverEmails : [receiverEmails];

        const hasInvalidEmails = emails.some((email) => !email.endsWith('@coditas.com'));

        if (hasInvalidEmails) {
          Logger.warn('Emails can only be sent to @coditas.com addresses.');
          return true;
        }
      }

      // Inject company details into every email context for consistency
      const contextWithCompanyDetails = {
        ...emailData,
        companyName: COMPANY_DETAILS.NAME,
        companyLogo: COMPANY_DETAILS.LOGO_URL,
        companyEmail: COMPANY_DETAILS.EMAIL_HR,
        companyPhone: COMPANY_DETAILS.PHONE,
        companyAddress: COMPANY_DETAILS.FULL_ADDRESS,
        currentYear: new Date().getFullYear(),
      };

      await this.mailService.sendMail({
        to: receiverEmails,
        subject,
        template,
        context: contextWithCompanyDetails,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
          contentType: att.contentType,
        })),
      });

      Logger.log(`Mail Successfully Sent to : ${receiverEmails}`);
    } catch (error) {
      Logger.error(`Failed to send email: ${error.message}`, error.stack);
      this.scheduleRetry(emailContext);
    }
  }

  private scheduleRetry(emailContext: IMailOptions, retryCount = 0) {
    if (retryCount >= 3) {
      Logger.error(`Failed to send email after 3 retries to: ${emailContext.receiverEmails}`);
      return;
    }
    const delay = Math.pow(5, retryCount) * 60 * 1000;
    setTimeout(async () => {
      try {
        await this.sendMail(emailContext);
        Logger.log(`Retry successful for email to: ${emailContext.receiverEmails}`);
      } catch (error) {
        this.scheduleRetry(emailContext, retryCount + 1);
      }
    }, delay);
  }
}
