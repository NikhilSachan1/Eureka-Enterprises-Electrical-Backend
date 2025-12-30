export interface RequestWithTimezone extends Request {
  user: { id: string; role?: string };
  timezone?: string;
}
