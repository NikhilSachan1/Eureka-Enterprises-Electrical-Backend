import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { VendorType } from '../constants/vendor.constants';

@Entity('vendors')
@Index('IDX_VENDOR_NAME', ['name'])
@Index('IDX_VENDOR_GST', ['gstNumber'])
@Index('IDX_VENDOR_CITY', ['city'])
@Index('IDX_VENDOR_TYPE', ['vendorType'])
export class VendorEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  contactNumber: string;

  // FREELANCER | GST_REGISTERED — drives whether GST number is required
  @Column({ type: 'varchar', length: 20, default: VendorType.GST_REGISTERED })
  vendorType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gstNumber: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  panNumber: string;

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

  @Column({ type: 'varchar', length: 6, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'text', nullable: true })
  fullAddress: string;

  // Bank details (optional, used for payment release)
  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  ifscCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  accountHolderName: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
