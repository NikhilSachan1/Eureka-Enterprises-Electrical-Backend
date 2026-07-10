import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { PaymentSheetRepository } from './payment-sheet.repository';
import { PaymentSheetEntity } from './entities/payment-sheet.entity';
import { PaymentSheetItemEntity } from './entities/payment-sheet-item.entity';
import { PaymentSheetStatus, PaymentSheetItemStatus } from './constants/payment-sheet.constants';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';

type SheetDetail = PaymentSheetEntity & { items: PaymentSheetItemEntity[] };

interface GenerateOpts {
  keySuffix?: string;
  filterLabel?: string;
}

@Injectable()
export class PaymentSheetPdfService {
  private readonly logger = new Logger(PaymentSheetPdfService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly repo: PaymentSheetRepository,
  ) {}

  /** Full-sheet PDF: returns an existing pdfKey when final, else generates + caches it. */
  async ensurePdf(detail: SheetDetail): Promise<string> {
    const isFinal = detail.status === PaymentSheetStatus.COMPLETED;
    if (detail.pdfKey && isFinal) return detail.pdfKey;
    const key = await this.generate(detail, detail.items ?? []);
    await this.repo.updateSheet({ id: detail.id }, { pdfKey: key });
    return key;
  }

  /** Filtered PDF (e.g. vendor-only): always regenerated, distinct key, never cached on the sheet. */
  async generateVariant(
    detail: SheetDetail,
    items: PaymentSheetItemEntity[],
    keySuffix: string,
    filterLabel: string,
  ): Promise<string> {
    return this.generate(detail, items, { keySuffix, filterLabel });
  }

  async getDownloadUrl(key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }

