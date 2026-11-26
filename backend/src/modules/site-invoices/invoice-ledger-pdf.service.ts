import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { PartyType } from 'src/modules/common/financials/financial.constants';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import { LedgerPdfColumns, LedgerPdfData, LedgerPdfRow } from './types/invoice-ledger-pdf.types';

/**
 * Contractor / vendor ledger as a landscape A4 PDF, laid out like the ledger page: company header,
 * headline totals, a bordered invoice table with the same column groups and colours, one total row
 * at the end, and the "For EUREKA ENTERPRISES · Authorised Signatory" block.
 * Same rendering path as the payment sheet PDF (puppeteer → S3 → presigned URL).
 */
@Injectable()
export class InvoiceLedgerPdfService {
  private readonly logger = new Logger(InvoiceLedgerPdfService.name);

  constructor(private readonly filesService: FilesService) {}

  /** Renders, uploads and returns a download URL for the ledger PDF. */
  async generate(data: LedgerPdfData): Promise<{ url: string; key: string }> {
    const logoBase64 = await this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(
      () => null,
    );
    const html = this.buildHtml(data, logoBase64);
    const side = data.partyType === PartyType.SALE ? 'contractor' : 'vendor';

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
          footerTemplate: this.footerTemplate(data),
          margin: { top: '22px', bottom: '42px', left: '22px', right: '22px' },
        }),
      );
      const stamp = data.generatedAt.toISOString().replace(/[:.]/g, '-');
      const key = `ledgers/${side}/${side}-ledger-${stamp}.pdf`;
      await this.filesService.uploadFile(pdfBuffer, key, 'application/pdf');
      return await this.filesService.getDownloadFileUrl(key);
    } catch (err) {
      this.logger.error(`Ledger PDF generation failed (${side}): ${err}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  // ─── Formatting ───

  private esc(s: unknown): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escaped, with break points after / - _ so codes like "EE/26-27/004" wrap at a separator. */
  private code(s: unknown): string {
    return this.esc(s ?? '—').replace(/([/\-_])/g, '$1<wbr>');
  }

  /** Indian grouping, two decimals, no symbol (the table says amounts are in ₹). */
  private amount(n: number): string {
    return Number(n ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private money(n: number): string {
    return `₹${this.amount(n)}`;
  }

  private fmtDate(v: Date | string | null | undefined): string {
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(`${v.slice(0, 10)}T00:00:00`) : v;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /** Amount in the column's colour, or muted when zero; optional note in brackets underneath. */
  private amountCell(value: number, tone: string, note?: string): string {
    const cls = value > 0 ? tone : 'zero';
    return `<span class="${cls}">${this.amount(value)}</span>${
      note ? `<div class="note">(${this.esc(note)})</div>` : ''
    }`;
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

  // ─── HTML ───

  private row(r: LedgerPdfRow, idx: number, cols: LedgerPdfColumns): string {
    const gstNote = r.gstAmount
      ? [
          r.gstPercentage !== null ? `${Number(r.gstPercentage)}%` : '',
          r.isGstHold ? 'Held' : 'Not held',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
    const tdsNote = r.tdsAmount && r.tdsPercentage !== null ? `${Number(r.tdsPercentage)}%` : '';
    const transfers = r.payments.length;
    const paidNote = transfers ? `${transfers} ${transfers === 1 ? 'transfer' : 'transfers'}` : '';
    const location = [r.siteCity, r.siteState].filter(Boolean).join(', ');
    const status = String(r.paymentStatus ?? '').toUpperCase();
    const payments = transfers
      ? `<ul class="pays">${r.payments
          .map(
            (p) =>
              `<li><span class="d">${this.fmtDate(p.date)}</span><span class="a">${this.amount(
                p.amount,
              )}</span></li>`,
          )
          .join('')}</ul>`
      : '<span class="zero">—</span>';

    return `
      <tr>
        <td class="c sno">${idx + 1}</td>
        <td class="party">${this.esc(r.partyName ?? '—')}</td>
        <td>
          <div class="strong">${this.esc(r.companyName ?? '—')}</div>
          <div>${this.esc(r.siteName)}</div>
          ${location ? `<div class="muted">${this.esc(location)}</div>` : ''}
        </td>
        <td>
          <div class="inv">${this.code(r.invoiceNumber)}</div>
          <div class="muted nowrap">${this.fmtDate(r.invoiceDate)}</div>
        </td>
        <td class="c">
          <div class="nowrap">${this.esc(r.financialYear ?? '—')}</div>
          ${r.quarter ? `<div class="qtr">${this.esc(r.quarter)}</div>` : ''}
        </td>
        <td class="po">${this.code(r.poNumber)}</td>
        <td class="r s-bill">${this.amountCell(r.taxableAmount, 't-bill')}</td>
        ${cols.cgstSgst ? `<td class="r s-gst">${this.amountCell(r.cgstAmount, 't-gst')}</td>` : ''}
        ${cols.cgstSgst ? `<td class="r s-gst">${this.amountCell(r.sgstAmount, 't-gst')}</td>` : ''}
        ${cols.igst ? `<td class="r s-gst">${this.amountCell(r.igstAmount, 't-gst')}</td>` : ''}
        <td class="r s-gst">${this.amountCell(r.gstAmount, 't-gst', gstNote)}</td>
        <td class="r s-bill">${this.amountCell(r.grossAmount, 't-bill')}</td>
        <td class="r s-ded">${this.amountCell(r.tdsAmount, 't-tds', tdsNote)}</td>
        ${
          cols.advance
            ? `<td class="r s-ded">${this.amountCell(r.advanceAdjusted, 't-adv')}</td>`
            : ''
        }
        <td class="r s-rcv">${this.amountCell(r.paidAmount, 't-rcv', paidNote)}</td>
        <td class="s-rcv">${payments}</td>
        <td class="r s-out">${this.amountCell(r.outstandingAmount, 't-out')}</td>
        <td class="c"><span class="badge badge-${status.toLowerCase()}">${this.esc(
      this.titleCase(status || '—'),
    )}</span></td>
      </tr>`;
  }

  /**
   * Summary above the table, in two steps that read left to right, the way the page's statement
   * does: (1) basic value plus each GST part gives the gross bill; (2) the gross bill less TDS,
   * held GST, advance and what was paid gives the outstanding. Every line says whether it adds
   * (+), deducts (−) or totals (=).
   */
  private summaryBlock(data: LedgerPdfData, paidLabel: string): string {
    const t = data.totals;
    const isVendor = data.partyType !== PartyType.SALE;
    const share = (part: number, whole: number) =>
      whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString('en-IN')}%` : '—';

    const gstHeld = Math.max(t.grossAmount - t.tdsAmount - t.netPayable, 0);
    const advance = isVendor ? t.advanceAdjusted : 0;
    // Outstanding never goes below zero per invoice, so an invoice paid above its net payable
    // leaves a gap between "net − advance − paid" and the outstanding; it is shown, not hidden.
    const excessPaid = t.outstandingAmount - (t.netPayable - advance - t.paidAmount);

    const line = (
      sign: string,
      label: string,
      value: number,
      opts: { note?: string; cls?: string; tone?: string } = {},
    ) => `
      <tr class="${opts.cls ?? ''}">
        <td class="sign">${sign}</td>
        <td>${opts.tone ? `<i class="sw" style="background:${opts.tone}"></i>` : ''}${label}${
      opts.note ? `<span class="calc-note">${this.esc(opts.note)}</span>` : ''
    }</td>
        <td class="r">${this.money(value)}</td>
      </tr>`;

    // Each GST part on its own line, then the GST total.
    const gstParts = (
      [
        ['CGST', t.cgstAmount],
        ['SGST', t.sgstAmount],
        ['IGST', t.igstAmount],
      ] as [string, number][]
    ).filter(([, amount]) => amount > 0);

    const billLines = [
      line('', 'Basic value', t.taxableAmount),
      ...gstParts.map(([label, amount]) => line('+', label, amount, { cls: 'part' })),
      gstParts.length
        ? line('', 'Total GST', t.gstAmount, { cls: 'group-total' })
        : line('+', 'GST', t.gstAmount),
      line('=', 'Gross bill', t.grossAmount, { cls: 'grand-total bill' }),
    ].join('');

    const settleLines = [
      line('', 'Gross bill', t.grossAmount),
      line('−', 'TDS deducted', t.tdsAmount, {
        note: `${share(t.tdsAmount, t.taxableAmount)} of basic value`,
        tone: '#4f46e5',
      }),
      gstHeld > 0.009
        ? line('−', 'GST held', gstHeld, {
            note: 'Paid once the GST return is filed',
            tone: '#d97706',
          })
        : '',
      line('=', 'Net payable', t.netPayable, { cls: 'sub-total' }),
      isVendor
        ? line('−', 'Advance adjusted', t.advanceAdjusted, {
            note: `${share(t.advanceAdjusted, t.netPayable)} of net payable`,
            tone: '#0284c7',
          })
        : '',
      line('−', paidLabel, t.paidAmount, {
        note: `${share(t.paidAmount, t.netPayable)} of net payable`,
        tone: '#16a34a',
      }),
      excessPaid > 0.009
        ? line('+', 'Paid above net payable on some invoices', excessPaid, {
            note: 'Not counted against other invoices',
          })
        : '',
      line('=', 'Outstanding', t.outstandingAmount, { cls: 'grand-total', tone: '#dc2626' }),
    ].join('');

    return `
    <div class="summary">
      <div class="panel">
        <div class="panel-title"><span class="step">1</span>Gross bill <span class="hint">Amounts in ₹</span></div>
        <table class="calc-table">${billLines}</table>
      </div>
      <div class="flow">→</div>
      <div class="panel">
        <div class="panel-title"><span class="step">2</span>How the outstanding is worked out <span class="hint">Amounts in ₹</span></div>
        <table class="calc-table">${settleLines}</table>
      </div>
    </div>`;
  }

  /** One total row after the last invoice (a <tfoot> would repeat on every page). */
  private totalRow(data: LedgerPdfData, cols: LedgerPdfColumns): string {
    const t = data.totals;
    const cell = (v: number) => `<td class="r">${this.amount(v)}</td>`;
    return `
      <tr class="total-row">
        <td colspan="6" class="r">Total · ${data.rows.length} invoices</td>
        ${cell(t.taxableAmount)}
        ${cols.cgstSgst ? cell(t.cgstAmount) + cell(t.sgstAmount) : ''}
        ${cols.igst ? cell(t.igstAmount) : ''}
        ${cell(t.gstAmount)}
        ${cell(t.grossAmount)}
        ${cell(t.tdsAmount)}
        ${cols.advance ? cell(t.advanceAdjusted) : ''}
        ${cell(t.paidAmount)}
        <td></td>
        ${cell(t.outstandingAmount)}
        <td></td>
      </tr>`;
  }

  private buildHtml(data: LedgerPdfData, logoBase64: string | null): string {
    const isContractor = data.partyType === PartyType.SALE;
    const title = isContractor ? 'CONTRACTOR LEDGER' : 'VENDOR LEDGER';
    const partyLabel = isContractor ? 'Contractor' : 'Vendor';
    const paidLabel = isContractor ? 'Received' : 'Paid';
    const rows = data.rows;

    // Columns that would be all zero are left out, so the table keeps room for what matters.
    const cols: LedgerPdfColumns = {
      advance: !isContractor,
      cgstSgst:
        rows.some((r) => r.cgstAmount > 0 || r.sgstAmount > 0) ||
        !rows.some((r) => r.igstAmount > 0),
      igst: rows.some((r) => r.igstAmount > 0),
    };

    // Fixed column widths (relative weights → %), so long names wrap inside their own cell
    // instead of squeezing their neighbours.
    const weights = [
      3, // #
      10, // party
      13, // client / project
      9, // invoice no. / date
      6, // FY / quarter
      8.5, // PO no.
      7.5, // basic
      ...(cols.cgstSgst ? [6.5, 6.5] : []),
      ...(cols.igst ? [6.5] : []),
      7, // total GST
      7.5, // gross
      6.5, // TDS
      ...(cols.advance ? [6.5] : []),
      7.5, // received / paid
      9.5, // payment dates
      8, // outstanding
      5.5, // status
    ];
    const weightSum = weights.reduce((s, w) => s + w, 0);
    const colgroup = `<colgroup>${weights
      .map((w) => `<col style="width:${((w / weightSum) * 100).toFixed(2)}%"/>`)
      .join('')}</colgroup>`;

    const company = PAYMENT_ADVICE_COMPANY_DETAILS;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #1a1a1a; background: #fff; }
  .page { padding: 2px; }

  /* Header — same as the payment sheet */
  .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1f3a5f; padding-bottom: 10px; }
  .header-logo img { height: 50px; width: auto; object-fit: contain; }
  .header-details { flex: 1; }
  .header .company { font-size: 17px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .company-sub { font-size: 9.5px; color: #555; margin-top: 3px; }
  .header .doc-badge { text-align: right; }
  .header .doc-title { font-size: 15px; font-weight: bold; color: #1f3a5f; letter-spacing: 1px; }
  .header .doc-sub { font-size: 10px; color: #666; margin-top: 3px; }

  /* Summary — two calculation panels: gross bill, then how the outstanding is worked out */
  .summary { display: flex; gap: 8px; margin: 12px 0 4px; align-items: stretch; page-break-inside: avoid; }
  .panel { flex: 1; border: 1px solid #cfd6df; border-radius: 5px; padding: 8px 10px; background: #fff; }
  .flow { display: flex; align-items: center; color: #94a3b8; font-size: 16px; font-weight: bold; }
  .panel-title { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #e2e6ec; font-size: 9px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .panel-title .step { display: inline-block; width: 14px; height: 14px; line-height: 14px; text-align: center; border-radius: 50%; background: #1f3a5f; color: #fff; font-size: 8px; }
  .panel-title .hint { margin-left: auto; font-size: 8px; font-weight: normal; color: #6b7280; text-transform: none; letter-spacing: 0; }
  table.calc-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.calc-table td { padding: 4px 6px; vertical-align: top; }
  table.calc-table td.sign { width: 14px; color: #6b7280; font-weight: bold; text-align: center; }
  table.calc-table td.r { text-align: right; white-space: nowrap; font-weight: 600; }
  table.calc-table .sw { display: inline-block; width: 7px; height: 7px; border-radius: 2px; margin-right: 5px; }
  .calc-note { display: block; color: #6b7280; font-size: 7.6px; margin-top: 1px; padding-left: 12px; }
  table.calc-table tr.part td { padding-top: 2px; padding-bottom: 2px; color: #6b7280; font-size: 8.4px; }
  table.calc-table tr.part td:nth-child(2) { padding-left: 16px; }
  table.calc-table tr.part td.r { font-weight: 500; }
  table.calc-table tr.group-total td { border-top: 1px dashed #cbd5e1; color: #b45309; font-weight: bold; }
  table.calc-table tr.sub-total td { border-top: 1px solid #94a3b8; font-weight: bold; color: #111; }
  table.calc-table tr.grand-total td { border-top: 2px solid #1f3a5f; background: #fef2f2; color: #b91c1c; font-weight: bold; font-size: 10px; }
  table.calc-table tr.grand-total.bill td { background: #f0fdfa; color: #0f766e; }

  .section-label { display: flex; justify-content: space-between; align-items: baseline; margin: 14px 0 6px; font-weight: bold; font-size: 10.5px; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .section-label span { font-weight: normal; font-size: 9px; color: #6b7280; text-transform: none; letter-spacing: 0; }

  /* Ledger table — bordered, column groups coloured like the page */
  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.4px; border: 1px solid #94a3b8; }
  table.items th, table.items td { border: 1px solid #cfd6df; }
  table.items thead { display: table-header-group; }
  table.items thead th { background: #eef2f6; color: #1f2937; padding: 6px 5px; text-align: left; font-weight: 700; font-size: 7.6px; text-transform: uppercase; letter-spacing: 0.2px; vertical-align: middle; border-bottom: 1.5px solid #94a3b8; }
  table.items tbody td { padding: 5px 5px; vertical-align: top; overflow-wrap: break-word; }
  table.items tbody tr { page-break-inside: avoid; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items td.r { white-space: nowrap; }

  th.s-bill { background: #ccfbf1 !important; border-top: 3px solid #0d9488 !important; }
  th.s-gst { background: #fef3c7 !important; border-top: 3px solid #d97706 !important; }
  th.s-ded { background: #e0e7ff !important; border-top: 3px solid #4f46e5 !important; }
  th.s-rcv { background: #dcfce7 !important; border-top: 3px solid #16a34a !important; }
  th.s-out { background: #fee2e2 !important; border-top: 3px solid #dc2626 !important; }
  td.s-bill { background: #f3fdfb; }
  td.s-gst { background: #fffbf0; }
  td.s-ded { background: #f6f7ff; }
  td.s-rcv { background: #f4fdf7; }
  td.s-out { background: #fff6f6; }

  .sno { white-space: nowrap; color: #6b7280; }
  .party { font-weight: 700; color: #111; }
  .inv { font-weight: 600; color: #111; }
  .po { color: #111; }
  .qtr { display: inline-block; margin-top: 2px; padding: 0 5px; border-radius: 6px; background: #eef2f6; color: #475569; font-size: 7.6px; font-weight: 700; }
  .t-bill { color: #0f766e; font-weight: 600; }
  .t-gst { color: #b45309; font-weight: 600; }
  .t-tds { color: #4338ca; font-weight: 600; }
  .t-adv { color: #0369a1; font-weight: 600; }
  .t-rcv { color: #15803d; font-weight: 600; }
  .t-out { color: #b91c1c; font-weight: 700; }
  .zero { color: #9ca3af; }
  .note { color: #6b7280; font-size: 7.4px; margin-top: 1px; white-space: normal; }
  .muted { color: #6b7280; font-size: 7.8px; margin-top: 1px; }
  .strong { font-weight: 600; color: #111; }
  .nowrap { white-space: nowrap; }
  .pays { list-style: none; }
  .pays li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 6px; padding: 1px 0; }
  .pays li span { white-space: nowrap; }
  .pays li + li { border-top: 1px dashed #d1d5db; }
  .pays .d { color: #6b7280; }
  .pays .a { color: #15803d; font-weight: 600; }

  .badge { display: inline-block; white-space: nowrap; padding: 2px 6px; border-radius: 10px; font-size: 7.6px; font-weight: 700; }
  .badge-paid { background: #dcfce7; color: #15803d; }
  .badge-partial { background: #fef3c7; color: #b45309; }
  .badge-unpaid { background: #fee2e2; color: #b91c1c; }

  tr.total-row td { background: #e8eef7 !important; color: #1f3a5f; font-weight: 700; font-size: 7.8px; padding: 7px 5px; border-top: 2px solid #1f3a5f; white-space: nowrap; }

  /* Signature */
  .sign-wrap { display: flex; justify-content: flex-end; margin-top: 28px; page-break-inside: avoid; }
  .sign-box { width: 240px; text-align: center; }
  .sign-box .for { font-size: 10px; font-weight: bold; color: #1f3a5f; text-transform: uppercase; letter-spacing: 0.4px; }
  .sign-box .space { height: 56px; }
  .sign-box .line { border-top: 1px solid #1f3a5f; padding-top: 5px; font-size: 9.5px; font-weight: 600; color: #1f3a5f; }
  .disclaimer { margin-top: 14px; font-size: 8px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="logo"/></div>` : ''}
    <div class="header-details">
      <div class="company">${this.esc(company.NAME)}</div>
      <div class="company-sub">${this.esc(company.FULL_ADDRESS)}, ${this.esc(
      company.ADDRESS.CITY,
    )}, ${this.esc(company.ADDRESS.STATE)} ${this.esc(company.ADDRESS.PINCODE)}</div>
      <div class="company-sub">GSTIN: ${this.esc(company.GSTIN)}</div>
    </div>
    <div class="doc-badge">
      <div class="doc-title">${title}</div>
    </div>
  </div>

  ${this.summaryBlock(data, paidLabel)}

  <div class="section-label">${partyLabel} invoices <span>Amounts in ₹</span></div>
  <table class="items">
    ${colgroup}
    <thead>
      <tr>
        <th class="c">#</th>
        <th>${partyLabel}</th>
        <th>Client / Project</th>
        <th>Invoice no. / Date</th>
        <th class="c">FY / Qtr</th>
        <th>PO no.</th>
        <th class="r s-bill">Basic value</th>
        ${cols.cgstSgst ? '<th class="r s-gst">CGST</th><th class="r s-gst">SGST</th>' : ''}
        ${cols.igst ? '<th class="r s-gst">IGST</th>' : ''}
        <th class="r s-gst">Total GST</th>
        <th class="r s-bill">Gross bill</th>
        <th class="r s-ded">TDS</th>
        ${cols.advance ? '<th class="r s-ded">Advance</th>' : ''}
        <th class="r s-rcv">${paidLabel}</th>
        <th class="s-rcv">Payment dates</th>
        <th class="r s-out">Outstanding</th>
        <th class="c">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r, i) => this.row(r, i, cols)).join('')}
      ${this.totalRow(data, cols)}
    </tbody>
  </table>

  <div class="sign-wrap">
    <div class="sign-box">
      <div class="for">For ${this.esc(company.NAME)}</div>
      <div class="space"></div>
      <div class="line">Authorised Signatory</div>
    </div>
  </div>
  <div class="disclaimer">This is a system generated statement. Please report any discrepancy within 7 days of receipt.</div>

</div>
</body>
</html>`;
  }

  private footerTemplate(data: LedgerPdfData): string {
    const side = data.partyType === PartyType.SALE ? 'contractor' : 'vendor';
    return `
      <div style="width:100%; font-family: Arial, Helvetica, sans-serif; font-size:7.5px; color:#9ca3af; padding:0 22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e6ec; padding-top:4px;">
          <span>${
            PAYMENT_ADVICE_COMPANY_DETAILS.NAME
          } · System generated ${side} ledger · Generated ${this.fmtDate(data.generatedAt)}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }
}
