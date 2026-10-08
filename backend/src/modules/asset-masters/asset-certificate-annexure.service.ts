import { Injectable, Logger } from '@nestjs/common';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
  PDFEmbeddedPage,
  PDFImage,
} from 'pdf-lib';
import { FilesService } from 'src/modules/common/file-upload/files.service';

/** One asset's calibration certificate, as the annexure needs it. */
export interface CertificateSource {
  assetMasterId: string;
  assetId: string;
  name: string;
  calibrationStartDate?: Date | string | null;
  calibrationEndDate?: Date | string | null;
  /** Null when the asset has no certificate on file — it still gets a page saying so. */
  fileKey: string | null;
}

/**
 * A4 landscape, used only when the report has no page to measure. Normally the annexure copies the
 * report's own page size instead — puppeteer's A4 is a fraction off the nominal one, and a file
 * whose pages differ by half a point prints with a visible jump.
 */
const FALLBACK_W = 841.89;
const FALLBACK_H = 595.28;

/** Height of the band naming the asset, reserved above every certificate page. */
const BAND_H = 46;
const MARGIN = 18;

const BRAND = rgb(0.09, 0.3, 0.55);
const BAND_TEXT = rgb(1, 1, 1);
const MUTED = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.1, 0.12, 0.15);
const RULE = rgb(0.85, 0.87, 0.9);

/** The page size the annexure draws at — copied from the report so every page matches. */
interface PageSize {
  w: number;
  h: number;
}

/** What one asset contributes to the annexure, resolved before any page is written. */
interface Plan {
  source: CertificateSource;
  /** Embedded certificate pages, or a single image, or neither when nothing is on file. */
  embedded: PDFEmbeddedPage[];
  image: PDFImage | null;
  pageCount: number;
  missing: boolean;
  /**
   * True when a file *is* attached but could not be read.
   *
   * Worth telling apart from nothing being uploaded: one asks someone to go and upload a
   * certificate, the other to re-upload a file that is already there in a form we can open. A
   * page that says only "not on file" sends the reader looking for the wrong problem.
   */
  unreadable: boolean;
}

/**
 * Appends every selected asset's calibration certificate to the Asset Report, in one PDF.
 *
 * Two things make this harder than it sounds, and shape the whole approach:
 *
 * 1. **A certificate may be a PDF or an image.** Uploads allow both, and lab-issued certificates
 *    are usually PDFs. Puppeteer renders HTML, and a PDF cannot be inlined into HTML — so the
 *    certificates cannot be part of the report's own HTML. They are merged in afterwards with
 *    pdf-lib instead, which also keeps a PDF certificate as real vector pages: its text stays
 *    selectable and searchable rather than being flattened to a picture.
 *
 * 2. **Every page must say which asset it belongs to.** Drawing that over the certificate risks
 *    covering its content — a scanned certificate often has no usable margin. So each certificate
 *    page is placed onto a fresh page, scaled to fit *below* a header band. Nothing is ever
 *    covered, and the band sits in the same place on every page.
 *
 * An index page opens the annexure, listing each asset against the page its certificate starts on.
 * The work is planned in full before a single page is written, because the index has to state real
 * page numbers and those are only known once every certificate's page count is.
 */
@Injectable()
export class AssetCertificateAnnexureService {
  private readonly logger = new Logger(AssetCertificateAnnexureService.name);

  constructor(private readonly filesService: FilesService) {}

