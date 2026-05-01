export const WHATSAPP_SENDER = 'Eureka HRMS';

// Template keys - use these instead of hardcoding strings
export const WHATSAPP_TEMPLATE_KEYS = {
  ATTENDANCE_APPROVED: 'ATTENDANCE_APPROVED',
  ATTENDANCE_REJECTED: 'ATTENDANCE_REJECTED',
  ATTENDANCE_REGULARIZED: 'ATTENDANCE_REGULARIZED',
  ATTENDANCE_SUBMITTED: 'ATTENDANCE_SUBMITTED',
  ATTENDANCE_CHECKED_OUT: 'ATTENDANCE_CHECKED_OUT',
  ATTENDANCE_FORCE_CREATED: 'ATTENDANCE_FORCE_CREATED',
  ATTENDANCE_ABSENT_MARKED: 'ATTENDANCE_ABSENT_MARKED',
  EXPENSE_SUBMITTED: 'EXPENSE_SUBMITTED',
  EXPENSE_APPROVED: 'EXPENSE_APPROVED',
  EXPENSE_REJECTED: 'EXPENSE_REJECTED',
  EXPENSE_FORCE_CREATED: 'EXPENSE_FORCE_CREATED',
  FUEL_EXPENSE_SUBMITTED: 'FUEL_EXPENSE_SUBMITTED',
  FUEL_EXPENSE_APPROVED: 'FUEL_EXPENSE_APPROVED',
  FUEL_EXPENSE_REJECTED: 'FUEL_EXPENSE_REJECTED',
  FUEL_EXPENSE_REIMBURSED: 'FUEL_EXPENSE_REIMBURSED',
  FUEL_EXPENSE_FORCE_CREATED: 'FUEL_EXPENSE_FORCE_CREATED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  LEAVE_SUBMITTED: 'LEAVE_SUBMITTED',
  LEAVE_CANCELLED: 'LEAVE_CANCELLED',
  LEAVE_FORCE_APPLIED: 'LEAVE_FORCE_APPLIED',
  LEAVE_BALANCE_CREDITED: 'LEAVE_BALANCE_CREDITED',
  WELCOME_EMPLOYEE: 'WELCOME_EMPLOYEE',
  FORGET_PASSWORD: 'FORGET_PASSWORD',
  ASSET_HANDOVER_INITIATED: 'ASSET_HANDOVER_INITIATED',
  ASSET_HANDOVER_ACCEPTED: 'ASSET_HANDOVER_ACCEPTED',
  ASSET_HANDOVER_REJECTED: 'ASSET_HANDOVER_REJECTED',
  ASSET_HANDOVER_CANCELLED: 'ASSET_HANDOVER_CANCELLED',
  ASSET_DEALLOCATED: 'ASSET_DEALLOCATED',
  ASSET_LOST: 'ASSET_LOST',
  ASSET_RECOVERED: 'ASSET_RECOVERED',
  VEHICLE_HANDOVER_INITIATED: 'VEHICLE_HANDOVER_INITIATED',
  VEHICLE_HANDOVER_ACCEPTED: 'VEHICLE_HANDOVER_ACCEPTED',
  VEHICLE_HANDOVER_REJECTED: 'VEHICLE_HANDOVER_REJECTED',
  VEHICLE_HANDOVER_CANCELLED: 'VEHICLE_HANDOVER_CANCELLED',
  VEHICLE_DEALLOCATED: 'VEHICLE_DEALLOCATED',
  FOOD_EXPENSE_CREDITED: 'FOOD_EXPENSE_CREDITED',
} as const;

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATE_KEYS;

