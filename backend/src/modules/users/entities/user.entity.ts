import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserRoleEntity } from 'src/modules/user-roles/entities/user-role.entity';
import { UserPermissionEntity } from 'src/modules/user-permissions/entities/user-permission.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  // ==================== Basic Information ====================
  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Index('IDX_USER_EMAIL')
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordUpdatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profilePicture: string;

  @Index('IDX_USER_STATUS')
  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  @Index('IDX_USER_EMPLOYEE_ID')
  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  employeeId: string;

  // ==================== Personal Information ====================
  @Column({ type: 'varchar', length: 255, nullable: true })
  fatherName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergencyContactNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bloodGroup: string;

  // ==================== Address Information ====================
  @Column({ type: 'varchar', length: 100, nullable: true })
  houseNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streetName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  landmark: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string;

  // ==================== Employment Details ====================
  @Column({ type: 'date', nullable: true })
  dateOfJoining: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  previousExperience: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  employeeType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  designation: string;

  // ==================== Education Details ====================
  @Column({ type: 'varchar', length: 100, nullable: true })
  degree: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branch: string;

  @Column({ type: 'int', nullable: true })
  passoutYear: number;

  // ==================== Banking Details ====================
  @Column({ type: 'varchar', length: 255, nullable: true })
  bankHolderName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ifscCode: string;

  // ==================== Government IDs ====================
  // Note: Document files are stored in user_documents table
  @Column({ type: 'varchar', length: 50, nullable: true })
  esicNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  aadharNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  panNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  dlNumber: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  uanNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  passportNumber: string;

  // ==================== Relations ====================
  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user)
  userRoles: UserRoleEntity[];

  @OneToMany(() => UserPermissionEntity, (userPermission) => userPermission.user)
  userPermissions: UserPermissionEntity[];
}