  private money(n: number | null | undefined): string {
    return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  private esc(s: unknown): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private fmtDate(v: Date | string | null | undefined): string {
    if (!v) return '—';
    return new Date(v).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private fmtFy(fy: string | null | undefined): string {
    if (!fy || fy.length !== 4) return this.esc(fy ?? '—');
    return `FY ${fy.slice(0, 2)}-${fy.slice(2)}`;
  }

  // ─── Fetch a URL and return it as a base64 data URI (for the company logo) ───
  private fetchUrlAsBase64(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, (res) => {
          const chunks: Uint8Array[] = [];
          res.on('data', (c: Uint8Array) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] ?? 'image/jpeg';
            resolve(`data:${contentType};base64,${buf.toString('base64')}`);
          });
        })
        .on('error', () => resolve(null));
    });
  }

  /** Human beneficiary label — real name from the enriched user/vendor, falling back to the bank snapshot. */
  private beneficiaryName(it: any): string {
    if (it.beneficiaryType === 'VENDOR') {
      return this.esc(it.vendor?.name ?? it.bankSnapshot?.accountHolderName ?? '—');
    }
    const name = it.user?.fullName ?? it.bankSnapshot?.accountHolderName ?? '—';
    const emp = it.user?.employeeId ? ` (${this.esc(it.user.employeeId)})` : '';
    return `${this.esc(name)}${emp}`;
  }

  private sourceLabel(sourceType: string): string {
    switch (sourceType) {
      case 'VENDOR_PAYMENT':
        return 'Vendor Payment';
      case 'FUEL_EXPENSE':
        return 'Fuel Expense';
      case 'EXPENSE':
        return 'Expense';
      default:
        return this.esc(sourceType);
    }
  }

  private statusBadge(status: string): string {
    const s = String(status ?? '').toUpperCase();
    const map: Record<string, string> = {
      PENDING: 'badge-pending',
      PAID: 'badge-paid',
      HOLD: 'badge-hold',
      REJECTED: 'badge-rejected',
    };
    const cls = map[s] ?? 'badge-pending';
    return `<span class="badge ${cls}">${this.esc(s || '—')}</span>`;
  }

  /** Bottom-of-sheet approver signature block: OM / HR / Admin / Accountant.
   * Name and Signature are left blank for manual fill-in on the printed sheet. */
  private approverSignatures(): string {
    const approvers = ['Operation Manager', 'HR', 'Admin', 'Accountant'];
    const rows = approvers
      .map(
        (label) => `
        <tr>
          <td class="role">${this.esc(label)}</td>
          <td class="name"></td>
          <td class="sig"></td>
          <td class="date"></td>
        </tr>`,
      )
      .join('');
    return `
      <div class="sign-wrap">
        <div class="section-label">Approvals &amp; Signatures</div>
        <table class="sign">
          <thead>
            <tr><th style="width:22%">Approver</th><th style="width:30%">Name</th><th style="width:30%">Signature</th><th style="width:18%">Date</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  private buildHtml(
    detail: SheetDetail,
    items: PaymentSheetItemEntity[],
    filterLabel: string | undefined,
    logoBase64: string | null,
  ): string {
    const rows = items
      .map((it: any, idx) => {
        const bank = it.bankSnapshot;
        const kind = it.beneficiaryType === 'VENDOR' ? 'Vendor' : 'Employee';
        return `
          <tr>
            <td class="c">${idx + 1}</td>
            <td>
              <div class="bene-name">${this.beneficiaryName(it)}</div>
              <div class="muted">${kind}</div>
            </td>
            <td>${this.sourceLabel(it.sourceType)}</td>
            <td>
              <div>${this.esc(bank?.accountHolderName ?? '—')}</div>
              <div class="muted">${this.esc(bank?.bankName ?? '')}${
          bank?.accountNumber ? ' · ' + this.esc(bank.accountNumber) : ''
        }</div>
              <div class="muted">${this.esc(bank?.ifscCode ?? '')}</div>
            </td>
            <td class="r strong">${this.money(Number(it.currentAmount))}</td>
            <td class="c">${this.statusBadge(it.itemStatus)}</td>
            <td class="r">${it.paidAmount != null ? this.money(Number(it.paidAmount)) : '—'}</td>
          </tr>`;
      })
      .join('');

    // Totals computed from the rendered items, so filtered exports get a correct subtotal.
    const activeItems = items.filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED);
    const totalCurrent = activeItems.reduce((s, i) => s + Number(i.currentAmount), 0);
    const totalPaid = items.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
    const totalsLabel = filterLabel ? 'Subtotal' : 'Total Payable';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { padding: 4px 2px; }

  /* ── Header ──────────────────────────────────────────── */
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 12px; margin-bottom: 4px; }
  .header-logo img { height: 56px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 18px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-gst { font-size: 10px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 15px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 11px; color: #666; margin-top: 2px; }

  /* ── Info + summary band ─────────────────────────────── */
  .band { display: flex; gap: 16px; margin: 14px 0 6px; }
  .info-block { flex: 1; border: 1px solid #e2e6ec; border-radius: 6px; padding: 10px 12px; }
  .info-block table { width: 100%; border-collapse: collapse; }
  .info-block td { padding: 3px 0; vertical-align: top; border: none; }
  .info-block .lbl { color: #6b7280; white-space: nowrap; width: 46%; }
  .info-block .val { color: #111; font-weight: 600; }

  .filter-note { display:inline-block; margin: 6px 0 2px; padding: 3px 12px; border-radius: 12px; background:#eef3fb; color:#1f3a5f; font-size:10px; font-weight:600; }

  /* ── Summary cards ───────────────────────────────────── */
  .cards { display: flex; gap: 10px; margin: 12px 0 4px; }
  .card { flex: 1; border: 1px solid #e2e6ec; border-radius: 6px; padding: 10px 12px; background: #f8fafc; }
  .card .card-lbl { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .card .card-val { font-size: 15px; font-weight: bold; color: #1f3a5f; margin-top: 4px; }
  .card.paid .card-val { color: #15803d; }

  /* ── Items table ─────────────────────────────────────── */
  .section-label { font-weight: bold; font-size: 11px; color: #1f3a5f; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.items thead th { background: #1f3a5f; color: #fff; padding: 8px 8px; text-align: left; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { border-bottom: 1px solid #e8ebef; padding: 7px 8px; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  table.items .bene-name { font-weight: 600; color: #111; }
  table.items .muted { color: #6b7280; font-size: 9px; margin-top: 1px; }
  table.items .strong { font-weight: bold; }
  table.items tfoot td { border-top: 2px solid #1f3a5f; padding: 9px 8px; font-weight: bold; background: #eef3fb; color: #1f3a5f; font-size: 11px; }

  /* ── Status badges ───────────────────────────────────── */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8.5px; font-weight: 700; letter-spacing: 0.3px; }
  .badge-pending { background: #eef1f5; color: #4b5563; }
  .badge-paid { background: #dcfce7; color: #15803d; }
  .badge-hold { background: #ffedd5; color: #c2410c; }
  .badge-rejected { background: #fee2e2; color: #b91c1c; }

  .empty { text-align: center; color: #9ca3af; padding: 24px; font-style: italic; }

  /* ── Approver signatures ─────────────────────────────── */
  .sign-wrap { margin-top: 22px; page-break-inside: avoid; }
  table.sign { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.sign th { background: #eef3fb; color: #1f3a5f; text-align: left; padding: 7px 10px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #d7deea; }
  table.sign td { border: 1px solid #d7deea; padding: 10px; vertical-align: bottom; }
  table.sign td.role { font-weight: 600; color: #1f3a5f; }
  table.sign td.name, table.sign td.sig, table.sign td.date { height: 46px; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="logo"/></div>` : ''}
    <div class="header-details">
      <div class="company">${this.esc(PAYMENT_ADVICE_COMPANY_DETAILS.NAME)}</div>
      <div class="company-gst">GSTIN: ${this.esc(PAYMENT_ADVICE_COMPANY_DETAILS.GSTIN)}</div>
    </div>
    <div class="doc-badge">
      <div class="doc-title">PAYMENT SHEET</div>
      <div class="doc-sub">${this.esc(detail.sheetNumber)}</div>
    </div>
  </div>

  ${filterLabel ? `<div class="filter-note">Filtered view: ${this.esc(filterLabel)}</div>` : ''}

  <!-- Info band -->
  <div class="band">
    <div class="info-block">
      <table>
        <tr><td class="lbl">Sheet Number</td><td class="val">${this.esc(
          detail.sheetNumber,
        )}</td></tr>
        <tr><td class="lbl">Title</td><td class="val">${this.esc(detail.title ?? '—')}</td></tr>
        <tr><td class="lbl">Financial Year</td><td class="val">${this.fmtFy(
          detail.financialYear,
        )}</td></tr>
      </table>
    </div>
    <div class="info-block">
      <table>
        <tr><td class="lbl">Status</td><td class="val">${this.esc(detail.status)}</td></tr>
        <tr><td class="lbl">Current Stage</td><td class="val">${this.esc(
          detail.currentStage ?? '—',
        )}</td></tr>
        <tr><td class="lbl">Created On</td><td class="val">${this.fmtDate(
          (detail as any).createdAt,
        )}</td></tr>
      </table>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="cards">
    <div class="card"><div class="card-lbl">Line Items</div><div class="card-val">${
      activeItems.length
    }</div></div>
    <div class="card"><div class="card-lbl">${totalsLabel}</div><div class="card-val">${this.money(
      totalCurrent,
    )}</div></div>
    <div class="card paid"><div class="card-lbl">Total Paid</div><div class="card-val">${this.money(
      totalPaid,
    )}</div></div>
  </div>

  <!-- Items -->
  <div class="section-label">Beneficiaries</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:26px">#</th>
        <th>Beneficiary</th>
        <th>Source</th>
        <th>Bank Account</th>
        <th class="r">Amount</th>
        <th class="c">Status</th>
        <th class="r">Paid</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" class="empty">No line items</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="r">${totalsLabel}</td>
        <td class="r">${this.money(totalCurrent)}</td>
        <td></td>
        <td class="r">${this.money(totalPaid)}</td>
      </tr>
    </tfoot>
  </table>

  ${this.approverSignatures()}

