import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { PaymentSheetRepository } from './payment-sheet.repository';
import { PaymentSheetEntity } from './entities/payment-sheet.entity';
import { PaymentSheetItemEntity } from './entities/payment-sheet-item.entity';
import { PaymentSheetStatus, PaymentSheetItemStatus } from './constants/payment-sheet.constants';

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

  private buildHtml(
    detail: SheetDetail,
    items: PaymentSheetItemEntity[],
    filterLabel?: string,
  ): string {
    const rows = items
      .map((it, idx) => {
        const bank = it.bankSnapshot;
        const beneficiary = it.beneficiaryType === 'VENDOR' ? 'Vendor' : 'Employee';
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${beneficiary}</td>
            <td>${this.esc(it.sourceType)}</td>
            <td>${this.esc(bank?.accountHolderName ?? '—')}<br/>
                <span class="muted">${this.esc(bank?.bankName ?? '')} ${this.esc(
          bank?.accountNumber ?? '',
        )}<br/>${this.esc(bank?.ifscCode ?? '')}</span></td>
            <td class="r">${this.money(Number(it.currentAmount))}</td>
            <td>${this.esc(it.itemStatus)}</td>
            <td class="r">${it.paidAmount != null ? this.money(Number(it.paidAmount)) : '—'}</td>
          </tr>`;
      })
      .join('');

    // Totals computed from the rendered items, so filtered exports get a correct subtotal.
    const totalCurrent = items
      .filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED)
      .reduce((s, i) => s + Number(i.currentAmount), 0);
    const totalPaid = items.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
    const totalsLabel = filterLabel ? 'Subtotal' : 'Totals';

    return `<!doctype html><html><head><meta charset="utf-8"/>
      <style>
        * { font-family: Arial, Helvetica, sans-serif; }
        body { color: #222; font-size: 12px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { margin-bottom: 12px; color: #444; }
        .meta div { margin: 2px 0; }
        .filter { display:inline-block; margin-top:4px; padding:2px 10px; border-radius:12px; background:#eef; color:#224; font-size:11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; }
        td.r, th.r { text-align: right; }
        .muted { color: #777; font-size: 10px; }
        tfoot td { font-weight: bold; background: #fafafa; }
      </style></head><body>
      <h1>Payment Sheet ${this.esc(detail.sheetNumber)}</h1>
      <div class="meta">
        <div><strong>Title:</strong> ${this.esc(detail.title ?? '—')}</div>
        <div><strong>Status:</strong> ${this.esc(
          detail.status,
        )} &nbsp; <strong>Stage:</strong> ${this.esc(detail.currentStage ?? '—')}</div>
        <div><strong>Financial Year:</strong> ${this.esc(detail.financialYear)}</div>
        ${filterLabel ? `<div class="filter">Filtered: ${this.esc(filterLabel)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Beneficiary</th><th>Source</th><th>Account</th><th class="r">Amount</th><th>Status</th><th class="r">Paid</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="r">${totalsLabel}</td>
            <td class="r">${this.money(totalCurrent)}</td>
            <td></td>
            <td class="r">${this.money(totalPaid)}</td>
          </tr>
        </tfoot>
      </table>
    </body></html>`;
  }

  private async generate(
    detail: SheetDetail,
    items: PaymentSheetItemEntity[],
    opts: GenerateOpts = {},
  ): Promise<string> {
    const html = this.buildHtml(detail, items, opts.filterLabel);
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
          margin: { top: '20px', bottom: '20px', left: '30px', right: '30px' },
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
