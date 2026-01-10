import { UserStatus } from '../../users/constants/user.constants';
import { AttendanceStatus, ApprovalStatus } from '../../attendance/constants/attendance.constants';
import { ApprovalStatus as LeaveApprovalStatus } from '../../leave-applications/constants/leave-application.constants';
import { PayrollStatus } from '../../payroll/constants/payroll.constants';

// ==================== Overview Queries ====================

export const getEmployeeSummaryQuery = () => ({
  query: `
    SELECT
      COUNT(*)::int as "total",
      COUNT(CASE WHEN status = $1 THEN 1 END)::int as "active",
      COUNT(CASE WHEN status != $1 THEN 1 END)::int as "inactive",
      COUNT(CASE WHEN "dateOfJoining" >= DATE_TRUNC('month', CURRENT_DATE) 
                 AND "dateOfJoining" <= CURRENT_DATE THEN 1 END)::int as "newThisMonth",
      COUNT(CASE WHEN "lastWorkingDate" >= DATE_TRUNC('month', CURRENT_DATE) 
                 AND "lastWorkingDate" <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day') THEN 1 END)::int as "exitingThisMonth",
      COUNT(CASE WHEN "employeeType" = 'PROBATION' AND status = $1 THEN 1 END)::int as "onProbation"
    FROM users
    WHERE "deletedAt" IS NULL
  `,
  params: [UserStatus.ACTIVE],
});

export const getTodayAttendanceSummaryQuery = (today: string) => ({
  query: `
    SELECT
      COUNT(CASE WHEN status = $1 THEN 1 END)::int as "present",
      COUNT(CASE WHEN status = $2 THEN 1 END)::int as "absent",
      COUNT(CASE WHEN status IN ($3, $4) THEN 1 END)::int as "onLeave",
      COUNT(CASE WHEN status = $5 THEN 1 END)::int as "holiday",
      COUNT(CASE WHEN status = $6 THEN 1 END)::int as "notCheckedInYet",
      COUNT(CASE WHEN status = $7 THEN 1 END)::int as "approvalPending",
      COUNT(CASE WHEN status = $8 THEN 1 END)::int as "checkedIn",
      COUNT(CASE WHEN status = $9 THEN 1 END)::int as "checkedOut",
      COUNT(CASE WHEN status = $10 THEN 1 END)::int as "halfDay"
    FROM attendances
    WHERE "attendanceDate" = $11::date
      AND "isActive" = true
      AND "deletedAt" IS NULL
  `,
  params: [
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LEAVE,
    AttendanceStatus.LEAVE_WITHOUT_PAY,
    AttendanceStatus.HOLIDAY,
    AttendanceStatus.NOT_CHECKED_IN_YET,
    AttendanceStatus.APPROVAL_PENDING,
    AttendanceStatus.CHECKED_IN,
    AttendanceStatus.CHECKED_OUT,
    AttendanceStatus.HALF_DAY,
    today,
  ],
});

export const getPendingApprovalsCountQuery = () => ({
  query: `
    SELECT
      (SELECT COUNT(*)::int FROM leave_applications 
       WHERE "approvalStatus" = $1 AND "deletedAt" IS NULL) as "leave",
      (SELECT COUNT(*)::int FROM attendances 
       WHERE "approvalStatus" = $2 AND "isActive" = true AND "deletedAt" IS NULL) as "attendance",
      (SELECT COUNT(*)::int FROM expenses 
       WHERE "approvalStatus" = $3 AND "deletedAt" IS NULL) as "expense"
  `,
  params: [LeaveApprovalStatus.PENDING, ApprovalStatus.PENDING, 'pending'],
});

export const getCurrentMonthPayrollSummaryQuery = (month: number, year: number) => ({
  query: `
    SELECT
      COUNT(CASE WHEN status = $1 THEN 1 END)::int as "draft",
      COUNT(CASE WHEN status = $2 THEN 1 END)::int as "generated",
      COUNT(CASE WHEN status = $3 THEN 1 END)::int as "approved",
      COUNT(CASE WHEN status = $4 THEN 1 END)::int as "paid",
      COUNT(CASE WHEN status = $5 THEN 1 END)::int as "cancelled",
      COALESCE(SUM("netPayable"), 0)::decimal as "totalAmount"
    FROM payroll
    WHERE month = $6 AND year = $7 AND "deletedAt" IS NULL
  `,
  params: [
    PayrollStatus.DRAFT,
    PayrollStatus.GENERATED,
    PayrollStatus.APPROVED,
    PayrollStatus.PAID,
    PayrollStatus.CANCELLED,
    month,
    year,
  ],
});

