import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, In, ILike } from 'typeorm';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { BookPaymentService } from 'src/modules/book-payments/book-payment.service';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import {
  CreatePaymentRequestDto,
  UpdatePaymentRequestDto,
  ApprovePaymentRequestDto,
  RejectPaymentRequestDto,
  GetPaymentRequestDto,
} from './dto';
import {
  PAYMENT_REQUEST_STATUS,
  PAYMENT_REQUEST_ERRORS,
  PAYMENT_REQUEST_RESPONSES,
} from './constants/payment-request.constants';

@Injectable()
export class PaymentRequestService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bookPaymentService: BookPaymentService,
  ) {}

  private get repo() {
    return this.dataSource.getRepository(PaymentRequestEntity);
  }

  /** Raise a payment request against an invoice (project-wise; site/PO derived from the invoice). */
  async create(dto: CreatePaymentRequestDto, createdBy: string) {
    const invoice = await this.dataSource
      .getRepository(SiteInvoiceEntity)
      .findOne({ where: { id: dto.invoiceId, deletedAt: IsNull() } });
    if (!invoice) throw new NotFoundException(PAYMENT_REQUEST_ERRORS.INVOICE_NOT_FOUND);

    const created = await this.repo.save(
      this.repo.create({
        invoiceId: invoice.id,
        siteId: invoice.siteId,
        poId: invoice.poId,
        requestedAmount: dto.requestedAmount,
        reason: dto.reason ?? null,
        status: PAYMENT_REQUEST_STATUS.PENDING,
        createdBy,
      }),
    );
    return { message: PAYMENT_REQUEST_RESPONSES.CREATED, id: created.id };
  }

  /**
   * Edit a request while it is still PENDING. Once approved a book_payment exists against it and
   * once rejected it is a closed record, so neither may be amended in place.
   */
  async update(id: string, dto: UpdatePaymentRequestDto, updatedBy: string) {
    const pr = await this.findActive(id);
    this.assertPending(pr, PAYMENT_REQUEST_ERRORS.NOT_PENDING_EDIT);

    const patch: Partial<PaymentRequestEntity> = {};
    if (dto.requestedAmount !== undefined) patch.requestedAmount = dto.requestedAmount;
    if (dto.reason !== undefined) patch.reason = dto.reason ?? null;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(PAYMENT_REQUEST_ERRORS.NOTHING_TO_UPDATE);
    }

    await this.repo.update({ id }, { ...patch, updatedBy });
    return { message: PAYMENT_REQUEST_RESPONSES.UPDATED };
  }

  /** Soft-delete a request while it is still PENDING. */
  async remove(id: string, deletedBy: string) {
    const pr = await this.findActive(id);
    this.assertPending(pr, PAYMENT_REQUEST_ERRORS.NOT_PENDING_DELETE);

    // Stamp the actor before soft-deleting — softDelete() only sets deletedAt.
    await this.repo.update({ id }, { deletedBy, updatedBy: deletedBy });
    await this.repo.softDelete({ id });
    return { message: PAYMENT_REQUEST_RESPONSES.DELETED };
  }

  private assertPending(pr: PaymentRequestEntity, template: string): void {
    if (pr.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(template.replace('{status}', pr.status));
    }
  }

  /**
   * Approve a request (optionally adjusting the amount). Creates a book_payment for the approved
   * amount against the invoice — this is what surfaces in the payment sheet.
   */
  async approve(id: string, dto: ApprovePaymentRequestDto, approvedBy: string) {
    const pr = await this.findActive(id);
    if (pr.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(PAYMENT_REQUEST_ERRORS.NOT_PENDING);
    }
    const approvedAmount = dto.approvedAmount ?? Number(pr.requestedAmount);

    // The approver's note wins, but fall back to the reason the request was raised with so the
    // book payment still carries some context. `remarks` is optional on approval and the UI does
    // not currently send it, so without this fallback every book payment created from a request
    // was stored with remarks = null and the requester's reason was lost at the handover.
    const remarks = dto.remarks?.trim() || pr.reason?.trim() || undefined;

    // Book payment (its own validation: invoice approved, PO ceiling, etc.) — the amount that
    // reaches the vendor. bookingDate = today.
    const bookingDate = new Date().toISOString().slice(0, 10);
    const bp: { id: string } = await this.bookPaymentService.create(
      {
        invoiceId: pr.invoiceId,
        bookingDate,
        transferAmount: approvedAmount,
        remarks,
      } as any,
      approvedBy,
    );

    await this.repo.update(
      { id },
      {
        status: PAYMENT_REQUEST_STATUS.APPROVED,
        approvedAmount,
        bookPaymentId: bp?.id ?? null,
        approvalBy: approvedBy,
        approvalAt: new Date(),
        updatedBy: approvedBy,
      },
    );
    return { message: PAYMENT_REQUEST_RESPONSES.APPROVED, bookPaymentId: bp?.id ?? null };
  }

  async reject(id: string, dto: RejectPaymentRequestDto, rejectedBy: string) {
    const pr = await this.findActive(id);
    if (pr.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(PAYMENT_REQUEST_ERRORS.NOT_PENDING);
    }
    await this.repo.update(
      { id },
      {
        status: PAYMENT_REQUEST_STATUS.REJECTED,
        rejectionReason: dto.reason,
        approvalBy: rejectedBy,
        approvalAt: new Date(),
        updatedBy: rejectedBy,
      },
    );
    return { message: PAYMENT_REQUEST_RESPONSES.REJECTED };
  }

  private readonly listRelations = [
    'site',
    'site.company',
    'po',
    'invoice',
    'invoice.contractor',
    'invoice.vendor',
    'createdByUser',
    'approvalByUser',
  ] as const;

  private readonly detailRelations = [...this.listRelations, 'updatedByUser'] as const;

  private formatDateOnly(value?: Date | string | null): string | null {
    if (!value) return null;
    return new Date(value).toISOString().split('T')[0];
  }

  /** Slim list/detail shape aligned with other financial doc APIs + FE schemas. */
  private mapRecord(r: PaymentRequestEntity, opts?: { includeUpdatedBy?: boolean }) {
    return {
      id: r.id,
      invoiceId: r.invoiceId,
      siteId: r.siteId,
      poId: r.poId,
      requestedAmount: r.requestedAmount,
      approvedAmount: r.approvedAmount,
      status: r.status,
      reason: r.reason,
      rejectionReason: r.rejectionReason,
      bookPaymentId: r.bookPaymentId,
      approvalAt: r.approvalAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      createdBy: r.createdBy,
      createdByUser: formatUser(r.createdByUser),
      approvalByUser: formatUser(r.approvalByUser),
      ...(opts?.includeUpdatedBy ? { updatedByUser: formatUser(r.updatedByUser) } : {}),
      site: r.site
        ? {
            name: r.site.name,
            city: r.site.city,
            state: r.site.state,
            company: r.site.company ? { name: r.site.company.name } : null,
          }
        : null,
      vendor: r.invoice?.vendor ? { name: r.invoice.vendor.name } : null,
      contractor: r.invoice?.contractor ? { name: r.invoice.contractor.name } : null,
      po: r.po
        ? {
            poNumber: r.po.poNumber,
            poDate: this.formatDateOnly(r.po.poDate),
            taxableAmount: r.po.taxableAmount,
            gstAmount: r.po.gstAmount,
            totalAmount: r.po.totalAmount,
          }
        : null,
      invoice: r.invoice
        ? {
            id: r.invoice.id,
            invoiceNumber: r.invoice.invoiceNumber,
            invoiceDate: this.formatDateOnly(r.invoice.invoiceDate),
            taxableAmount: r.invoice.taxableAmount,
            gstAmount: r.invoice.gstAmount,
            tdsAmount: r.invoice.tdsAmount,
            totalAmount: r.invoice.totalAmount,
          }
        : null,
    };
  }

  async findAll(query: GetPaymentRequestDto) {
    const { siteId, invoiceId, status, invoiceNumber, page = 1, pageSize = 10 } = query;
    const where: any = { deletedAt: IsNull() };
    if (siteId?.length) where.siteId = In(siteId);
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;
    // Partial match on the related invoice's number. `invoice` is already in listRelations,
    // so the join TypeORM adds for this condition is the one it was making anyway.
    if (invoiceNumber) where.invoice = { invoiceNumber: ILike(`%${invoiceNumber}%`) };

    const [records, totalRecords] = await Promise.all([
      this.repo.find({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [...this.listRelations],
      }),
      this.repo.count({ where }),
    ]);
    return {
      records: records.map((r) => this.mapRecord(r)),
      totalRecords,
    };
  }

  async findById(id: string) {
    const pr = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [...this.detailRelations],
    });
    if (!pr) throw new NotFoundException(PAYMENT_REQUEST_ERRORS.NOT_FOUND);
    return this.mapRecord(pr, { includeUpdatedBy: true });
  }

  private async findActive(id: string): Promise<PaymentRequestEntity> {
    const pr = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!pr) throw new NotFoundException(PAYMENT_REQUEST_ERRORS.NOT_FOUND);
    return pr;
  }
}
