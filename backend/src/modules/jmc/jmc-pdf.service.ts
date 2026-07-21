import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { JmcEntity } from './entities/jmc.entity';
import { JmcItemEntity } from './entities/jmc-item.entity';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';

type JmcDetail = JmcEntity & { items?: JmcItemEntity[] };

/**
 * System-generated JMC PDF. Always regenerated fresh from current state (never cached) — the
 * JMC stays editable until approved, so a stored PDF could silently go stale. Puppeteer
 * generation is cheap enough that always-fresh is worth the correctness guarantee.
 * Modeled on PaymentSheetPdfService for consistent branding.
 */
@Injectable()
export class JmcPdfService {
  private readonly logger = new Logger(JmcPdfService.name);

  constructor(private readonly filesService: FilesService) {}

  async getDownloadUrl(key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }

  async generate(jmc: JmcDetail): Promise<string> {
    const logoBase64 = await this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(
      () => null,
    );
    const html = this.buildHtml(jmc, logoBase64);
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
      const safeNumber = String(jmc.jmcNumber ?? jmc.id).replace(/\//g, '-');
      const key = `jmcs/${safeNumber}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return key;
    } catch (err) {
      this.logger.error(`JMC PDF generation failed for ${jmc.jmcNumber ?? jmc.id}: ${err}`);
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
    return new Date(v).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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

  private buildHtml(jmc: JmcDetail, logoBase64: string | null): string {
    const projectName = (jmc as any).site?.name ?? '—';
    const clientName = PAYMENT_ADVICE_COMPANY_DETAILS.NAME;
    const contractorName = (jmc as any).contractor?.name ?? '—';
    const poNumber = (jmc as any).po?.poNumber ?? '—';
    const siteName = projectName;

    const items = (jmc.items ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const rows = items
      .map(
        (it, idx) => `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${this.esc(it.itemName)}</td>
          <td class="c">${this.esc(it.unit)}</td>
          <td class="r">${this.esc(it.quantity)}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { padding: 4px 2px; }

  /* ── Header ── */
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 12px; margin-bottom: 4px; }
  .header-logo img { height: 56px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 18px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-sub { font-size: 10px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 14px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 11px; color: #666; margin-top: 2px; }

  /* ── Info band ── */
  .band { display: flex; gap: 16px; margin: 14px 0 6px; }
  .info-block { flex: 1; border: 1px solid #e2e6ec; border-radius: 6px; padding: 10px 12px; }
  .info-block table { width: 100%; border-collapse: collapse; }
  .info-block td { padding: 4px 0; vertical-align: top; border: none; }
  .info-block .lbl { color: #6b7280; white-space: nowrap; width: 42%; }
  .info-block .val { color: #111; font-weight: 600; }

  /* ── Items table ── */
  .section-label { font-weight: bold; font-size: 11px; color: #1f3a5f; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.items thead th { background: #1f3a5f; color: #fff; padding: 8px; text-align: left; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { border-bottom: 1px solid #e8ebef; padding: 8px; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  .empty { text-align: center; color: #9ca3af; padding: 24px; font-style: italic; }

  /* ── Signatures ── */
  .sign-wrap { margin-top: 40px; page-break-inside: avoid; }
  table.sign { width: 100%; border-collapse: collapse; }
  table.sign td { width: 50%; border: 1px solid #d7deea; padding: 10px 12px; vertical-align: bottom; height: 90px; text-align: center; }
  table.sign .sig-space { height: 54px; }
  table.sign .sig-label { font-weight: 600; color: #1f3a5f; border-top: 1px solid #9fb0c9; padding-top: 6px; font-size: 10.5px; }
  table.sign .sig-cap { font-size: 8.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="logo"/></div>` : ''}
    <div class="header-details">
      <div class="company">${this.esc(clientName)}</div>
      <div class="company-sub">GSTIN: ${this.esc(
        PAYMENT_ADVICE_COMPANY_DETAILS.GSTIN,
      )} · ${this.esc(PAYMENT_ADVICE_COMPANY_DETAILS.FULL_ADDRESS)}, ${this.esc(
      PAYMENT_ADVICE_COMPANY_DETAILS.ADDRESS.CITY,
    )}</div>
    </div>
    <div class="doc-badge">
      <div class="doc-title">JOINT MEASUREMENT CERTIFICATE</div>
      <div class="doc-sub">${this.esc(jmc.jmcNumber)}</div>
    </div>
  </div>

  <!-- Info band -->
  <div class="band">
    <div class="info-block">
      <table>
        <tr><td class="lbl">Nature / Name of Work</td><td class="val">${this.esc(
          projectName,
        )}</td></tr>
        <tr><td class="lbl">Client / Owner</td><td class="val">${this.esc(clientName)}</td></tr>
        <tr><td class="lbl">Contractor</td><td class="val">${this.esc(contractorName)}</td></tr>
      </table>
    </div>
    <div class="info-block">
      <table>
        <tr><td class="lbl">JMC Number</td><td class="val">${this.esc(jmc.jmcNumber)}</td></tr>
        <tr><td class="lbl">JMC Date</td><td class="val">${this.fmtDate(jmc.jmcDate)}</td></tr>
        <tr><td class="lbl">PO Number</td><td class="val">${this.esc(poNumber)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Items -->
  <div class="section-label">Measurement Items</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:36px">#</th>
        <th>Item</th>
        <th class="c" style="width:120px">Unit</th>
        <th class="r" style="width:120px">Quantity</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="4" class="empty">No measurement items</td></tr>`}</tbody>
  </table>

  <!-- Signatures: Eureka Enterprises + Site -->
  <div class="sign-wrap">
    <div class="section-label">Signatures</div>
    <table class="sign">
      <tr>
        <td>
          <div class="sig-cap">For</div>
          <div class="sig-space"></div>
          <div class="sig-label">${this.esc(clientName)}</div>
        </td>
        <td>
          <div class="sig-cap">For</div>
          <div class="sig-space"></div>
          <div class="sig-label">${this.esc(siteName)}</div>
        </td>
      </tr>
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
          <span>${PAYMENT_ADVICE_COMPANY_DETAILS.NAME} · System generated JMC · Generated ${generated}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }
}
