import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('dsr_files')
@Index('IDX_DSR_FILE_DSR', ['dsrId'])
@Index('IDX_DSR_FILE_TYPE', ['fileType'])
export class DsrFileEntity extends BaseEntity {
  // DSR reference
  @Column({ type: 'uuid' })
  dsrId: string;

  @ManyToOne('DailyStatusReportEntity', 'files', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dsrId' })
  dsr: any;

  // File details
  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  // File type (IMAGE, PDF, VIDEO) - config driven
  @Column({ type: 'varchar', length: 20 })
  fileType: string;

  // File size in bytes
  @Column({ type: 'bigint', nullable: true })
  fileSize: number;
}
