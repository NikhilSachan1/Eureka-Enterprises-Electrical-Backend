export const WHATSAPP_SENDER = 'Eureka HRMS';

// Template keys - use these instead of hardcoding strings
export const WHATSAPP_TEMPLATE_KEYS = {
  ATTENDANCE_APPROVED: 'ATTENDANCE_APPROVED',
  ATTENDANCE_REJECTED: 'ATTENDANCE_REJECTED',
  ATTENDANCE_REGULARIZED: 'ATTENDANCE_REGULARIZED',
  EXPENSE_SUBMITTED: 'EXPENSE_SUBMITTED',
  EXPENSE_APPROVED: 'EXPENSE_APPROVED',
  EXPENSE_REJECTED: 'EXPENSE_REJECTED',
  FUEL_EXPENSE_SUBMITTED: 'FUEL_EXPENSE_SUBMITTED',
  FUEL_EXPENSE_APPROVED: 'FUEL_EXPENSE_APPROVED',
  FUEL_EXPENSE_REJECTED: 'FUEL_EXPENSE_REJECTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  WELCOME_EMPLOYEE: 'WELCOME_EMPLOYEE',
  FORGET_PASSWORD: 'FORGET_PASSWORD',
  ASSET_HANDOVER_INITIATED: 'ASSET_HANDOVER_INITIATED',
  ASSET_HANDOVER_ACCEPTED: 'ASSET_HANDOVER_ACCEPTED',
  ASSET_HANDOVER_REJECTED: 'ASSET_HANDOVER_REJECTED',
  ASSET_HANDOVER_CANCELLED: 'ASSET_HANDOVER_CANCELLED',
  ASSET_DEALLOCATED: 'ASSET_DEALLOCATED',
  VEHICLE_HANDOVER_INITIATED: 'VEHICLE_HANDOVER_INITIATED',
  VEHICLE_HANDOVER_ACCEPTED: 'VEHICLE_HANDOVER_ACCEPTED',
  VEHICLE_HANDOVER_REJECTED: 'VEHICLE_HANDOVER_REJECTED',
  VEHICLE_HANDOVER_CANCELLED: 'VEHICLE_HANDOVER_CANCELLED',
  VEHICLE_DEALLOCATED: 'VEHICLE_DEALLOCATED',
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

  FUEL_EXPENSE_SUBMITTED: {
    name: 'fuel_expense_submitted',
    contentSid: '',
    sandboxMessage: (data: { employeeName: string; amount: string; vehicleNumber: string }) =>
      `⛽ *Fuel Expense Submitted*\n\nHi *${data.employeeName}*,\n\nYour fuel expense of *${data.amount}* for vehicle *${data.vehicleNumber}* has been submitted successfully and is pending approval.\n\n- *${WHATSAPP_SENDER}*`,
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
