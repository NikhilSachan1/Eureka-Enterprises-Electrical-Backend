import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull, ILike } from 'typeorm';
import { JmcRepository } from './jmc.repository';
import { JmcEntity } from './entities/jmc.entity';
import { CreateJmcDto, UpdateJmcDto, GetJmcDto } from './dto';
import { ApproveDto, RejectDto, UnlockRequestDto } from 'src/modules/purchase-orders/dto/approval.dto';
import { JMC_ERRORS, JMC_RESPONSES } from './constants/jmc.constants';
import { checkJmcHasChildrenQuery } from './queries/jmc.queries';
import { PurchaseOrderEntity } from 'src/modules/purchase-orders/entities/purchase-order.entity';
import {
  FinancialApprovalStatus,
  FINANCIAL_ERRORS,
} from 'src/modules/common/financials/financial.constants';
import {
  DefaultPaginationValues,
  SortOrder,
} from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class JmcService {
  constructor(
    private readonly jmcRepository: JmcRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateJmcDto, createdBy: string) {
    const po = await this.dataSource
      .getRepository(PurchaseOrderEntity)
      .findOne({ where: { id: dto.poId, deletedAt: IsNull() } });
    if (!po) throw new NotFoundException(JMC_ERRORS.PO_NOT_FOUND);
    if (po.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(JMC_ERRORS.PO_NOT_APPROVED);
    }

    // Uniqueness within PO + jmcNumber (partial on deletedAt)
    const dup = await this.jmcRepository.findOne({
      where: { poId: dto.poId, jmcNumber: dto.jmcNumber, deletedAt: IsNull() },
    });
    if (dup) throw new ConflictException(JMC_ERRORS.JMC_NUMBER_EXISTS);

    const created = await this.jmcRepository.create({
      poId: po.id,
      siteId: po.siteId,
      partyType: po.partyType,
      contractorId: po.contractorId,
      vendorId: po.vendorId,
      jmcNumber: dto.jmcNumber,
      jmcDate: new Date(dto.jmcDate),
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks,
      approvalStatus: FinancialApprovalStatus.PENDING,
      isLocked: false,
      createdBy,
    });

    return { message: JMC_RESPONSES.CREATED, id: created.id };
  }

  async findAll(query: GetJmcDto) {
    const {
      poId,
      siteId,
      partyType,
      approvalStatus,
      search,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (poId) where.poId = poId;
    if (siteId) where.siteId = siteId;
    if (partyType) where.partyType = partyType;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (search) where.jmcNumber = ILike(`%${search}%`);

    const [records, totalRecords] = await Promise.all([
      this.jmcRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['po', 'site', 'contractor', 'vendor'],
      }),
      this.jmcRepository.count({ where }),
    ]);

    return { records, totalRecords };
  }

  async findById(id: string) {
    const jmc = await this.jmcRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['po', 'site', 'contractor', 'vendor'],
    });
    if (!jmc) throw new NotFoundException(JMC_ERRORS.NOT_FOUND);
    return jmc;
  }

  async update(id: string, dto: UpdateJmcDto, updatedBy: string) {
    const jmc = await this.findActiveById(id);
    this.assertEditable(jmc);

    if (dto.jmcNumber && dto.jmcNumber !== jmc.jmcNumber) {
      const dup = await this.jmcRepository.findOne({
        where: { poId: jmc.poId, jmcNumber: dto.jmcNumber, deletedAt: IsNull() },
      });
      if (dup && dup.id !== id) throw new ConflictException(JMC_ERRORS.JMC_NUMBER_EXISTS);
    }

    await this.jmcRepository.update(
      { id },
      {
        ...dto,
        jmcDate: dto.jmcDate ? new Date(dto.jmcDate) : undefined,
        updatedBy,
      } as Partial<JmcEntity>,
    );
    return { message: JMC_RESPONSES.UPDATED };
  }

  async remove(id: string, deletedBy: string) {
    const jmc = await this.findActiveById(id);
    this.assertEditable(jmc);

    const childCheck = await this.dataSource.query(checkJmcHasChildrenQuery, [id]);
    if (childCheck.length > 0) {
      throw new BadRequestException(JMC_ERRORS.CANNOT_DELETE_HAS_CHILDREN);
    }

    await this.jmcRepository.update({ id }, { deletedBy });
    await this.jmcRepository.softDelete({ id });
    return { message: JMC_RESPONSES.DELETED };
  }

  // Approval workflow

  async approve(id: string, dto: ApproveDto, approvedBy: string) {
    const jmc = await this.findActiveById(id);
    if (jmc.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new ConflictException(FINANCIAL_ERRORS.ALREADY_APPROVED);
    }
    await this.jmcRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.APPROVED,
        approvalBy: approvedBy,
        approvalAt: new Date(),
        approvalReason: dto.reason ?? null,
        isLocked: true,
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: approvedBy,
      },
    );
    return { message: JMC_RESPONSES.APPROVED };
  }

  async reject(id: string, dto: RejectDto, rejectedBy: string) {
    const jmc = await this.findActiveById(id);
    if (jmc.approvalStatus === FinancialApprovalStatus.REJECTED) {
      throw new ConflictException(FINANCIAL_ERRORS.ALREADY_REJECTED);
    }
    await this.jmcRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.REJECTED,
        approvalBy: rejectedBy,
        approvalAt: new Date(),
        approvalReason: dto.reason,
        isLocked: false,
        updatedBy: rejectedBy,
      },
    );
    return { message: JMC_RESPONSES.REJECTED };
  }

  async requestUnlock(id: string, dto: UnlockRequestDto, requestedBy: string) {
    const jmc = await this.findActiveById(id);
    if (!jmc.isLocked || jmc.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(JMC_ERRORS.ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK);
    }
    await this.jmcRepository.update(
      { id },
      {
        unlockRequestedAt: new Date(),
        unlockRequestedBy: requestedBy,
        unlockReason: dto.reason,
        updatedBy: requestedBy,
      },
    );
    return { message: JMC_RESPONSES.UNLOCK_REQUESTED };
  }

  async grantUnlock(id: string, grantedBy: string) {
    const jmc = await this.findActiveById(id);
    if (!jmc.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_NOT_REQUESTED);
    }
    await this.jmcRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.PENDING,
        approvalBy: null,
        approvalAt: null,
        approvalReason: null,
        isLocked: false,
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: grantedBy,
      },
    );
    return { message: JMC_RESPONSES.UNLOCK_GRANTED };
  }

  // Helpers

  private async findActiveById(id: string): Promise<JmcEntity> {
    const jmc = await this.jmcRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!jmc) throw new NotFoundException(JMC_ERRORS.NOT_FOUND);
    return jmc;
  }

  private assertEditable(jmc: JmcEntity): void {
    if (jmc.approvalStatus !== FinancialApprovalStatus.PENDING) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_DELETE_NOT_PENDING);
    }
    if (jmc.isLocked) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
    }
  }
}
