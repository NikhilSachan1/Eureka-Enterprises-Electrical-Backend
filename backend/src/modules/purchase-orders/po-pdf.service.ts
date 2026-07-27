import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { PoItemEntity } from './entities/po-item.entity';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';

type PoDetail = PurchaseOrderEntity & { items?: PoItemEntity[] };

/**
 * System-generated Purchase Order PDF. Always regenerated fresh (never cached) — a PO stays
 * editable until approved, so a stored PDF could go stale. Branding matches the other PDFs.
 */
@Injectable()
export class PoPdfService {
  private readonly logger = new Logger(PoPdfService.name);

  constructor(private readonly filesService: FilesService) {}

  async getDownloadUrl(key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }

  async generate(po: PoDetail): Promise<string> {
    const logoBase64 = await this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(
      () => null,
    );
    const html = this.buildHtml(po, logoBase64);
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
      const safeNumber = String(po.poNumber ?? po.id).replace(/\//g, '-');
      const key = `purchase-orders/${safeNumber}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return key;
    } catch (err) {
      this.logger.error(`PO PDF generation failed for ${po.poNumber ?? po.id}: ${err}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  // ─── helpers ───────────────────────────────────────────
  private esc(s: unknown): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private money(n: number | string | null | undefined): string {
    return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  private qty(n: number | string | null | undefined): string {
    return Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
  }

  private fmtDate(v: Date | string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

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

  private buildHtml(po: PoDetail, logoBase64: string | null): string {
    const vendorName = (po as any).vendor?.name ?? '—';
    const siteName = (po as any).site?.name ?? '—';
    const items = (po.items ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const rows = items
      .map(
        (it, idx) => `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>
            <div class="strong">${this.esc(it.itemName)}</div>
            ${it.make ? `<div class="muted">Make: ${this.esc(it.make)}</div>` : ''}
          </td>
          <td class="c">${this.esc(it.hsnCode ?? '—')}</td>
          <td class="r">${this.qty(it.quantity)}</td>
          <td class="r">${this.money(it.rate)}</td>
          <td class="r strong">${this.money(it.amount)}</td>
        </tr>`,
      )
      .join('');

    const taxable = Number(po.taxableAmount ?? 0);
    const gst = Number(po.gstAmount ?? 0);
    const total = Number(po.totalAmount ?? 0);
    const isIgst = String(po.gstType) === 'IGST';
    const taxRows = isIgst
      ? `<tr><td class="lbl">IGST</td><td class="val">${this.money(gst)}</td></tr>`
      : `<tr><td class="lbl">CGST</td><td class="val">${this.money(gst / 2)}</td></tr>
         <tr><td class="lbl">SGST</td><td class="val">${this.money(gst / 2)}</td></tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { padding: 4px 2px; }

  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 12px; margin-bottom: 4px; }
  .header-logo img { height: 56px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 18px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-sub { font-size: 10px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 15px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 11px; color: #666; margin-top: 2px; }

  .band { display: flex; gap: 16px; margin: 14px 0 6px; }
  .info-block { flex: 1; border: 1px solid #e2e6ec; border-radius: 6px; padding: 10px 12px; }
  .info-block table { width: 100%; border-collapse: collapse; }
  .info-block td { padding: 4px 0; vertical-align: top; border: none; }
  .info-block .lbl { color: #6b7280; white-space: nowrap; width: 42%; }
  .info-block .val { color: #111; font-weight: 600; }

  .section-label { font-weight: bold; font-size: 11px; color: #1f3a5f; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.items thead th { background: #1f3a5f; color: #fff; padding: 8px; text-align: left; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { border-bottom: 1px solid #e8ebef; padding: 7px 8px; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  table.items .strong { font-weight: 600; color: #111; }
  table.items .muted { color: #6b7280; font-size: 9px; margin-top: 1px; }
  .empty { text-align: center; color: #9ca3af; padding: 24px; font-style: italic; }

  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
  table.totals { width: 300px; border-collapse: collapse; font-size: 11px; }
  table.totals td { padding: 6px 10px; border: 1px solid #e2e6ec; }
  table.totals .lbl { color: #6b7280; }
  table.totals .val { text-align: right; font-weight: 600; }
  table.totals tr.grand td { background: #eef3fb; color: #1f3a5f; font-weight: bold; border-top: 2px solid #1f3a5f; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="logo"/></div>` : ''}
    <div class="header-details">
      <div class="company">${this.esc(PAYMENT_ADVICE_COMPANY_DETAILS.NAME)}</div>
      <div class="company-sub">GSTIN: ${this.esc(PAYMENT_ADVICE_COMPANY_DETAILS.GSTIN)}</div>
    </div>
    <div class="doc-badge">
      <div class="doc-title">PURCHASE ORDER</div>
      <div class="doc-sub">${this.esc(po.poNumber)}</div>
    </div>
  </div>

  <div class="band">
    <div class="info-block">
      <table>
        <tr><td class="lbl">Vendor</td><td class="val">${this.esc(vendorName)}</td></tr>
        <tr><td class="lbl">Project / Site</td><td class="val">${this.esc(siteName)}</td></tr>
      </table>
    </div>
    <div class="info-block">
      <table>
        <tr><td class="lbl">PO Number</td><td class="val">${this.esc(po.poNumber)}</td></tr>
        <tr><td class="lbl">PO Date</td><td class="val">${this.fmtDate(po.poDate)}</td></tr>
      </table>
    </div>
  </div>

  <div class="section-label">Items</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:28px">#</th>
        <th>Item</th>
        <th class="c" style="width:90px">HSN</th>
        <th class="r" style="width:80px">Qty</th>
        <th class="r" style="width:100px">Rate</th>
        <th class="r" style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6" class="empty">No items</td></tr>`}</tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals">
      <tr><td class="lbl">Taxable Amount</td><td class="val">${this.money(taxable)}</td></tr>
      ${taxRows}
      <tr class="grand"><td class="lbl">Total</td><td class="val">${this.money(total)}</td></tr>
    </table>
  </div>

</div>
</body>
</html>`;
  }

  private footerTemplate(): string {
    const generated = this.fmtDate(new Date());
    return `
      <div style="width:100%; font-family: Arial, Helvetica, sans-serif; font-size:8px; color:#9ca3af; padding:0 30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e6ec; padding-top:4px;">
          <span>${PAYMENT_ADVICE_COMPANY_DETAILS.NAME} · System generated purchase order · Generated ${generated}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }
}
