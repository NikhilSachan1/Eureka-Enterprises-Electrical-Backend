import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
  DataSource,
} from 'typeorm';
import { Logger } from '@nestjs/common';
import { EntityAuditLogEntity, EntityAuditAction } from '../entities/entity-audit-log.entity';
import { EXCLUDED_ENTITIES } from '../constants/audit-log.constants';
import { getAuditContext } from '../context/audit.context';
import { maskSensitiveData } from '../utils/sensitive-data-mask.util';

@EventSubscriber()
export class EntityAuditSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(EntityAuditSubscriber.name);

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<any>): Promise<void> {
    await this.logEntityChange(event, EntityAuditAction.CREATE, null, event.entity);
  }

  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    const oldValues = event.databaseEntity;
    const newValues = event.entity;
    await this.logEntityChange(event, EntityAuditAction.UPDATE, oldValues, newValues);
  }

  async afterRemove(event: RemoveEvent<any>): Promise<void> {
    await this.logEntityChange(event, EntityAuditAction.DELETE, event.databaseEntity, null);
  }

  async afterSoftRemove(event: SoftRemoveEvent<any>): Promise<void> {
    await this.logEntityChange(
      event,
      EntityAuditAction.SOFT_DELETE,
      event.databaseEntity,
      event.entity,
    );
  }

  private async logEntityChange(
    event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any> | SoftRemoveEvent<any>,
    action: EntityAuditAction,
    oldValues: any,
    newValues: any,
  ): Promise<void> {
    try {
      const entityName = event.metadata.name;

      if (EXCLUDED_ENTITIES.includes(entityName)) {
        return;
      }

      const entity = newValues || oldValues;
      if (!entity) {
        return;
      }

      const entityId = this.getEntityId(entity, event);
      if (!entityId) {
        return;
      }

      const auditContext = getAuditContext();

      const maskedOldValues = oldValues ? maskSensitiveData(this.entityToPlain(oldValues)) : null;
      const maskedNewValues = newValues ? maskSensitiveData(this.entityToPlain(newValues)) : null;

      const changedFields = this.getChangedFields(maskedOldValues, maskedNewValues);

      await event.manager
        .createQueryBuilder()
        .insert()
        .into(EntityAuditLogEntity)
        .values({
          correlationId: auditContext?.correlationId,
          entityName,
          entityId,
          action,
          oldValues: maskedOldValues,
          newValues: maskedNewValues,
          changedFields,
          changedBy: auditContext?.userId || this.extractUserFromEntity(entity),
          timestamp: new Date(),
        })
        .execute();
    } catch (error) {
      this.logger.error(`Failed to log entity audit: ${error.message}`, error.stack);
    }
  }

  private getEntityId(entity: any, event: any): string | null {
    if (entity.id) {
      return entity.id;
    }

    const primaryColumns = event.metadata.primaryColumns;
    if (primaryColumns.length > 0) {
      const primaryValue = event.metadata.getEntityIdMixedMap(entity);
      if (primaryValue && typeof primaryValue === 'object') {
        return primaryValue.id || Object.values(primaryValue)[0];
      }
      return primaryValue;
    }

    return null;
  }

  private entityToPlain(entity: any): Record<string, any> {
    if (!entity) return null;

    const plain: Record<string, any> = {};
    const keys = Object.keys(entity);

    for (const key of keys) {
      const value = entity[key];

      if (typeof value === 'function') continue;

      if (value instanceof Date) {
        plain[key] = value.toISOString();
        continue;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.id) {
          plain[`${key}Id`] = value.id;
        }
        continue;
      }

      plain[key] = value;
    }

    return plain;
  }

  private getChangedFields(oldValues: any, newValues: any): string[] {
    if (!oldValues || !newValues) {
      return newValues ? Object.keys(newValues) : [];
    }

    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      if (['createdAt', 'updatedAt', 'deletedAt'].includes(key)) continue;

      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  private extractUserFromEntity(entity: any): string | null {
    return entity?.createdBy || entity?.updatedBy || entity?.deletedBy || null;
  }
}