export const WHATSAPP_TEMPLATES = {
  ATTENDANCE_APPROVED: {
    name: 'attendance_approved',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      date: string;
      approverName: string;
      remarks?: string;
    }) =>
      `✅ *Attendance Approved*\n\nHi *${data.employeeName}*,\n\nYour attendance for *${
        data.date
      }* has been approved by *${data.approverName}*.${
        data.remarks ? `\n\nRemarks: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_REJECTED: {
    name: 'attendance_rejected',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      date: string;
      approverName: string;
      remarks?: string;
    }) =>
      `❌ *Attendance Rejected*\n\nHi *${data.employeeName}*,\n\nYour attendance for *${
        data.date
      }* has been rejected by *${data.approverName}*.${
        data.remarks ? `\n\nReason: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_REGULARIZED: {
    name: 'attendance_regularized',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      date: string;
      originalStatus: string;
      newStatus: string;
      regularizedByName: string;
      notes?: string;
    }) =>
      `🔄 *Attendance Regularized*\n\nHi *${data.employeeName}*,\n\nYour attendance for *${
        data.date
      }* has been regularized by *${data.regularizedByName}*.\n\n📊 *Status Change:* ${
        data.originalStatus
      } → ${data.newStatus}${
        data.notes ? `\n\n📝 *Notes:* ${data.notes}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_SUBMITTED: {
    name: 'attendance_submitted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; date: string; checkInTime: string }) =>
      `🕐 *Check-In Recorded*\n\nHi *${data.employeeName}*,\n\nYour check-in for *${data.date}* has been recorded at *${data.checkInTime}*. Your attendance is pending approval.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_CHECKED_OUT: {
    name: 'attendance_checked_out',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      date: string;
      checkOutTime: string;
      totalHours?: string;
    }) =>
      `🕔 *Check-Out Recorded*\n\nHi *${data.employeeName}*,\n\nYour check-out for *${
        data.date
      }* has been recorded at *${data.checkOutTime}*.${
        data.totalHours ? `\n\n⏱️ *Total Hours:* ${data.totalHours}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_FORCE_CREATED: {
    name: 'attendance_force_created',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      date: string;
      status: string;
      createdByName: string;
    }) =>
      `📋 *Attendance Entry Added*\n\nHi *${data.employeeName}*,\n\nAn attendance entry has been added for *${data.date}* with status *${data.status}* by *${data.createdByName}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ATTENDANCE_ABSENT_MARKED: {
    name: 'attendance_absent_marked',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; date: string }) =>
      `⚠️ *Marked as Absent*\n\nHi *${data.employeeName}*,\n\nYou have been marked *ABSENT* for *${data.date}* as no check-in was recorded.\n\nIf this is incorrect, please contact your manager and ask for regularization.\n\n- *${WHATSAPP_SENDER}*`,
  },

  EXPENSE_SUBMITTED: {
    name: 'expense_submitted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; amount: string; category: string }) =>
      `🧾 *Expense Submitted*\n\nHi *${data.employeeName}*,\n\nYour expense of *${data.amount}* for *${data.category}* has been submitted successfully and is pending approval.\n\n- *${WHATSAPP_SENDER}*`,
  },

  EXPENSE_APPROVED: {
    name: 'expense_approved',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      category: string;
      approverName: string;
      remarks?: string;
    }) =>
      `✅ *Expense Approved*\n\nHi *${data.employeeName}*,\n\nYour expense of *${
        data.amount
      }* for *${data.category}* has been approved by *${data.approverName}*.${
        data.remarks ? `\n\nRemarks: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  EXPENSE_REJECTED: {
    name: 'expense_rejected',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      category: string;
      approverName: string;
      remarks?: string;
    }) =>
      `❌ *Expense Rejected*\n\nHi *${data.employeeName}*,\n\nYour expense of *${
        data.amount
      }* for *${data.category}* has been rejected by *${data.approverName}*.${
        data.remarks ? `\n\nReason: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  EXPENSE_FORCE_CREATED: {
    name: 'expense_force_created',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      category: string;
      createdByName: string;
    }) =>
      `🧾 *Expense Entry Added*\n\nHi *${data.employeeName}*,\n\nAn expense of *${data.amount}* for *${data.category}* has been added for you by *${data.createdByName}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FUEL_EXPENSE_SUBMITTED: {
    name: 'fuel_expense_submitted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; amount: string; vehicleNumber: string }) =>
      `⛽ *Fuel Expense Submitted*\n\nHi *${data.employeeName}*,\n\nYour fuel expense of *${data.amount}* for vehicle *${data.vehicleNumber}* has been submitted successfully and is pending approval.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FUEL_EXPENSE_REIMBURSED: {
    name: 'fuel_expense_reimbursed',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; amount: string; processedBy: string }) =>
      `💰 *Fuel Expense Reimbursed*\n\nHi *${data.employeeName}*,\n\nYour fuel expense settlement of *${data.amount}* has been processed by *${data.processedBy}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FUEL_EXPENSE_FORCE_CREATED: {
    name: 'fuel_expense_force_created',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
      createdByName: string;
    }) =>
      `⛽ *Fuel Expense Entry Added*\n\nHi *${data.employeeName}*,\n\nA fuel expense of *${data.amount}* for vehicle *${data.vehicleNumber}* has been added for you by *${data.createdByName}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FUEL_EXPENSE_APPROVED: {
    name: 'fuel_expense_approved',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
      approverName: string;
      remarks?: string;
    }) =>
      `✅ *Fuel Expense Approved*\n\nHi *${data.employeeName}*,\n\nYour fuel expense of *${
        data.amount
      }* for vehicle *${data.vehicleNumber}* has been approved by *${data.approverName}*.${
        data.remarks ? `\n\nRemarks: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  FUEL_EXPENSE_REJECTED: {
    name: 'fuel_expense_rejected',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      vehicleNumber: string;
      approverName: string;
      remarks?: string;
    }) =>
      `❌ *Fuel Expense Rejected*\n\nHi *${data.employeeName}*,\n\nYour fuel expense of *${
        data.amount
      }* for vehicle *${data.vehicleNumber}* has been rejected by *${data.approverName}*.${
        data.remarks ? `\n\nReason: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_APPROVED: {
    name: 'leave_approved',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
      approverName: string;
      remarks?: string;
    }) =>
      `✅ *Leave Approved*\n\nHi *${data.employeeName}*,\n\nYour *${data.leaveType}* from *${
        data.fromDate
      }* to *${data.toDate}* (*${data.totalDays} days*) has been approved by *${
        data.approverName
      }*.${data.remarks ? `\n\nRemarks: ${data.remarks}` : ''}\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_REJECTED: {
    name: 'leave_rejected',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      approverName: string;
      remarks?: string;
    }) =>
      `❌ *Leave Rejected*\n\nHi *${data.employeeName}*,\n\nYour *${data.leaveType}* from *${
        data.fromDate
      }* to *${data.toDate}* has been rejected by *${data.approverName}*.${
        data.remarks ? `\n\nReason: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_SUBMITTED: {
    name: 'leave_submitted',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
    }) =>
      `📝 *Leave Application Submitted*\n\nHi *${data.employeeName}*,\n\nYour *${data.leaveType}* from *${data.fromDate}* to *${data.toDate}* (*${data.totalDays} day(s)*) has been submitted and is pending approval.\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_CANCELLED: {
    name: 'leave_cancelled',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      cancelledByName: string;
      remarks?: string;
    }) =>
      `🚫 *Leave Cancelled*\n\nHi *${data.employeeName}*,\n\nYour *${data.leaveType}* from *${
        data.fromDate
      }* to *${data.toDate}* has been cancelled by *${data.cancelledByName}*.${
        data.remarks ? `\n\nReason: ${data.remarks}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_FORCE_APPLIED: {
    name: 'leave_force_applied',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      totalDays: string;
      appliedByName: string;
      reason?: string;
    }) =>
      `📋 *Leave Applied on Your Behalf*\n\nHi *${data.employeeName}*,\n\n*${
        data.leaveType
      }* from *${data.fromDate}* to *${data.toDate}* (*${
        data.totalDays
      } day(s)*) has been applied for you by *${data.appliedByName}*.${
        data.reason ? `\n\nReason: ${data.reason}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  LEAVE_BALANCE_CREDITED: {
    name: 'leave_balance_credited',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      leaveCategory: string;
      credited: string;
      total: string;
      month: string;
    }) =>
      `✅ *Leave Balance Credited*\n\nHi *${data.employeeName}*,\n\n*${data.credited} day(s)* of *${data.leaveCategory}* have been credited for *${data.month}*.\n\n📊 *Total Balance:* ${data.total} days\n\n- *${WHATSAPP_SENDER}*`,
  },

  WELCOME_EMPLOYEE: {
    name: 'welcome_employee',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      email: string;
      tempPassword: string;
      employeeId: string;
      loginUrl: string;
    }) =>
      `🎉 *Welcome to Eureka HRMS!*\n\nHi *${data.employeeName}*,\n\nYour account has been created. Here are your login details:\n\n📧 Email: *${data.email}*\n🔑 Password: *${data.tempPassword}*\n🆔 Employee ID: *${data.employeeId}*\n\nPlease login at ${data.loginUrl} and change your password.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FORGET_PASSWORD: {
    name: 'forget_password',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; resetLink: string }) =>
      `🔒 *Password Reset Request*\n\nHi *${data.employeeName}*,\n\nA password reset was requested for your account. Click the link below to reset your password:\n\n${data.resetLink}\n\nIf you didn't request this, please ignore this message.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_HANDOVER_INITIATED: {
    name: 'asset_handover_initiated',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; assetId: string; actorName: string }) =>
      `📦 *Asset Handover Initiated*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has initiated a handover for asset *${data.assetId}* to you.\n\nPlease accept or reject it from the portal.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_HANDOVER_ACCEPTED: {
    name: 'asset_handover_accepted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; assetId: string; actorName: string }) =>
      `✅ *Asset Handover Accepted*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has accepted the handover for asset *${data.assetId}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_HANDOVER_REJECTED: {
    name: 'asset_handover_rejected',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; assetId: string; actorName: string }) =>
      `❌ *Asset Handover Rejected*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has rejected the handover for asset *${data.assetId}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_HANDOVER_CANCELLED: {
    name: 'asset_handover_cancelled',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; assetId: string; actorName: string }) =>
      `🚫 *Asset Handover Cancelled*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has cancelled the handover for asset *${data.assetId}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_DEALLOCATED: {
    name: 'asset_deallocated',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; assetId: string; actorName: string }) =>
      `📤 *Asset Deallocated*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has deallocated asset *${data.assetId}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_LOST: {
    name: 'asset_lost',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      assetId: string;
      assetName: string;
      actorName: string;
      reason: string;
      lastSeenDate: string;
      recoveryAmount?: string;
    }) =>
      `🚨 *Asset Marked as Lost*\n\nHi *${data.employeeName}*,\n\nThe asset *${data.assetName}* (ID: ${data.assetId}) previously assigned to you has been marked as lost by *${data.actorName}*.\n\n📝 *Reason:* ${data.reason}\n📅 *Last seen:* ${data.lastSeenDate}${
        data.recoveryAmount && Number(data.recoveryAmount) > 0
          ? `\n\n💰 *Recovery:* ₹${data.recoveryAmount} has been added to your account as a debit. Please contact HR if you have any concerns.`
          : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  ASSET_RECOVERED: {
    name: 'asset_recovered',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      assetId: string;
      assetName: string;
      actorName: string;
      notes?: string;
      refundedAmount?: string;
    }) =>
      `✅ *Asset Recovered*\n\nHi *${data.employeeName}*,\n\nGood news! The previously lost asset *${data.assetName}* (ID: ${data.assetId}) has been recovered by *${data.actorName}*.${
        data.notes ? `\n\n📝 *Notes:* ${data.notes}` : ''
      }${
        data.refundedAmount && Number(data.refundedAmount) > 0
          ? `\n\n💰 *Refund:* ₹${data.refundedAmount} has been credited back to your account.`
          : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },

  VEHICLE_HANDOVER_INITIATED: {
    name: 'vehicle_handover_initiated',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; vehicleNumber: string; actorName: string }) =>
      `🚗 *Vehicle Handover Initiated*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has initiated a handover for vehicle *${data.vehicleNumber}* to you.\n\nPlease accept or reject it from the portal.\n\n- *${WHATSAPP_SENDER}*`,
  },

  VEHICLE_HANDOVER_ACCEPTED: {
    name: 'vehicle_handover_accepted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; vehicleNumber: string; actorName: string }) =>
      `✅ *Vehicle Handover Accepted*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has accepted the handover for vehicle *${data.vehicleNumber}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  VEHICLE_HANDOVER_REJECTED: {
    name: 'vehicle_handover_rejected',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; vehicleNumber: string; actorName: string }) =>
      `❌ *Vehicle Handover Rejected*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has rejected the handover for vehicle *${data.vehicleNumber}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  VEHICLE_HANDOVER_CANCELLED: {
    name: 'vehicle_handover_cancelled',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; vehicleNumber: string; actorName: string }) =>
      `🚫 *Vehicle Handover Cancelled*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has cancelled the handover for vehicle *${data.vehicleNumber}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  VEHICLE_DEALLOCATED: {
    name: 'vehicle_deallocated',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; vehicleNumber: string; actorName: string }) =>
      `📤 *Vehicle Deallocated*\n\nHi *${data.employeeName}*,\n\n*${data.actorName}* has deallocated vehicle *${data.vehicleNumber}*.\n\n- *${WHATSAPP_SENDER}*`,
  },

  FOOD_EXPENSE_CREDITED: {
    name: 'food_expense_credited',
    contentSid: '',
    sandboxMessage: (data: {
      employeeName: string;
      amount: string;
      date: string;
      creditedFor?: string;
    }) =>
      `🍽️ *Food Allowance Credited*\n\nHi *${data.employeeName}*,\n\nFood allowance of *₹${
        data.amount
      }* has been credited for *${data.date}*.${
        data.creditedFor ? `\n\n👤 *On behalf of:* ${data.creditedFor}` : ''
      }\n\n- *${WHATSAPP_SENDER}*`,
  },
};

export const WHATSAPP_ERRORS = {
  NOT_ENABLED: 'WhatsApp messaging is not enabled',
  INVALID_NUMBER: 'Invalid WhatsApp number',
  USER_NOT_OPTED_IN: 'User has not opted in for WhatsApp notifications',
  SEND_FAILED: 'Failed to send WhatsApp message',
  TWILIO_ERROR: 'Twilio API error',
};

export const WHATSAPP_SUCCESS = {
  MESSAGE_SENT: 'WhatsApp message sent successfully',
  MESSAGE_QUEUED: 'WhatsApp message queued for delivery',
};

export const formatWhatsAppNumber = (phoneNumber: string): string => {
  let cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return `whatsapp:+${cleaned}`;
};

export const isValidWhatsAppNumber = (phoneNumber: string): boolean => {
  if (!phoneNumber) return false;
  const cleaned = phoneNumber.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
};
