import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { SiteEntity } from './site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';

@Entity('site_contractors')
@Index('IDX_SITE_CONTRACTOR_SITE', ['siteId'])
@Index('IDX_SITE_CONTRACTOR_CONTRACTOR', ['contractorId'])
@Index('IDX_SITE_CONTRACTOR_UNIQUE', ['siteId', 'contractorId'], { unique: true })
export class SiteContractorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @Column({ type: 'uuid' })
  contractorId: string;

  @ManyToOne(() => SiteEntity, (site) => site.siteContractors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @ManyToOne(() => ContractorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractorId' })
  contractor: ContractorEntity;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
