import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('user_documents')
@Index('idx_user_documents_userId', ['userId'])
@Index('idx_user_documents_documentType', ['documentType'])
export class UserDocumentEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  documentType: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  fileKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
