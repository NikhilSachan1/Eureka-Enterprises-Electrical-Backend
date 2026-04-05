/**
 * Analytics SQL Queries
 * Optimized raw SQL queries for analytics calculations
 *
 * Note: All queries use parameterized values to prevent SQL injection
 */

// ==================== EXECUTIVE DASHBOARD QUERIES ====================

/**
 * Get overall summary counts for executive dashboard
 */
export const getExecutiveSummaryQuery = (companyId?: string) => {
  const params: any[] = [];
  let companyFilter = '';

  if (companyId) {
    params.push(companyId);
    companyFilter = `AND s."companyId" = $${params.length}`;
  }

  return {
    query: `
      SELECT
        (SELECT COUNT(*) FROM sites s WHERE s."deletedAt" IS NULL ${companyFilter}) as "totalSites",
        (SELECT COUNT(*) FROM sites s WHERE s."deletedAt" IS NULL AND s.status = 'ONGOING' ${companyFilter}) as "activeSites",
        (SELECT COUNT(*) FROM companies WHERE "deletedAt" IS NULL) as "totalCompanies",
        (SELECT COUNT(*) FROM contractors WHERE "deletedAt" IS NULL) as "totalContractors",
        (SELECT COUNT(*) FROM users WHERE "deletedAt" IS NULL AND status = 'ACTIVE') as "totalEmployees"
    `,
    params,
  };
};

/**
 * Get sites grouped by status
 */
export const getSitesByStatusQuery = (companyId?: string) => {
  const params: any[] = [];
  let companyFilter = '';

  if (companyId) {
    params.push(companyId);
    companyFilter = `AND "companyId" = $${params.length}`;
  }

  return {
    query: `
      SELECT 
        status,
        COUNT(*) as count
      FROM sites
      WHERE "deletedAt" IS NULL ${companyFilter}
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'ONGOING' THEN 1 
          WHEN 'UPCOMING' THEN 2 
          WHEN 'HOLD' THEN 3 
          WHEN 'COMPLETED' THEN 4 
        END
    `,
    params,
  };
};

/**
 * Get financial overview (revenue, expenses, profit)
 */
