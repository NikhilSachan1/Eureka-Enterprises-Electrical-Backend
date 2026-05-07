import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { SiteVendorEntity } from './entities/site-vendor.entity';

@Injectable()
export class SiteVendorRepository {
  constructor(
    @InjectRepository(SiteVendorEntity)
    private readonly repository: Repository<SiteVendorEntity>,
  ) {}

  async addVendors(
    siteId: string,
    vendorIds: string[],
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteVendorEntity)
        : this.repository;
      const rows = vendorIds.map((vendorId) => repo.create({ siteId, vendorId }));
      await repo.save(rows);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async removeVendors(
    siteId: string,
    vendorIds?: string[],
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteVendorEntity)
        : this.repository;
      const where = vendorIds ? { siteId, vendorId: In(vendorIds) } : { siteId };
      await repo.delete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getVendorsBySiteId(siteId: string): Promise<SiteVendorEntity[]> {
    try {
      return await this.repository.find({
        where: { siteId },
        relations: ['vendor'],
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getSitesByVendorId(vendorId: string): Promise<SiteVendorEntity[]> {
    try {
      return await this.repository.find({
        where: { vendorId },
        relations: ['site'],
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
