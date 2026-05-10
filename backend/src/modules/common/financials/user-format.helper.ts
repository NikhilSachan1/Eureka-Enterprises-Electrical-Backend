/**
 * Shared helper — formats a UserEntity into the minimal object returned
 * in every financial document's user references:
 *   createdByUser, updatedByUser, approvalByUser, unlockRequestedByUser
 *
 * Fields: id, employeeId, firstName, lastName, email, profilePicture
 */
export function formatUser(user: any): {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
} | null {
  if (!user) return null;
  return {
    id: user.id,
    employeeId: user.employeeId ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    profilePicture: user.profilePicture ?? null,
  };
}
