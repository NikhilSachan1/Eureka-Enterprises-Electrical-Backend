import { DataSource, In } from 'typeorm';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/** Who did a step: only safe, display fields of the user. */
export interface AuditTrailUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  employeeId: string | null;
}

/** One step a person took on a record, e.g. "Verified in 26Q". */
export interface AuditTrailStep {
  action: string;
  user: AuditTrailUser | null;
  date: Date | string | null;
  notes?: string | null;
}

/** A step before its user is loaded. Falsy values are skipped, so steps can be conditional. */
export interface AuditTrailStepInput {
  action: string;
  userId: string | null | undefined;
  date: Date | string | null | undefined;
  notes?: string | null;
}

/**
 * Loads the users of the given steps in one query and returns the steps that have a user,
 * oldest first. Users are selected column by column so nothing sensitive is returned.
 */
export async function buildAuditTrail(
  dataSource: DataSource,
  steps: (AuditTrailStepInput | null | undefined | false)[],
): Promise<AuditTrailStep[]> {
  const withUser = steps.filter((step): step is AuditTrailStepInput => !!step && !!step.userId);
  const ids = [...new Set(withUser.map((step) => step.userId as string))];
  if (!ids.length) return [];

  const users = await dataSource.getRepository(UserEntity).find({
    where: { id: In(ids) },
    select: ['id', 'firstName', 'lastName', 'email', 'employeeId'],
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  const time = (date: Date | string | null | undefined): number =>
    date ? new Date(date).getTime() : 0;

  return withUser
    .map((step) => {
      const user = byId.get(step.userId as string);
      return {
        action: step.action,
        user: user
          ? {
              id: user.id,
              firstName: user.firstName ?? null,
              lastName: user.lastName ?? null,
              email: user.email ?? null,
              employeeId: user.employeeId ?? null,
            }
          : null,
        date: step.date ?? null,
        notes: step.notes ?? null,
      };
    })
    .sort((a, b) => time(a.date) - time(b.date));
}
