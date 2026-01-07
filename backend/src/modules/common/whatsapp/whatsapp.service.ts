import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import { Environments } from 'env-configs';
import {
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_KEYS,
  WHATSAPP_ERRORS,
  formatWhatsAppNumber,
  isValidWhatsAppNumber,
} from './constants/whatsapp.constants';
import { CommunicationLogService } from '../communication-logs/communication-log.service';
import {
  CommunicationStatus,
  CommunicationCategory,
} from '../communication-logs/constants/communication-log.constants';
import { WhatsAppMessageOptions, WhatsAppSendResult } from './whatsapp.types';

@Injectable()
export class WhatsAppService {
  private client: Twilio | null = null;
  private readonly isEnabled: boolean;
  private readonly isProduction: boolean;
  private readonly fromNumber: string;

  constructor(private readonly communicationLogService: CommunicationLogService) {
    this.isEnabled = Environments.WHATSAPP_ENABLED;
    this.isProduction = Environments.WHATSAPP_MODE === 'production';

    if (this.isEnabled) {
      try {
        this.client = new Twilio(Environments.TWILIO_ACCOUNT_SID, Environments.TWILIO_AUTH_TOKEN);
        this.fromNumber = formatWhatsAppNumber(Environments.TWILIO_WHATSAPP_NUMBER);
        Logger.log(
          `WhatsApp Service initialized in ${this.isProduction ? 'PRODUCTION' : 'SANDBOX'} mode`,
        );
      } catch (error) {
        Logger.error('Failed to initialize WhatsApp Service:', error);
        this.client = null;
      }
    } else {
      Logger.log('WhatsApp Service is disabled');
    }
  }

  isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  async sendMessage(options: WhatsAppMessageOptions): Promise<WhatsAppSendResult> {
    const {
      to,
      templateKey,
      templateData,
      category,
      referenceId,
      referenceType,
      recipientId,
      recipientName,
    } = options;

    if (!this.isAvailable()) {
      Logger.warn('WhatsApp service is not available');
      return { success: false, error: WHATSAPP_ERRORS.NOT_ENABLED };
    }

    if (!isValidWhatsAppNumber(to)) {
      Logger.warn(`Invalid WhatsApp number: ${to}`);
      return { success: false, error: WHATSAPP_ERRORS.INVALID_NUMBER };
    }

    const template = WHATSAPP_TEMPLATES[templateKey];
    if (!template) {
      Logger.error(`Template not found: ${templateKey}`);
      return { success: false, error: `Template not found: ${templateKey}` };
    }

    const toNumber = formatWhatsAppNumber(to);
    const startTime = Date.now();

    try {
      let messageResult;

      if (this.isProduction && template.contentSid) {
        messageResult = await this.client.messages.create({
          from: this.fromNumber,
          to: toNumber,
          contentSid: template.contentSid,
          contentVariables: JSON.stringify(templateData),
        });
      } else {
        const messageBody = template.sandboxMessage(templateData as any);
        messageResult = await this.client.messages.create({
          from: this.fromNumber,
          to: toNumber,
          body: messageBody,
        });
      }

      const responseTimeMs = Date.now() - startTime;

      await this.communicationLogService.logWhatsApp(
        {
          recipientPhone: to,
          recipientName,
          recipientId,
          templateName: template.name,
          templateData,
          messageContent: this.isProduction
            ? undefined
            : template.sandboxMessage(templateData as any),
          category,
          referenceId,
          referenceType,
        },
        CommunicationStatus.SENT,
        messageResult.sid,
      );

      Logger.log(`WhatsApp message sent to ${to} (SID: ${messageResult.sid}, ${responseTimeMs}ms)`);

      return {
        success: true,
        messageId: messageResult.sid,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      await this.communicationLogService.logWhatsApp(
        {
          recipientPhone: to,
          recipientName,
          recipientId,
          templateName: template.name,
          templateData,
          category,
          referenceId,
          referenceType,
        },
        CommunicationStatus.FAILED,
        undefined,
        {
          message: error.message,
          code: error.code?.toString() || 'UNKNOWN',
          details: {
            twilioCode: error.code,
            moreInfo: error.moreInfo,
            responseTimeMs,
          },
        },
      );

      Logger.error(`Failed to send WhatsApp message to ${to}: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendAttendanceApproval(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
      approverName: string;
      remarks?: string;
      isApproved: boolean;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    const templateKey = data.isApproved
      ? WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_APPROVED
      : WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_REJECTED;

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
        approverName: data.approverName,
        remarks: data.remarks,
      },
      category: CommunicationCategory.ATTENDANCE_APPROVAL,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendExpenseApproval(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      category: string;
      approverName: string;
      remarks?: string;
      isApproved: boolean;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    const templateKey = data.isApproved
      ? WHATSAPP_TEMPLATE_KEYS.EXPENSE_APPROVED
      : WHATSAPP_TEMPLATE_KEYS.EXPENSE_REJECTED;

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        category: data.category,
        approverName: data.approverName,
        remarks: data.remarks,
      },
      category: CommunicationCategory.EXPENSE_APPROVAL,
      referenceId: options?.referenceId,
      referenceType: 'EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendFuelExpenseApproval(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
      approverName: string;
      remarks?: string;
      isApproved: boolean;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    const templateKey = data.isApproved
      ? WHATSAPP_TEMPLATE_KEYS.FUEL_EXPENSE_APPROVED
      : WHATSAPP_TEMPLATE_KEYS.FUEL_EXPENSE_REJECTED;

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        vehicleNumber: data.vehicleNumber,
        approverName: data.approverName,
        remarks: data.remarks,
      },
      category: CommunicationCategory.FUEL_EXPENSE_APPROVAL,
      referenceId: options?.referenceId,
      referenceType: 'FUEL_EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendLeaveApproval(
    phoneNumber: string,
    data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
      approverName: string;
      remarks?: string;
      isApproved: boolean;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    const templateKey = data.isApproved
      ? WHATSAPP_TEMPLATE_KEYS.LEAVE_APPROVED
      : WHATSAPP_TEMPLATE_KEYS.LEAVE_REJECTED;

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        leaveType: data.leaveType,
        fromDate: data.fromDate,
        toDate: data.toDate,
        totalDays: data.totalDays,
        approverName: data.approverName,
        remarks: data.remarks,
      },
      category: CommunicationCategory.LEAVE_APPROVAL,
      referenceId: options?.referenceId,
      referenceType: 'LEAVE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }
}
