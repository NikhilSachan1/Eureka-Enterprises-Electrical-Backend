import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';

export interface AssetReportRow {
  assetId: string;
  name: string;
  model?: string | null;
  serialNumber?: string | null;
  category?: string | null;
  assetType?: string | null;
  calibrationFrom?: string | null;
  calibrationStartDate?: Date | string | null;
  calibrationEndDate?: Date | string | null;
  purchaseDate?: Date | string | null;
  vendorName?: string | null;
  warrantyStartDate?: Date | string | null;
  warrantyEndDate?: Date | string | null;
  status?: string | null;
  remarks?: string | null;
}

type StatusKind = 'ok' | 'warn' | 'bad' | 'na';

/**
 * Client-ready Asset Report PDF (landscape). Always regenerated fresh from the selected assets.
 * Branding matches the JMC / payment-sheet PDFs. Calibration is emphasised (report is shared
 * with clients), plus warranty, make/model, serial, and category.
 */
@Injectable()
export class AssetReportPdfService {
  private readonly logger = new Logger(AssetReportPdfService.name);
  private static readonly EXPIRING_SOON_DAYS = 30;

  constructor(private readonly filesService: FilesService) {}

  async getDownloadUrl(key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }

  async generate(assets: AssetReportRow[]): Promise<string> {
    const logoBase64 = await this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(
      () => null,
    );
    const html = this.buildHtml(assets, logoBase64);
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
          landscape: true,
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: this.footerTemplate(),
          margin: { top: '20px', bottom: '46px', left: '24px', right: '24px' },
        }),
      );
      const key = `asset-reports/asset-report-${this.timestampSlug()}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return key;
    } catch (err) {
      this.logger.error(`Asset report PDF generation failed: ${err}`);
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

  private fmtDate(v: Date | string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private timestampSlug(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  /** Days from today until the given date (negative = past). */
  private daysUntil(v: Date | string | null | undefined): number | null {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  /** Valid / Expiring Soon / Expired / N/A for a validity end date. */
  private validity(end: Date | string | null | undefined): { label: string; kind: StatusKind } {
    const days = this.daysUntil(end);
    if (days === null) return { label: 'N/A', kind: 'na' };
    if (days < 0) return { label: 'Expired', kind: 'bad' };
    if (days <= AssetReportPdfService.EXPIRING_SOON_DAYS)
      return { label: 'Expiring Soon', kind: 'warn' };
    return { label: 'Valid', kind: 'ok' };
  }

  private badge(label: string, kind: StatusKind): string {
    return `<span class="badge badge-${kind}">${this.esc(label)}</span>`;
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

  private buildHtml(assets: AssetReportRow[], logoBase64: string | null): string {
    const rows = assets
      .map((a, idx) => {
        const cal = this.validity(a.calibrationEndDate);
        const war = this.validity(a.warrantyEndDate);
        const calRange =
          a.calibrationStartDate || a.calibrationEndDate
            ? `${this.fmtDate(a.calibrationStartDate)} → ${this.fmtDate(a.calibrationEndDate)}`
            : '—';
        return `
          <tr>
            <td class="c">${idx + 1}</td>
            <td class="mono">${this.esc(a.assetId)}</td>
            <td class="mono">${this.esc(a.serialNumber ?? '—')}</td>
            <td>
              <div class="strong">${this.esc(a.name)}</div>
              ${a.model ? `<div class="muted">Model: ${this.esc(a.model)}</div>` : ''}
            </td>
            <td>${this.esc(a.category ?? '—')}</td>
            <td>
              <div>${calRange}</div>
              <div>${this.badge(cal.label, cal.kind)}</div>
              ${
                a.calibrationFrom
                  ? `<div class="muted">By: ${this.esc(a.calibrationFrom)}</div>`
                  : ''
              }
            </td>
            <td>
              <div>${this.fmtDate(a.warrantyEndDate)}</div>
              <div>${this.badge(war.label, war.kind)}</div>
            </td>
          </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1a1a1a; background: #fff; }
  .page { padding: 4px 2px; }
  .mono { font-family: 'Courier New', monospace; }

  /* ── Header ── */
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 12px; margin-bottom: 4px; }
  .header-logo img { height: 52px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 18px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-sub { font-size: 10px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 15px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 10px; color: #666; margin-top: 2px; }

  /* ── Table ── */
  .section-label { font-weight: bold; font-size: 11px; color: #1f3a5f; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.items thead th { background: #1f3a5f; color: #fff; padding: 7px 7px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { border-bottom: 1px solid #e8ebef; padding: 6px 7px; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  table.items .strong { font-weight: 600; color: #111; }
  table.items .muted { color: #6b7280; font-size: 8.5px; margin-top: 1px; }

  /* ── Badges ── */
  .badge { display: inline-block; padding: 1.5px 7px; border-radius: 10px; font-size: 8px; font-weight: 700; letter-spacing: 0.2px; margin-top: 2px; }
  .badge-ok { background: #dcfce7; color: #15803d; }
  .badge-warn { background: #ffedd5; color: #c2410c; }
  .badge-bad { background: #fee2e2; color: #b91c1c; }
  .badge-na { background: #eef1f5; color: #4b5563; }
  .empty { text-align: center; color: #9ca3af; padding: 24px; font-style: italic; }
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
      <div class="doc-title">ASSET REPORT</div>
      <div class="doc-sub">Generated ${this.fmtDate(new Date())}</div>
    </div>
  </div>

  <div class="section-label">Asset Details</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:32px">#</th>
        <th style="width:90px">Asset ID</th>
        <th style="width:130px">Serial No</th>
        <th>Name / Model</th>
        <th style="width:140px">Category</th>
        <th style="width:200px">Calibration (Valid From → Till)</th>
        <th style="width:120px">Warranty Till</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" class="empty">No assets selected</td></tr>`}</tbody>
  </table>

</div>
</body>
</html>`;
  }

  private footerTemplate(): string {
    const generated = this.fmtDate(new Date());
    return `
      <div style="width:100%; font-family: Arial, Helvetica, sans-serif; font-size:8px; color:#9ca3af; padding:0 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e6ec; padding-top:4px;">
          <span>${PAYMENT_ADVICE_COMPANY_DETAILS.NAME} · Asset Report · Generated ${generated}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }
}
