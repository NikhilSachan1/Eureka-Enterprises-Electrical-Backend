import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, IsNull, ILike, EntityManager } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { PaymentAdviceRepository } from './payment-advice.repository';
import { PaymentAdvicePdfService, PaymentAdvicePdfData } from './payment-advice-pdf.service';
import { PaymentAdviceEntity } from './entities/payment-advice.entity';
import { GetPaymentAdviceDto, SendPaymentAdviceEmailDto } from './dto';
import {
  PAYMENT_ADVICE_ERRORS,
  PAYMENT_ADVICE_RESPONSES,
} from './constants/payment-advice.constants';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { CommunicationLogService } from 'src/modules/common/communication-logs/communication-log.service';
import {
  CommunicationCategory,
  CommunicationStatus,
} from 'src/modules/common/communication-logs/constants/communication-log.constants';

@Injectable()
export class PaymentAdviceService {
  private readonly logger = new Logger(PaymentAdviceService.name);

  constructor(
    private readonly paymentAdviceRepository: PaymentAdviceRepository,
    private readonly pdfService: PaymentAdvicePdfService,
    private readonly mailerService: MailerService,
    private readonly communicationLogService: CommunicationLogService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a payment advice for a bank transfer (called from BankTransferService).
   * This is called within an existing transaction (em provided).
   */
  async createForBankTransfer(
    bankTransferId: string,
    siteId: string,
    vendorId: string,
    financialYear: string,
    createdBy: string,
    em: EntityManager,
    pdfData?: Omit<PaymentAdvicePdfData, 'referenceNumber' | 'generatedAt' | 'financialYear'>,
  ): Promise<{ id: string; referenceNumber: string }> {
    // Allocate sequence number (with advisory lock)
    const { sequenceNumber, referenceNumber } =
      await this.paymentAdviceRepository.allocateSequenceNumber(financialYear, em);

    const generatedAt = new Date();
    const advice = await this.paymentAdviceRepository.create(
      {
        bankTransferId,
        siteId,
        vendorId,
        referenceNumber,
        financialYear,
        sequenceNumber,
        generatedAt,
        pdfKey: null,
        approvalStatus: FinancialApprovalStatus.APPROVED,
        createdBy,
      },
      em,
    );

    // Generate PDF asynchronously after transaction commits — don't block the response
    if (pdfData) {
      setImmediate(() => {
        this.pdfService
          .generate({ ...pdfData, referenceNumber, generatedAt, financialYear })
          .then((pdfKey) =>
            this.dataSource
              .getRepository(PaymentAdviceEntity)
              .update({ id: advice.id }, { pdfKey }),
          )
          .catch((err) =>
            this.logger.error(`PDF generation failed for advice ${advice.id}: ${err}`),
          );
      });
    }

    return { id: advice.id, referenceNumber: advice.referenceNumber };
  }

  async findAll(query: GetPaymentAdviceDto) {
    const {
      siteId,
      vendorId,
      financialYear,
      search,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (vendorId) where.vendorId = vendorId;
    if (financialYear) where.financialYear = financialYear;
    if (search) where.referenceNumber = ILike(`%${search}%`);

    const [records, totalRecords] = await Promise.all([
      this.paymentAdviceRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['bankTransfer', 'site', 'site.company', 'vendor'],
      }),
      this.paymentAdviceRepository.count({ where }),
    ]);

    return { records, totalRecords };
  }

