/**
 * Standalone script — generates a sample Payment Advice PDF with dummy data
 * and writes it to /tmp/sample-payment-advice.pdf (or the path in CLI arg).
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/generate-sample-payment-advice')"
 *   or via: ts-node scripts/generate-sample-payment-advice.ts [outputPath]
 */
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

// ─── Inline copy of the build function (so we don't need the DI container) ──
function numberToWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  const toWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] + ' ' : ' ');
    return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? toWords(n % 100) : '');
  };

  const intPart = Math.floor(Math.abs(amount));
  const decPart = Math.round((Math.abs(amount) - intPart) * 100);

  let result = '';
  let n = intPart;

  if (n >= 10_000_000) { result += toWords(Math.floor(n / 10_000_000)).trim() + ' Crore '; n = n % 10_000_000; }
  if (n >= 100_000) { result += toWords(Math.floor(n / 100_000)).trim() + ' Lakh '; n = n % 100_000; }
  if (n >= 1_000) { result += toWords(Math.floor(n / 1_000)).trim() + ' Thousand '; n = n % 1_000; }
  result += toWords(n);

  result = result.trim() || 'Zero';
  if (decPart > 0) result += ' and ' + toWords(decPart).trim() + ' Paise';
  return result + ' Only';
}

function buildHtml(d: {
  referenceNumber: string; generatedAt: Date; financialYear: string;
  vendorName: string; vendorEmail: string; vendorGstNumber: string | null;
  vendorAddress: string | null; vendorCity: string | null;
  vendorBankName: string | null; vendorAccountNumber: string | null;
  vendorIfscCode: string | null; vendorAccountHolderName: string | null;
  siteName: string; companyName: string;
  utrNumber: string; transferDate: string; transferAmount: number;
  taxableAmount: number; gstAmount: number; tdsDeductionAmount: number;
  paymentTotalAmount: number; paymentHoldReason: string | null;
  invoiceNumber: string | null; invoiceDate: string | null; poNumber: string | null;
}): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
  const fmtN = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtDate = (v: Date | string | null | undefined) => {
    if (!v) return '-';
    return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const grossAmount = Number(d.taxableAmount);
  const tdsAmount = Number(d.tdsDeductionAmount);
  const gstAmount = Number(d.gstAmount);
  const netAmount = Number(d.paymentTotalAmount);
  const totalDeduction = tdsAmount;
  const inWords = numberToWords(d.transferAmount);

  const leftRows: string[] = [];
  leftRows.push(`<tr><td class="lbl">Vendor Name</td><td class="sep">:</td><td class="val"><strong>${d.vendorName}</strong></td></tr>`);
  if (d.vendorAddress) leftRows.push(`<tr><td class="lbl">Address</td><td class="sep">:</td><td class="val">${d.vendorAddress}</td></tr>`);
  if (d.vendorCity) leftRows.push(`<tr><td class="lbl">City</td><td class="sep">:</td><td class="val">${d.vendorCity}</td></tr>`);
  if (d.vendorGstNumber) leftRows.push(`<tr><td class="lbl">GST No.</td><td class="sep">:</td><td class="val">${d.vendorGstNumber}</td></tr>`);
  if (d.vendorIfscCode) leftRows.push(`<tr><td class="lbl">Bank IFSC</td><td class="sep">:</td><td class="val">${d.vendorIfscCode}</td></tr>`);
  if (d.vendorAccountNumber) leftRows.push(`<tr><td class="lbl">Bank A/c No.</td><td class="sep">:</td><td class="val">${d.vendorAccountNumber}</td></tr>`);
  if (d.vendorAccountHolderName) leftRows.push(`<tr><td class="lbl">A/c Holder</td><td class="sep">:</td><td class="val">${d.vendorAccountHolderName}</td></tr>`);

  const rightRows: string[] = [];
  rightRows.push(`<tr><td class="lbl">Document No.</td><td class="sep">:</td><td class="val"><strong>${d.referenceNumber}</strong></td></tr>`);
  rightRows.push(`<tr><td class="lbl">Date</td><td class="sep">:</td><td class="val">${fmtDate(d.generatedAt)}</td></tr>`);
  rightRows.push(`<tr><td class="lbl">UTR No.</td><td class="sep">:</td><td class="val">${d.utrNumber}</td></tr>`);
  if (d.poNumber) rightRows.push(`<tr><td class="lbl">PO Number</td><td class="sep">:</td><td class="val">${d.poNumber}</td></tr>`);
  if (d.invoiceNumber) rightRows.push(`<tr><td class="lbl">Vendor Bill No.</td><td class="sep">:</td><td class="val">${d.invoiceNumber}</td></tr>`);
  rightRows.push(`<tr><td class="lbl">Site</td><td class="sep">:</td><td class="val">${d.siteName}</td></tr>`);
  rightRows.push(`<tr><td class="lbl">Financial Year</td><td class="sep">:</td><td class="val">FY ${d.financialYear.slice(0, 2)}-${d.financialYear.slice(2)}</td></tr>`);

  const gstNote = gstAmount > 0
    ? `<p style="font-size:10px;color:#555;margin-top:6px;">Note: GST of ${fmt(gstAmount)} is tracked separately in the GST register.</p>`
    : '';

  const holdReasonHtml = d.paymentHoldReason
    ? `<div class="hold-reason"><strong>Payment Hold Reason:</strong> ${d.paymentHoldReason}</div>`
    : '';

  const deductionTableHtml = tdsAmount > 0 ? `
    <div class="section-label">Deduction Details</div>
    <table>
      <thead>
        <tr>
          <th>Invoice Reference</th>
          <th class="r">Gross Amount (Rs.)</th>
          <th>Deduction Remarks</th>
          <th class="r">TDS / TCS Amount (Rs.)</th>
          <th class="r">Deduction Amount (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${d.invoiceNumber ?? '-'}</td>
          <td class="r">${fmtN(grossAmount)}</td>
          <td>TDS Deduction</td>
          <td class="r">${fmtN(tdsAmount)}</td>
          <td class="r">${fmtN(tdsAmount)}</td>
        </tr>
      </tbody>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }
  .page { padding: 28px 36px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
  .header .company { font-size: 17px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .doc-title { font-size: 13px; font-weight: bold; margin-top: 3px; letter-spacing: 1px; }
  .info-block { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #000; }
  .info-block td { vertical-align: top; padding: 8px 10px; }
  .info-block .divider { border-left: 1px solid #000; width: 1px; padding: 0; }
  .info-cell table { width: 100%; border-collapse: collapse; }
  .info-cell table .lbl { white-space: nowrap; color: #333; padding-bottom: 4px; padding-right: 6px; width: 110px; vertical-align: top; }
  .info-cell table .sep { padding: 0 4px 4px 0; vertical-align: top; }
  .info-cell table .val { padding-bottom: 4px; vertical-align: top; }
  .greeting { margin-bottom: 10px; }
  .payment-msg { margin-bottom: 14px; line-height: 1.6; }
  .amount-highlight { font-weight: bold; }
  .hold-reason { background: #fff8e1; border-left: 3px solid #f59e0b; padding: 8px 10px; margin-bottom: 14px; }
  .section-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
  th { background: #e8e8e8; border: 1px solid #000; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 10px; }
  th.r { text-align: right; }
  td { border: 1px solid #000; padding: 5px 8px; }
  td.r { text-align: right; }
  .footer { margin-top: 24px; }
  .regards { margin-bottom: 36px; line-height: 1.8; }
  .system-note { text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 16px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="company">${d.companyName}</div>
    <div class="doc-title">PAYMENT ADVICE</div>
  </div>
  <table class="info-block">
    <tr>
      <td class="info-cell" style="width:49%">
        <table>${leftRows.join('')}</table>
      </td>
      <td class="divider"></td>
      <td class="info-cell" style="width:49%">
        <table>${rightRows.join('')}</table>
      </td>
    </tr>
  </table>
  <div class="greeting">Dear SIR / MADAM,</div>
  <div class="payment-msg">
    This is to inform you that payment has been released for
    <span class="amount-highlight">${fmt(d.transferAmount)}</span>
    (${inWords}).
  </div>
  ${holdReasonHtml}
  <div class="section-label">Invoice Summary</div>
  <table>
    <thead>
      <tr>
        <th>Invoice Reference</th>
        <th>Invoice Date</th>
        <th class="r">Gross Amount (Rs.)</th>
        <th class="r">Total Deduction (Rs.)</th>
        <th class="r">Net Amount Paid (Rs.)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${d.invoiceNumber ?? '-'}</td>
        <td>${fmtDate(d.invoiceDate)}</td>
        <td class="r">${fmtN(grossAmount)}</td>
        <td class="r">${fmtN(totalDeduction)}</td>
        <td class="r">${fmtN(netAmount)}</td>
      </tr>
    </tbody>
  </table>
  ${gstNote}
  ${deductionTableHtml}
  <div class="footer">
    <div class="regards">
      Thanks and Regards,<br/>
      <strong>${d.companyName}</strong>
    </div>
  </div>
  <div class="system-note">
    This is a system generated document &nbsp;|&nbsp; Reference: ${d.referenceNumber} &nbsp;|&nbsp; Generated: ${fmtDate(d.generatedAt)}
  </div>
</div>
</body>
</html>`;
}

