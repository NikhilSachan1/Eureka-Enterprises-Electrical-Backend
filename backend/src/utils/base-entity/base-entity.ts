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

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdBy?: string;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedBy?: string;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'deletedBy' })
  deletedBy?: string;

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
