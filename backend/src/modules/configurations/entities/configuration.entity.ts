import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { ConfigSettingEntity } from '../../config-settings/entities/config-setting.entity';

@Entity('configurations')
export class ConfigurationEntity extends BaseEntity {
  @Index('IDX_CONFIGURATIONS_MODULE')
  @Column({ type: 'text' })
  module: string;

  @Index('IDX_CONFIGURATIONS_KEY')
  @Column({ type: 'text', unique: true })
  key: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text' })
  valueType: string;

  @Column({ type: 'boolean', default: true })
  isEditable: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => ConfigSettingEntity, (configSetting) => configSetting.configuration)
  configSettings: ConfigSettingEntity[];
}
