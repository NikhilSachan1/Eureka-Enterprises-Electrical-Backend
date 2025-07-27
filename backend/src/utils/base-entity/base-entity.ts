/* eslint-disable prettier/prettier */
import { UserEntity } from 'src/modules/users/entities/user.entity';
import {
  BaseEntity as baseEntity,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export class BaseEntity extends baseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Keep the string columns
  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string;

  // Add proper relation properties
  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser?: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser?: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'deletedBy' })
  deletedByUser?: UserEntity;

  @Column({
    type: 'timestamp',
    default: () => 'NOW()',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'NOW()',
  })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}
