import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import puppeteer from 'puppeteer';
import { PartyType } from 'src/modules/common/financials/financial.constants';
import { PAYMENT_ADVICE_COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import {
  LedgerDocumentFile,
  LedgerPdfColumns,
  LedgerPdfData,
  LedgerPdfRow,
} from './types/invoice-ledger-pdf.types';
import { LEDGER_DOCUMENT_CSS } from './constants/invoice-ledger-document.styles';
import {
  LEDGER_INTERACTIVE_CSS,
  LEDGER_INTERACTIVE_SCRIPT,
} from './constants/invoice-ledger-interactive.constants';

/**
 * Contractor / vendor ledger as a document, in two forms built from the same markup:
 *  - PDF (landscape A4): company header, status band, the two calculation panels, the bordered
 *    invoice table with one total row, and the "For EUREKA ENTERPRISES · Authorised Signatory"
 *    block, rendered with puppeteer.
 *  - Interactive file (one HTML file): the same document plus a filter bar (financial year,
 *    quarter, status, PO, invoice number, invoice date). The filters only narrow the invoices already in the file and
 *    every figure is worked out again from the invoices left.
 * Both are built on request and sent straight back to the browser; nothing is stored.
 *
 * Every figure carries a `data-k` marker and every invoice row its amounts as `data-*`, which the
 * interactive file's script reads; the PDF ignores them.
 */
@Injectable()
export class InvoiceLedgerDocumentService {
  private readonly logger = new Logger(InvoiceLedgerDocumentService.name);

  /** Renders the PDF and returns it, ready to send to the browser. */
  async generatePdf(data: LedgerPdfData): Promise<LedgerDocumentFile> {
    const html = this.buildHtml(data, await this.logo(), false);
    const side = this.side(data);

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
      return {
        buffer: pdfBuffer,
        fileName: this.fileName(data, 'pdf'),
        contentType: 'application/pdf',
      };
    } catch (err) {
      this.logger.error(`Ledger PDF generation failed (${side}): ${err}`);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  /** Builds the interactive HTML file and returns it, ready to send to the browser. */
  async generateInteractive(data: LedgerPdfData): Promise<LedgerDocumentFile> {
    const html = this.buildHtml(data, await this.logo(), true);
    return {
      buffer: Buffer.from(html, 'utf8'),
      fileName: this.fileName(data, 'html'),
      contentType: 'text/html; charset=utf-8',
    };
  }

  // ─── Formatting ───

  private side(data: LedgerPdfData): 'contractor' | 'vendor' {
    return data.partyType === PartyType.SALE ? 'contractor' : 'vendor';
  }

  /** e.g. "vendor-ledger-2026-11-26.html". */
  private fileName(data: LedgerPdfData, extension: 'pdf' | 'html'): string {
    return `${this.side(data)}-ledger-${data.generatedAt.toISOString().slice(0, 10)}.${extension}`;
  }

  private logo(): Promise<string | null> {
    return this.fetchUrlAsBase64(PAYMENT_ADVICE_COMPANY_DETAILS.LOGO_URL).catch(() => null);
  }

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

  private share(part: number, whole: number): string {
    return whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString('en-IN')}%` : '—';
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

  /** Net payable of one invoice: basic − TDS + GST, GST left out while it is held. */
  private netPayableOf(r: LedgerPdfRow): number {
    const gst = r.isGstHold && r.gstAmount > 0 ? 0 : r.gstAmount;
    return Math.round((r.taxableAmount - r.tdsAmount + gst) * 100) / 100;
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

  private row(r: LedgerPdfRow, idx: number, cols: LedgerPdfColumns, paidVerb: string): string {
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
    // Share of this invoice's net payable received / paid and still due; together they make 100%.
    const netPayable = this.netPayableOf(r);
    const paidNote = [
      r.paidAmount > 0 && netPayable > 0
        ? `${this.share(r.paidAmount, netPayable)} ${paidVerb}`
        : '',
      transfers ? `${transfers} ${transfers === 1 ? 'transfer' : 'transfers'}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const outstandingNote =
      r.outstandingAmount > 0 && netPayable > 0
        ? `${this.share(r.outstandingAmount, netPayable)} due`
        : '';
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

    // What the interactive file's filters and totals read.
    const dataAttrs = [
      ['fy', r.financialYear ?? ''],
      ['q', r.quarter ?? ''],
      ['status', status],
      ['date', r.invoiceDate ? r.invoiceDate.slice(0, 10) : ''],
      ['po', r.poNumber ?? ''],
      ['inv', r.invoiceNumber ?? ''],
      ['basic', r.taxableAmount],
      ['cgst', r.cgstAmount],
      ['sgst', r.sgstAmount],
      ['igst', r.igstAmount],
      ['gst', r.gstAmount],
      ['gross', r.grossAmount],
      ['tds', r.tdsAmount],
      ['adv', cols.advance ? r.advanceAdjusted : 0],
      ['paid', r.paidAmount],
      ['out', r.outstandingAmount],
      ['net', this.netPayableOf(r)],
    ]
      .map(([k, v]) => `data-${k}="${this.esc(v)}"`)
      .join(' ');

    return `
      <tr data-row ${dataAttrs}>
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
        <td class="r s-out">${this.amountCell(r.outstandingAmount, 't-out', outstandingNote)}</td>
        <td class="c"><span class="badge badge-${status.toLowerCase()}">${this.esc(
      this.titleCase(status || '—'),
    )}</span></td>
      </tr>`;
  }

  /**
   * Summary above the table, in two steps that read left to right, the way the page's statement
   * does: (1) basic value plus each GST part gives the gross bill; (2) the gross bill less TDS,
   * held GST, advance and what was paid gives the outstanding. Every line says whether it adds
   * (+), deducts (−) or totals (=). Lines that are zero stay in the markup, hidden, so the
   * interactive file can show them when a filter makes them count.
   */
  private summaryBlock(data: LedgerPdfData, paidLabel: string): string {
    const t = data.totals;
    const isVendor = data.partyType !== PartyType.SALE;

    const gstHeld = Math.max(t.grossAmount - t.tdsAmount - t.netPayable, 0);
    const advance = isVendor ? t.advanceAdjusted : 0;
    // Outstanding never goes below zero per invoice, so an invoice paid above its net payable
    // leaves a gap between "net − advance − paid" and the outstanding; it is shown, not hidden.
    const excessPaid = t.outstandingAmount - (t.netPayable - advance - t.paidAmount);

    const line = (
      sign: string,
      label: string,
      key: string,
      value: number,
      opts: {
        note?: string;
        noteKey?: string;
        cls?: string;
        tone?: string;
        lineKey?: string;
        show?: boolean;
        signKey?: string;
      } = {},
    ) => `
      <tr class="${opts.cls ?? ''}"${opts.lineKey ? ` data-line="${opts.lineKey}"` : ''}${
      opts.show === false ? ' style="display:none"' : ''
    }>
        <td class="sign"${opts.signKey ? ` data-k="${opts.signKey}"` : ''}>${sign}</td>
        <td>${opts.tone ? `<i class="sw" style="background:${opts.tone}"></i>` : ''}${label}${
      opts.note !== undefined
        ? `<span class="calc-note"${opts.noteKey ? ` data-k="${opts.noteKey}"` : ''}>${this.esc(
            opts.note,
          )}</span>`
        : ''
    }</td>
        <td class="r" data-k="${key}">${this.money(value)}</td>
      </tr>`;

    // Each GST part on its own line, then the GST total.
    const parts: [string, string, number][] = [
      ['CGST', 'cgst', t.cgstAmount],
      ['SGST', 'sgst', t.sgstAmount],
      ['IGST', 'igst', t.igstAmount],
    ];
    const anyPart = parts.some(([, , amount]) => amount > 0);

    const billLines = [
      line('', 'Basic value', 'c-basic', t.taxableAmount),
      ...parts.map(([label, key, amount]) =>
        line('+', label, `c-${key}`, amount, { cls: 'part', lineKey: key, show: amount > 0 }),
      ),
      line(anyPart ? '' : '+', 'Total GST', 'c-gst', t.gstAmount, {
        cls: 'group-total',
        signKey: 'c-gst-sign',
      }),
      line('=', 'Gross bill', 'c-gross', t.grossAmount, { cls: 'grand-total bill' }),
    ].join('');

    const settleLines = [
      line('', 'Gross bill', 'c-gross', t.grossAmount),
      line('−', 'TDS deducted', 'c-tds', t.tdsAmount, {
        note: `${this.share(t.tdsAmount, t.taxableAmount)} of basic value`,
        noteKey: 'c-tds-note',
        tone: '#4f46e5',
      }),
      line('−', 'GST held', 'c-held', gstHeld, {
        note: 'Paid once the GST return is filed',
        tone: '#d97706',
        lineKey: 'held',
        show: gstHeld > 0.009,
      }),
      line('=', 'Net payable', 'c-net', t.netPayable, { cls: 'sub-total' }),
      isVendor
        ? line('−', 'Advance adjusted', 'c-adv', t.advanceAdjusted, {
            note: `${this.share(t.advanceAdjusted, t.netPayable)} of net payable adjusted`,
            noteKey: 'c-adv-note',
            tone: '#0284c7',
          })
        : '',
      line('−', paidLabel, 'c-paid', t.paidAmount, {
        note: `${this.share(t.paidAmount, t.netPayable)} of net payable ${paidLabel.toLowerCase()}`,
        noteKey: 'c-paid-note',
        tone: '#16a34a',
      }),
      line('+', 'Paid above net payable on some invoices', 'c-excess', Math.max(excessPaid, 0), {
        note: 'Not counted against other invoices',
        lineKey: 'excess',
        show: excessPaid > 0.009,
      }),
      line('=', 'Outstanding', 'c-out', t.outstandingAmount, {
        cls: 'grand-total',
        tone: '#dc2626',
        note: `${this.share(t.outstandingAmount, t.netPayable)} of net payable still outstanding`,
        noteKey: 'c-out-note',
      }),
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

  /**
   * How many invoices are paid, partly paid and unpaid: the total, a bar split in proportion,
   * and one box per status with its count, share, billed and due.
   */
  private statusBand(data: LedgerPdfData): string {
    const rows = data.rows;
    const total = rows.length;
    const statuses: [string, string, string, string][] = [
      ['PAID', 'Paid', '#16a34a', '#f0fdf4'],
      ['PARTIAL', 'Partial', '#d97706', '#fffbeb'],
      ['UNPAID', 'Unpaid', '#dc2626', '#fef2f2'],
    ];
    const groups = statuses.map(([key, label, color, tint]) => {
      const inStatus = rows.filter((r) => String(r.paymentStatus).toUpperCase() === key);
      return {
        key,
        label,
        color,
        tint,
        count: inStatus.length,
        percent: total ? Math.round((inStatus.length / total) * 1000) / 10 : 0,
        gross: inStatus.reduce((s, r) => s + r.grossAmount, 0),
        outstanding: inStatus.reduce((s, r) => s + r.outstandingAmount, 0),
      };
    });

    const bar = groups
      .map(
        (g) =>
          `<span data-seg="${g.key}" style="flex:${g.count};background:${g.color}${
            g.count ? '' : ';display:none'
          }">${g.percent >= 12 ? `${g.count} ${g.label}` : ''}</span>`,
      )
      .join('');
    const boxes = groups
      .map(
        (g) => `
        <div class="sb-box" style="--c:${g.color};background:${g.tint}">
          <div class="sb-box-head"><i></i>${g.label}<span data-k="band-pct-${
          g.key
        }">${g.percent.toLocaleString('en-IN')}%</span></div>
          <div class="sb-box-count"><span data-k="band-count-${g.key}">${
          g.count
        }</span> <small data-k="band-unit-${g.key}">${
          g.count === 1 ? 'invoice' : 'invoices'
        }</small></div>
          <div class="sb-figures">
            <div><small>Billed</small><b data-k="band-gross-${g.key}">${this.money(
          g.gross,
        )}</b></div>
            <div class="due"><small>Due</small><span data-k="band-due-${g.key}">${
          g.outstanding > 0
            ? `<b>${this.money(g.outstanding)}</b>`
            : '<b class="settled">Fully settled ✓</b>'
        }</span></div>
          </div>
        </div>`,
      )
      .join('');

    return `
    <div class="status-band">
      <div class="sb-total"><small>Invoices</small><b data-k="band-total">${total}</b></div>
      <div class="sb-main">
        <div class="sb-bar">${bar}</div>
        <div class="sb-boxes">${boxes}</div>
      </div>
    </div>`;
  }

  /** One total row after the last invoice (a <tfoot> would repeat on every page). */
  private totalRow(data: LedgerPdfData, cols: LedgerPdfColumns): string {
    const t = data.totals;
    const cell = (key: string, v: number) =>
      `<td class="r" data-k="t-${key}">${this.amount(v)}</td>`;
    const count = data.rows.length;
    return `
      <tr class="total-row">
        <td colspan="6" class="r" data-k="t-label">Total · ${count} ${
      count === 1 ? 'invoice' : 'invoices'
    }</td>
        ${cell('basic', t.taxableAmount)}
        ${cols.cgstSgst ? cell('cgst', t.cgstAmount) + cell('sgst', t.sgstAmount) : ''}
        ${cols.igst ? cell('igst', t.igstAmount) : ''}
        ${cell('gst', t.gstAmount)}
        ${cell('gross', t.grossAmount)}
        ${cell('tds', t.tdsAmount)}
        ${cols.advance ? cell('adv', t.advanceAdjusted) : ''}
        ${cell('paid', t.paidAmount)}
        <td></td>
        ${cell('out', t.outstandingAmount)}
        <td></td>
      </tr>`;
  }

  /** Filter bar of the interactive file: its filters, plus reset and print. */
  private filterBar(total: number): string {
    return `
  <div class="ix-bar no-print">
    <div class="ix-field"><label for="f-fy">Financial year</label><select id="f-fy"><option value="">All years</option></select></div>
    <div class="ix-field"><label for="f-qtr">Quarter</label><select id="f-qtr"><option value="">All quarters</option></select></div>
    <div class="ix-field"><label for="f-status">Status</label><select id="f-status"><option value="">All statuses</option></select></div>
    <div class="ix-field"><label for="f-po">PO no.</label><select id="f-po"><option value="">All POs</option></select></div>
    <div class="ix-field"><label for="f-inv">Invoice no.</label><input type="search" id="f-inv" placeholder="Type part of a number" autocomplete="off"/></div>
    <div class="ix-field"><label for="f-from">Invoice date from</label><input type="date" id="f-from"/></div>
    <div class="ix-field"><label for="f-to">Invoice date to</label><input type="date" id="f-to"/></div>
    <div class="ix-actions">
      <span class="ix-shown" data-k="ix-shown">Showing ${total} of ${total} invoices</span>
      <button type="button" class="ix-btn" id="f-reset">Reset</button>
      <button type="button" class="ix-btn primary" id="f-print">Print / Save PDF</button>
    </div>
    <div class="ix-note">Filters narrow the ${total} invoices exported from the portal; every figure below is worked out again from the invoices shown.</div>
  </div>`;
  }

  private buildHtml(data: LedgerPdfData, logoBase64: string | null, interactive: boolean): string {
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
    const docTitle = `${isContractor ? 'Contractor' : 'Vendor'} Ledger · ${company.NAME}`;

    const table = `
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
      ${rows.map((r, i) => this.row(r, i, cols, paidLabel.toLowerCase())).join('')}
      ${
        interactive
          ? `<tr id="ix-empty" style="display:none"><td colspan="${weights.length}" class="c muted">No invoices match these filters.</td></tr>`
          : ''
      }
      ${this.totalRow(data, cols)}
    </tbody>
  </table>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
${interactive ? '<meta name="viewport" content="width=device-width, initial-scale=1"/>' : ''}
<title>${this.esc(docTitle)}</title>
<style>
${LEDGER_DOCUMENT_CSS}
${interactive ? LEDGER_INTERACTIVE_CSS : ''}
</style>
</head>
<body>
<div class="page" data-paid-verb="${paidLabel.toLowerCase()}">

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

  ${interactive ? this.filterBar(rows.length) : ''}
  ${this.statusBand(data)}
  ${this.summaryBlock(data, paidLabel)}

  <div class="section-label">${partyLabel} invoices <span>Amounts in ₹</span></div>
  ${interactive ? `<div class="table-scroll">${table}</div>` : table}

  <div class="sign-wrap">
    <div class="sign-box">
      <div class="for">For ${this.esc(company.NAME)}</div>
      <div class="space"></div>
      <div class="line">Authorised Signatory</div>
    </div>
  </div>
  <div class="disclaimer">This is a system generated statement. Please report any discrepancy within 7 days of receipt.</div>
  ${
    interactive
      ? `<div class="ix-footer">${this.esc(company.NAME)} · System generated ${this.side(
          data,
        )} ledger · Exported ${this.fmtDate(data.generatedAt)}</div>`
      : ''
  }

</div>
${interactive ? `<script>${LEDGER_INTERACTIVE_SCRIPT}</script>` : ''}
</body>
</html>`;
  }

  private footerTemplate(data: LedgerPdfData): string {
    return `
      <div style="width:100%; font-family: Arial, Helvetica, sans-serif; font-size:7.5px; color:#9ca3af; padding:0 22px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e6ec; padding-top:4px;">
          <span>${PAYMENT_ADVICE_COMPANY_DETAILS.NAME} · System generated ${this.side(
      data,
    )} ledger · Generated ${this.fmtDate(data.generatedAt)}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      </div>`;
  }
}