export const getFinancialOverviewQuery = (
  companyId?: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [];
  const conditions: string[] = ['sd."deletedAt" IS NULL', 's."deletedAt" IS NULL'];

  if (companyId) {
    params.push(companyId);
    conditions.push(`s."companyId" = $${params.length}`);
  }

  // Apply date filter on document date
  if (startDate) {
    params.push(startDate);
    conditions.push(`sd."documentDate" >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`sd."documentDate" <= $${params.length}::date`);
  }

  return {
    query: `
      SELECT
        COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalRevenue",
        COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalExpenses",
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'RECEIVABLE' AND sd."paymentStatus" = 'PENDING' THEN sd."totalAmount" 
          ELSE 0 
        END), 0) as "pendingReceivables",
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'PAYABLE' AND sd."paymentStatus" = 'PENDING' THEN sd."totalAmount" 
          ELSE 0 
        END), 0) as "pendingPayables"
      FROM site_documents sd
      INNER JOIN sites s ON sd."siteId" = s.id
      WHERE ${conditions.join(' AND ')}
    `,
    params,
  };
};

/**
 * Get dashboard alerts (upcoming deadlines, overdue items)
 */
export const getDashboardAlertsQuery = (companyId?: string) => {
  const params: any[] = [];
  let siteFilter = '';

  if (companyId) {
    params.push(companyId);
    siteFilter = `AND s."companyId" = $${params.length}`;
  }

  return {
    query: `
      SELECT
        (SELECT COUNT(*) FROM sites s 
          WHERE s."deletedAt" IS NULL 
          AND s."endDate" BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND s.status = 'ONGOING'
          ${siteFilter}) as "upcomingDeadlines",
        (SELECT COUNT(*) FROM site_documents sd 
          INNER JOIN sites s ON sd."siteId" = s.id
          WHERE sd."deletedAt" IS NULL 
          AND s."deletedAt" IS NULL
          AND sd.direction = 'RECEIVABLE'
          AND sd."paymentStatus" != 'PAID'
          AND sd."dueDate" < CURRENT_DATE
          ${siteFilter}) as "overdueInvoices",
        (SELECT COUNT(*) FROM site_documents sd 
          INNER JOIN sites s ON sd."siteId" = s.id
          WHERE sd."deletedAt" IS NULL 
          AND s."deletedAt" IS NULL
          AND sd.direction = 'PAYABLE'
          AND sd."paymentStatus" != 'PAID'
          AND sd."dueDate" < CURRENT_DATE
          ${siteFilter}) as "overduePayments"
    `,
    params,
  };
};

// ==================== SITE PROFITABILITY QUERIES ====================

type SiteProfitabilityDateFilters = {
  params: any[];
  siteDateFilterDoc: string;
  siteDateFilterExp: string;
  siteDateFilterFuel: string;
};

/**
 * Shared date fragments for site profitability (documents, employee expenses, fuel).
 * Params always start with [siteId, ...].
 */
export function buildSiteProfitabilityDateFilters(
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
): SiteProfitabilityDateFilters {
  const params: any[] = [siteId];
  let dateFilterDoc = '';
  let dateFilterExp = '';
  let dateFilterFuel = '';
  let useSiteDates = false;

  if (startDate && endDate) {
    params.push(startDate, endDate);
    const lo = params.length - 1;
    const hi = params.length;
    dateFilterDoc = `AND sd."documentDate" >= $${lo}::date AND sd."documentDate" <= $${hi}::date`;
    dateFilterExp = `AND e."expenseDate"::date >= $${lo}::date AND e."expenseDate"::date <= $${hi}::date`;
    dateFilterFuel = `AND fe."fillDate"::date >= $${lo}::date AND fe."fillDate"::date <= $${hi}::date`;
  } else if (startDate) {
    params.push(startDate);
    dateFilterDoc = `AND sd."documentDate" >= $${params.length}::date`;
    dateFilterExp = `AND e."expenseDate"::date >= $${params.length}::date`;
    dateFilterFuel = `AND fe."fillDate"::date >= $${params.length}::date`;
  } else if (endDate) {
    params.push(endDate);
    dateFilterDoc = `AND sd."documentDate" <= $${params.length}::date`;
    dateFilterExp = `AND e."expenseDate"::date <= $${params.length}::date`;
    dateFilterFuel = `AND fe."fillDate"::date <= $${params.length}::date`;
  } else {
    useSiteDates = true;
  }

  const siteDateFilterDoc = useSiteDates
    ? `AND sd."documentDate" >= site_info."startDate" AND sd."documentDate" <= COALESCE(site_info."endDate", CURRENT_DATE)`
    : dateFilterDoc;
  const siteDateFilterExp = useSiteDates
    ? `AND e."expenseDate"::date >= site_info."startDate" AND e."expenseDate"::date <= COALESCE(site_info."endDate", CURRENT_DATE)`
    : dateFilterExp;
  const siteDateFilterFuel = useSiteDates
    ? `AND fe."fillDate"::date >= site_info."startDate" AND fe."fillDate"::date <= COALESCE(site_info."endDate", CURRENT_DATE)`
    : dateFilterFuel;

  return { params, siteDateFilterDoc, siteDateFilterExp, siteDateFilterFuel };
}

/**
 * Get profitability data for a single site
 * Includes: Site Documents + Employee Expenses + Fuel Expenses (APPROVED only)
 *
 * Date Range Logic:
 * - If startDate/endDate provided: use those dates
 * - If not provided: use site's startDate to endDate (or current date if no endDate)
 *
 * Expense Linking:
 * - Employee expenses: linked via siteId OR via allocation during expense date
 * - Fuel expenses: linked via employee allocation during fill date
 */
export const getSiteProfitabilityQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const { params, siteDateFilterDoc, siteDateFilterExp, siteDateFilterFuel } =
    buildSiteProfitabilityDateFilters(siteId, startDate, endDate);

  return {
    query: `
      WITH site_info AS (
        SELECT id, name, status, "startDate", "endDate", "companyId"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      ),
      -- Get all employees currently or previously allocated to this site
      site_employees AS (
        SELECT DISTINCT sa."userId"
        FROM site_allocations sa
        WHERE sa."siteId" = $1 AND sa."deletedAt" IS NULL
      ),
      -- Get all vehicles used at this site (from vehicle_logs)
      site_vehicles AS (
        SELECT DISTINCT vl."vehicleId", MIN(vl."logDate") as "firstUsedAt", MAX(vl."logDate") as "lastUsedAt"
        FROM vehicle_logs vl
        WHERE vl."siteId" = $1 AND vl."deletedAt" IS NULL
        GROUP BY vl."vehicleId"
      ),
      site_doc_totals AS (
        SELECT
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'PO' THEN sd."totalAmount" ELSE 0 END), 0) as "totalPOValue",
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalInvoiced",
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' AND sd."paymentStatus" = 'PAID' THEN sd."totalAmount" ELSE 0 END), 0) as "collectedAmount",
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalRevenue",
          COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "contractorExpenses",
          COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' AND sd."paymentStatus" = 'PAID' THEN sd."totalAmount" ELSE 0 END), 0) as "paidContractorExpenses",
          COUNT(sd.id) as "totalDocuments",
          COUNT(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' THEN 1 END) as "totalInvoicedCount"
        FROM site_documents sd, site_info
        WHERE sd."siteId" = $1 AND sd."deletedAt" IS NULL ${siteDateFilterDoc}
      ),
      -- Employee expenses: directly linked via siteId OR via allocation during expense date
      employee_expenses AS (
        SELECT COALESCE(SUM(e.amount), 0) as total
        FROM expenses e, site_info
        WHERE e."deletedAt" IS NULL
          AND e."approvalStatus" = 'approved'
          AND e."transactionType" = 'debit'
          AND e."isActive" = true
          AND (
            -- Directly linked to site
            e."siteId" = $1
            OR (
              -- Linked via allocation: employee was allocated to site during expense date
              e."userId" IN (SELECT "userId" FROM site_employees)
              AND EXISTS (
                SELECT 1 FROM site_allocations sa
                WHERE sa."userId" = e."userId"
                  AND sa."siteId" = $1
                  AND sa."deletedAt" IS NULL
                  AND e."expenseDate"::date >= sa."allocatedAt"
                  AND (sa."deallocatedAt" IS NULL OR e."expenseDate"::date <= sa."deallocatedAt")
              )
            )
          )
          ${siteDateFilterExp}
      ),
      -- Fuel expenses: linked via vehicle usage at site (vehicle_logs)
      -- Only includes fuel expenses for vehicles that were used at this site
      fuel_expenses AS (
        SELECT COALESCE(SUM(fe."fuelAmount"), 0) as total
        FROM fuel_expenses fe
        INNER JOIN site_vehicles sv ON sv."vehicleId" = fe."vehicleId"
        CROSS JOIN site_info
        WHERE fe."deletedAt" IS NULL
          AND fe."approvalStatus" = 'approved'
          AND fe."transactionType" = 'debit'
          AND fe."isActive" = true
          -- Fuel fill date should be within the vehicle's usage period at this site
          AND fe."fillDate"::date >= sv."firstUsedAt"
          AND fe."fillDate"::date <= sv."lastUsedAt"
          ${siteDateFilterFuel}
      ),
      -- Payroll/Salary costs: pro-rated based on allocation days in each payroll month
      -- Only includes PAID or APPROVED payroll entries
      payroll_costs AS (
        SELECT COALESCE(SUM(
          -- Pro-rate salary based on days allocated during that payroll month
          p."netPayable" * (
            -- Calculate days allocated in this payroll month
            LEAST(
              -- End of allocation or end of month
              COALESCE(sa."deallocatedAt", (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date),
              -- End of payroll month
              (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date,
              -- End of site date range filter (if provided)
              COALESCE(site_info."endDate", CURRENT_DATE)
            )
            -
            GREATEST(
              -- Start of allocation or start of month
              sa."allocatedAt",
              -- Start of payroll month
              make_date(p.year, p.month, 1),
              -- Start of site date range filter (if provided)
              site_info."startDate"
            )
            + 1
          )::numeric
          /
          -- Total days in the payroll month
          EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day'))::numeric
        ), 0) as total
        FROM payroll p
        INNER JOIN site_allocations sa ON sa."userId" = p."userId"
        CROSS JOIN site_info
        WHERE p."deletedAt" IS NULL
          AND sa."siteId" = $1
          AND sa."deletedAt" IS NULL
          AND p.status IN ('PAID', 'APPROVED')
          -- Payroll month overlaps with allocation period
          AND make_date(p.year, p.month, 1) <= COALESCE(sa."deallocatedAt", CURRENT_DATE)
          AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= sa."allocatedAt"
          -- Payroll month overlaps with site date range
          AND make_date(p.year, p.month, 1) <= COALESCE(site_info."endDate", CURRENT_DATE)
          AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= site_info."startDate"
      )
      SELECT
        s.id as "siteId",
        s.name as "siteName",
        c.name as "companyName",
        s.status,
        s."startDate",
        s."endDate",
        (COALESCE(s."endDate"::date, CURRENT_DATE) - s."startDate"::date) + 1 as "durationDays",
        
        -- Revenue from site documents
        sdt."totalPOValue",
        sdt."totalInvoiced",
        sdt."collectedAmount",
        sdt."totalRevenue",
        
        -- Expenses breakdown
        sdt."contractorExpenses",
        sdt."paidContractorExpenses",
        ee.total as "employeeExpenses",
        fue.total as "fuelExpenses",
        pc.total as "payrollCosts",
        (sdt."contractorExpenses" + ee.total + fue.total + pc.total) as "totalExpenses",
        
        -- Document count
        sdt."totalDocuments"
        
      FROM sites s
      LEFT JOIN companies c ON s."companyId" = c.id
      CROSS JOIN site_doc_totals sdt
      CROSS JOIN employee_expenses ee
      CROSS JOIN fuel_expenses fue
      CROSS JOIN payroll_costs pc
      WHERE s.id = $1 AND s."deletedAt" IS NULL
    `,
    params,
  };
};

/**
 * Payable site documents grouped by documentType (aligned with profitability date filters).
 */
export const getSiteExpensesByCategoryQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const { params, siteDateFilterDoc } = buildSiteProfitabilityDateFilters(
    siteId,
    startDate,
    endDate,
  );
  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      )
      SELECT
        sd."documentType" as category,
        COALESCE(SUM(sd."totalAmount"), 0)::numeric as amount,
        COUNT(sd.id)::int as count
      FROM site_documents sd
      CROSS JOIN site_info
      WHERE sd."siteId" = $1
        AND sd."deletedAt" IS NULL
        AND sd.direction = 'PAYABLE'
        ${siteDateFilterDoc}
      GROUP BY sd."documentType"
      ORDER BY amount DESC
    `,
    params,
  };
};

/**
 * Employee expenses (expenses table) grouped by category — same scope as profitability employee_expenses.
 */
export const getSiteEmployeeExpensesByCategoryQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const { params, siteDateFilterExp } = buildSiteProfitabilityDateFilters(
    siteId,
    startDate,
    endDate,
  );
  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      ),
      site_employees AS (
        SELECT DISTINCT sa."userId"
        FROM site_allocations sa
        WHERE sa."siteId" = $1 AND sa."deletedAt" IS NULL
      )
      SELECT
        e.category,
        COALESCE(SUM(e.amount), 0)::numeric as amount,
        COUNT(e.id)::int as count
      FROM expenses e
      CROSS JOIN site_info
      WHERE e."deletedAt" IS NULL
        AND e."approvalStatus" = 'approved'
        AND e."transactionType" = 'debit'
        AND e."isActive" = true
        AND (
          e."siteId" = $1
          OR (
            e."userId" IN (SELECT "userId" FROM site_employees)
            AND EXISTS (
              SELECT 1 FROM site_allocations sa
              WHERE sa."userId" = e."userId"
                AND sa."siteId" = $1
                AND sa."deletedAt" IS NULL
                AND e."expenseDate"::date >= sa."allocatedAt"
                AND (sa."deallocatedAt" IS NULL OR e."expenseDate"::date <= sa."deallocatedAt")
            )
          )
        )
        ${siteDateFilterExp}
      GROUP BY e.category
      ORDER BY amount DESC
    `,
    params,
  };
};

/**
 * Fuel costs at site, grouped by vehicle (same scope as profitability fuel_expenses).
 * Fuel rows have no "category"; vehicle is the natural split.
 */
export const getSiteFuelExpensesByVehicleQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const { params, siteDateFilterFuel } = buildSiteProfitabilityDateFilters(
    siteId,
    startDate,
    endDate,
  );
  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      ),
      site_vehicles AS (
        SELECT DISTINCT vl."vehicleId", MIN(vl."logDate") as "firstUsedAt", MAX(vl."logDate") as "lastUsedAt"
        FROM vehicle_logs vl
        WHERE vl."siteId" = $1 AND vl."deletedAt" IS NULL
        GROUP BY vl."vehicleId"
      )
      SELECT
        fe."vehicleId" as "vehicleId",
        MAX(COALESCE(vm."registrationNo", 'Unknown')) as "vehicleLabel",
        COALESCE(SUM(fe."fuelAmount"), 0)::numeric as amount,
        COUNT(fe.id)::int as count
      FROM fuel_expenses fe
      INNER JOIN site_vehicles sv ON sv."vehicleId" = fe."vehicleId"
      LEFT JOIN vehicle_masters vm ON vm.id = fe."vehicleId" AND vm."deletedAt" IS NULL
      CROSS JOIN site_info
      WHERE fe."deletedAt" IS NULL
        AND fe."approvalStatus" = 'approved'
        AND fe."transactionType" = 'debit'
        AND fe."isActive" = true
        AND fe."fillDate"::date >= sv."firstUsedAt"
        AND fe."fillDate"::date <= sv."lastUsedAt"
        ${siteDateFilterFuel}
      GROUP BY fe."vehicleId"
      ORDER BY amount DESC
    `,
    params,
  };
};

/**
 * Pro-rated payroll cost per employee (same rules as profitability payroll_costs).
 */
export const getSitePayrollByEmployeeQuery = (siteId: string) => {
  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      )
      SELECT
        p."userId" as "userId",
        MAX(
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(u."firstName", ''), ' ', COALESCE(u."lastName", ''))), ''),
            u."employeeId"::text
          )
        ) as "employeeName",
        COALESCE(SUM(
          p."netPayable" * (
            LEAST(
              COALESCE(sa."deallocatedAt", (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date),
              (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date,
              COALESCE(site_info."endDate", CURRENT_DATE)
            )
            -
            GREATEST(
              sa."allocatedAt",
              make_date(p.year, p.month, 1),
              site_info."startDate"
            )
            + 1
          )::numeric
          /
          EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day'))::numeric
        ), 0)::numeric as amount
      FROM payroll p
      INNER JOIN site_allocations sa ON sa."userId" = p."userId"
      INNER JOIN users u ON u.id = p."userId" AND u."deletedAt" IS NULL
      CROSS JOIN site_info
      WHERE p."deletedAt" IS NULL
        AND sa."siteId" = $1
        AND sa."deletedAt" IS NULL
        AND p.status IN ('PAID', 'APPROVED')
        AND make_date(p.year, p.month, 1) <= COALESCE(sa."deallocatedAt", CURRENT_DATE)
        AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= sa."allocatedAt"
        AND make_date(p.year, p.month, 1) <= COALESCE(site_info."endDate", CURRENT_DATE)
        AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= site_info."startDate"
      GROUP BY p."userId"
      ORDER BY amount DESC
    `,
    params: [siteId],
  };
};

/**
 * Get expense breakdown by contractor for a site
 */
export const getSiteExpensesByContractorQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const { params, siteDateFilterDoc } = buildSiteProfitabilityDateFilters(
    siteId,
    startDate,
    endDate,
  );
  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      )
      SELECT
        c.id as "contractorId",
        c.name as "contractorName",
        COALESCE(SUM(sd."totalAmount"), 0)::numeric as amount,
        COALESCE(SUM(CASE WHEN sd."paymentStatus" = 'PAID' THEN sd."totalAmount" ELSE 0 END), 0)::numeric as "paidAmount",
        COALESCE(SUM(CASE WHEN sd."paymentStatus" != 'PAID' THEN sd."totalAmount" ELSE 0 END), 0)::numeric as "pendingAmount"
      FROM site_documents sd
      INNER JOIN contractors c ON sd."contractorId" = c.id
      CROSS JOIN site_info
      WHERE sd."siteId" = $1
        AND sd."deletedAt" IS NULL
        AND sd.direction = 'PAYABLE'
        ${siteDateFilterDoc}
      GROUP BY c.id, c.name
      ORDER BY amount DESC
    `,
    params,
  };
};

/**
 * Get document summary for a site (by type and status)
 */
export const getSiteDocumentSummaryQuery = (siteId: string) => {
  return {
    query: `
      SELECT
        'by_type' as "groupType",
        "documentType" as "groupValue",
        COUNT(*) as count
      FROM site_documents
      WHERE "siteId" = $1 AND "deletedAt" IS NULL
      GROUP BY "documentType"
      
      UNION ALL
      
      SELECT
        'by_status' as "groupType",
        status as "groupValue",
        COUNT(*) as count
      FROM site_documents
      WHERE "siteId" = $1 AND "deletedAt" IS NULL
      GROUP BY status
    `,
    params: [siteId],
  };
};

/**
 * Get monthly trend data for site profitability (Revenue vs Expenses vs Profit)
 * Returns monthly breakdown within the site's date range
 */
export const getSiteMonthlyTrendQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [siteId];
  // Always bind $2/$3 so the months CTE never references missing parameters (e.g. all_time → null,null → site bounds)
  params.push(startDate ?? null, endDate ?? null);

  return {
    query: `
      WITH site_info AS (
        SELECT id, "startDate", "endDate"
        FROM sites
        WHERE id = $1 AND "deletedAt" IS NULL
      ),
      -- Generate months within site date range
      months AS (
        SELECT 
          DATE_TRUNC('month', generate_series(
            GREATEST(site_info."startDate", COALESCE($2::date, site_info."startDate")),
            LEAST(COALESCE(site_info."endDate", CURRENT_DATE), COALESCE($3::date, COALESCE(site_info."endDate", CURRENT_DATE))),
            '1 month'::interval
          ))::date as month_start
        FROM site_info
      ),
      -- Site employees for linking
      site_employees AS (
        SELECT DISTINCT sa."userId", sa."allocatedAt", sa."deallocatedAt"
        FROM site_allocations sa
        WHERE sa."siteId" = $1 AND sa."deletedAt" IS NULL
      ),
      -- Site vehicles for linking fuel expenses
      site_vehicles AS (
        SELECT DISTINCT vl."vehicleId", MIN(vl."logDate") as "firstUsedAt", MAX(vl."logDate") as "lastUsedAt"
        FROM vehicle_logs vl
        WHERE vl."siteId" = $1 AND vl."deletedAt" IS NULL
        GROUP BY vl."vehicleId"
      ),
      -- Monthly revenue from site documents
      monthly_revenue AS (
        SELECT 
          DATE_TRUNC('month', sd."documentDate")::date as month_start,
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' THEN sd."totalAmount" ELSE 0 END), 0) as revenue
        FROM site_documents sd
        WHERE sd."siteId" = $1 AND sd."deletedAt" IS NULL
        GROUP BY DATE_TRUNC('month', sd."documentDate")
      ),
      -- Monthly contractor expenses from site documents
      monthly_contractor AS (
        SELECT 
          DATE_TRUNC('month', sd."documentDate")::date as month_start,
          COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as contractor_expenses
        FROM site_documents sd
        WHERE sd."siteId" = $1 AND sd."deletedAt" IS NULL
        GROUP BY DATE_TRUNC('month', sd."documentDate")
      ),
      -- Monthly employee expenses
      monthly_employee AS (
        SELECT 
          DATE_TRUNC('month', e."expenseDate")::date as month_start,
          COALESCE(SUM(e.amount), 0) as employee_expenses
        FROM expenses e
        WHERE e."deletedAt" IS NULL
          AND e."approvalStatus" = 'approved'
          AND e."transactionType" = 'debit'
          AND e."isActive" = true
          AND (
            e."siteId" = $1
            OR (
              e."userId" IN (SELECT "userId" FROM site_employees)
              AND EXISTS (
                SELECT 1 FROM site_allocations sa
                WHERE sa."userId" = e."userId"
                  AND sa."siteId" = $1
                  AND sa."deletedAt" IS NULL
                  AND e."expenseDate"::date >= sa."allocatedAt"
                  AND (sa."deallocatedAt" IS NULL OR e."expenseDate"::date <= sa."deallocatedAt")
              )
            )
          )
        GROUP BY DATE_TRUNC('month', e."expenseDate")
      ),
      -- Monthly fuel expenses
      monthly_fuel AS (
        SELECT 
          DATE_TRUNC('month', fe."fillDate")::date as month_start,
          COALESCE(SUM(fe."fuelAmount"), 0) as fuel_expenses
        FROM fuel_expenses fe
        INNER JOIN site_vehicles sv ON sv."vehicleId" = fe."vehicleId"
        WHERE fe."deletedAt" IS NULL
          AND fe."approvalStatus" = 'approved'
          AND fe."transactionType" = 'debit'
          AND fe."isActive" = true
          AND fe."fillDate"::date >= sv."firstUsedAt"
          AND fe."fillDate"::date <= sv."lastUsedAt"
        GROUP BY DATE_TRUNC('month', fe."fillDate")
      ),
      -- Monthly payroll costs
      monthly_payroll AS (
        SELECT 
          make_date(p.year, p.month, 1) as month_start,
          COALESCE(SUM(
            p."netPayable" * (
              LEAST(
                COALESCE(sa."deallocatedAt", (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date),
                (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date
              )
              -
              GREATEST(
                sa."allocatedAt",
                make_date(p.year, p.month, 1)
              )
              + 1
            )::numeric
            /
            EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day'))::numeric
          ), 0) as payroll_costs
        FROM payroll p
        INNER JOIN site_allocations sa ON sa."userId" = p."userId"
        WHERE p."deletedAt" IS NULL
          AND sa."siteId" = $1
          AND sa."deletedAt" IS NULL
          AND p.status IN ('PAID', 'APPROVED')
          AND make_date(p.year, p.month, 1) <= COALESCE(sa."deallocatedAt", CURRENT_DATE)
          AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= sa."allocatedAt"
        GROUP BY make_date(p.year, p.month, 1)
      )
      SELECT 
        TO_CHAR(m.month_start, 'YYYY-MM') as month,
        TO_CHAR(m.month_start, 'Mon YYYY') as "monthLabel",
        COALESCE(mr.revenue, 0) as revenue,
        COALESCE(mc.contractor_expenses, 0) as "contractorExpenses",
        COALESCE(me.employee_expenses, 0) as "employeeExpenses",
        COALESCE(mf.fuel_expenses, 0) as "fuelExpenses",
        COALESCE(mp.payroll_costs, 0) as "payrollCosts",
        (COALESCE(mc.contractor_expenses, 0) + COALESCE(me.employee_expenses, 0) + COALESCE(mf.fuel_expenses, 0) + COALESCE(mp.payroll_costs, 0)) as "totalExpenses",
        (COALESCE(mr.revenue, 0) - (COALESCE(mc.contractor_expenses, 0) + COALESCE(me.employee_expenses, 0) + COALESCE(mf.fuel_expenses, 0) + COALESCE(mp.payroll_costs, 0))) as profit
      FROM months m
      LEFT JOIN monthly_revenue mr ON mr.month_start = m.month_start
      LEFT JOIN monthly_contractor mc ON mc.month_start = m.month_start
      LEFT JOIN monthly_employee me ON me.month_start = m.month_start
      LEFT JOIN monthly_fuel mf ON mf.month_start = m.month_start
      LEFT JOIN monthly_payroll mp ON mp.month_start = m.month_start
      ORDER BY m.month_start
    `,
    params,
  };
};

/**
 * Get profitability summary for all sites (for comparison)
 * Includes: Site Documents + Employee Expenses + Fuel Expenses (APPROVED only)
 *
 * Date Range Logic:
 * - If startDate/endDate provided: use those dates
 * - If not provided: use each site's startDate to endDate (or current date if no endDate)
 *
 * Expense Linking:
 * - Employee expenses: linked via siteId OR via allocation during expense date
 * - Fuel expenses: linked via employee allocation during fill date
 */
