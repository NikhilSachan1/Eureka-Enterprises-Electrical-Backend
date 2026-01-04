import { FnfStatementData } from '../fnf.types';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getFnfStatementTemplate = (data: FnfStatementData): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Full & Final Settlement Statement</title>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Source Sans Pro', 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #2c3e50;
      padding: 25px 35px;
      background: #fff;
    }
    
    .letterhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 2px solid #1a3a5c;
      margin-bottom: 15px;
    }
    
    .company-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .company-logo {
      max-width: 70px;
      max-height: 50px;
    }
    
    .company-details {
      border-left: 2px solid #1a3a5c;
      padding-left: 15px;
    }
    
    .company-name {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 18px;
      font-weight: 700;
      color: #1a3a5c;
      letter-spacing: 0.5px;
    }
    
    .company-address {
      font-size: 10px;
      color: #5a6c7d;
      margin-top: 2px;
    }
    
    .document-meta {
      text-align: right;
      font-size: 10px;
      color: #5a6c7d;
    }
    
    .document-meta div {
      margin-bottom: 3px;
    }
    
    .document-meta strong {
      color: #1a3a5c;
    }
    
    .title {
      text-align: center;
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 14px;
      font-weight: 700;
      color: #1a3a5c;
      margin: 12px 0 15px 0;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .title::after {
      content: '';
      display: block;
      width: 40px;
      height: 2px;
      background: #1a3a5c;
      margin: 6px auto 0;
    }
    
    .employee-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 30px;
      margin-bottom: 15px;
      padding: 12px 15px;
      background: #f8fafb;
      border-left: 3px solid #1a3a5c;
    }
    
    .emp-row {
      display: flex;
      font-size: 11px;
    }
    
    .emp-label {
      width: 130px;
      color: #5a6c7d;
      font-weight: 600;
    }
    
    .emp-value {
      color: #2c3e50;
    }
    
    .emp-value.highlight {
      font-weight: 700;
      color: #1a3a5c;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 12px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #1a3a5c;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #1a3a5c;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .section-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    
    .earnings-icon {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .deductions-icon {
      background: #ffebee;
      color: #c62828;
    }
    
    .statement-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .statement-table th {
      background: #1a3a5c;
      color: white;
      padding: 6px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
    }
    
    .statement-table th:last-child {
      text-align: right;
      width: 100px;
    }
    
    .statement-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e8ecef;
      font-size: 10px;
    }
    
    .statement-table td:last-child {
      text-align: right;
      font-family: 'Source Sans Pro', monospace;
      font-weight: 600;
    }
    
    .statement-table tr:nth-child(even) {
      background: #fafbfc;
    }
    
    .statement-table .subtotal {
      background: #f0f4f7 !important;
    }
    
    .statement-table .subtotal td {
      border-top: 2px solid #1a3a5c;
      font-weight: 700;
      color: #1a3a5c;
    }
    
    .positive {
      color: #2e7d32;
    }
    
    .negative {
      color: #c62828;
    }
    
    .net-payable {
      background: #1a3a5c;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 15px 0;
    }
    
    .net-label {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    
    .net-amount {
      font-size: 20px;
      font-weight: 700;
      font-family: 'Source Sans Pro', monospace;
    }
    
    .remarks {
      padding: 10px 12px;
      background: #fffbf0;
      border-left: 3px solid #f0ad4e;
      margin-bottom: 15px;
      font-size: 10px;
    }
    
    .remarks-title {
      font-weight: 700;
      color: #1a3a5c;
      margin-bottom: 4px;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e8ecef;
    }
    
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
    }
    
    .signature-box {
      text-align: center;
      width: 150px;
    }
    
    .signature-line {
      border-top: 1px solid #1a3a5c;
      margin-bottom: 5px;
    }
    
    .signature-label {
      font-size: 9px;
      color: #5a6c7d;
      font-weight: 600;
    }
    
    .signature-name {
      font-size: 10px;
      color: #2c3e50;
      margin-top: 3px;
    }
    
    .watermark {
      text-align: center;
      font-size: 9px;
      color: #a0aab4;
      margin-top: 15px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="company-info">
      ${
        data.companyLogo
          ? `<img src="${data.companyLogo}" alt="Company Logo" class="company-logo">`
          : ''
      }
      <div class="company-details">
        <div class="company-name">${data.companyName}</div>
        <div class="company-address">${data.companyAddress}</div>
      </div>
    </div>
    <div class="document-meta">
      <div><strong>Ref:</strong> ${data.refNumber}</div>
      <div><strong>Date:</strong> ${data.statementDate}</div>
    </div>
  </div>
  
  <div class="title">Full & Final Settlement Statement</div>
  
  <div class="employee-grid">
    <div class="emp-row">
      <span class="emp-label">Employee Name</span>
      <span class="emp-value highlight">${data.employeeName}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Employee ID</span>
      <span class="emp-value">${data.employeeId}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Designation</span>
      <span class="emp-value">${data.designation}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Department</span>
      <span class="emp-value">${data.department || 'N/A'}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Date of Joining</span>
      <span class="emp-value">${data.dateOfJoining}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Last Working Date</span>
      <span class="emp-value highlight">${data.lastWorkingDate}</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Service Duration</span>
      <span class="emp-value">${data.serviceYears.toFixed(2)} years</span>
    </div>
    <div class="emp-row">
      <span class="emp-label">Bank Account</span>
      <span class="emp-value">${data.bankAccount || 'N/A'}</span>
    </div>
  </div>
  
  <div class="two-column">
    <div>
      <div class="section-title">
        <span class="section-icon earnings-icon">+</span>
        EARNINGS
      </div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Final Salary (${data.daysWorked} days)</td>
            <td class="positive">${formatCurrency(data.finalSalary)}</td>
          </tr>
          ${
            data.encashableLeaves > 0
              ? `
          <tr>
            <td>Leave Encashment (${data.encashableLeaves} days)</td>
            <td class="positive">${formatCurrency(data.leaveEncashmentAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.gratuityAmount > 0
              ? `
          <tr>
            <td>Gratuity (${data.serviceYears.toFixed(1)} yrs)</td>
            <td class="positive">${formatCurrency(data.gratuityAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.pendingExpenseReimbursement > 0
              ? `
          <tr>
            <td>Expense Reimbursement</td>
            <td class="positive">${formatCurrency(data.pendingExpenseReimbursement)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.pendingFuelReimbursement > 0
              ? `
          <tr>
            <td>Fuel Expense Reimbursement</td>
            <td class="positive">${formatCurrency(data.pendingFuelReimbursement)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.pendingReimbursements > 0
              ? `
          <tr>
            <td>Other Reimbursements</td>
            <td class="positive">${formatCurrency(data.pendingReimbursements)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.otherAdditions > 0
              ? `
          <tr>
            <td>Other Additions</td>
            <td class="positive">${formatCurrency(data.otherAdditions)}</td>
          </tr>
          `
              : ''
          }
          <tr class="subtotal">
            <td>Total Earnings</td>
            <td>${formatCurrency(data.totalEarnings)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div>
      <div class="section-title">
        <span class="section-icon deductions-icon">−</span>
        DEDUCTIONS
      </div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Notice Period Recovery${
              data.noticePeriodDays > 0 ? ` (${data.noticePeriodDays} days)` : ''
            }</td>
            <td class="${data.noticePeriodRecovery > 0 ? 'negative' : ''}">${formatCurrency(
    data.noticePeriodRecovery,
  )}</td>
          </tr>
          ${
            data.unsettledExpenseCredit > 0
              ? `
          <tr>
            <td>Unsettled Expense Credit</td>
            <td class="negative">${formatCurrency(data.unsettledExpenseCredit)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.unsettledFuelCredit > 0
              ? `
          <tr>
            <td>Unsettled Fuel Credit</td>
            <td class="negative">${formatCurrency(data.unsettledFuelCredit)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.otherDeductions > 0
              ? `
          <tr>
            <td>Other Deductions</td>
            <td class="negative">${formatCurrency(data.otherDeductions)}</td>
          </tr>
          `
              : ''
          }
          <tr class="subtotal">
            <td>Total Deductions</td>
            <td>${formatCurrency(data.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="net-payable">
    <div class="net-label">NET PAYABLE AMOUNT</div>
    <div class="net-amount">${formatCurrency(data.netPayable)}</div>
  </div>
  
  ${
    data.additionRemarks || data.deductionRemarks
      ? `
  <div class="remarks">
    <div class="remarks-title">Remarks</div>
    ${data.additionRemarks ? `<div><strong>Additions:</strong> ${data.additionRemarks}</div>` : ''}
    ${
      data.deductionRemarks
        ? `<div><strong>Deductions:</strong> ${data.deductionRemarks}</div>`
        : ''
    }
  </div>
  `
      : ''
  }
  
  <div class="footer">
    <div class="signature-grid">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Employee Signature</div>
        <div class="signature-name">${data.employeeName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">HR Department</div>
        <div class="signature-name">Authorized Signatory</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Finance Department</div>
        <div class="signature-name">Authorized Signatory</div>
      </div>
    </div>
  </div>
  
  <div class="watermark">
    This is a computer-generated document. For discrepancies, contact HR within 7 days.
  </div>
</body>
</html>
`;
};
