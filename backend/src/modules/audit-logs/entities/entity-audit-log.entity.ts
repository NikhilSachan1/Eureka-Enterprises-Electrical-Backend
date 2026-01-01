import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

export enum EntityAuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SOFT_DELETE = 'SOFT_DELETE',
}

@Entity('entity_audit_logs')
@Index('IDX_ENTITY_AUDIT_CORRELATION', ['correlationId'])
@Index('IDX_ENTITY_AUDIT_ENTITY', ['entityName', 'entityId'])
@Index('IDX_ENTITY_AUDIT_USER', ['changedBy'])
@Index('IDX_ENTITY_AUDIT_TIMESTAMP', ['timestamp'])
@Index('IDX_ENTITY_AUDIT_ACTION', ['action'])
export class EntityAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  correlationId: string;

  @Column({ type: 'varchar', length: 100 })
  entityName: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 20 })
  action: EntityAuditAction;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  changedFields: string[];

  @Column({ type: 'uuid', nullable: true })
  changedBy: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
