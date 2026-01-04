import { ExperienceLetterData } from '../fnf.types';

export const getExperienceLetterTemplate = (data: ExperienceLetterData): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Experience Certificate</title>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Source Sans Pro', 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.7;
      color: #2c3e50;
      padding: 30px 45px;
      background: #fff;
    }
    
    .letterhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 15px;
      border-bottom: 2px solid #1a3a5c;
      margin-bottom: 20px;
    }
    
    .company-info {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .company-logo {
      max-width: 80px;
      max-height: 60px;
    }
    
    .company-details {
      border-left: 2px solid #1a3a5c;
      padding-left: 20px;
    }
    
    .company-name {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #1a3a5c;
      letter-spacing: 0.5px;
    }
    
    .company-address {
      font-size: 11px;
      color: #5a6c7d;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }
    
    .document-meta {
      text-align: right;
      font-size: 12px;
      color: #5a6c7d;
    }
    
    .document-meta div {
      margin-bottom: 4px;
    }
    
    .document-meta strong {
      color: #1a3a5c;
    }
    
    .title {
      text-align: center;
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 16px;
      font-weight: 700;
      color: #1a3a5c;
      margin: 18px 0 22px 0;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .title::after {
      content: '';
      display: block;
      width: 50px;
      height: 2px;
      background: #1a3a5c;
      margin: 8px auto 0;
    }
    
    .salutation {
      font-weight: 600;
      color: #1a3a5c;
      margin-bottom: 15px;
      font-size: 13px;
    }
    
    .content {
      text-align: justify;
    }
    
    .content p {
      margin-bottom: 12px;
    }
    
    .content strong {
      color: #1a3a5c;
      font-weight: 600;
    }
    
    .employee-details {
      margin: 15px 0;
      padding: 0 15px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 5px;
      font-size: 12px;
    }
    
    .detail-label {
      width: 160px;
      color: #5a6c7d;
      font-weight: 600;
    }
    
    .detail-value {
      color: #2c3e50;
      font-weight: 400;
    }
    
    .detail-value.highlight {
      font-weight: 700;
      color: #1a3a5c;
    }
    
    .wishes {
      margin-top: 15px;
      font-style: italic;
      color: #3d5a73;
    }
    
    .footer {
      margin-top: 35px;
    }
    
    .for-company {
      font-weight: 600;
      color: #1a3a5c;
      margin-bottom: 45px;
    }
    
    .signature-block {
      width: 220px;
    }
    
    .signature-line {
      border-top: 1px solid #1a3a5c;
      margin-bottom: 8px;
    }
    
    .signatory-name {
      font-weight: 700;
      color: #1a3a5c;
      font-size: 13px;
    }
    
    .signatory-title {
      font-size: 11px;
      color: #5a6c7d;
      margin-top: 2px;
    }
    
    .watermark {
      position: fixed;
      bottom: 30px;
      right: 30px;
      font-size: 9px;
      color: #c0c8d0;
      letter-spacing: 0.5px;
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
      <div><strong>Date:</strong> ${data.letterDate}</div>
    </div>
  </div>
  
  <div class="title">Experience Certificate</div>
  
  <div class="content">
    <p class="salutation">To Whomsoever It May Concern,</p>
    
    <p>
      This is to certify that <strong>${data.employeeName}</strong> (Employee ID: <strong>${
    data.employeeId
  }</strong>) 
      was employed with <strong>${data.companyName}</strong> from <strong>${
    data.dateOfJoining
  }</strong> 
      to <strong>${data.lastWorkingDate}</strong>, serving as <strong>${data.designation}</strong>${
    data.department ? ` in the <strong>${data.department}</strong> department` : ''
  }.
    </p>
    
    <div class="employee-details">
      <div class="detail-row">
        <span class="detail-label">Employee Name</span>
        <span class="detail-value highlight">${data.employeeName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Employee ID</span>
        <span class="detail-value">${data.employeeId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Designation</span>
        <span class="detail-value">${data.designation}</span>
      </div>
      ${
        data.department
          ? `
      <div class="detail-row">
        <span class="detail-label">Department</span>
        <span class="detail-value">${data.department}</span>
      </div>
      `
          : ''
      }
      <div class="detail-row">
        <span class="detail-label">Period of Employment</span>
        <span class="detail-value">${data.dateOfJoining} to ${data.lastWorkingDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total Experience</span>
        <span class="detail-value highlight">${data.totalExperience}</span>
      </div>
    </div>
    
    <p>
      During the tenure with our organization, ${
        data.employeeName.split(' ')[0]
      } demonstrated exemplary 
      work ethic, professional competence, and a positive attitude. ${
        data.employeeName.split(' ')[0]
      } 
      consistently met performance expectations and contributed significantly to team objectives.
    </p>
    
    <p>
      The ability to work collaboratively with colleagues and stakeholders was commendable. We found 
      ${data.employeeName.split(' ')[0]} to be honest, sincere, hardworking, and dedicated towards 
      assigned responsibilities. The overall conduct and behavior during employment with us was 
      satisfactory and professional.
    </p>
    
    <p class="wishes">
      We wish ${
        data.employeeName.split(' ')[0]
      } all the very best for future professional endeavors 
      and are confident that the skills and experience gained here will prove valuable in upcoming challenges.
    </p>
  </div>
  
  <div class="footer">
    <div class="for-company">For ${data.companyName}</div>
    
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signatory-name">Authorized Signatory</div>
      <div class="signatory-title">Human Resources Department</div>
    </div>
  </div>
  
  <div class="watermark">This is a computer-generated document</div>
</body>
</html>
`;
};