export const getAllSitesProfitabilityQuery = (
  status?: string,
  companyId?: string,
  sortField = 'createdAt',
  sortOrder = 'DESC',
  limit = 20,
  offset = 0,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [];
  const conditions: string[] = ['s."deletedAt" IS NULL'];
  let dateFilterDoc = '';
  let dateFilterExp = '';
  let dateFilterFuel = '';
  let useSiteDates = false;

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  if (companyId) {
    params.push(companyId);
    conditions.push(`s."companyId" = $${params.length}`);
  }

  // Date filters
  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilterDoc = `AND sd."documentDate" >= $${
      params.length - 1
    }::date AND sd."documentDate" <= $${params.length}::date`;
    dateFilterExp = `AND e."expenseDate"::date >= $${
      params.length - 1
    }::date AND e."expenseDate"::date <= $${params.length}::date`;
    dateFilterFuel = `AND fe."fillDate"::date >= $${
      params.length - 1
    }::date AND fe."fillDate"::date <= $${params.length}::date`;
  } else if (startDate) {
    params.push(startDate);
    dateFilterDoc = `AND sd."documentDate" >= $${params.length}::date`;
    dateFilterExp = `AND e."expenseDate"::date >= $${params.length}::date`;
    dateFilterFuel = `AND fe."fillDate"::date >= $${params.length}::date`;
  } else if (endDate) {
    params.push(endDate);
    dateFilterDoc = `AND sd."documentDate" <= $${params.length}::date`;
    dateFilterExp = `AND e."expenseDate"::date <= $${params.length}::date`;
    dateFilterFuel = `AND fe."fillDate"::date <= $${params.length}::date`;
  } else {
    // No date filter provided - use site's date range for each site
    useSiteDates = true;
  }

  // When using site dates, apply date filter using site's own date range
  const siteDateFilterDoc = useSiteDates
    ? `AND sd."documentDate" >= s."startDate" AND sd."documentDate" <= COALESCE(s."endDate", CURRENT_DATE)`
    : dateFilterDoc;
  const siteDateFilterExp = useSiteDates
    ? `AND e."expenseDate"::date >= s."startDate" AND e."expenseDate"::date <= COALESCE(s."endDate", CURRENT_DATE)`
    : dateFilterExp;
  const siteDateFilterFuel = useSiteDates
    ? `AND fe."fillDate"::date >= s."startDate" AND fe."fillDate"::date <= COALESCE(s."endDate", CURRENT_DATE)`
    : dateFilterFuel;

  // Validate sort field to prevent SQL injection
  const validSortFields: Record<string, string> = {
    name: '"siteName"',
    createdAt: '"createdAt"',
    totalRevenue: '"totalRevenue"',
    totalExpenses: '"totalExpenses"',
    profit: 'profit',
    profitMargin: '"profitMarginPercent"',
  };

  const sortColumn = validSortFields[sortField] || '"createdAt"';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  params.push(limit, offset);

  return {
    query: `
      WITH site_financials AS (
        SELECT
          s.id as "siteId",
          s.name as "siteName",
          c.name as "companyName",
          s.status,
          s."createdAt",
          s."startDate",
          s."endDate",
          (COALESCE(s."endDate"::date, CURRENT_DATE) - s."startDate"::date) + 1 as "durationDays",
          
          -- Revenue from site documents
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalRevenue",
          
          -- Contractor expenses from site documents
          COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "contractorExpenses",
          
          -- Employee expenses: directly linked via siteId OR via allocation during expense date
          COALESCE((
            SELECT SUM(e.amount)
            FROM expenses e
            WHERE e."deletedAt" IS NULL
              AND e."approvalStatus" = 'approved'
              AND e."transactionType" = 'debit'
              AND e."isActive" = true
              AND (
                -- Directly linked to site
                e."siteId" = s.id
                OR (
                  -- Linked via allocation: employee was allocated to site during expense date
                  EXISTS (
                    SELECT 1 FROM site_allocations sa
                    WHERE sa."userId" = e."userId"
                      AND sa."siteId" = s.id
                      AND sa."deletedAt" IS NULL
                      AND e."expenseDate"::date >= sa."allocatedAt"
                      AND (sa."deallocatedAt" IS NULL OR e."expenseDate"::date <= sa."deallocatedAt")
                  )
                )
              )
              ${siteDateFilterExp}
          ), 0) as "employeeExpenses",
          
          -- Fuel expenses: linked via vehicle usage at site (vehicle_logs)
          COALESCE((
            SELECT SUM(fe."fuelAmount")
            FROM fuel_expenses fe
            WHERE fe."deletedAt" IS NULL
              AND fe."approvalStatus" = 'approved'
              AND fe."transactionType" = 'debit'
              AND fe."isActive" = true
              AND EXISTS (
                -- Vehicle was used at this site during a period that includes the fuel fill date
                SELECT 1 FROM vehicle_logs vl
                WHERE vl."vehicleId" = fe."vehicleId"
                  AND vl."siteId" = s.id
                  AND vl."deletedAt" IS NULL
                  AND fe."fillDate"::date >= (
                    SELECT MIN(vl2."logDate") FROM vehicle_logs vl2 
                    WHERE vl2."vehicleId" = fe."vehicleId" AND vl2."siteId" = s.id AND vl2."deletedAt" IS NULL
                  )
                  AND fe."fillDate"::date <= (
                    SELECT MAX(vl3."logDate") FROM vehicle_logs vl3 
                    WHERE vl3."vehicleId" = fe."vehicleId" AND vl3."siteId" = s.id AND vl3."deletedAt" IS NULL
                  )
              )
              ${siteDateFilterFuel}
          ), 0) as "fuelExpenses",
          
          -- Payroll/Salary costs: pro-rated based on allocation days in each payroll month
          COALESCE((
            SELECT SUM(
              p."netPayable" * (
                -- Days allocated in this payroll month
                LEAST(
                  COALESCE(sa."deallocatedAt", (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date),
                  (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date,
                  COALESCE(s."endDate", CURRENT_DATE)
                )
                -
                GREATEST(
                  sa."allocatedAt",
                  make_date(p.year, p.month, 1),
                  s."startDate"
                )
                + 1
              )::numeric
              /
              EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day'))::numeric
            )
            FROM payroll p
            INNER JOIN site_allocations sa ON sa."userId" = p."userId"
            WHERE p."deletedAt" IS NULL
              AND sa."siteId" = s.id
              AND sa."deletedAt" IS NULL
              AND p.status IN ('PAID', 'APPROVED')
              -- Payroll month overlaps with allocation period
              AND make_date(p.year, p.month, 1) <= COALESCE(sa."deallocatedAt", CURRENT_DATE)
              AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= sa."allocatedAt"
              -- Payroll month overlaps with site date range
              AND make_date(p.year, p.month, 1) <= COALESCE(s."endDate", CURRENT_DATE)
              AND (DATE_TRUNC('month', make_date(p.year, p.month, 1)) + INTERVAL '1 month - 1 day')::date >= s."startDate"
          ), 0) as "payrollCosts"
          
        FROM sites s
        LEFT JOIN companies c ON s."companyId" = c.id
        LEFT JOIN site_documents sd ON sd."siteId" = s.id AND sd."deletedAt" IS NULL ${siteDateFilterDoc}
        WHERE ${conditions.join(' AND ')}
        GROUP BY s.id, s.name, c.name, s.status, s."createdAt", s."startDate", s."endDate"
      )
      SELECT
        "siteId",
        "siteName",
        "companyName",
        status,
        "startDate",
        "endDate",
        "durationDays",
        "totalRevenue",
        "contractorExpenses",
        "employeeExpenses",
        "fuelExpenses",
        "payrollCosts",
        ("contractorExpenses" + "employeeExpenses" + "fuelExpenses" + "payrollCosts") as "totalExpenses",
        "totalRevenue" - ("contractorExpenses" + "employeeExpenses" + "fuelExpenses" + "payrollCosts") as profit,
        CASE 
          WHEN "totalRevenue" > 0 
          THEN ROUND((("totalRevenue" - ("contractorExpenses" + "employeeExpenses" + "fuelExpenses" + "payrollCosts")) / "totalRevenue" * 100)::numeric, 2)
          ELSE 0 
        END as "profitMarginPercent"
      FROM site_financials
      ORDER BY ${sortColumn} ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  };
};

/**
 * Get total count for all sites profitability (for pagination)
 */
export const getAllSitesProfitabilityCountQuery = (status?: string, companyId?: string) => {
  const params: any[] = [];
  const conditions: string[] = ['"deletedAt" IS NULL'];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (companyId) {
    params.push(companyId);
    conditions.push(`"companyId" = $${params.length}`);
  }

  return {
    query: `SELECT COUNT(*) as count FROM sites WHERE ${conditions.join(' AND ')}`,
    params,
  };
};

// ==================== INVOICE AGING QUERIES ====================

/**
 * Get invoice aging report
 */
export const getInvoiceAgingQuery = (
  direction: 'RECEIVABLE' | 'PAYABLE',
  siteId?: string,
  contractorId?: string,
  overdueOnly = false,
  limit = 100,
  offset = 0,
) => {
  const params: any[] = [direction];
  const conditions: string[] = [
    'sd."deletedAt" IS NULL',
    's."deletedAt" IS NULL',
    'sd.direction = $1',
    'sd."paymentStatus" != \'PAID\'',
  ];

  if (siteId) {
    params.push(siteId);
    conditions.push(`sd."siteId" = $${params.length}`);
  }

  if (contractorId) {
    params.push(contractorId);
    conditions.push(`sd."contractorId" = $${params.length}`);
  }

  if (overdueOnly) {
    conditions.push('sd."dueDate" < CURRENT_DATE');
  }

  params.push(limit, offset);

  return {
    query: `
      SELECT
        sd.id,
        sd."documentNumber",
        sd."totalAmount" as amount,
        sd."dueDate",
        sd."paymentStatus",
        s.name as "siteName",
        c.name as "contractorName",
        GREATEST(0, CURRENT_DATE - sd."dueDate") as "daysOverdue",
        CASE
          WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30'
          WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60'
          WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90'
          ELSE '90+'
        END as bucket
      FROM site_documents sd
      INNER JOIN sites s ON sd."siteId" = s.id
      LEFT JOIN contractors c ON sd."contractorId" = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY "daysOverdue" DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  };
};

