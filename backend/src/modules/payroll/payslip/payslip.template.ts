import { PayslipData } from './payslip.types';

export const generatePayslipHTML = (data: PayslipData): string => {
  const { company, employee, payPeriod, attendance, earnings, deductions, summary, leaveBalance } =
    data;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate paid days (present + paid leaves)
  const paidDays = attendance.paidDays || attendance.presentDays + attendance.paidLeaves;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${payPeriod.monthName} ${payPeriod.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f1f5f9;
      padding: 20px;
      color: #1e293b;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .payslip-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    
    /* Header Section - Keep as is */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      padding: 28px 32px;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .header-content {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .company-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .company-logo {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .company-details h1 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .company-details p {
      font-size: 11px;
      opacity: 0.8;
      line-height: 1.4;
    }
    
    .payslip-title {
      text-align: right;
    }
    
    .payslip-title p {
      font-size: 11px;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .payslip-title h2 {
      font-size: 22px;
      font-weight: 700;
      color: #90cdf4;
    }
    
    /* Employee Summary Section */
    .summary-section {
      padding: 24px 32px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 200px;
      gap: 24px;
      align-items: start;
    }
    
    .employee-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px 24px;
    }
    
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .detail-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
    }
    
    .detail-value {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .net-pay-card {
      background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .net-pay-card p {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    
    .net-pay-card h3 {
      font-size: 24px;
      font-weight: 700;
    }
    
    .attendance-row {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    
    .attendance-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .attendance-item .label {
      font-size: 11px;
      color: #64748b;
    }
    
    .attendance-item .value {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    
    /* Salary Breakdown Section */
    .salary-section {
      padding: 24px 32px;
    }
    
    .section-header {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .salary-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .salary-table-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    
    .salary-column h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      margin-bottom: 8px;
      border-radius: 6px;
      font-weight: 600;
    }
    
    .salary-column.earnings h4 {
      background: #ecfdf5;
      color: #047857;
    }
    
    .salary-column.deductions h4 {
      background: #fef2f2;
      color: #dc2626;
    }
    
    .salary-items {
      display: flex;
      flex-direction: column;
    }
    
    .salary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .salary-item:last-child {
      border-bottom: none;
    }
    
    .salary-item .label {
      color: #475569;
      font-size: 12px;
    }
    
    .salary-item .amount {
      font-weight: 600;
      color: #1e293b;
      font-size: 12px;
    }
    
    .salary-total {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      margin-top: 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
    }
    
    .earnings .salary-total {
      background: #d1fae5;
      color: #047857;
    }
    
    .deductions .salary-total {
      background: #fecaca;
      color: #dc2626;
    }
    
    /* Net Pay Summary */
    .net-summary {
      margin-top: 24px;
      padding: 20px;
      background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
      border-radius: 10px;
      color: white;
    }
    
    .net-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .net-summary-row .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }
    
    .net-summary-row .amount {
      font-size: 28px;
      font-weight: 700;
    }
    
    .net-summary-words {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 8px;
      font-style: italic;
    }
    
    .holiday-credit {
      display: inline-block;
      margin-top: 12px;
      padding: 6px 12px;
      background: rgba(255,255,255,0.15);
      border-radius: 6px;
      font-size: 11px;
    }
    
    /* Leave Balance Section */
    .leave-section {
      padding: 20px 32px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    
    .leave-grid {
      display: flex;
      gap: 32px;
    }
    
    .leave-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .leave-item .type {
      font-size: 11px;
      color: #64748b;
    }
    
    .leave-item .count {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    /* Footer */
    .footer {
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
    }
    
    .footer-note {
      max-width: 400px;
      line-height: 1.5;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .payslip-container {
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="company-info">
          <img class="company-logo" src="https://5.imimg.com/data5/AY/VX/BQ/SELLER-107173792/vvv-120x120.jpeg" alt="Eureka Enterprises" />
          <div class="company-details">
            <h1>${company.name}</h1>
            <p>${company.address.city}, ${company.address.state} ${company.address.pincode}</p>
          </div>
        </div>
        <div class="payslip-title">
          <p>Payslip For the Month</p>
          <h2>${payPeriod.monthName} ${payPeriod.year}</h2>
        </div>
      </div>
    </div>
    
    <!-- Employee Summary -->
    <div class="summary-section">
      <div class="summary-grid">
        <div>
          <div class="employee-details">
            <div class="detail-item">
              <span class="detail-label">Employee Name</span>
              <span class="detail-value">${employee.name}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Employee ID</span>
              <span class="detail-value">${employee.employeeId}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Designation</span>
              <span class="detail-value">${employee.designation || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date of Joining</span>
              <span class="detail-value">${employee.dateOfJoining || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Pay Period</span>
              <span class="detail-value">${payPeriod.monthName} ${payPeriod.year}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Pay Date</span>
              <span class="detail-value">${payPeriod.payDate || 'N/A'}</span>
            </div>
          </div>
          <div class="attendance-row">
            <div class="attendance-item">
              <span class="label">Paid Days:</span>
              <span class="value">${paidDays}</span>
            </div>
            <div class="attendance-item">
              <span class="label">LOP Days:</span>
              <span class="value">${attendance.lopDays}</span>
            </div>
            <div class="attendance-item">
              <span class="label">Bank A/C:</span>
              <span class="value">${employee.bankAccount || 'N/A'}</span>
            </div>
            ${
              employee.uanNumber
                ? `
            <div class="attendance-item">
              <span class="label">UAN:</span>
              <span class="value">${employee.uanNumber}</span>
            </div>
            `
                : ''
            }
          </div>
        </div>
        <div class="net-pay-card">
          <p>Total Net Pay</p>
          <h3>${formatCurrency(summary.netPayable)}</h3>
        </div>
      </div>
    </div>

    <!-- Leave Balance -->
    ${
      leaveBalance
        ? `
    <div class="leave-section">
      <div class="section-header" style="margin-bottom: 12px;">Leave Balance Available</div>
      <div class="leave-grid">
        ${
          leaveBalance.earned !== undefined
            ? `
        <div class="leave-item">
          <span class="type">Earned Leave:</span>
          <span class="count">${leaveBalance.earned}</span>
        </div>
        `
            : ''
        }
        ${
          leaveBalance.casual !== undefined
            ? `
        <div class="leave-item">
          <span class="type">Casual Leave:</span>
          <span class="count">${leaveBalance.casual}</span>
        </div>
        `
            : ''
        }
        ${
          leaveBalance.total !== undefined
            ? `
        <div class="leave-item">
          <span class="type">Total Available:</span>
          <span class="count">${leaveBalance.total}</span>
        </div>
        `
            : ''
        }
      </div>
    </div>
    `
        : ''
    }
    
    <!-- Salary Breakdown -->
    <div class="salary-section">
      <div class="section-header">Salary Breakdown</div>
      <div class="salary-table-container">
        <div class="salary-column earnings">
          <h4>Earnings</h4>
          <div class="salary-items">
            ${earnings.items
              .map(
                (item) => `
            <div class="salary-item">
              <span class="label">${item.label}</span>
              <span class="amount">${formatCurrency(item.amount)}</span>
            </div>
            `,
              )
              .join('')}
          </div>
          <div class="salary-total">
            <span>Gross Earnings</span>
            <span>${formatCurrency(earnings.total)}</span>
          </div>
        </div>
        
        <div class="salary-column deductions">
          <h4>Deductions</h4>
          <div class="salary-items">
            ${deductions.items
              .map(
                (item) => `
            <div class="salary-item">
              <span class="label">${item.label}</span>
              <span class="amount">${formatCurrency(item.amount)}</span>
            </div>
            `,
              )
              .join('')}
          </div>
          <div class="salary-total">
            <span>Total Deductions</span>
            <span>${formatCurrency(deductions.total)}</span>
          </div>
        </div>
      </div>
      
      <!-- Net Pay Summary -->
      <div class="net-summary">
        <div class="net-summary-row">
          <span class="label">Net Payable Amount</span>
          <span class="amount">${formatCurrency(summary.netPayable)}</span>
        </div>
        <div class="net-summary-words">${summary.netPayableInWords}</div>
        ${
          summary.holidayLeavesCredited && summary.holidayLeavesCredited > 0
            ? `<div class="holiday-credit">🎁 Holiday Leaves Credited: ${summary.holidayLeavesCredited} Day(s)</div>`
            : ''
        }
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-note">
        This is a computer-generated payslip and does not require a signature. 
        For any queries, please contact the HR department.
      </div>
      <div>
        Generated on: <strong>${new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}</strong>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};
