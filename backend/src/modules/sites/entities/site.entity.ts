import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { CompanyEntity } from 'src/modules/companies/entities/company.entity';
import { SiteStatus } from '../constants/site.constants';

@Entity('sites')
@Index('IDX_SITE_NAME', ['name'])
@Index('IDX_SITE_COMPANY', ['companyId'])
@Index('IDX_SITE_STATUS', ['status'])
@Index('IDX_SITE_START_DATE', ['startDate'])
export class SiteEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Company where work is executed
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'companyId' })
  company: CompanyEntity;

  // Site Manager (name-based, not user reference)
  @Column({ type: 'varchar', length: 255 })
  managerName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  managerContact: string;

  // Dates
  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  // Base distance for travel/fuel calculations (in KM)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  baseDistanceKm: number;

  // Expected vehicle daily KM (typically baseDistanceKm * 2 for round trip)
  @Column({ type: 'integer', nullable: true })
  expectedVehicleDailyKm: number;

  // Estimated budget for the site (optional, used for health score calculation)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimatedBudget: number;

  // Status
  @Column({ type: 'varchar', length: 20, default: SiteStatus.UPCOMING })
  status: SiteStatus;

  // Address fields (optional)
  @Column({ type: 'varchar', length: 50, nullable: true })
  blockNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  buildingName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streetName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  landmark: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  pincode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  fullAddress: string;

  // Work types (stored as JSON array of work type names/ids)
  @Column({ type: 'jsonb', nullable: true })
  workTypes: string[];

  // Site type (e.g. Civil, Electrical, Mechanical — free text)
  @Column({ type: 'varchar', length: 100, nullable: true })
  siteType: string;

  // Additional notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Contractors relation will be through SiteContractorEntity
  @OneToMany('SiteContractorEntity', 'site')
  siteContractors: any[];
}
