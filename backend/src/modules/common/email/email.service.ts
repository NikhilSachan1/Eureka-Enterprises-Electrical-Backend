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

    // The caller's category if it gave one, else the template's
    const category =
      emailContext.category || TEMPLATE_CATEGORY_MAP[template] || CommunicationCategory.OTHER;

    // Handle multiple recipients
    const emails = Array.isArray(receiverEmails) ? receiverEmails : [receiverEmails];

    // Log each email separately for accurate tracking
    for (const email of emails) {
      const single = { ...emailContext, receiverEmails: email };
      const sent = await this.sendSingleEmail(single, category, startTime, 0);
      if (!sent) this.scheduleRetry(single, 1, category);
    }
  }

  /**
   * One attempt. Returns whether it went; never schedules anything itself.
   *
   * It used to start a fresh retry chain at count 0 on every failure — including failures of the
   * retries — so the retry limit was never reached and each failed email retried about once a
   * minute until the process restarted (one alert reached 8,885 attempts in 7 days). Retrying is
   * now `scheduleRetry`'s job alone, and it carries the count.
   */
  private async sendSingleEmail(
    emailContext: IMailOptions & { receiverEmails: string },
    category: CommunicationCategory,
    startTime: number,
    attempt: number,
  ): Promise<boolean> {
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

      // Log failed email. A logging failure must not turn a failed send into a thrown error.
      await this.communicationLogService
        .logEmail(
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
              attempt: attempt + 1,
              maxAttempts: EMAIL_RETRY_CONFIG.MAX_RETRIES + 1,
            },
          },
        )
        .catch((logError) => Logger.error(`Failed to log email failure: ${logError?.message}`));

      Logger.error(`Failed to send email to ${email}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Retry `retry` of `MAX_RETRIES` after an exponential delay: 1 min, 5 min, 25 min.
   *
   * With the defaults an email is tried four times in all — once, then three retries — and then
   * given up on. The chain lives in memory, so a restart drops any retry still waiting.
   */
  private scheduleRetry(
    emailContext: IMailOptions & { receiverEmails: string },
    retry: number,
    category: CommunicationCategory,
  ) {
    const { MAX_RETRIES, BASE_DELAY_MINUTES, DELAY_MULTIPLIER } = EMAIL_RETRY_CONFIG;

    if (retry > MAX_RETRIES) {
      Logger.error(
        `Failed to send email after ${MAX_RETRIES} retries to: ${emailContext.receiverEmails}`,
      );
      return;
    }

    const delayMs = Math.pow(DELAY_MULTIPLIER, retry - 1) * BASE_DELAY_MINUTES * 60 * 1000;
    const nextRetryAt = new Date(Date.now() + delayMs);

    Logger.log(
      `Scheduling retry ${retry}/${MAX_RETRIES} for ${
        emailContext.receiverEmails
      } at ${nextRetryAt.toISOString()}`,
    );

    setTimeout(async () => {
      const sent = await this.sendSingleEmail(emailContext, category, Date.now(), retry).catch(
        () => false,
      );
      if (sent) {
        Logger.log(`Retry ${retry} successful for email to: ${emailContext.receiverEmails}`);
      } else {
        this.scheduleRetry(emailContext, retry + 1, category);
      }
    }, delayMs);
  }
}