  async append(reportPdf: Buffer, sources: CertificateSource[]): Promise<Buffer> {
    if (!sources.length) return reportPdf;

    const doc = await PDFDocument.load(reportPdf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const reportPages = doc.getPageCount();

    // Copied from the report rather than assumed: puppeteer's A4 is a fraction off the nominal
    // one, and pages differing by half a point show as a jump when printed.
    const first = reportPages ? doc.getPage(0).getSize() : null;
    const size: PageSize = { w: first?.width ?? FALLBACK_W, h: first?.height ?? FALLBACK_H };

    const plans: Plan[] = [];
    for (const source of sources) {
      plans.push(await this.plan(doc, source));
    }

    // The index page itself is the first annexure page, so certificates start one after it.
    const starts: number[] = [];
    let cursor = reportPages + 2;
    for (const p of plans) {
      starts.push(cursor);
      cursor += p.pageCount;
    }

    this.drawIndex(doc.addPage([size.w, size.h]), plans, starts, font, bold, size);

    for (const p of plans) {
      if (p.missing) {
        const page = doc.addPage([size.w, size.h]);
        this.drawBand(page, p.source, bold, font, 1, 1, size, true, p.unreadable);
        this.drawMissingNotice(page, bold, font, size, p.unreadable);
        continue;
      }
      if (p.image) {
        const page = doc.addPage([size.w, size.h]);
        this.drawBand(page, p.source, bold, font, 1, 1, size);
        page.drawImage(p.image, this.fitBox(p.image.width, p.image.height, size));
        continue;
      }
      p.embedded.forEach((e, i) => {
        const page = doc.addPage([size.w, size.h]);
        this.drawBand(page, p.source, bold, font, i + 1, p.embedded.length, size);
        page.drawPage(e, this.fitBox(e.width, e.height, size));
      });
    }

    return Buffer.from(await doc.save());
  }

  /**
   * Resolve one asset's certificate into embeddable content, without writing any page yet.
   *
   * Every failure here — no file, unreadable download, corrupt PDF, unsupported image — lands on
   * the same outcome: `missing`, one page saying so. A single bad file must not cost the whole
   * report, and a page that admits the gap is more useful in an audit than a silently skipped one.
   */
  private async plan(doc: PDFDocument, source: CertificateSource): Promise<Plan> {
    const miss = (reason?: string): Plan => ({
      source,
      embedded: [],
      image: null,
      pageCount: 1,
      missing: true,
      unreadable: Boolean(reason),
    });
    if (!source.fileKey) return miss();

    let bytes: Buffer;
    try {
      bytes = await this.filesService.getFileContent(source.fileKey);
    } catch (err) {
      this.logger.warn(`Certificate unreadable for asset ${source.assetId}: ${err}`);
      return miss('download');
    }

    if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
      try {
        // Ignoring encryption reads the certificates that carry only an owner password, which is
        // the common case for an issued document.
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        if (!src.getPageIndices().length) return miss('empty');

        // Decode once against a throwaway document before going near the real one.
        //
        // embedPdf does not decode anything — it registers the pages on the target document and
        // the streams are decompressed later, inside doc.save(). So a certificate pdf-lib cannot
        // read threw long after this method had returned, outside the catch below, and 500'd the
        // whole export: one unreadable attachment cost every asset on the sheet. Catching it here
        // is not enough on its own either, because the pages it already registered stay queued on
        // the target and throw again at save. Probing on a document we discard keeps the real one
        // clean, at the cost of decoding a valid certificate twice — cheap, and only on a report.
        const probe = await PDFDocument.create();
        await Promise.all((await probe.embedPdf(src, src.getPageIndices())).map((p) => p.embed()));

        const embedded = await doc.embedPdf(src, src.getPageIndices());
        if (!embedded.length) return miss('empty');
        return {
          source,
          embedded,
          image: null,
          pageCount: embedded.length,
          missing: false,
          unreadable: false,
        };
      } catch (err) {
        this.logger.warn(`Certificate PDF unreadable for asset ${source.assetId}: ${err}`);
        return miss('pdf');
      }
    }

    try {
      const isJpg = bytes.subarray(0, 2).toString('hex') === 'ffd8';
      const image = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      // Same deferral as above — an image that only fails once it is written out would otherwise
      // escape this catch and 500 the report.
      await image.embed();
      return { source, embedded: [], image, pageCount: 1, missing: false, unreadable: false };
    } catch (err) {
      this.logger.warn(`Certificate image unreadable for asset ${source.assetId}: ${err}`);
      return miss('image');
    }
  }

  /** Centre the original inside the area left below the band, preserving its aspect ratio. */
  private fitBox(w: number, h: number, size: PageSize) {
    const availW = size.w - MARGIN * 2;
    const availH = size.h - BAND_H - MARGIN * 2;
    const scale = Math.min(availW / w, availH / h);
    const drawW = w * scale;
    const drawH = h * scale;
    return {
      x: (size.w - drawW) / 2,
      y: MARGIN + (availH - drawH) / 2,
      width: drawW,
      height: drawH,
    };
  }

