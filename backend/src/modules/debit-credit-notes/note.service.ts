import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In } from 'typeorm';
import { resolveReadableSiteFilter } from 'src/modules/common/financials/site-access.helper';
import { NoteRepository } from './note.repository';
import { DebitNoteEntity } from './entities/debit-note.entity';
import { CreditNoteEntity } from './entities/credit-note.entity';
import { CreateNoteDto, UpdateNoteDto, GetNoteDto } from './dto';
import { NOTE_ERRORS, NOTE_RESPONSES } from './constants/note.constants';
import {
  NoteSide,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class NoteService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateNoteDto, createdBy: string) {
    if (dto.noteSide === NoteSide.SALE) {
      return this.createDebitNote(dto, createdBy);
    } else {
      return this.createCreditNote(dto, createdBy);
    }
  }

  private async createDebitNote(dto: CreateNoteDto, createdBy: string) {
    if (!dto.contractorId) {
      throw new BadRequestException(NOTE_ERRORS.CONTRACTOR_ID_REQUIRED);
    }

    const debitNote = await this.noteRepository.createDebitNote({
      siteId: dto.siteId,
      contractorId: dto.contractorId,
      amount: dto.amount,
      noteDate: new Date(dto.noteDate),
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks ?? null,
      approvalStatus: FinancialApprovalStatus.APPROVED,
      createdBy,
    });

    return { message: NOTE_RESPONSES.DEBIT_NOTE_CREATED, id: debitNote.id };
  }

  private async createCreditNote(dto: CreateNoteDto, createdBy: string) {
    if (!dto.vendorId) {
      throw new BadRequestException(NOTE_ERRORS.VENDOR_ID_REQUIRED);
    }

    const creditNote = await this.noteRepository.createCreditNote({
      siteId: dto.siteId,
      vendorId: dto.vendorId,
      amount: dto.amount,
      noteDate: new Date(dto.noteDate),
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks ?? null,
      approvalStatus: FinancialApprovalStatus.APPROVED,
      createdBy,
    });

    return { message: NOTE_RESPONSES.CREDIT_NOTE_CREATED, id: creditNote.id };
  }

  async findAll(query: GetNoteDto, userId: string, activeRole?: string) {
    const {
      noteSide,
      siteId,
      contractorId,
      vendorId,
      search,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    // Sites the requester may read, narrowed to the requested one.
    const siteIds = await resolveReadableSiteFilter(
      this.dataSource,
      userId,
      activeRole,
      siteId ? [siteId] : undefined,
    );
    if (siteIds?.length === 0) {
      return {
        records: [],
        totalRecords: 0,
        noteSide: noteSide === NoteSide.SALE ? NoteSide.SALE : NoteSide.PURCHASE,
      };
    }

    if (noteSide === NoteSide.SALE) {
      return this.findAllDebitNotes({
        siteIds,
        contractorId,
        search,
        sortField,
        sortOrder,
        page,
        pageSize,
      });
    } else {
      return this.findAllCreditNotes({
        siteIds,
        vendorId,
        search,
        sortField,
        sortOrder,
        page,
        pageSize,
      });
    }
  }

  private async findAllDebitNotes(params: {
    /** Sites the requester may read; null = every site. */
    siteIds?: string[] | null;
    contractorId?: string;
    search?: string;
    sortField: string;
    sortOrder: string;
    page: number;
    pageSize: number;
  }) {
    const where: any = { deletedAt: IsNull() };
    if (params.siteIds) where.siteId = In(params.siteIds);
    if (params.contractorId) where.contractorId = params.contractorId;
    if (params.search) where.remarks = ILike(`%${params.search}%`);

    const [records, totalRecords] = await Promise.all([
      this.noteRepository.findAllDebitNotes({
        where,
        order: { [params.sortField]: params.sortOrder as SortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        relations: ['site', 'site.company', 'contractor'],
      }),
      this.noteRepository.countDebitNotes({ where }),
    ]);

    return { records, totalRecords, noteSide: NoteSide.SALE };
  }

  private async findAllCreditNotes(params: {
    /** Sites the requester may read; null = every site. */
    siteIds?: string[] | null;
    vendorId?: string;
    search?: string;
    sortField: string;
    sortOrder: string;
    page: number;
    pageSize: number;
  }) {
    const where: any = { deletedAt: IsNull() };
    if (params.siteIds) where.siteId = In(params.siteIds);
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.search) where.remarks = ILike(`%${params.search}%`);

    const [records, totalRecords] = await Promise.all([
      this.noteRepository.findAllCreditNotes({
        where,
        order: { [params.sortField]: params.sortOrder as SortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        relations: ['site', 'site.company', 'vendor'],
      }),
      this.noteRepository.countCreditNotes({ where }),
    ]);

    return { records, totalRecords, noteSide: NoteSide.PURCHASE };
  }

  async findById(id: string, noteSide: NoteSide) {
    if (noteSide === NoteSide.SALE) {
      const note = await this.noteRepository.findOneDebitNote({
        where: { id, deletedAt: IsNull() },
        relations: ['site', 'site.company', 'contractor'],
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.DEBIT_NOTE_NOT_FOUND);
      return note;
    } else {
      const note = await this.noteRepository.findOneCreditNote({
        where: { id, deletedAt: IsNull() },
        relations: ['site', 'site.company', 'vendor'],
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.CREDIT_NOTE_NOT_FOUND);
      return note;
    }
  }

  async update(id: string, noteSide: NoteSide, dto: UpdateNoteDto, updatedBy: string) {
    if (noteSide === NoteSide.SALE) {
      const note = await this.noteRepository.findOneDebitNote({
        where: { id, deletedAt: IsNull() },
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.DEBIT_NOTE_NOT_FOUND);

      await this.noteRepository.updateDebitNote({ id }, {
        ...dto,
        noteDate: dto.noteDate ? new Date(dto.noteDate) : undefined,
        updatedBy,
      } as Partial<DebitNoteEntity>);
      return { message: NOTE_RESPONSES.DEBIT_NOTE_UPDATED };
    } else {
      const note = await this.noteRepository.findOneCreditNote({
        where: { id, deletedAt: IsNull() },
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.CREDIT_NOTE_NOT_FOUND);

      await this.noteRepository.updateCreditNote({ id }, {
        ...dto,
        noteDate: dto.noteDate ? new Date(dto.noteDate) : undefined,
        updatedBy,
      } as Partial<CreditNoteEntity>);
      return { message: NOTE_RESPONSES.CREDIT_NOTE_UPDATED };
    }
  }

  async remove(id: string, noteSide: NoteSide, deletedBy: string) {
    if (noteSide === NoteSide.SALE) {
      const note = await this.noteRepository.findOneDebitNote({
        where: { id, deletedAt: IsNull() },
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.DEBIT_NOTE_NOT_FOUND);

      await this.noteRepository.updateDebitNote({ id }, { deletedBy });
      await this.noteRepository.softDeleteDebitNote({ id });
      return { message: NOTE_RESPONSES.DEBIT_NOTE_DELETED };
    } else {
      const note = await this.noteRepository.findOneCreditNote({
        where: { id, deletedAt: IsNull() },
      });
      if (!note) throw new NotFoundException(NOTE_ERRORS.CREDIT_NOTE_NOT_FOUND);

      await this.noteRepository.updateCreditNote({ id }, { deletedBy });
      await this.noteRepository.softDeleteCreditNote({ id });
      return { message: NOTE_RESPONSES.CREDIT_NOTE_DELETED };
    }
  }
}
