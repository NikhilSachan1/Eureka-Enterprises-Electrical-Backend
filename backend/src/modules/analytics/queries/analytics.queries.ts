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

/**
 * Get profitability data for a single site
 */
export const getSiteProfitabilityQuery = (
  siteId: string,
  startDate?: string | null,
  endDate?: string | null,
) => {
  const params: any[] = [siteId];
  const dateConditions: string[] = [];

  // Apply date filter on document date
  if (startDate) {
    params.push(startDate);
    dateConditions.push(`sd."documentDate" >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    dateConditions.push(`sd."documentDate" <= $${params.length}::date`);
  }

  const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';

  return {
    query: `
      SELECT
        s.id as "siteId",
        s.name as "siteName",
        c.name as "companyName",
        s.status,
        s."startDate",
        s."endDate",
        (COALESCE(s."endDate"::date, CURRENT_DATE) - s."startDate"::date) + 1 as "durationDays",
        
        -- Revenue calculations (filtered by date range)
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'PO' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "totalPOValue",
        
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'RECEIVABLE' AND sd."documentType" = 'INVOICE' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "totalInvoiced",
        
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'RECEIVABLE' AND sd."paymentStatus" = 'PAID' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "collectedAmount",
        
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'RECEIVABLE' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "totalRevenue",
        
        -- Expense calculations
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'PAYABLE' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "totalExpenses",
        
        COALESCE(SUM(CASE 
          WHEN sd.direction = 'PAYABLE' AND sd."paymentStatus" = 'PAID' 
          THEN sd."totalAmount" ELSE 0 
        END), 0) as "paidExpenses",
        
        -- Document counts
        COUNT(sd.id) as "totalDocuments"
        
      FROM sites s
      LEFT JOIN companies c ON s."companyId" = c.id
      LEFT JOIN site_documents sd ON sd."siteId" = s.id AND sd."deletedAt" IS NULL ${dateFilter}
      WHERE s.id = $1 AND s."deletedAt" IS NULL
      GROUP BY s.id, s.name, c.name, s.status, s."startDate", s."endDate"
    `,
    params,
  };
};

/**
 * Get expense breakdown by category for a site
 */
export const getSiteExpensesByCategoryQuery = (siteId: string) => {
  return {
    query: `
      SELECT
        sd."documentType" as category,
        COALESCE(SUM(sd."totalAmount"), 0) as amount,
        COUNT(sd.id) as count
      FROM site_documents sd
      WHERE sd."siteId" = $1
        AND sd."deletedAt" IS NULL
        AND sd.direction = 'PAYABLE'
      GROUP BY sd."documentType"
      ORDER BY amount DESC
    `,
    params: [siteId],
  };
};

/**
 * Get expense breakdown by contractor for a site
 */
export const getSiteExpensesByContractorQuery = (siteId: string) => {
  return {
    query: `
      SELECT
        c.id as "contractorId",
        c.name as "contractorName",
        COALESCE(SUM(sd."totalAmount"), 0) as amount,
        COALESCE(SUM(CASE WHEN sd."paymentStatus" = 'PAID' THEN sd."totalAmount" ELSE 0 END), 0) as "paidAmount",
        COALESCE(SUM(CASE WHEN sd."paymentStatus" != 'PAID' THEN sd."totalAmount" ELSE 0 END), 0) as "pendingAmount"
      FROM site_documents sd
      INNER JOIN contractors c ON sd."contractorId" = c.id
      WHERE sd."siteId" = $1
        AND sd."deletedAt" IS NULL
        AND sd.direction = 'PAYABLE'
      GROUP BY c.id, c.name
      ORDER BY amount DESC
    `,
    params: [siteId],
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
 * Get profitability summary for all sites (for comparison)
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
  const docDateConditions: string[] = [];

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  if (companyId) {
    params.push(companyId);
    conditions.push(`s."companyId" = $${params.length}`);
  }

  // Date filters for documents
  if (startDate) {
    params.push(startDate);
    docDateConditions.push(`sd."documentDate" >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    docDateConditions.push(`sd."documentDate" <= $${params.length}::date`);
  }

  const docDateFilter =
    docDateConditions.length > 0 ? `AND ${docDateConditions.join(' AND ')}` : '';

  // Validate sort field to prevent SQL injection
  // Note: These reference CTE columns (site_financials), not the original tables
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
          (COALESCE(s."endDate"::date, CURRENT_DATE) - s."startDate"::date) + 1 as "durationDays",
          COALESCE(SUM(CASE WHEN sd.direction = 'RECEIVABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalRevenue",
          COALESCE(SUM(CASE WHEN sd.direction = 'PAYABLE' THEN sd."totalAmount" ELSE 0 END), 0) as "totalExpenses"
        FROM sites s
        LEFT JOIN companies c ON s."companyId" = c.id
        LEFT JOIN site_documents sd ON sd."siteId" = s.id AND sd."deletedAt" IS NULL ${docDateFilter}
        WHERE ${conditions.join(' AND ')}
        GROUP BY s.id, s.name, c.name, s.status, s."createdAt", s."startDate", s."endDate"
      )
      SELECT
        "siteId",
        "siteName",
        "companyName",
        status,
        "durationDays",
        "totalRevenue",
        "totalExpenses",
        "totalRevenue" - "totalExpenses" as profit,
        CASE 
          WHEN "totalRevenue" > 0 
          THEN ROUND((("totalRevenue" - "totalExpenses") / "totalRevenue" * 100)::numeric, 2)
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
