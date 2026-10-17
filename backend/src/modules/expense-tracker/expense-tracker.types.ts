export interface RequestWithTimezone {
  /** `activeRole` is the role the caller is currently acting as; `role` is the legacy field. */
  user: { id: string; role?: string; activeRole?: string };
  timezone: string;
}
