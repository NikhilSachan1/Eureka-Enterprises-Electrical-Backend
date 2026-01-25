import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('contractors')
@Index('IDX_CONTRACTOR_NAME', ['name'])
@Index('IDX_CONTRACTOR_GST', ['gstNumber'])
@Index('IDX_CONTRACTOR_CITY', ['city'])
@Index('IDX_CONTRACTOR_SELF', ['isSelfContractor'])
export class ContractorEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  contactNumber: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstNumber: string;

  // Address fields
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

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'varchar', length: 6 })
  pincode: string;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'text', nullable: true })
  fullAddress: string;

  // Bank details (optional)
  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  ifscCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  accountHolderName: string;

  // Self contractor flag (for company's own contractor entry)
  @Column({ type: 'boolean', default: false })
  isSelfContractor: boolean;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