// ==================== Birthday & Anniversary Queries ====================

export const getBirthdaysQuery = (today: string, weekEnd: string, monthEnd: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      email,
      "dateOfBirth" as "date",
      "profilePicture",
      CASE 
        WHEN TO_CHAR("dateOfBirth", 'MM-DD') = TO_CHAR($1::date, 'MM-DD') THEN 'today'
        WHEN TO_CHAR("dateOfBirth", 'MM-DD') <= TO_CHAR($2::date, 'MM-DD') 
             AND TO_CHAR("dateOfBirth", 'MM-DD') > TO_CHAR($1::date, 'MM-DD') THEN 'week'
        ELSE 'month'
      END as "period",
      CASE 
        WHEN TO_CHAR("dateOfBirth", 'MM-DD') >= TO_CHAR($1::date, 'MM-DD')
        THEN (
          MAKE_DATE(EXTRACT(YEAR FROM $1::date)::int, 
                    EXTRACT(MONTH FROM "dateOfBirth")::int, 
                    EXTRACT(DAY FROM "dateOfBirth")::int) - $1::date
        )
        ELSE (
          MAKE_DATE(EXTRACT(YEAR FROM $1::date)::int + 1, 
                    EXTRACT(MONTH FROM "dateOfBirth")::int, 
                    EXTRACT(DAY FROM "dateOfBirth")::int) - $1::date
        )
      END as "daysUntil"
    FROM users
    WHERE status = $4
      AND "dateOfBirth" IS NOT NULL
      AND "deletedAt" IS NULL
      AND (
        TO_CHAR("dateOfBirth", 'MM-DD') >= TO_CHAR($1::date, 'MM-DD')
        AND TO_CHAR("dateOfBirth", 'MM-DD') <= TO_CHAR($3::date, 'MM-DD')
      )
    ORDER BY TO_CHAR("dateOfBirth", 'MM-DD')
  `,
  params: [today, weekEnd, monthEnd, UserStatus.ACTIVE],
});

export const getAnniversariesQuery = (today: string, weekEnd: string, monthEnd: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      email,
      "dateOfJoining" as "date",
      "profilePicture",
      EXTRACT(YEAR FROM AGE($1::date, "dateOfJoining"))::int as "yearsCompleted",
      CASE 
        WHEN TO_CHAR("dateOfJoining", 'MM-DD') = TO_CHAR($1::date, 'MM-DD') THEN 'today'
        WHEN TO_CHAR("dateOfJoining", 'MM-DD') <= TO_CHAR($2::date, 'MM-DD') 
             AND TO_CHAR("dateOfJoining", 'MM-DD') > TO_CHAR($1::date, 'MM-DD') THEN 'week'
        ELSE 'month'
      END as "period",
      CASE 
        WHEN TO_CHAR("dateOfJoining", 'MM-DD') >= TO_CHAR($1::date, 'MM-DD')
        THEN (
          MAKE_DATE(EXTRACT(YEAR FROM $1::date)::int, 
                    EXTRACT(MONTH FROM "dateOfJoining")::int, 
                    EXTRACT(DAY FROM "dateOfJoining")::int) - $1::date
        )
        ELSE (
          MAKE_DATE(EXTRACT(YEAR FROM $1::date)::int + 1, 
                    EXTRACT(MONTH FROM "dateOfJoining")::int, 
                    EXTRACT(DAY FROM "dateOfJoining")::int) - $1::date
        )
      END as "daysUntil"
    FROM users
    WHERE status = $4
      AND "dateOfJoining" IS NOT NULL
      AND "dateOfJoining" < $1::date
      AND "deletedAt" IS NULL
      AND (
        TO_CHAR("dateOfJoining", 'MM-DD') >= TO_CHAR($1::date, 'MM-DD')
        AND TO_CHAR("dateOfJoining", 'MM-DD') <= TO_CHAR($3::date, 'MM-DD')
      )
    ORDER BY TO_CHAR("dateOfJoining", 'MM-DD')
  `,
  params: [today, weekEnd, monthEnd, UserStatus.ACTIVE],
});

