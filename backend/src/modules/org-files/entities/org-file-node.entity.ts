import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { OrgFileNodeType } from '../constants/org-files.constants';

@Entity('org_file_nodes')
@Index('IDX_ORG_FILE_NODE_PARENT', ['parentId'])
@Index('IDX_ORG_FILE_NODE_TYPE', ['type'])
export class OrgFileNodeEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  type: OrgFileNodeType;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => OrgFileNodeEntity, (node) => node.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: OrgFileNodeEntity;

  @OneToMany(() => OrgFileNodeEntity, (node) => node.parent)
  children: OrgFileNodeEntity[];

  @Column({ type: 'varchar', length: 1000, nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;
}
