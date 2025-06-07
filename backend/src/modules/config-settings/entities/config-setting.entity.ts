import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { ConfigurationEntity } from '../../configurations/entities/configuration.entity';

@Entity('config_settings')
export class ConfigSettingEntity extends BaseEntity {
  @Column({ name: 'configId' })
  configId: string;

  @Column({ type: 'text', nullable: true })
  contextKey: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true })
  effectiveTo: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Index('IDX_CONFIG_SETTINGS_CONFIG_ID')
  @ManyToOne(() => ConfigurationEntity, (configuration) => configuration.configSettings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'configId' })
  configuration: ConfigurationEntity;
}