// ==================== Festivals/Holidays Query ====================

export const getHolidaysQuery = () => ({
  query: `
    SELECT 
      cs.value as "holidays"
    FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.module = 'attendance'
      AND c.key = 'holidayCalendar'
      AND cs."isActive" = true
      AND cs."deletedAt" IS NULL
      AND c."deletedAt" IS NULL
    LIMIT 1
  `,
  params: [],
});

// ==================== Attendance Trend Query ====================

export const getAttendanceTrendQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      TO_CHAR("attendanceDate", 'YYYY-MM-DD') as "date",
      COUNT(CASE WHEN status = $1 THEN 1 END)::int as "present",
      COUNT(CASE WHEN status = $2 THEN 1 END)::int as "absent",
      COUNT(CASE WHEN status IN ($3, $4) THEN 1 END)::int as "leave",
      COUNT(CASE WHEN status = $5 THEN 1 END)::int as "holiday"
    FROM attendances
    WHERE "attendanceDate" >= $6::date
      AND "attendanceDate" <= $7::date
      AND "isActive" = true
      AND "deletedAt" IS NULL
    GROUP BY "attendanceDate"
    ORDER BY "attendanceDate"
  `,
  params: [
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LEAVE,
    AttendanceStatus.LEAVE_WITHOUT_PAY,
    AttendanceStatus.HOLIDAY,
    startDate,
    endDate,
  ],
});

// ==================== Leave Summary Query ====================

export const getLeaveSummaryQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      "leaveCategory",
      COUNT(*)::int as "count"
    FROM leave_applications
    WHERE "fromDate" >= $1::date
      AND "fromDate" <= $2::date
      AND "approvalStatus" = $3
      AND "deletedAt" IS NULL
    GROUP BY "leaveCategory"
  `,
  params: [startDate, endDate, LeaveApprovalStatus.APPROVED],
});

export const getUpcomingLeavesQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      la.id,
      la."userId",
      CONCAT(u."firstName", ' ', u."lastName") as "userName",
      la."leaveCategory" as "leaveType",
      la."fromDate",
      la."toDate",
      (la."toDate"::date - la."fromDate"::date + 1)::int as "days"
    FROM leave_applications la
    JOIN users u ON u.id = la."userId"
    WHERE la."fromDate" >= $1::date
      AND la."fromDate" <= $2::date
      AND la."approvalStatus" = $3
      AND la."deletedAt" IS NULL
    ORDER BY la."fromDate"
  `,
  params: [startDate, endDate, LeaveApprovalStatus.APPROVED],
});

export const getLeaveBalanceOverviewQuery = (financialYear: string) => ({
  query: `
    SELECT 
      "leaveCategory",
      SUM("allocated"::int)::int as "allocated",
      SUM("consumed"::int)::int as "consumed",
      SUM(("allocated"::int - "consumed"::int))::int as "balance"
    FROM leave_balances
    WHERE "financialYear" = $1
      AND "deletedAt" IS NULL
    GROUP BY "leaveCategory"
  `,
  params: [financialYear],
});

// ==================== Pending Approvals Queries ====================

export const getPendingLeaveApprovalsQuery = (limit = 10) => ({
  query: `
    SELECT 
      la.id,
      la."userId",
      CONCAT(u."firstName", ' ', u."lastName") as "userName",
      u."profilePicture" as "userProfilePic",
      la."leaveCategory" as "leaveType",
      la."fromDate",
      la."toDate",
      (la."toDate"::date - la."fromDate"::date + 1)::int as "days",
      la."reason",
      la."createdAt" as "appliedAt",
      EXTRACT(DAY FROM NOW() - la."createdAt")::int as "aging"
    FROM leave_applications la
    JOIN users u ON u.id = la."userId"
    WHERE la."approvalStatus" = $1
      AND la."deletedAt" IS NULL
    ORDER BY la."createdAt" ASC
    LIMIT $2
  `,
  params: [LeaveApprovalStatus.PENDING, limit],
});

export const getPendingAttendanceApprovalsQuery = (limit = 10) => ({
  query: `
    SELECT 
      a.id,
      a."userId",
      CONCAT(u."firstName", ' ', u."lastName") as "userName",
      u."profilePicture" as "userProfilePic",
      a."attendanceDate",
      a."status",
      a."checkInTime",
      a."checkOutTime",
      a."notes",
      a."createdAt" as "appliedAt",
      EXTRACT(DAY FROM NOW() - a."createdAt")::int as "aging"
    FROM attendances a
    JOIN users u ON u.id = a."userId"
    WHERE a."approvalStatus" = $1
      AND a."isActive" = true
      AND a."deletedAt" IS NULL
    ORDER BY a."createdAt" ASC
    LIMIT $2
  `,
  params: [ApprovalStatus.PENDING, limit],
});

export const getPendingExpenseApprovalsQuery = (limit = 10) => ({
  query: `
    SELECT 
      e.id,
      e."userId",
      CONCAT(u."firstName", ' ', u."lastName") as "userName",
      u."profilePicture" as "userProfilePic",
      e."category",
      e."amount",
      e."description",
      e."createdAt" as "claimedAt",
      EXTRACT(DAY FROM NOW() - e."createdAt")::int as "aging"
    FROM expenses e
    JOIN users u ON u.id = e."userId"
    WHERE e."approvalStatus" = $1
      AND e."deletedAt" IS NULL
    ORDER BY e."createdAt" ASC
    LIMIT $2
  `,
  params: ['pending', limit],
});

// ==================== Employees Queries ====================

export const getNewJoinersQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      email,
      "dateOfJoining",
      "profilePicture"
    FROM users
    WHERE "dateOfJoining" >= $1::date
      AND "dateOfJoining" <= $2::date
      AND status = $3
      AND "deletedAt" IS NULL
    ORDER BY "dateOfJoining" DESC
  `,
  params: [startDate, endDate, UserStatus.ACTIVE],
});

