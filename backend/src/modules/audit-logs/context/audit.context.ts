import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface AuditContext {
  correlationId: string;
  userId?: string;
  userIp?: string;
}

export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext | undefined {
  return auditContextStorage.getStore();
}

export function getCorrelationId(): string {
  const context = getAuditContext();
  return context?.correlationId || uuidv4();
}

export function getCurrentUserId(): string | undefined {
  return getAuditContext()?.userId;
}

export function runWithAuditContext<T>(context: AuditContext, fn: () => T): T {
  return auditContextStorage.run(context, fn);
}
