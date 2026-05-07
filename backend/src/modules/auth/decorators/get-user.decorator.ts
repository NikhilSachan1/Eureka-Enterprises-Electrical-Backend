import { CurrentUser } from './current-user.decorator';

/**
 * Alias for {@link CurrentUser}. Several financial-module controllers were
 * built referencing `GetUser`, so we expose both names; both resolve to the
 * same param decorator that pulls the authenticated user off the request.
 *
 * Usage:
 *   create(@GetUser('id') userId: string) { ... }
 */
export const GetUser = CurrentUser;