export const getExitingEmployeesQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      email,
      "lastWorkingDate",
      "profilePicture",
      ("lastWorkingDate"::date - CURRENT_DATE)::int as "daysRemaining"
    FROM users
    WHERE "lastWorkingDate" >= $1::date
      AND "lastWorkingDate" <= $2::date
      AND "deletedAt" IS NULL
    ORDER BY "lastWorkingDate" ASC
  `,
  params: [startDate, endDate],
});

export const getProbationEmployeesQuery = () => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      email,
      "dateOfJoining",
      "profilePicture",
      "employeeType"
    FROM users
    WHERE "employeeType" = 'PROBATION'
      AND status = $1
      AND "deletedAt" IS NULL
    ORDER BY "dateOfJoining" DESC
  `,
  params: [UserStatus.ACTIVE],
});

// ==================== Alert Queries ====================

export const getExpiringCardsQuery = (warningDate: string, infoDate: string) => ({
  query: `
    WITH parsed_cards AS (
      SELECT 
        id,
        "cardNumber",
        "cardType",
        "cardName",
        "holderName",
        "expiryDate",
        "expiryStatus",
        CASE 
          WHEN "expiryDate" ~ '^\\d{2}/\\d{4}$' THEN 
            TO_DATE('01/' || "expiryDate", 'DD/MM/YYYY') + INTERVAL '1 month' - INTERVAL '1 day'
          WHEN "expiryDate" ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN 
            "expiryDate"::date
          ELSE NULL
        END as "parsedExpiryDate"
      FROM cards
      WHERE "expiryDate" IS NOT NULL
        AND "deletedAt" IS NULL
    )
    SELECT 
      id,
      "cardNumber",
      "cardType",
      "cardName",
      "holderName",
      "expiryDate",
      "parsedExpiryDate",
      CASE 
        WHEN "parsedExpiryDate" < CURRENT_DATE THEN 'expired'
        WHEN "parsedExpiryDate" <= $1::date THEN 'warning'
        ELSE 'info'
      END as "severity"
    FROM parsed_cards
    WHERE "parsedExpiryDate" IS NOT NULL
      AND "parsedExpiryDate" <= $2::date
    ORDER BY "parsedExpiryDate" ASC
  `,
  params: [warningDate, infoDate],
});

