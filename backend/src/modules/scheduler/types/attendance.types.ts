export interface DailyAttendanceResult {
  totalUsers: number;
  created: number;
  skipped: number;
  holidays: number;
  leaves: number;
  lwp: number;
  errors: string[];
}
