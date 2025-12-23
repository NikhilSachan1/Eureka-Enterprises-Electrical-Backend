export interface UserMetrics {
  total: number;
  active: number;
  inactive: number;
  byEmployeeType: Record<string, number>;
  byDesignation: Record<string, number>;
  newJoinersLast30Days: number;
  byGender: Record<string, number>;
}