export const getExpiringVehicleDocsQuery = (warningDate: string, infoDate: string) => ({
  query: `
    WITH expiring_docs AS (
      SELECT 
        vv.id,
        vm."registrationNo" as "vehicleNumber",
        'Insurance' as "documentType",
        vv."insuranceEndDate" as "expiryDate",
        CASE 
          WHEN vv."insuranceEndDate" < CURRENT_DATE THEN 'expired'
          WHEN vv."insuranceEndDate" <= $1::date THEN 'warning'
          ELSE 'info'
        END as "severity"
      FROM vehicle_versions vv
      JOIN vehicle_masters vm ON vm.id = vv."vehicleMasterId"
      WHERE vv."insuranceEndDate" IS NOT NULL
        AND vv."insuranceEndDate" <= $2::date
        AND vv."isActive" = true
        AND vv."deletedAt" IS NULL
      
      UNION ALL
      
      SELECT 
        vv.id,
        vm."registrationNo" as "vehicleNumber",
        'PUC' as "documentType",
        vv."pucEndDate" as "expiryDate",
        CASE 
          WHEN vv."pucEndDate" < CURRENT_DATE THEN 'expired'
          WHEN vv."pucEndDate" <= $1::date THEN 'warning'
          ELSE 'info'
        END as "severity"
      FROM vehicle_versions vv
      JOIN vehicle_masters vm ON vm.id = vv."vehicleMasterId"
      WHERE vv."pucEndDate" IS NOT NULL
        AND vv."pucEndDate" <= $2::date
        AND vv."isActive" = true
        AND vv."deletedAt" IS NULL
      
      UNION ALL
      
      SELECT 
        vv.id,
        vm."registrationNo" as "vehicleNumber",
        'Fitness' as "documentType",
        vv."fitnessEndDate" as "expiryDate",
        CASE 
          WHEN vv."fitnessEndDate" < CURRENT_DATE THEN 'expired'
          WHEN vv."fitnessEndDate" <= $1::date THEN 'warning'
          ELSE 'info'
        END as "severity"
      FROM vehicle_versions vv
      JOIN vehicle_masters vm ON vm.id = vv."vehicleMasterId"
      WHERE vv."fitnessEndDate" IS NOT NULL
        AND vv."fitnessEndDate" <= $2::date
        AND vv."isActive" = true
        AND vv."deletedAt" IS NULL
    )
    SELECT * FROM expiring_docs
    ORDER BY "expiryDate" ASC
  `,
  params: [warningDate, infoDate],
});

export const getVehicleServiceDueQuery = (warningKm: number) => ({
  query: `
    SELECT 
      vm.id,
      vm."registrationNo" as "vehicleNumber",
      vv."lastServiceKm",
      vv."lastServiceDate",
      vs."odometerReading" as "lastServiceOdometer",
      CASE 
        WHEN vs."odometerReading" IS NOT NULL AND vv."lastServiceKm" IS NOT NULL
          THEN (vv."lastServiceKm" - vs."odometerReading")
        ELSE NULL
      END as "kmSinceLastService",
      CASE 
        WHEN vs."odometerReading" IS NULL THEN 'info'
        WHEN vv."lastServiceKm" IS NULL THEN 'info'
        WHEN (vv."lastServiceKm" - vs."odometerReading") >= $1 THEN 'overdue'
        WHEN (vv."lastServiceKm" - vs."odometerReading") >= ($1 - $2) THEN 'warning'
        ELSE 'info'
      END as "severity"
    FROM vehicle_masters vm
    JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm.id AND vv."isActive" = true
    LEFT JOIN LATERAL (
      SELECT "odometerReading", "serviceDate"
      FROM vehicle_services 
      WHERE "vehicleMasterId" = vm.id
        AND "resetsServiceInterval" = true
      ORDER BY "serviceDate" DESC 
      LIMIT 1
    ) vs ON true
    WHERE vm."deletedAt" IS NULL
      AND vv."deletedAt" IS NULL
      AND (
        vs."odometerReading" IS NULL
        OR vv."lastServiceKm" IS NULL  
        OR (vv."lastServiceKm" - COALESCE(vs."odometerReading", 0)) >= ($1 - $2)
      )
  `,
  params: [10000, warningKm], // Default service interval 10000km
});

export const getAssetCalibrationDueQuery = (warningDate: string, infoDate: string) => ({
  query: `
    SELECT 
      av.id,
      av."name" as "assetName",
      am."assetId" as "assetCode",
      av."calibrationEndDate" as "calibrationDueDate",
      CASE 
        WHEN av."calibrationEndDate" < CURRENT_DATE THEN 'overdue'
        WHEN av."calibrationEndDate" <= $1::date THEN 'warning'
        ELSE 'info'
      END as "severity"
    FROM asset_versions av
    JOIN asset_masters am ON am.id = av."assetMasterId"
    WHERE av."calibrationEndDate" IS NOT NULL
      AND av."calibrationEndDate" <= $2::date
      AND av."isActive" = true
      AND av."deletedAt" IS NULL
    ORDER BY av."calibrationEndDate" ASC
  `,
  params: [warningDate, infoDate],
});

