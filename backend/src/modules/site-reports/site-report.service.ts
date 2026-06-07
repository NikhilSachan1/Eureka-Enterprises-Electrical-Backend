import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { SiteReportRepository } from './site-report.repository';
import { SiteReportEntity } from './entities/site-report.entity';
import { CreateSiteReportDto, UpdateSiteReportDto, GetSiteReportDto } from './dto';
import { REPORT_ERRORS, REPORT_RESPONSES } from './constants/site-report.constants';
import { JmcEntity } from 'src/modules/jmc/entities/jmc.entity';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';
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
      createdBy,
    });

    return { message: REPORT_RESPONSES.CREATED, id: created.id };
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
      ],
    });
    if (!report) throw new NotFoundException(REPORT_ERRORS.NOT_FOUND);
    return {
      ...report,
      createdByUser: formatUser(report.createdByUser),
      updatedByUser: formatUser(report.updatedByUser),
      approvalByUser: formatUser(report.approvalByUser),
    };
  }

  async update(id: string, dto: UpdateSiteReportDto, updatedBy: string) {
    await this.findActiveById(id);
    await this.reportRepository.update({ id }, {
      ...dto,
      reportDate: dto.reportDate ? new Date(dto.reportDate) : undefined,
      updatedBy,
    } as Partial<SiteReportEntity>);
    return { message: REPORT_RESPONSES.UPDATED };
  }

  async remove(id: string, deletedBy: string) {
    await this.findActiveById(id);
    await this.reportRepository.update({ id }, { deletedBy });
    await this.reportRepository.softDelete({ id });
    return { message: REPORT_RESPONSES.DELETED };
  }

  private async findActiveById(id: string): Promise<SiteReportEntity> {
    const r = await this.reportRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException(REPORT_ERRORS.NOT_FOUND);
    return r;
  }
}
