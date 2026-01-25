import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('companies')
@Index('IDX_COMPANY_NAME', ['name'])
@Index('IDX_COMPANY_CITY', ['city'])
@Index('IDX_COMPANY_PARENT', ['parentCompanyId'])
export class CompanyEntity extends BaseEntity {
  // ==================== Basic Information ====================
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string; // S3 key or file path

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstNumber: string;

  // ==================== Address Information ====================
  @Column({ type: 'varchar', length: 100, nullable: true })
  blockNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buildingName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streetName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  landmark: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  area: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  // ==================== Full Address (Computed/Stored) ====================
  @Column({ type: 'text', nullable: true })
  fullAddress: string; // Combined address for display

  // ==================== Parent Company (Self-Reference) ====================
  @Column({ type: 'uuid', nullable: true })
  parentCompanyId: string;

  @ManyToOne(() => CompanyEntity, (company) => company.childCompanies, { nullable: true })
  @JoinColumn({ name: 'parentCompanyId' })
  parentCompany: CompanyEntity;

  @OneToMany(() => CompanyEntity, (company) => company.parentCompany)
  childCompanies: CompanyEntity[];

  // ==================== Additional ====================
  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
