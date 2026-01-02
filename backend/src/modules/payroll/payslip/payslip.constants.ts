export const PAYSLIP_CONSTANTS = {
  COMPANY: {
    NAME: 'Eureka Enterprises Pvt Ltd',
    ADDRESS: {
      CITY: 'Jhansi',
      STATE: 'Uttar Pradesh',
      PINCODE: '284001',
    },
  },
  ERRORS: {
    PAYROLL_NOT_FOUND: 'Payroll record not found',
    PDF_GENERATION_FAILED: 'Failed to generate payslip PDF',
    EMAIL_SEND_FAILED: 'Failed to send payslip email',
  },
  LOGS: {
    GENERATING: 'Generating payslip for payroll ID: {payrollId}',
    GENERATED: 'Payslip generated successfully for payroll ID: {payrollId}',
    SENDING: 'Sending payslip to email: {email}',
    SENT_SUCCESS: 'Payslip sent successfully to {email} for {monthYear}',
    SENT_FAILED: 'Failed to send payslip to {email}: {error}',
  },
};
