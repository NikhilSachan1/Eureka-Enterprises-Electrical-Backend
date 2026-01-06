import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailOptions } from './email.types';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import { CommunicationLogService } from '../communication-logs/communication-log.service';
import {
  CommunicationStatus,
  CommunicationCategory,
  EMAIL_RETRY_CONFIG,
} from '../communication-logs/constants/communication-log.constants';
import { TEMPLATE_CATEGORY_MAP } from './constants/email.constants';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailService: MailerService,
    private readonly communicationLogService: CommunicationLogService,
  ) {}

  async sendMail(emailContext: IMailOptions) {
    const { receiverEmails, template } = emailContext;
    const startTime = Date.now();

    // Determine category from template name
    const category = TEMPLATE_CATEGORY_MAP[template] || CommunicationCategory.OTHER;

    // Handle multiple recipients
    const emails = Array.isArray(receiverEmails) ? receiverEmails : [receiverEmails];

    // Log each email separately for accurate tracking
    for (const email of emails) {
      await this.sendSingleEmail(
        {
          ...emailContext,
          receiverEmails: email,
        },
        category,
        startTime,
      );
    }
  }

  private async sendSingleEmail(
    emailContext: IMailOptions & { receiverEmails: string },
    category: CommunicationCategory,
    startTime: number,
  ) {
    const { receiverEmails: email, subject, template, emailData, attachments } = emailContext;

    try {
      const contextWithCompanyDetails = {
        ...emailData,
        companyName: COMPANY_DETAILS.NAME,
        companyLogo: COMPANY_DETAILS.LOGO_URL,
        companyEmail: COMPANY_DETAILS.EMAIL_HR,
        companyPhone: COMPANY_DETAILS.PHONE,
        companyAddress: COMPANY_DETAILS.FULL_ADDRESS,
        currentYear: new Date().getFullYear(),
      };

      // Send the email
      await this.mailService.sendMail({
        to: email,
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

      const responseTimeMs = Date.now() - startTime;

      // Log successful email
      await this.communicationLogService.logEmail(
        {
          recipientEmail: email,
          recipientName: emailData?.employeeName,
          subject,
          templateName: template,
          templateData: emailData,
          category,
          referenceId: emailData?.referenceId,
          referenceType: emailData?.referenceType,
        },
        CommunicationStatus.SENT,
      );

      Logger.log(`Mail Successfully Sent to: ${email} (${responseTimeMs}ms)`);
      return true;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      // Log failed email
      await this.communicationLogService.logEmail(
        {
          recipientEmail: email,
          recipientName: emailData?.employeeName,
          subject,
          templateName: template,
          templateData: emailData,
          category,
          referenceId: emailData?.referenceId,
          referenceType: emailData?.referenceType,
        },
        CommunicationStatus.FAILED,
        {
          message: error.message,
          code: error.code || 'UNKNOWN',
          details: {
            stack: error.stack,
            responseTimeMs,
          },
        },
      );

      Logger.error(`Failed to send email to ${email}: ${error.message}`, error.stack);

      // Schedule retry for failed emails
      this.scheduleRetry(emailContext, 0, category);
      return false;
    }
  }

  private scheduleRetry(
    emailContext: IMailOptions & { receiverEmails: string },
    retryCount: number,
    category: CommunicationCategory,
  ) {
    const { MAX_RETRIES, BASE_DELAY_MINUTES, DELAY_MULTIPLIER } = EMAIL_RETRY_CONFIG;

    if (retryCount >= MAX_RETRIES) {
      Logger.error(
        `Failed to send email after ${MAX_RETRIES} retries to: ${emailContext.receiverEmails}`,
      );
      return;
    }

    // Exponential backoff: 1min, 5min, 25min (multiplier^retryCount * base)
    const delayMs = Math.pow(DELAY_MULTIPLIER, retryCount) * BASE_DELAY_MINUTES * 60 * 1000;
    const nextRetryAt = new Date(Date.now() + delayMs);

    Logger.log(
      `Scheduling retry ${retryCount + 1}/${MAX_RETRIES} for ${
        emailContext.receiverEmails
      } at ${nextRetryAt.toISOString()}`,
    );

    setTimeout(async () => {
      try {
        const startTime = Date.now();
        await this.sendSingleEmail(emailContext, category, startTime);
        Logger.log(`Retry successful for email to: ${emailContext.receiverEmails}`);
      } catch (error) {
        this.scheduleRetry(emailContext, retryCount + 1, category);
      }
    }, delayMs);
  }
}
