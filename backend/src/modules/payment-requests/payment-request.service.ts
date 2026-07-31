import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, In } from 'typeorm';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { BookPaymentService } from 'src/modules/book-payments/book-payment.service';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import {
  CreatePaymentRequestDto,
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
   * Approve a request (optionally adjusting the amount). Creates a book_payment for the approved
   * amount against the invoice — this is what surfaces in the payment sheet.
   */
  async approve(id: string, dto: ApprovePaymentRequestDto, approvedBy: string) {
    const pr = await this.findActive(id);
    if (pr.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(PAYMENT_REQUEST_ERRORS.NOT_PENDING);
    }
    const approvedAmount = dto.approvedAmount ?? Number(pr.requestedAmount);

    // Book payment (its own validation: invoice approved, PO ceiling, etc.) — the amount that
    // reaches the vendor. bookingDate = today.
    const bookingDate = new Date().toISOString().slice(0, 10);
    const bp: { id: string } = await this.bookPaymentService.create(
      {
        invoiceId: pr.invoiceId,
        bookingDate,
        transferAmount: approvedAmount,
        remarks: dto.remarks,
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

  async findAll(query: GetPaymentRequestDto) {
    const { siteId, invoiceId, status, page = 1, pageSize = 10 } = query;
    const where: any = { deletedAt: IsNull() };
    if (siteId?.length) where.siteId = In(siteId);
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;

    const [records, totalRecords] = await Promise.all([
      this.repo.find({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['invoice', 'approvalByUser'],
      }),
      this.repo.count({ where }),
    ]);
    return {
      records: records.map((r) => ({ ...r, approvalByUser: formatUser(r.approvalByUser) })),
      totalRecords,
    };
  }

  async findById(id: string) {
    const pr = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['invoice', 'approvalByUser'],
    });
    if (!pr) throw new NotFoundException(PAYMENT_REQUEST_ERRORS.NOT_FOUND);
    return { ...pr, approvalByUser: formatUser(pr.approvalByUser) };
  }

  private async findActive(id: string): Promise<PaymentRequestEntity> {
    const pr = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!pr) throw new NotFoundException(PAYMENT_REQUEST_ERRORS.NOT_FOUND);
    return pr;
  }
}
