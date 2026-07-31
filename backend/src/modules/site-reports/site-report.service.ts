import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { SiteReportRepository } from './site-report.repository';
import { SiteReportEntity } from './entities/site-report.entity';
import { CreateSiteReportDto, UpdateSiteReportDto, GetSiteReportDto } from './dto';
import { REPORT_ERRORS, REPORT_RESPONSES } from './constants/site-report.constants';
import { JmcEntity } from 'src/modules/jmc/entities/jmc.entity';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import {
  FinancialApprovalStatus,
  FINANCIAL_ERRORS,
} from 'src/modules/common/financials/financial.constants';
import { UnlockRequestDto } from 'src/modules/purchase-orders/dto/approval.dto';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class SiteReportService {
  constructor(
    private readonly reportRepository: SiteReportRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSiteReportDto, createdBy: string) {
    const jmc = await this.dataSource
      .getRepository(JmcEntity)
      .findOne({ where: { id: dto.jmcId, deletedAt: IsNull() } });
    if (!jmc) throw new NotFoundException(REPORT_ERRORS.JMC_NOT_FOUND);

    // 1 JMC = 1 Report (BRD §4.3 confirmed-8)
    const existingForJmc = await this.reportRepository.findOne({
      where: { jmcId: dto.jmcId, deletedAt: IsNull() },
    });
    if (existingForJmc) {
      throw new ConflictException(REPORT_ERRORS.REPORT_ALREADY_EXISTS_FOR_JMC);
    }

    // Auto-approved + auto-locked on creation.
    const created = await this.reportRepository.create({
      jmcId: jmc.id,
      siteId: jmc.siteId,
      partyType: jmc.partyType,
      contractorId: jmc.contractorId,
      vendorId: jmc.vendorId,
      reportNumber: dto.reportNumber,
      reportDate: new Date(dto.reportDate),
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks,
      approvalStatus: FinancialApprovalStatus.APPROVED,
      approvalBy: createdBy,
      approvalAt: new Date(),
      isLocked: true,
      createdBy,
    });

    return { message: REPORT_RESPONSES.CREATED, id: created.id };
  }

  async approve(id: string, approvedBy: string) {
    const report = await this.findActiveById(id);
    if (report.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(REPORT_ERRORS.ALREADY_APPROVED);
    }
    // Rejection is terminal — a rejected doc is locked and cannot be resurrected.
    if (report.approvalStatus === FinancialApprovalStatus.REJECTED) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_APPROVE_REJECTED);
    }
    await this.reportRepository.update({ id }, {
      approvalStatus: FinancialApprovalStatus.APPROVED,
      approvalBy: approvedBy,
      approvalAt: new Date(),
      isLocked: true, // approved ⇒ locked (e.g. re-approving after an unlock)
      updatedBy: approvedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.APPROVED };
  }

  async reject(id: string, rejectedBy: string) {
    const report = await this.findActiveById(id);
    if (report.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(REPORT_ERRORS.CANNOT_REJECT_APPROVED);
    }
    await this.reportRepository.update({ id }, {
      approvalStatus: FinancialApprovalStatus.REJECTED,
      approvalBy: rejectedBy,
      approvalAt: new Date(),
      isLocked: true, // terminal — rejected docs stay locked
      updatedBy: rejectedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.REJECTED };
  }

  async findAll(query: GetSiteReportDto) {
    const {
      jmcId,
      companyId,
      siteId,
      partyType,
      contractorId,
      vendorId,
      dateFrom,
      dateTo,
      search,
      poNumber,
      jmcNumber,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (jmcId) where.jmcId = jmcId;
    if (companyId?.length) where.site = { companyId: In(companyId) };
    if (siteId?.length) where.siteId = In(siteId);
    if (partyType) where.partyType = partyType;
    if (contractorId?.length) where.contractorId = In(contractorId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (dateFrom && dateTo) where.reportDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.reportDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.reportDate = LessThanOrEqual(dateTo);
    if (search) where.reportNumber = ILike(`%${search}%`);
    if (jmcNumber || poNumber) {
      const jmcCond: any = {};
      if (jmcNumber) jmcCond.jmcNumber = ILike(`%${jmcNumber}%`);
      if (poNumber) jmcCond.po = { poNumber: ILike(`%${poNumber}%`) };
      where.jmc = jmcCond;
    }

    const [records, totalRecords] = await Promise.all([
      this.reportRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [
          'jmc',
          'jmc.po',
          'site',
          'site.company',
          'contractor',
          'vendor',
          'createdByUser',
          'updatedByUser',
          'approvalByUser',
          'unlockRequestedByUser',
        ],
      }),
      this.reportRepository.count({ where }),
    ]);

    return {
      records: records.map((r) => ({
        ...r,
        createdByUser: formatUser(r.createdByUser),
        updatedByUser: formatUser(r.updatedByUser),
        approvalByUser: formatUser(r.approvalByUser),
        unlockRequestedByUser: formatUser(r.unlockRequestedByUser),
      })),
      totalRecords,
    };
  }

  async findById(id: string) {
    const report = await this.reportRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'jmc',
        'jmc.po',
        'site',
        'site.company',
        'contractor',
        'vendor',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
        'unlockRequestedByUser',
      ],
    });
    if (!report) throw new NotFoundException(REPORT_ERRORS.NOT_FOUND);
    return {
      ...report,
      createdByUser: formatUser(report.createdByUser),
      updatedByUser: formatUser(report.updatedByUser),
      approvalByUser: formatUser(report.approvalByUser),
      unlockRequestedByUser: formatUser(report.unlockRequestedByUser),
    };
  }

  async update(id: string, dto: UpdateSiteReportDto, updatedBy: string) {
    const report = await this.findActiveById(id);
    // Must be unlocked first (via the unlock workflow) before it can be edited.
    if (report.isLocked) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
    }
    // Editing re-approves + re-locks (reports are always auto-approved + locked).
    await this.reportRepository.update({ id }, {
      ...dto,
      reportDate: dto.reportDate ? new Date(dto.reportDate) : undefined,
      approvalStatus: FinancialApprovalStatus.APPROVED,
      approvalBy: updatedBy,
      approvalAt: new Date(),
      isLocked: true,
      updatedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.UPDATED };
  }

  async remove(id: string, deletedBy: string) {
    const report = await this.findActiveById(id);
    if (report.isLocked) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
    }
    await this.reportRepository.update({ id }, { deletedBy });
    await this.reportRepository.softDelete({ id });
    return { message: REPORT_RESPONSES.DELETED };
  }

  // ── Unlock workflow (JMC-style) ───────────────────────────────────────────

  async requestUnlock(id: string, dto: UnlockRequestDto, requestedBy: string) {
    const report = await this.findActiveById(id);
    if (!report.isLocked || report.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(REPORT_ERRORS.ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK);
    }
    await this.reportRepository.update({ id }, {
      unlockRequestedAt: new Date(),
      unlockRequestedBy: requestedBy,
      unlockReason: dto.reason,
      updatedBy: requestedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.UNLOCK_REQUESTED };
  }

  async grantUnlock(id: string, grantedBy: string) {
    const report = await this.findActiveById(id);
    if (!report.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_NOT_REQUESTED);
    }
    await this.reportRepository.update({ id }, {
      approvalStatus: FinancialApprovalStatus.PENDING,
      approvalBy: null,
      approvalAt: null,
      isLocked: false,
      unlockRequestedAt: null,
      unlockRequestedBy: null,
      unlockReason: null,
      updatedBy: grantedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.UNLOCK_GRANTED };
  }

  async rejectUnlock(id: string, rejectedBy: string) {
    const report = await this.findActiveById(id);
    if (!report.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_REJECT_NO_REQUEST);
    }
    await this.reportRepository.update({ id }, {
      unlockRequestedAt: null,
      unlockRequestedBy: null,
      unlockReason: null,
      updatedBy: rejectedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.UNLOCK_REJECTED };
  }

  private async findActiveById(id: string): Promise<SiteReportEntity> {
    const r = await this.reportRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException(REPORT_ERRORS.NOT_FOUND);
    return r;
  }
}