export const getAssetWarrantyExpiryQuery = (warningDate: string, infoDate: string) => ({
  query: `
    SELECT 
      av.id,
      av."name" as "assetName",
      am."assetId" as "assetCode",
      av."warrantyEndDate" as "warrantyExpiryDate",
      CASE 
        WHEN av."warrantyEndDate" < CURRENT_DATE THEN 'expired'
        WHEN av."warrantyEndDate" <= $1::date THEN 'warning'
        ELSE 'info'
      END as "severity"
    FROM asset_versions av
    JOIN asset_masters am ON am.id = av."assetMasterId"
    WHERE av."warrantyEndDate" IS NOT NULL
      AND av."warrantyEndDate" <= $2::date
      AND av."isActive" = true
      AND av."deletedAt" IS NULL
    ORDER BY av."warrantyEndDate" ASC
  `,
  params: [warningDate, infoDate],
});

// ==================== Payroll Queries ====================

export const getPayrollTrendQuery = (months = 6) => ({
  query: `
    SELECT 
      month,
      year,
      SUM("grossEarnings")::decimal as "grossEarnings",
      SUM("totalDeductions")::decimal as "totalDeductions",
      SUM("netPayable")::decimal as "netPayable"
    FROM payroll
    WHERE status = $1
      AND "deletedAt" IS NULL
      AND (year * 12 + month) >= (EXTRACT(YEAR FROM CURRENT_DATE)::int * 12 + EXTRACT(MONTH FROM CURRENT_DATE)::int - $2)
    GROUP BY year, month
    ORDER BY year, month
  `,
  params: [PayrollStatus.PAID, months],
});

export const getPayrollDeductionBreakdownQuery = (month: number, year: number) => ({
  query: `
    SELECT 
      SUM("employeePf")::decimal as "employeePf",
      SUM("employerPf")::decimal as "employerPf",
      SUM("tds")::decimal as "tds",
      SUM("esic")::decimal as "esic",
      SUM("professionalTax")::decimal as "professionalTax"
    FROM payroll
    WHERE month = $1 AND year = $2 AND "deletedAt" IS NULL
  `,
  params: [month, year],
});

// ==================== Expense Queries ====================

export const getExpenseSummaryQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::decimal as "totalExpenses",
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)::decimal as "totalCredits",
      SUM(CASE WHEN "approvalStatus" = 'pending' THEN amount ELSE 0 END)::decimal as "pendingClaims",
      SUM(CASE WHEN "approvalStatus" = 'approved' THEN amount ELSE 0 END)::decimal as "approvedClaims",
      SUM(CASE WHEN "approvalStatus" = 'rejected' THEN amount ELSE 0 END)::decimal as "rejectedClaims"
    FROM expenses
    WHERE "createdAt" >= $1::date
      AND "createdAt" <= $2::date
      AND "deletedAt" IS NULL
  `,
  params: [startDate, endDate],
});

export const getExpenseCategoryDistributionQuery = (startDate: string, endDate: string) => ({
  query: `
    SELECT 
      category,
      SUM(amount)::decimal as "total"
    FROM expenses
    WHERE "createdAt" >= $1::date
      AND "createdAt" <= $2::date
      AND amount > 0
      AND "deletedAt" IS NULL
    GROUP BY category
    ORDER BY "total" DESC
  `,
  params: [startDate, endDate],
});

export const getTopSpendersQuery = (startDate: string, endDate: string, limit = 5) => ({
  query: `
    SELECT 
      e."userId",
      CONCAT(u."firstName", ' ', u."lastName") as "userName",
      SUM(e.amount)::decimal as "totalExpense"
    FROM expenses e
    JOIN users u ON u.id = e."userId"
    WHERE e."createdAt" >= $1::date
      AND e."createdAt" <= $2::date
      AND e.amount > 0
      AND e."deletedAt" IS NULL
    GROUP BY e."userId", u."firstName", u."lastName"
    ORDER BY "totalExpense" DESC
    LIMIT $3
  `,
  params: [startDate, endDate, limit],
});
