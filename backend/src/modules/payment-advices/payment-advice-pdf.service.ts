import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';

export interface PaymentAdvicePdfData {
  referenceNumber: string;
  generatedAt: Date;
  financialYear: string;
  // Vendor
  vendorName: string;
  vendorEmail: string;
  vendorGstNumber: string | null;
  vendorAddress: string | null;
  vendorBankName: string | null;
  vendorAccountNumber: string | null;
  vendorIfscCode: string | null;
  vendorAccountHolderName: string | null;
  // Site / Company
  siteName: string;
  companyName: string;
  // Transfer
  utrNumber: string;
  transferDate: string;
  transferAmount: number;
  // Book Payment
  taxableAmount: number;
  gstAmount: number;
  tdsDeductionAmount: number;
  paymentTotalAmount: number;
}

@Injectable()
export class PaymentAdvicePdfService {
  private readonly logger = new Logger(PaymentAdvicePdfService.name);

  constructor(private readonly filesService: FilesService) {}

  async generate(data: PaymentAdvicePdfData): Promise<string> {
    const html = this.buildHtml(data);
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
        }),
      );

      const key = `payment-advices/${data.financialYear}/${data.referenceNumber.replace(
        /\//g,
        '-',
      )}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return key;
    } catch (err) {
      this.logger.error(`PDF generation failed for ${data.referenceNumber}: ${err}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  private buildHtml(d: PaymentAdvicePdfData): string {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

    const date = (v: Date | string) =>
      new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; background: #fff; }
  .page { padding: 32px; }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a56db; padding-bottom: 16px; margin-bottom: 20px; }
  .company-name { font-size: 20px; font-weight: 700; color: #1a56db; }
  .doc-title { text-align: right; }
  .doc-title h2 { font-size: 16px; font-weight: 700; color: #1a56db; }
  .doc-title .ref { font-size: 13px; color: #374151; margin-top: 4px; }
  .doc-title .date { font-size: 11px; color: #6b7280; margin-top: 2px; }
  /* Section */
  .section { margin-bottom: 18px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  /* Two-col layout */
  .two-col { display: flex; gap: 24px; }
  .two-col > div { flex: 1; }
  /* Info rows */
  .info-row { display: flex; margin-bottom: 4px; }
  .info-label { color: #6b7280; width: 160px; flex-shrink: 0; }
  .info-value { font-weight: 500; }
  /* Table */
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #1a56db; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  .total-row td { background: #eff6ff; font-weight: 700; }
  /* Footer */
  .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 14px; font-size: 10px; color: #9ca3af; text-align: center; }
  .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${d.companyName}</div>
      <div style="color:#6b7280;margin-top:4px;">${d.siteName}</div>
    </div>
    <div class="doc-title">
      <h2>PAYMENT ADVICE</h2>
      <div class="ref">${d.referenceNumber}</div>
      <div class="date">Generated: ${date(d.generatedAt)}</div>
      <div style="margin-top:6px;"><span class="badge">APPROVED</span></div>
    </div>
  </div>

  <!-- Vendor & Transfer Details -->
  <div class="two-col">
    <div class="section">
      <div class="section-title">Vendor Details</div>
      <div class="info-row"><span class="info-label">Name</span><span class="info-value">${
        d.vendorName
      }</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${
        d.vendorEmail
      }</span></div>
      ${
        d.vendorGstNumber
          ? `<div class="info-row"><span class="info-label">GST Number</span><span class="info-value">${d.vendorGstNumber}</span></div>`
          : ''
      }
      ${
        d.vendorAddress
          ? `<div class="info-row"><span class="info-label">Address</span><span class="info-value">${d.vendorAddress}</span></div>`
          : ''
      }
    </div>
    <div class="section">
      <div class="section-title">Bank Details</div>
      ${
        d.vendorBankName
          ? `<div class="info-row"><span class="info-label">Bank</span><span class="info-value">${d.vendorBankName}</span></div>`
          : '<div style="color:#9ca3af;">Not provided</div>'
      }
      ${
        d.vendorAccountNumber
          ? `<div class="info-row"><span class="info-label">Account No.</span><span class="info-value">${d.vendorAccountNumber}</span></div>`
          : ''
      }
      ${
        d.vendorIfscCode
          ? `<div class="info-row"><span class="info-label">IFSC Code</span><span class="info-value">${d.vendorIfscCode}</span></div>`
          : ''
      }
      ${
        d.vendorAccountHolderName
          ? `<div class="info-row"><span class="info-label">Account Holder</span><span class="info-value">${d.vendorAccountHolderName}</span></div>`
          : ''
      }
    </div>
  </div>

  <!-- Transfer Info -->
  <div class="section">
    <div class="section-title">Transfer Details</div>
    <div class="two-col">
      <div>
        <div class="info-row"><span class="info-label">UTR Number</span><span class="info-value">${
          d.utrNumber
        }</span></div>
        <div class="info-row"><span class="info-label">Transfer Date</span><span class="info-value">${date(
          d.transferDate,
        )}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Financial Year</span><span class="info-value">FY ${d.financialYear.slice(
          0,
          2,
        )}-${d.financialYear.slice(2)}</span></div>
      </div>
    </div>
  </div>

  <!-- Amount Breakdown -->
  <div class="section">
    <div class="section-title">Payment Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Taxable Amount</td><td class="text-right">${fmt(d.taxableAmount)}</td></tr>
        <tr><td>GST Deducted</td><td class="text-right">- ${fmt(d.gstAmount)}</td></tr>
        <tr><td>TDS Deducted</td><td class="text-right">- ${fmt(d.tdsDeductionAmount)}</td></tr>
        <tr class="total-row"><td>Net Payment Amount</td><td class="text-right">${fmt(
          d.paymentTotalAmount,
        )}</td></tr>
        <tr class="total-row"><td>Amount Transferred (UTR: ${
          d.utrNumber
        })</td><td class="text-right">${fmt(d.transferAmount)}</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    This is a system-generated Payment Advice. Reference: ${d.referenceNumber} | ${d.companyName}
  </div>

</div>
</body>
</html>`;
  }
}
