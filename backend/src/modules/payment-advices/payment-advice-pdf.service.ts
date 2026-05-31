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
  vendorCity: string | null;
  vendorBankName: string | null;
  vendorAccountNumber: string | null;
  vendorIfscCode: string | null;
  vendorAccountHolderName: string | null;
  // Site / Company
  siteName: string;
  companyName: string;
  companyLogoKey?: string | null;
  companyAddress?: string | null;
  companyGstNumber?: string | null;
  // Transfer
  utrNumber: string;
  transferDate: string;
  transferAmount: number;
  // Book Payment
  taxableAmount: number;
  gstAmount: number;
  tdsDeductionAmount: number;
  paymentTotalAmount: number;
  paymentHoldReason: string | null;
  // Invoice / PO references
  invoiceNumber: string | null;
  invoiceDate: string | null;
  poNumber: string | null;
}

@Injectable()
export class PaymentAdvicePdfService {
  private readonly logger = new Logger(PaymentAdvicePdfService.name);

  constructor(private readonly filesService: FilesService) {}

  async generate(data: PaymentAdvicePdfData): Promise<string> {
    let logoBase64: string | null = null;
    if (data.companyLogoKey) {
      try {
        const buf = await this.filesService.getFileContent(data.companyLogoKey);
        const ext = data.companyLogoKey.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        logoBase64 = `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        // logo fetch failed — render without it
      }
    }

    const html = this.buildHtml(data, logoBase64);
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
          margin: { top: '20px', bottom: '20px', left: '30px', right: '30px' },
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

  // ─── Number to words (Indian rupee format) ────────────────────────────────
  private numberToWords(amount: number): string {
    const ones = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    const toWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n] + ' ';
      if (n < 100)
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] + ' ' : ' ');
      return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? toWords(n % 100) : '');
    };

    const intPart = Math.floor(Math.abs(amount));
    const decPart = Math.round((Math.abs(amount) - intPart) * 100);

    let result = '';
    let n = intPart;

    if (n >= 10_000_000) {
      result += toWords(Math.floor(n / 10_000_000)).trim() + ' Crore ';
      n = n % 10_000_000;
    }
    if (n >= 100_000) {
      result += toWords(Math.floor(n / 100_000)).trim() + ' Lakh ';
      n = n % 100_000;
    }
    if (n >= 1_000) {
      result += toWords(Math.floor(n / 1_000)).trim() + ' Thousand ';
      n = n % 1_000;
    }
    result += toWords(n);

    result = result.trim() || 'Zero';

    if (decPart > 0) {
      result += ' and ' + toWords(decPart).trim() + ' Paise';
    }

    return result + ' Only';
  }

  private buildHtml(d: PaymentAdvicePdfData, logoBase64: string | null = null): string {
    // Currency formatter (with ₹ symbol, 2 decimals)
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(n);

    // Number formatter (no symbol, 2 decimals — for table cells)
    const fmtN = (n: number) =>
      new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);

    // Date formatter
    const fmtDate = (v: Date | string | null | undefined) => {
      if (!v) return '-';
      return new Date(v).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    // Amounts used in tables
    const grossAmount = Number(d.taxableAmount);
    const tdsAmount = Number(d.tdsDeductionAmount);
    const gstAmount = Number(d.gstAmount);
    const netAmount = Number(d.paymentTotalAmount);
    const totalDeduction = tdsAmount; // GST tracked separately in GST register, not deducted from payment

    const inWords = this.numberToWords(d.transferAmount);

    // Conditional rows for the left info column
    const leftRows: string[] = [];
    leftRows.push(
      `<tr><td class="lbl">Vendor Name</td><td class="sep">:</td><td class="val"><strong>${d.vendorName}</strong></td></tr>`,
    );
    if (d.vendorAddress) {
      leftRows.push(
        `<tr><td class="lbl">Address</td><td class="sep">:</td><td class="val">${d.vendorAddress}</td></tr>`,
      );
    }
    if (d.vendorCity) {
      leftRows.push(
        `<tr><td class="lbl">City</td><td class="sep">:</td><td class="val">${d.vendorCity}</td></tr>`,
      );
    }
    if (d.vendorGstNumber) {
      leftRows.push(
        `<tr><td class="lbl">GST No.</td><td class="sep">:</td><td class="val">${d.vendorGstNumber}</td></tr>`,
      );
    }
    if (d.vendorIfscCode) {
      leftRows.push(
        `<tr><td class="lbl">Bank IFSC</td><td class="sep">:</td><td class="val">${d.vendorIfscCode}</td></tr>`,
      );
    }
    if (d.vendorAccountNumber) {
      leftRows.push(
        `<tr><td class="lbl">Bank A/c No.</td><td class="sep">:</td><td class="val">${d.vendorAccountNumber}</td></tr>`,
      );
    }
    if (d.vendorAccountHolderName) {
      leftRows.push(
        `<tr><td class="lbl">A/c Holder</td><td class="sep">:</td><td class="val">${d.vendorAccountHolderName}</td></tr>`,
      );
    }

    // Conditional rows for the right info column
    const rightRows: string[] = [];
    rightRows.push(
      `<tr><td class="lbl">Document No.</td><td class="sep">:</td><td class="val"><strong>${d.referenceNumber}</strong></td></tr>`,
    );
    rightRows.push(
      `<tr><td class="lbl">Date</td><td class="sep">:</td><td class="val">${fmtDate(
        d.generatedAt,
      )}</td></tr>`,
    );
    rightRows.push(
      `<tr><td class="lbl">UTR No.</td><td class="sep">:</td><td class="val">${d.utrNumber}</td></tr>`,
    );
    if (d.poNumber) {
      rightRows.push(
        `<tr><td class="lbl">PO Number</td><td class="sep">:</td><td class="val">${d.poNumber}</td></tr>`,
      );
    }
    if (d.invoiceNumber) {
      rightRows.push(
        `<tr><td class="lbl">Vendor Bill No.</td><td class="sep">:</td><td class="val">${d.invoiceNumber}</td></tr>`,
      );
    }
    rightRows.push(
      `<tr><td class="lbl">Site</td><td class="sep">:</td><td class="val">${d.siteName}</td></tr>`,
    );
    rightRows.push(
      `<tr><td class="lbl">Financial Year</td><td class="sep">:</td><td class="val">FY ${d.financialYear.slice(
        0,
        2,
      )}-${d.financialYear.slice(2)}</td></tr>`,
    );

    // GST note (informational — tracked separately)
    const gstNote =
      gstAmount > 0
        ? `<p style="font-size:10px;color:#555;margin-top:6px;">Note: GST of ${fmt(
            gstAmount,
          )} is tracked separately in the GST register.</p>`
        : '';

    // Payment hold reason block
    const holdReasonHtml = d.paymentHoldReason
      ? `<div class="hold-reason"><strong>Payment Hold Reason:</strong> ${d.paymentHoldReason}</div>`
      : '';

    // Deduction details table (only if TDS > 0)
    const deductionTableHtml =
      tdsAmount > 0
        ? `
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
      </table>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }
  .page { padding: 28px 36px; }

  /* ── Header ──────────────────────────────────────────── */
  .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
  .header-inner { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .header-logo { flex-shrink: 0; }
  .header-logo img { height: 52px; width: auto; object-fit: contain; }
  .header-info { flex: 1; }
  .header .company { font-size: 17px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-address { font-size: 10px; color: #444; margin-top: 2px; }
  .header .company-gst { font-size: 10px; color: #444; margin-top: 1px; }
  .header .doc-title { font-size: 13px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-top: 6px; }

  /* ── Info block (two-column layout) ─────────────────── */
  .info-block { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 1px solid #ccc; }
  .info-block td { vertical-align: top; padding: 8px 10px; }
  .info-block .divider { border-left: 1px solid #ddd; width: 1px; padding: 0; }
  .info-cell table { width: 100%; border-collapse: collapse; }
  .info-cell table .lbl { white-space: nowrap; color: #555; padding-bottom: 4px; padding-right: 6px; width: 110px; vertical-align: top; }
  .info-cell table .sep { padding: 0 4px 4px 0; vertical-align: top; color: #555; }
  .info-cell table .val { padding-bottom: 4px; vertical-align: top; }

  /* ── Body text ───────────────────────────────────────── */
  .greeting { margin-bottom: 10px; }
  .payment-msg { margin-bottom: 14px; line-height: 1.6; }
  .amount-highlight { font-weight: bold; }
  .hold-reason { border-left: 3px solid #999; padding: 8px 10px; margin-bottom: 14px; }

  /* ── Section labels ──────────────────────────────────── */
  .section-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-decoration: underline; }

  /* ── Tables ──────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
  th { background: #e8e8e8; border: 1px solid #000; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 10px; }
  th.r { text-align: right; }
  td { border: 1px solid #000; padding: 5px 8px; }
  td.r { text-align: right; }

  /* ── Footer ──────────────────────────────────────────── */
  .footer { margin-top: 24px; }
  .regards { margin-bottom: 36px; line-height: 1.8; }
  .system-note { text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 16px; }
</style>
</head>
<body>
<div class="page">

  <!-- ── Header ─────────────────────────────────────────── -->
  <div class="header">
    <div class="header-inner">
      ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="logo"/></div>` : ''}
      <div class="header-info">
        <div class="company">${d.companyName}</div>
        ${d.companyAddress ? `<div class="company-address">${d.companyAddress}</div>` : ''}
        ${d.companyGstNumber ? `<div class="company-gst">GST: ${d.companyGstNumber}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">PAYMENT ADVICE</div>
  </div>

  <!-- ── Info Block ─────────────────────────────────────── -->
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

  <!-- ── Greeting & Payment Message ────────────────────── -->
  <div class="greeting">Dear SIR / MADAM,</div>
  <div class="payment-msg">
    This is to inform you that payment has been released for
    <span class="amount-highlight">${fmt(d.transferAmount)}</span>
    (${inWords}).
  </div>

  <!-- ── Invoice Summary ───────────────────────────────── -->
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

  ${holdReasonHtml}

  <!-- ── Footer ─────────────────────────────────────────── -->
  <div class="footer">
    <div class="regards">
      Thanks and Regards,<br/>
      <strong>${d.companyName}</strong>
    </div>
  </div>

  <div class="system-note">
    This is a system generated document &nbsp;|&nbsp; Reference: ${
      d.referenceNumber
    } &nbsp;|&nbsp; Generated: ${fmtDate(d.generatedAt)}
  </div>

</div>
</body>
</html>`;
  }
}