  /** The band naming the asset — same place on every certificate page, never over the content. */
  private drawBand(
    page: PDFPage,
    s: CertificateSource,
    bold: PDFFont,
    font: PDFFont,
    pageNo: number,
    pageCount: number,
    size: PageSize,
    /** A page standing in for a certificate that is not there — the band must not claim one. */
    missing = false,
    /** Missing because the attached file could not be opened, rather than because none exists. */
    unreadable = false,
  ) {
    page.drawRectangle({ x: 0, y: size.h - BAND_H, width: size.w, height: BAND_H, color: BRAND });

    page.drawText(this.safe(`${s.assetId}  -  ${s.name}`, 90), {
      x: MARGIN,
      y: size.h - 22,
      size: 12,
      font: bold,
      color: BAND_TEXT,
    });

    const cal =
      s.calibrationStartDate || s.calibrationEndDate
        ? `Calibration: ${this.fmtDate(s.calibrationStartDate)} to ${this.fmtDate(
            s.calibrationEndDate,
          )}`
        : 'Calibration dates not recorded';
    page.drawText(cal, { x: MARGIN, y: size.h - 37, size: 8.5, font, color: BAND_TEXT });

    const right = missing
      ? unreadable
        ? 'Certificate attached but unreadable'
        : 'Certificate not on file'
      : pageCount > 1
      ? `Certificate page ${pageNo} of ${pageCount}`
      : 'Calibration certificate';
    page.drawText(right, {
      x: size.w - MARGIN - font.widthOfTextAtSize(right, 8.5),
      y: size.h - 37,
      size: 8.5,
      font,
      color: BAND_TEXT,
    });
  }

  private drawMissingNotice(
    page: PDFPage,
    bold: PDFFont,
    font: PDFFont,
    size: PageSize,
    unreadable = false,
  ) {
    const title = unreadable
      ? 'Calibration certificate could not be read'
      : 'No calibration certificate on file';
    page.drawText(title, {
      x: (size.w - bold.widthOfTextAtSize(title, 16)) / 2,
      y: size.h / 2,
      size: 16,
      font: bold,
      color: INK,
    });
    const sub = unreadable
      ? 'A file is attached to this asset but could not be opened. Please re-upload it as a PDF or image.'
      : 'No calibration certificate is uploaded against this asset.';
    page.drawText(sub, {
      x: (size.w - font.widthOfTextAtSize(sub, 10)) / 2,
      y: size.h / 2 - 20,
      size: 10,
      font,
      color: MUTED,
    });
  }

  /** Asset to the page its certificate starts on, so a reader can jump straight to one. */
  private drawIndex(
    page: PDFPage,
    plans: Plan[],
    starts: number[],
    font: PDFFont,
    bold: PDFFont,
    size: PageSize,
  ) {
    page.drawRectangle({ x: 0, y: size.h - BAND_H, width: size.w, height: BAND_H, color: BRAND });
    page.drawText('Annexure - Calibration Certificates', {
      x: MARGIN,
      y: size.h - 29,
      size: 14,
      font: bold,
      color: BAND_TEXT,
    });

    const cols = { no: MARGIN, asset: MARGIN + 34, name: MARGIN + 170, status: size.w - 240 };
    let y = size.h - BAND_H - 34;

    page.drawText('#', { x: cols.no, y, size: 9, font: bold, color: MUTED });
    page.drawText('Asset ID', { x: cols.asset, y, size: 9, font: bold, color: MUTED });
    page.drawText('Name', { x: cols.name, y, size: 9, font: bold, color: MUTED });
    page.drawText('Certificate', { x: cols.status, y, size: 9, font: bold, color: MUTED });
    y -= 7;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: size.w - MARGIN, y },
      thickness: 0.6,
      color: RULE,
    });
    y -= 16;

    plans.forEach((p, i) => {
      // One index page by design. Past it the band on every certificate page still names its
      // asset, so nothing becomes unidentifiable — only the shortcut is lost.
      if (y < MARGIN + 14) return;
      page.drawText(String(i + 1), { x: cols.no, y, size: 9, font, color: INK });
      page.drawText(this.safe(p.source.assetId, 22), {
        x: cols.asset,
        y,
        size: 9,
        font: bold,
        color: INK,
      });
      page.drawText(this.safe(p.source.name, 60), { x: cols.name, y, size: 9, font, color: INK });
      const last = starts[i] + p.pageCount - 1;
      const label = p.missing
        ? p.unreadable
          ? 'Unreadable file'
          : 'Not on file'
        : `Page ${starts[i]}${p.pageCount > 1 ? ` to ${last}` : ''}`;
      page.drawText(label, { x: cols.status, y, size: 9, font, color: p.missing ? MUTED : INK });
      y -= 15;
    });
  }

  /**
   * pdf-lib's standard fonts are WinAnsi-encoded, and a character outside it throws mid-render —
   * which would fail the whole report over one asset named with, say, a Devanagari character.
   */
  private safe(s: string, max: number): string {
    const ascii = String(s ?? '').replace(/[^\x20-\x7E]/g, '');
    return ascii.length > max ? `${ascii.slice(0, max - 3)}...` : ascii;
  }

  private fmtDate(v: Date | string | null | undefined): string {
    if (!v) return '-';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
