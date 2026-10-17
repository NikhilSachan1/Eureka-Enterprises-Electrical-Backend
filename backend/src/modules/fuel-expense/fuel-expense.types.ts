export interface RequestWithTimezone extends Request {
  /** `activeRole` is the role the caller is acting as; `role` is the legacy field. */
  user: { id: string; role?: string; activeRole?: string };
  timezone?: string;
}