async function main() {
  const outPath = process.argv[2] ?? path.join(process.cwd(), 'sample-payment-advice.pdf');

  const sampleData = {
    referenceNumber: 'EE/TA/2526/001',
    generatedAt: new Date('2025-08-15'),
    financialYear: '2526',
    vendorName: 'M/s Suresh Constructions Pvt. Ltd.',
    vendorEmail: 'accounts@sureshconstructions.com',
    vendorGstNumber: '27AABCS1234D1Z5',
    vendorAddress: 'Plot No. 42, Industrial Estate, Andheri East',
    vendorCity: 'Mumbai',
    vendorBankName: 'HDFC Bank',
    vendorAccountNumber: '50200012345678',
    vendorIfscCode: 'HDFC0001234',
    vendorAccountHolderName: 'Suresh Constructions Pvt Ltd',
    siteName: 'Solar Park Phase-II, Nagpur',
    companyName: 'Eureka Enterprises',
    utrNumber: 'HDFC2508150012345',
    transferDate: '2025-08-15',
    transferAmount: 4_80_000,
    taxableAmount: 5_00_000,
    gstAmount: 0,
    tdsDeductionAmount: 20_000,
    paymentTotalAmount: 4_80_000,
    paymentHoldReason: null,
    invoiceNumber: 'SC/INV/2025-26/047',
    invoiceDate: '2025-08-10',
    poNumber: 'PO/EE/2526/0012',
  };

  console.log('Generating sample Payment Advice PDF...');
  console.log('  Vendor      :', sampleData.vendorName);
  console.log('  Reference   :', sampleData.referenceNumber);
  console.log('  Transfer Amt:', `₹${sampleData.transferAmount.toLocaleString('en-IN')}`);
  console.log('  TDS         :', `₹${sampleData.tdsDeductionAmount.toLocaleString('en-IN')}`);

  const html = buildHtml(sampleData);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '30px', right: '30px' },
    });
    fs.writeFileSync(outPath, pdfBuffer);
    console.log('\n✔  Sample PDF saved to:', outPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