/**
 * Get invoice aging summary (aggregated by bucket)
 */
export const getInvoiceAgingSummaryQuery = (
  direction: 'RECEIVABLE' | 'PAYABLE',
  siteId?: string,
  contractorId?: string,
) => {
  const params: any[] = [direction];
  const conditions: string[] = [
    'sd."deletedAt" IS NULL',
    's."deletedAt" IS NULL',
    'sd.direction = $1',
    'sd."paymentStatus" != \'PAID\'',
  ];

  if (siteId) {
    params.push(siteId);
    conditions.push(`sd."siteId" = $${params.length}`);
  }

  if (contractorId) {
    params.push(contractorId);
    conditions.push(`sd."contractorId" = $${params.length}`);
  }

  return {
    query: `
      WITH aged_docs AS (
        SELECT
          CASE
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30'
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60'
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90'
            ELSE '90+'
          END as bucket,
          CASE
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '30 days' THEN 1
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '60 days' THEN 2
            WHEN sd."dueDate" >= CURRENT_DATE - INTERVAL '90 days' THEN 3
            ELSE 4
          END as bucket_order,
          sd."totalAmount"
        FROM site_documents sd
        INNER JOIN sites s ON sd."siteId" = s.id
        WHERE ${conditions.join(' AND ')}
      )
      SELECT
        bucket,
        COUNT(*) as count,
        COALESCE(SUM("totalAmount"), 0) as "totalAmount"
      FROM aged_docs
      GROUP BY bucket, bucket_order
      ORDER BY bucket_order
    `,
    params,
  };
};

// ==================== CONTRACTOR ANALYTICS QUERIES ====================

/**
 * Get analytics for a single contractor
 */
export const getContractorAnalyticsQuery = (contractorId: string) => {
  return {
    query: `
      SELECT
        c.id,
        c.name,
        c."contactNumber",
        c.email,
        c.city,
        c."fullAddress",
        
        -- Site metrics
        COUNT(DISTINCT sc."siteId") as "totalSites",
        COUNT(DISTINCT CASE WHEN s.status = 'COMPLETED' THEN sc."siteId" END) as "completedSites",
        COUNT(DISTINCT CASE WHEN s.status = 'ONGOING' THEN sc."siteId" END) as "ongoingSites",
        COUNT(DISTINCT CASE WHEN s.status = 'UPCOMING' THEN sc."siteId" END) as "upcomingSites",
        
        -- Average site duration (for completed sites)
        ROUND(AVG(
          CASE WHEN s.status = 'COMPLETED' AND s."endDate" IS NOT NULL
          THEN (s."endDate"::date - s."startDate"::date)
          END
        )::numeric, 1) as "avgSiteDurationDays",
        
        -- Financial metrics from site_documents
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."contractorId" = c.id
            AND sd."deletedAt" IS NULL
            AND sd.direction = 'PAYABLE'
        ), 0) as "totalContractValue",
        
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."contractorId" = c.id
            AND sd."deletedAt" IS NULL
            AND sd.direction = 'PAYABLE'
            AND sd."paymentStatus" = 'PAID'
        ), 0) as "totalPaid"
        
      FROM contractors c
      LEFT JOIN site_contractors sc ON c.id = sc."contractorId"
      LEFT JOIN sites s ON sc."siteId" = s.id AND s."deletedAt" IS NULL
      WHERE c.id = $1 AND c."deletedAt" IS NULL
      GROUP BY c.id, c.name, c."contactNumber", c.email, c.city, c."fullAddress"
    `,
    params: [contractorId],
  };
};

/**
 * Get site details for a contractor
 */
export const getContractorSitesQuery = (contractorId: string) => {
  return {
    query: `
      SELECT
        s.id as "siteId",
        s.name as "siteName",
        s.status,
        s."startDate",
        s."endDate",
        COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "contractValue",
        COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' AND sd."paymentStatus" = 'PAID' THEN sd."totalAmount" ELSE 0 END), 0) as "paidAmount"
      FROM site_contractors sc
      INNER JOIN sites s ON sc."siteId" = s.id
      LEFT JOIN site_documents sd ON sd."siteId" = s.id AND sd."contractorId" = $1 AND sd."deletedAt" IS NULL
      WHERE sc."contractorId" = $1 AND s."deletedAt" IS NULL
      GROUP BY s.id, s.name, s.status, s."startDate", s."endDate"
      ORDER BY s."startDate" DESC
    `,
    params: [contractorId],
  };
};

/**
 * Get all contractors analytics summary
 */
