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

  async sendAttendanceRegularization(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
      originalStatus: string;
      newStatus: string;
      regularizedByName: string;
      notes?: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_REGULARIZED,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
        originalStatus: data.originalStatus,
        newStatus: data.newStatus,
        regularizedByName: data.regularizedByName,
        notes: data.notes,
      },
      category: CommunicationCategory.ATTENDANCE_REGULARIZATION,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendExpenseSubmitted(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      category: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.EXPENSE_SUBMITTED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        category: data.category,
      },
      category: CommunicationCategory.EXPENSE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'EXPENSE',
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

  async sendExpenseForceCreated(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      category: string;
      createdByName: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.EXPENSE_FORCE_CREATED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        category: data.category,
        createdByName: data.createdByName,
      },
      category: CommunicationCategory.EXPENSE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendFuelExpenseForceCreated(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
      createdByName: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.FUEL_EXPENSE_FORCE_CREATED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        vehicleNumber: data.vehicleNumber,
        createdByName: data.createdByName,
      },
      category: CommunicationCategory.FUEL_EXPENSE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'FUEL_EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendFuelExpenseSubmitted(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.FUEL_EXPENSE_SUBMITTED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        vehicleNumber: data.vehicleNumber,
      },
      category: CommunicationCategory.FUEL_EXPENSE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'FUEL_EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendFuelExpenseReimbursed(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      processedBy: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.FUEL_EXPENSE_REIMBURSED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        processedBy: data.processedBy,
      },
      category: CommunicationCategory.FUEL_EXPENSE_REIMBURSEMENT,
      referenceId: options?.referenceId,
      referenceType: 'FUEL_EXPENSE',
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

  async sendAttendanceSubmission(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
      checkInTime: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_SUBMITTED,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
        checkInTime: data.checkInTime,
      },
      category: CommunicationCategory.ATTENDANCE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendAttendanceCheckOut(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
      checkOutTime: string;
      totalHours?: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_CHECKED_OUT,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
        checkOutTime: data.checkOutTime,
        totalHours: data.totalHours,
      },
      category: CommunicationCategory.ATTENDANCE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendAttendanceForceCreated(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
      status: string;
      createdByName: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_FORCE_CREATED,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
        status: data.status,
        createdByName: data.createdByName,
      },
      category: CommunicationCategory.ATTENDANCE_FORCE_CREATED,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendAttendanceAbsentMarked(
    phoneNumber: string,
    data: {
      employeeName: string;
      date: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.ATTENDANCE_ABSENT_MARKED,
      templateData: {
        employeeName: data.employeeName,
        date: data.date,
      },
      category: CommunicationCategory.ATTENDANCE_ABSENT,
      referenceId: options?.referenceId,
      referenceType: 'ATTENDANCE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendLeaveSubmission(
    phoneNumber: string,
    data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.LEAVE_SUBMITTED,
      templateData: {
        employeeName: data.employeeName,
        leaveType: data.leaveType,
        fromDate: data.fromDate,
        toDate: data.toDate,
        totalDays: data.totalDays,
      },
      category: CommunicationCategory.LEAVE_SUBMISSION,
      referenceId: options?.referenceId,
      referenceType: 'LEAVE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendLeaveCancellation(
    phoneNumber: string,
    data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      cancelledByName: string;
      remarks?: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.LEAVE_CANCELLED,
      templateData: {
        employeeName: data.employeeName,
        leaveType: data.leaveType,
        fromDate: data.fromDate,
        toDate: data.toDate,
        cancelledByName: data.cancelledByName,
        remarks: data.remarks,
      },
      category: CommunicationCategory.LEAVE_CANCELLATION,
      referenceId: options?.referenceId,
      referenceType: 'LEAVE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendLeaveForceApplied(
    phoneNumber: string,
    data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
      appliedByName: string;
      reason?: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.LEAVE_FORCE_APPLIED,
      templateData: {
        employeeName: data.employeeName,
        leaveType: data.leaveType,
        fromDate: data.fromDate,
        toDate: data.toDate,
        totalDays: data.totalDays,
        appliedByName: data.appliedByName,
        reason: data.reason,
      },
      category: CommunicationCategory.LEAVE_FORCE_APPLIED,
      referenceId: options?.referenceId,
      referenceType: 'LEAVE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendLeaveBalanceCredited(
    phoneNumber: string,
    data: {
      employeeName: string;
      leaveCategory: string;
      credited: string;
      total: string;
      month: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.LEAVE_BALANCE_CREDITED,
      templateData: {
        employeeName: data.employeeName,
        leaveCategory: data.leaveCategory,
        credited: data.credited,
        total: data.total,
        month: data.month,
      },
      category: CommunicationCategory.LEAVE_BALANCE_CREDITED,
      referenceId: options?.referenceId,
      referenceType: 'LEAVE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendWelcomeEmployee(
    phoneNumber: string,
    data: {
      employeeName: string;
      email: string;
      tempPassword: string;
      employeeId: string;
      loginUrl: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.WELCOME_EMPLOYEE,
      templateData: {
        employeeName: data.employeeName,
        email: data.email,
        tempPassword: data.tempPassword,
        employeeId: data.employeeId,
        loginUrl: data.loginUrl,
      },
      category: CommunicationCategory.WELCOME_EMPLOYEE,
      referenceId: options?.referenceId,
      referenceType: 'USER',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendForgetPassword(
    phoneNumber: string,
    data: {
      employeeName: string;
      resetLink: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.FORGET_PASSWORD,
      templateData: {
        employeeName: data.employeeName,
        resetLink: data.resetLink,
      },
      category: CommunicationCategory.FORGET_PASSWORD,
      referenceId: options?.referenceId,
      referenceType: 'USER',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendAssetTransaction(
    phoneNumber: string,
    data: {
      employeeName: string;
      assetId: string;
      actorName: string;
      action: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    let templateKey: (typeof WHATSAPP_TEMPLATE_KEYS)[keyof typeof WHATSAPP_TEMPLATE_KEYS];

    switch (data.action) {
      case 'HANDOVER_INITIATED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.ASSET_HANDOVER_INITIATED;
        break;
      case 'HANDOVER_ACCEPTED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.ASSET_HANDOVER_ACCEPTED;
        break;
      case 'HANDOVER_REJECTED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.ASSET_HANDOVER_REJECTED;
        break;
      case 'HANDOVER_CANCELLED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.ASSET_HANDOVER_CANCELLED;
        break;
      case 'DEALLOCATED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.ASSET_DEALLOCATED;
        break;
      default:
        return { success: false, error: 'Invalid asset transaction action' };
    }

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        assetId: data.assetId,
        actorName: data.actorName,
      },
      category: CommunicationCategory.ASSET_TRANSACTION,
      referenceId: options?.referenceId,
      referenceType: 'ASSET',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendVehicleTransaction(
    phoneNumber: string,
    data: {
      employeeName: string;
      vehicleNumber: string;
      actorName: string;
      action: string;
    },
    options?: {
      referenceId?: string;
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    let templateKey: (typeof WHATSAPP_TEMPLATE_KEYS)[keyof typeof WHATSAPP_TEMPLATE_KEYS];

    switch (data.action) {
      case 'HANDOVER_INITIATED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.VEHICLE_HANDOVER_INITIATED;
        break;
      case 'HANDOVER_ACCEPTED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.VEHICLE_HANDOVER_ACCEPTED;
        break;
      case 'HANDOVER_REJECTED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.VEHICLE_HANDOVER_REJECTED;
        break;
      case 'HANDOVER_CANCELLED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.VEHICLE_HANDOVER_CANCELLED;
        break;
      case 'DEALLOCATED':
        templateKey = WHATSAPP_TEMPLATE_KEYS.VEHICLE_DEALLOCATED;
        break;
      default:
        return { success: false, error: 'Invalid vehicle transaction action' };
    }

    return this.sendMessage({
      to: phoneNumber,
      templateKey,
      templateData: {
        employeeName: data.employeeName,
        vehicleNumber: data.vehicleNumber,
        actorName: data.actorName,
      },
      category: CommunicationCategory.VEHICLE_TRANSACTION,
      referenceId: options?.referenceId,
      referenceType: 'VEHICLE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }

  async sendFoodExpenseCredited(
    phoneNumber: string,
    data: {
      employeeName: string;
      amount: string;
      date: string;
      creditedFor?: string;
    },
    options?: {
      recipientId?: string;
    },
  ): Promise<WhatsAppSendResult> {
    return this.sendMessage({
      to: phoneNumber,
      templateKey: WHATSAPP_TEMPLATE_KEYS.FOOD_EXPENSE_CREDITED,
      templateData: {
        employeeName: data.employeeName,
        amount: data.amount,
        date: data.date,
        creditedFor: data.creditedFor,
      },
      category: CommunicationCategory.FOOD_EXPENSE_CREDITED,
      referenceType: 'EXPENSE',
      recipientId: options?.recipientId,
      recipientName: data.employeeName,
    });
  }
}
