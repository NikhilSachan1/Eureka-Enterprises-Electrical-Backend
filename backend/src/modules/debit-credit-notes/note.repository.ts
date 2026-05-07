import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { DebitNoteEntity } from './entities/debit-note.entity';
import { CreditNoteEntity } from './entities/credit-note.entity';

@Injectable()
export class NoteRepository {
  constructor(
    @InjectRepository(DebitNoteEntity)
    private readonly debitNoteRepository: Repository<DebitNoteEntity>,
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepository: Repository<CreditNoteEntity>,
  ) {}

  // Debit Note methods
  async createDebitNote(
    data: Partial<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<DebitNoteEntity> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneDebitNote(
    options: FindOneOptions<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<DebitNoteEntity | null> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllDebitNotes(
    options: FindManyOptions<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<DebitNoteEntity[]> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async countDebitNotes(
    options: FindManyOptions<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateDebitNote(
    where: FindOptionsWhere<DebitNoteEntity>,
    data: Partial<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      await repo.update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDeleteDebitNote(
    where: FindOptionsWhere<DebitNoteEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em
        ? em.getRepository(DebitNoteEntity)
        : this.debitNoteRepository;
      await repo.softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // Credit Note methods
  async createCreditNote(
    data: Partial<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<CreditNoteEntity> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneCreditNote(
    options: FindOneOptions<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<CreditNoteEntity | null> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllCreditNotes(
    options: FindManyOptions<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<CreditNoteEntity[]> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async countCreditNotes(
    options: FindManyOptions<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateCreditNote(
    where: FindOptionsWhere<CreditNoteEntity>,
    data: Partial<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      await repo.update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDeleteCreditNote(
    where: FindOptionsWhere<CreditNoteEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em
        ? em.getRepository(CreditNoteEntity)
        : this.creditNoteRepository;
      await repo.softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
