export interface RequestWithTimezone {
  user: { id: string; role?: string };
  timezone: string;
}