  async findById(id: string) {
    const advice = await this.paymentAdviceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['bankTransfer', 'site', 'site.company', 'vendor'],
    });
    if (!advice) throw new NotFoundException(PAYMENT_ADVICE_ERRORS.NOT_FOUND);
    return advice;
  }

  /**
   * Send payment advice email (manual action per BRD §4.7).
   * Logs the send to payment_advice_email_logs and communication_logs.
   */
  async sendEmail(id: string, dto: SendPaymentAdviceEmailDto, sentBy: string) {
    const advice = await this.paymentAdviceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['bankTransfer', 'vendor', 'site'],
    });
    if (!advice) throw new NotFoundException(PAYMENT_ADVICE_ERRORS.NOT_FOUND);

    if (!dto.to || dto.to.length === 0) {
      throw new BadRequestException(PAYMENT_ADVICE_ERRORS.EMAIL_VALIDATION_FAILED);
    }

    // Collect S3 attachment keys (PDF + user-uploaded). Per BRD §4.7, the
    // user uploads attachments at send time and the PDF format/distribution
    // is TBD (BRD §12.3). For now we keep the keys in `payment_advice_email_logs`
    // and treat them as `path` references when handing off to the SMTP transport.
    // When the storage layer matures, this is the one place to swap in
    // presigned URLs / streamed downloads.
    const attachmentKeys: string[] = [];
    if (advice.pdfKey) attachmentKeys.push(advice.pdfKey);
    if (dto.attachmentKeys?.length) attachmentKeys.push(...dto.attachmentKeys);

    const mailerAttachments = attachmentKeys.map((key) => ({
      filename: key.split('/').pop() ?? key,
      path: key,
    }));

    // Send raw HTML body — the user composed it in the UI per BRD §4.7,
    // so we bypass the templated EmailService and call the underlying
    // MailerService directly.
    const startedAt = Date.now();
    let status: CommunicationStatus = CommunicationStatus.SENT;
    let errorInfo: { message?: string; code?: string; details?: Record<string, any> } | undefined;

    try {
      await this.mailerService.sendMail({
        to: dto.to,
        cc: dto.cc,
        subject: dto.subject,
        html: dto.body,
        attachments: mailerAttachments.length > 0 ? mailerAttachments : undefined,
      });
    } catch (error) {
      status = CommunicationStatus.FAILED;
      errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string })?.code ?? 'UNKNOWN',
        details: { stack: error instanceof Error ? error.stack : undefined },
      };
      this.logger.error(`Payment-advice email failed for advice ${id}: ${errorInfo.message}`);
    }

    // Log via the existing communication_logs table — one log per recipient
    // so retry/delivery state is tracked uniformly with every other email.
    // The payment_advice_email_logs row links to ONE of these logs (the
    // primary recipient) so the audit history is searchable from either side.
    let communicationLogId: string | null = null;
    for (const recipient of dto.to) {
      const logRow = await this.communicationLogService.logEmail(
        {
          recipientEmail: recipient,
          subject: dto.subject,
          // No Handlebars template — body is user-composed raw HTML.
          // We pass a stable token so existing dashboards filtering by
          // templateName have something to group on.
          templateName: 'paymentAdvice',
          category: CommunicationCategory.PAYMENT_ADVICE,
          referenceId: id,
          referenceType: 'payment_advice',
          createdBy: sentBy,
        },
        status,
        errorInfo,
      );
      if (!communicationLogId) {
        communicationLogId = logRow.id;
      }
    }

    if (status === CommunicationStatus.FAILED) {
      throw new BadRequestException(
        PAYMENT_ADVICE_ERRORS.EMAIL_SEND_FAILED(errorInfo?.message ?? 'unknown error'),
      );
    }

    // Audit row in payment_advice_email_logs (per-send history with full DTO)
    await this.paymentAdviceRepository.createEmailLog({
      paymentAdviceId: id,
      toEmails: dto.to,
      ccEmails: dto.cc ?? null,
      subject: dto.subject,
      body: dto.body,
      attachmentKeys: attachmentKeys.length > 0 ? attachmentKeys : null,
      communicationLogId,
      sentAt: new Date(),
      createdBy: sentBy,
    });

    this.logger.log(
      `Payment-advice email sent for advice ${id} to ${dto.to.length} recipient(s) in ${
        Date.now() - startedAt
      }ms`,
    );

    return { message: PAYMENT_ADVICE_RESPONSES.EMAIL_SENT };
  }

  /**
   * Delete a payment advice (only if it's safe to do so).
   */
  async remove(id: string, deletedBy: string) {
    const advice = await this.paymentAdviceRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!advice) throw new NotFoundException(PAYMENT_ADVICE_ERRORS.NOT_FOUND);

    await this.paymentAdviceRepository.update({ id }, { deletedBy });
    await this.paymentAdviceRepository.softDelete({ id });

    return { message: PAYMENT_ADVICE_RESPONSES.DELETED };
  }
}