export const getAllContractorsAnalyticsQuery = (
  search?: string,
  sortField = 'name',
  sortOrder = 'ASC',
  limit = 20,
  offset = 0,
) => {
  const params: any[] = [];
  const conditions: string[] = ['c."deletedAt" IS NULL'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }

  // Validate sort field
  const validSortFields: Record<string, string> = {
    name: 'c.name',
    totalSites: '"totalSites"',
    completedSites: '"completedSites"',
    totalContractValue: '"totalContractValue"',
    pendingPayment: '"pendingPayment"',
  };

  const sortColumn = validSortFields[sortField] || 'c.name';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  params.push(limit, offset);

  return {
    query: `
      SELECT
        c.id,
        c.name,
        COUNT(DISTINCT sc."siteId") as "totalSites",
        COUNT(DISTINCT CASE WHEN s.status = 'COMPLETED' THEN sc."siteId" END) as "completedSites",
        COUNT(DISTINCT CASE WHEN s.status = 'ONGOING' THEN sc."siteId" END) as "ongoingSites",
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."contractorId" = c.id AND sd."deletedAt" IS NULL AND sd.direction = 'PAYABLE'
        ), 0) as "totalContractValue",
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."contractorId" = c.id AND sd."deletedAt" IS NULL AND sd.direction = 'PAYABLE' AND sd."paymentStatus" != 'PAID'
        ), 0) as "pendingPayment"
      FROM contractors c
      LEFT JOIN site_contractors sc ON c.id = sc."contractorId"
      LEFT JOIN sites s ON sc."siteId" = s.id AND s."deletedAt" IS NULL
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, c.name
      ORDER BY ${sortColumn} ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  };
};

// ==================== EMPLOYEE ANALYTICS QUERIES ====================

/**
 * Get analytics for a single employee
 */
export const getEmployeeAnalyticsQuery = (
  employeeId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [employeeId];

  // Build date filter conditions for DSR and vehicle logs
  let dsrDateFilter = '';
  let vlDateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dsrDateFilter = `AND dsr."reportDate" >= $${params.length - 1}::date AND dsr."reportDate" <= $${
      params.length
    }::date`;
    vlDateFilter = `AND vl."logDate" >= $${params.length - 1}::date AND vl."logDate" <= $${
      params.length
    }::date`;
  } else if (startDate) {
    params.push(startDate);
    dsrDateFilter = `AND dsr."reportDate" >= $${params.length}::date`;
    vlDateFilter = `AND vl."logDate" >= $${params.length}::date`;
  } else if (endDate) {
    params.push(endDate);
    dsrDateFilter = `AND dsr."reportDate" <= $${params.length}::date`;
    vlDateFilter = `AND vl."logDate" <= $${params.length}::date`;
  }

  return {
    query: `
      SELECT
        u.id,
        u."firstName" || ' ' || u."lastName" as name,
        u.email,
        r.name as role,
        u."dateOfJoining",
        CASE WHEN u.status = 'ACTIVE' THEN 'Active' ELSE 'Inactive' END as "employeeStatus",
        
        -- Site metrics (always all-time for site counts)
        (SELECT COUNT(DISTINCT sa."siteId") 
         FROM site_allocations sa 
         WHERE sa."userId" = u.id AND sa."deletedAt" IS NULL) as "totalSitesWorked",
        
        (SELECT s.id FROM site_allocations sa 
         INNER JOIN sites s ON sa."siteId" = s.id 
         WHERE sa."userId" = u.id AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL
         LIMIT 1) as "currentSiteId",
         
        (SELECT s.name FROM site_allocations sa 
         INNER JOIN sites s ON sa."siteId" = s.id 
         WHERE sa."userId" = u.id AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL
         LIMIT 1) as "currentSiteName",
        
        -- Days worked calculation (all-time)
        COALESCE((
          SELECT SUM(COALESCE(sa."deallocatedAt"::date, CURRENT_DATE) - sa."allocatedAt"::date)
          FROM site_allocations sa
          WHERE sa."userId" = u.id AND sa."deletedAt" IS NULL
        ), 0) as "totalDaysWorked",
        
        -- Daily status reports (filtered by date range)
        (SELECT COUNT(*) FROM daily_status_reports dsr WHERE dsr."userId" = u.id AND dsr."deletedAt" IS NULL ${dsrDateFilter}) as "dailyReportsSubmitted",
        
        -- Vehicle logs (filtered by date range)
        (SELECT COUNT(*) FROM vehicle_logs vl WHERE vl."driverId" = u.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "vehicleLogsSubmitted",
        (SELECT COALESCE(SUM(vl."totalKmTraveled"), 0) FROM vehicle_logs vl WHERE vl."driverId" = u.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "totalKmDriven",
        (SELECT COUNT(*) FROM vehicle_logs vl WHERE vl."driverId" = u.id AND vl."deletedAt" IS NULL AND vl."anomalyDetected" = true ${vlDateFilter}) as "anomaliesCount"
        
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur."userId"
      LEFT JOIN roles r ON ur."roleId" = r.id
      WHERE u.id = $1 AND u."deletedAt" IS NULL
    `,
    params,
  };
};

/**
 * Get site allocation history for an employee
 */
export const getEmployeeAllocationsQuery = (employeeId: string) => {
  return {
    query: `
      SELECT
        s.id as "siteId",
        s.name as "siteName",
        sa."allocatedAt",
        sa."deallocatedAt",
        sa."isCurrentlyAllocated",
        (COALESCE(sa."deallocatedAt"::date, CURRENT_DATE) - sa."allocatedAt"::date) as "daysWorked"
      FROM site_allocations sa
      INNER JOIN sites s ON sa."siteId" = s.id
      WHERE sa."userId" = $1 AND sa."deletedAt" IS NULL
      ORDER BY sa."allocatedAt" DESC
    `,
    params: [employeeId],
  };
};

// ==================== VEHICLE ANALYTICS QUERIES ====================

/**
 * Get analytics for a single vehicle
 */
export const getVehicleAnalyticsQuery = (
  vehicleId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [vehicleId];

  // Build date filter for vehicle logs
  let vlDateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    vlDateFilter = `AND vl."logDate" >= $${params.length - 1}::date AND vl."logDate" <= $${
      params.length
    }::date`;
  } else if (startDate) {
    params.push(startDate);
    vlDateFilter = `AND vl."logDate" >= $${params.length}::date`;
  } else if (endDate) {
    params.push(endDate);
    vlDateFilter = `AND vl."logDate" <= $${params.length}::date`;
  }

  return {
    query: `
      SELECT
        vm.id,
        vv."registrationNo",
        vv.brand,
        vv.model,
        vv."fuelType",
        vv.status,
        vv."assignedTo",
        u."firstName" || ' ' || u."lastName" as "assignedToName",
        vv."lastServiceDate",
        vv."lastServiceKm",
        
        -- Usage metrics (filtered by date range)
        (SELECT COUNT(*) FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "totalLogs",
        (SELECT COALESCE(SUM(vl."totalKmTraveled"), 0) FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "totalKmTraveled",
        (SELECT COUNT(DISTINCT vl."logDate") FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "daysWithLogs",
        (SELECT MIN(vl."logDate") FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "firstLogDate",
        (SELECT MAX(vl."logDate") FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL ${vlDateFilter}) as "lastLogDate",
        
        -- Anomaly metrics (filtered by date range)
        (SELECT COUNT(*) FROM vehicle_logs vl WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL AND vl."anomalyDetected" = true ${vlDateFilter}) as "anomalyCount"
        
      FROM vehicle_masters vm
      INNER JOIN vehicle_versions vv ON vm.id = vv."vehicleMasterId" AND vv."isActive" = true
      LEFT JOIN users u ON vv."assignedTo" = u.id
      WHERE vm.id = $1 AND vm."deletedAt" IS NULL
    `,
    params,
  };
};

/**
 * Get recent anomalies for a vehicle
 */
export const getVehicleRecentAnomaliesQuery = (vehicleId: string, limit = 10) => {
  return {
    query: `
      SELECT
        vl."logDate" as date,
        vl."totalKmTraveled" as "kmTraveled",
        s."expectedVehicleDailyKm" as "expectedKm",
        vl."anomalyReason" as reason,
        s.name as "siteName"
      FROM vehicle_logs vl
      LEFT JOIN sites s ON vl."siteId" = s.id
      WHERE vl."vehicleId" = $1 
        AND vl."deletedAt" IS NULL 
        AND vl."anomalyDetected" = true
      ORDER BY vl."logDate" DESC
      LIMIT $2
    `,
    params: [vehicleId, limit],
  };
};

/**
 * Get monthly breakdown for a vehicle
 */
export const getVehicleMonthlyBreakdownQuery = (vehicleId: string, months = 6) => {
  return {
    query: `
      SELECT
        TO_CHAR(vl."logDate", 'Mon') as month,
        EXTRACT(YEAR FROM vl."logDate") as year,
        COALESCE(SUM(vl."totalKmTraveled"), 0) as "totalKm",
        COUNT(*) as "logsCount",
        COUNT(CASE WHEN vl."anomalyDetected" = true THEN 1 END) as anomalies,
        CASE 
          WHEN COUNT(DISTINCT vl."logDate") > 0 
          THEN ROUND((COALESCE(SUM(vl."totalKmTraveled"), 0) / COUNT(DISTINCT vl."logDate"))::numeric, 2)
          ELSE 0 
        END as "avgDailyKm"
      FROM vehicle_logs vl
      WHERE vl."vehicleId" = $1 
        AND vl."deletedAt" IS NULL
        AND vl."logDate" >= CURRENT_DATE - ($2 || ' months')::interval
      GROUP BY TO_CHAR(vl."logDate", 'Mon'), EXTRACT(YEAR FROM vl."logDate"), EXTRACT(MONTH FROM vl."logDate")
      ORDER BY EXTRACT(YEAR FROM vl."logDate"), EXTRACT(MONTH FROM vl."logDate")
    `,
    params: [vehicleId, months],
  };
};

/**
 * Get fleet overview (all vehicles summary)
 */
export const getFleetOverviewQuery = (
  search?: string,
  status?: string,
  assignedTo?: string,
  limit = 20,
  offset = 0,
) => {
  const params: any[] = [];
  const conditions: string[] = ['vm."deletedAt" IS NULL', 'vv."isActive" = true'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`vv."registrationNo" ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`vv.status = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    conditions.push(`vv."assignedTo" = $${params.length}`);
  }

  params.push(limit, offset);

  return {
    query: `
      SELECT
        vm.id,
        vv."registrationNo",
        vv.brand,
        vv.model,
        vv.status,
        vv."assignedTo",
        u."firstName" || ' ' || u."lastName" as "assignedToName",
        COALESCE((
          SELECT SUM(vl."totalKmTraveled")
          FROM vehicle_logs vl
          WHERE vl."vehicleId" = vm.id 
            AND vl."deletedAt" IS NULL
            AND EXTRACT(MONTH FROM vl."logDate") = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM vl."logDate") = EXTRACT(YEAR FROM CURRENT_DATE)
        ), 0) as "totalKmThisMonth",
        (SELECT COUNT(*) FROM vehicle_logs vl 
         WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL AND vl."anomalyDetected" = true) as "anomalyCount",
        (SELECT MAX(vl."logDate") FROM vehicle_logs vl 
         WHERE vl."vehicleId" = vm.id AND vl."deletedAt" IS NULL) as "lastLogDate"
      FROM vehicle_masters vm
      INNER JOIN vehicle_versions vv ON vm.id = vv."vehicleMasterId"
      LEFT JOIN users u ON vv."assignedTo" = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY vv."registrationNo"
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  };
};

/**
 * Get fleet summary counts
 */
export const getFleetSummaryQuery = () => {
  return {
    query: `
      SELECT
        COUNT(*) as "totalVehicles",
        COUNT(CASE WHEN vv."assignedTo" IS NOT NULL THEN 1 END) as assigned,
        COUNT(CASE WHEN vv.status = 'AVAILABLE' THEN 1 END) as available,
        COUNT(CASE WHEN vv.status = 'MAINTENANCE' THEN 1 END) as "underMaintenance"
      FROM vehicle_masters vm
      INNER JOIN vehicle_versions vv ON vm.id = vv."vehicleMasterId" AND vv."isActive" = true
      WHERE vm."deletedAt" IS NULL
    `,
    params: [],
  };
};

// ==================== SITE HEALTH SCORE QUERIES ====================

/**
 * Get data needed for site health score calculation
 */
export const getSiteHealthDataQuery = (siteId: string) => {
  return {
    query: `
      SELECT
        s.id,
        s.name,
        s.status,
        s."startDate",
        s."endDate",
        s."estimatedBudget",
        
        -- Timeline metrics
        (COALESCE(s."endDate"::date, (CURRENT_DATE + INTERVAL '30 days')::date) - s."startDate"::date) as "totalDays",
        (CURRENT_DATE - s."startDate"::date) as "daysElapsed",
        CASE 
          WHEN s."endDate" IS NOT NULL AND CURRENT_DATE > s."endDate" 
          THEN (CURRENT_DATE - s."endDate"::date)
          ELSE 0 
        END as "daysDelayed",
        
        -- Payment collection metrics
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL AND sd.direction = 'RECEIVABLE'
        ), 0) as "totalReceivable",
        COALESCE((
          SELECT SUM(sd."totalAmount")
          FROM site_documents sd
          WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL AND sd.direction = 'RECEIVABLE' AND sd."paymentStatus" = 'PAID'
        ), 0) as "collectedAmount",
        
        -- Document count
        (SELECT COUNT(*) FROM site_documents sd WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL) as "totalDocuments",
        
        -- Daily status report metrics
        (SELECT COUNT(DISTINCT dsr."reportDate") 
         FROM daily_status_reports dsr 
         WHERE dsr."siteId" = s.id AND dsr."deletedAt" IS NULL) as "daysWithReports",
        
        -- Employee allocations
        (SELECT COUNT(DISTINCT sa."userId") 
         FROM site_allocations sa 
         WHERE sa."siteId" = s.id AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL) as "currentEmployees"
        
      FROM sites s
      WHERE s.id = $1 AND s."deletedAt" IS NULL
    `,
    params: [siteId],
  };
};

// ==================== SITE TIMELINE QUERIES ====================

/**
 * Get timeline events for a site
 */
export const getSiteTimelineQuery = (
  siteId: string,
  eventType?: string,
  startDate?: string,
  endDate?: string,
  limit = 50,
) => {
  const params: any[] = [siteId, limit];
  const conditions: string[] = [];

  if (eventType) {
    params.push(eventType);
    conditions.push(`event_type = $${params.length}`);
  }

  if (startDate) {
    params.push(startDate);
    conditions.push(`event_date >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`event_date <= $${params.length}::date`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return {
    query: `
      WITH timeline_events AS (
        -- Site creation
        SELECT
          s.id::text as id,
          s."createdAt"::date as event_date,
          s."createdAt"::time as event_time,
          'SITE_CREATED' as event_type,
          'Site Created' as title,
          'Site was created' as description,
          NULL as actor
        FROM sites s
        WHERE s.id = $1 AND s."deletedAt" IS NULL
        
        UNION ALL
        
        -- Status changes
        SELECT
          ssh.id::text,
          ssh."createdAt"::date,
          ssh."createdAt"::time,
          'STATUS_CHANGED',
          'Status Changed to ' || ssh."toStatus",
          COALESCE(ssh.reason, 'Status changed from ' || COALESCE(ssh."fromStatus", 'N/A') || ' to ' || ssh."toStatus"),
          (SELECT u."firstName" || ' ' || u."lastName" FROM users u WHERE u.id = ssh."changedBy")
        FROM site_status_history ssh
        WHERE ssh."siteId" = $1
        
        UNION ALL
        
        -- Contractor assignments
        SELECT
          sc.id::text,
          sc."createdAt"::date,
          sc."createdAt"::time,
          'CONTRACTOR_ASSIGNED',
          'Contractor Assigned',
          'Contractor ' || c.name || ' was assigned to the site',
          NULL
        FROM site_contractors sc
        INNER JOIN contractors c ON sc."contractorId" = c.id
        WHERE sc."siteId" = $1
        
        UNION ALL
        
        -- Employee allocations (allocatedAt is DATE type, not TIMESTAMP)
        SELECT
          sa.id::text,
          sa."allocatedAt"::date,
          '00:00:00'::time,
          CASE WHEN sa."deallocatedAt" IS NOT NULL THEN 'EMPLOYEE_DEALLOCATED' ELSE 'EMPLOYEE_ALLOCATED' END,
          CASE WHEN sa."deallocatedAt" IS NOT NULL THEN 'Employee Deallocated' ELSE 'Employee Allocated' END,
          u."firstName" || ' ' || u."lastName" || 
            CASE WHEN sa."deallocatedAt" IS NOT NULL THEN ' was deallocated from the site' ELSE ' was allocated to the site' END,
          NULL
        FROM site_allocations sa
        INNER JOIN users u ON sa."userId" = u.id
        WHERE sa."siteId" = $1 AND sa."deletedAt" IS NULL
        
        UNION ALL
        
        -- Documents uploaded
        SELECT
          sd.id::text,
          sd."createdAt"::date,
          sd."createdAt"::time,
          'DOCUMENT_UPLOADED',
          sd."documentType" || ' Uploaded',
          sd."documentType" || 
            CASE WHEN sd."documentNumber" IS NOT NULL THEN ' #' || sd."documentNumber" ELSE '' END ||
            CASE WHEN sd."totalAmount" > 0 THEN ' - Amount: ₹' || sd."totalAmount" ELSE '' END,
          NULL
        FROM site_documents sd
        WHERE sd."siteId" = $1 AND sd."deletedAt" IS NULL
      )
      SELECT * FROM timeline_events
      ${whereClause}
      ORDER BY event_date DESC, event_time DESC
      LIMIT $2
    `,
    params,
  };
};