</div>
</body>
</html>`;
  }

  private footerTemplate(): string {
    const generated = this.fmtDate(new Date());
    return `
      <div style="width:100%; font-family: Arial, Helvetica, sans-serif; font-size:8px; color:#9ca3af; padding:0 30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e6ec; padding-top:4px;">
          <span>${PAYMENT_ADVICE_COMPANY_DETAILS.NAME} · System generated payment sheet · Generated ${generated}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }

  private async generate(
    detail: SheetDetail,
    items: PaymentSheetItemEntity[],
    opts: GenerateOpts = {},
  ): Promise<string> {
    const logoBase64 = await this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(
      () => null,
    );
    const html = this.buildHtml(detail, items, opts.filterLabel, logoBase64);
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--disable-features=VizDisplayCompositor',
        ],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: this.footerTemplate(),
          margin: { top: '24px', bottom: '48px', left: '30px', right: '30px' },
        }),
      );
      const base = `payment-sheets/${detail.financialYear}/${detail.sheetNumber.replace(
        /\//g,
        '-',
      )}`;
      const key = opts.keySuffix ? `${base}-${opts.keySuffix}.pdf` : `${base}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return key;
    } catch (err) {
      this.logger.error(`Payment sheet PDF generation failed for ${detail.sheetNumber}: ${err}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }
}
