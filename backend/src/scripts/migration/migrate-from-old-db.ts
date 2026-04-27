/**
 * Migration Script: Old Prod DB → New System
 *
 * Migrates Users, Attendance, Expenses, and Leave Balances
 * from eureka_enterprises (old) to european_union_migration_test (new).
 *
 * Usage:
 *   npx ts-node src/scripts/migration/migrate-from-old-db.ts
 *   npx ts-node src/scripts/migration/migrate-from-old-db.ts --dry-run
 *   npx ts-node src/scripts/migration/migrate-from-old-db.ts --rollback
 */

import { Client } from 'pg';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const OLD_DB = {
  host: 'eureka-enterprises.c4bfdwj2okvo.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'adminadmin',
  database: 'eureka_enterprises',
  ssl: { rejectUnauthorized: false },
};

const NEW_DB = {
  host: 'eureka-enterprises.c4bfdwj2okvo.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'adminadmin',
  database: 'european_union_migration_test', // Change to 'european_union' for prod
  ssl: { rejectUnauthorized: false },
};

const MIGRATION_START_DATE = '2026-04-01';
const FINANCIAL_YEAR = '2026-2027';
const LEAVE_ANNUAL_QUOTA = 52;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

const DRY_RUN = process.argv.includes('--dry-run');
const ROLLBACK = process.argv.includes('--rollback');

// ─── MAPPINGS ────────────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, string> = {
  USER: 'EMPLOYEE',
  HR: 'ADMIN',
  ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
};

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'ARCHIVED',
};

const ATTENDANCE_STATUS_MAP: Record<string, string> = {
  Present: 'present',
  Absent: 'absent',
};

const APPROVAL_STATUS_MAP: Record<string, string> = {
  APPROVED: 'approved',
  PENDING: 'approval_pending',
  REJECTED: 'rejected',
};

const EXPENSE_APPROVAL_MAP: Record<string, string> = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
};

const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  'Hotel Stay': 'hotel_stay',
  Tools: 'tools',
  Toll: 'toll_cash',
  'Car Service': 'car_service',
  Train: 'train',
  Bus: 'bus',
  'Local Convence': 'local_convence',
  'Expense Settlement': 'settlement',
  Stationery: 'stationery',
  'Safety Equipment': 'safety_equipment',
  Others: 'other',
  Food: 'food',
};

const PAYMENT_MODE_MAP: Record<string, string> = {
  CASH: 'cash',
  UPI: 'upi',
  CHEQUE: 'cheque',
  'NEFT/IMPS': 'neft/imps',
};

// All expense categories that should exist in new DB config
const ALL_EXPENSE_CATEGORIES = [
  { name: 'hotel_stay', label: 'Hotel Stay' },
  { name: 'tools', label: 'Tools' },
  { name: 'toll_cash', label: 'Toll' },
  { name: 'car_service', label: 'Car Service' },
  { name: 'train', label: 'Train' },
  { name: 'bus', label: 'Bus' },
  { name: 'local_convence', label: 'Local Convence' },
  { name: 'settlement', label: 'Expense Settlement' },
  { name: 'stationery', label: 'Stationery' },
  { name: 'safety_equipment', label: 'Safety Equipment' },
  { name: 'other', label: 'Others' },
  { name: 'food', label: 'Food' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[MIGRATION] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[MIGRATION WARNING] ${msg}`);
}

function error(msg: string) {
  console.error(`[MIGRATION ERROR] ${msg}`);
}

function getFYMonth(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  // April=1, May=2, ..., March=12
  return month >= 3 ? month - 2 : month + 10;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const oldDb = new Client(OLD_DB);
  const newDb = new Client(NEW_DB);

  try {
    await oldDb.connect();
    await newDb.connect();
    log(`Connected to old DB: ${OLD_DB.database}`);
    log(`Connected to new DB: ${NEW_DB.database}`);
    log(`Mode: ${DRY_RUN ? 'DRY RUN' : ROLLBACK ? 'ROLLBACK' : 'LIVE'}`);

    if (ROLLBACK) {
      await rollback(newDb);
      return;
    }

    // Start transaction on new DB
    await newDb.query('BEGIN');

    try {
      // Pre-step: Ensure expense categories config has all categories
      await ensureExpenseCategories(newDb);

      // Step 1: Migrate Users
      const migratedUserIds = await migrateUsers(oldDb, newDb);

      // Step 2: Migrate User Roles
      await migrateUserRoles(oldDb, newDb, migratedUserIds);

      // Step 3: Migrate Attendance
      const migratedAttendanceIds = await migrateAttendance(oldDb, newDb);

      // Step 4: Migrate Expenses
      const migratedExpenseIds = await migrateExpenses(oldDb, newDb);

      // Step 4b: Migrate Expense Files (proofs)
      const migratedExpenseFileIds = await migrateExpenseFiles(oldDb, newDb);

      // Step 5: Create Leave Balances
      const migratedLeaveBalanceIds = await createLeaveBalances(newDb, migratedUserIds);

      // Save migration manifest for rollback
      await saveMigrationManifest(newDb, {
        userIds: migratedUserIds,
        attendanceIds: migratedAttendanceIds,
        expenseIds: migratedExpenseIds,
        expenseFileIds: migratedExpenseFileIds,
        leaveBalanceIds: migratedLeaveBalanceIds,
      });

      if (DRY_RUN) {
        log('DRY RUN — rolling back transaction');
        await newDb.query('ROLLBACK');
      } else {
        await newDb.query('COMMIT');
        log('Migration COMMITTED successfully!');
      }

      // Print summary
      log('─── SUMMARY ───');
      log(`Users migrated: ${migratedUserIds.length}`);
      log(`Attendance migrated: ${migratedAttendanceIds.length}`);
      log(`Expenses migrated: ${migratedExpenseIds.length}`);
      log(`Expense files migrated: ${migratedExpenseFileIds.length}`);
      log(`Leave balances created: ${migratedLeaveBalanceIds.length}`);
    } catch (err) {
      await newDb.query('ROLLBACK');
      error(`Migration failed, transaction rolled back: ${err.message}`);
      throw err;
    }
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

// ─── STEP 0: ENSURE EXPENSE CATEGORIES ──────────────────────────────────────

async function ensureExpenseCategories(newDb: Client) {
  log('Ensuring expense categories config...');

  const result = await newDb.query(`
    SELECT cs.id, cs.value
    FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.key = 'expense_categories' AND cs."isActive" = true AND cs."deletedAt" IS NULL
  `);

  if (result.rows.length === 0) {
    warn('No expense_categories config found. Skipping category update.');
    return;
  }

  const configSettingId = result.rows[0].id;
  const currentCategories: Array<{ name: string }> = result.rows[0].value || [];
  const existingNames = new Set(currentCategories.map((c) => c.name));

  const toAdd = ALL_EXPENSE_CATEGORIES.filter((c) => !existingNames.has(c.name));

  if (toAdd.length === 0) {
    log('All expense categories already exist.');
    return;
  }

  const updatedCategories = [...toAdd, ...currentCategories];

  await newDb.query(`UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`, [
    JSON.stringify(updatedCategories),
    configSettingId,
  ]);

  log(`Added ${toAdd.length} expense categories: ${toAdd.map((c) => c.name).join(', ')}`);
}

// ─── STEP 1: MIGRATE USERS ──────────────────────────────────────────────────

async function migrateUsers(oldDb: Client, newDb: Client): Promise<string[]> {
  log('Step 1: Migrating users...');

  const oldUsers = await oldDb.query(`
    SELECT * FROM users WHERE "deletedAt" IS NULL ORDER BY "firstName"
  `);

  const migratedIds: string[] = [];
  const usedEmployeeIds = new Set<string>();

  for (const user of oldUsers.rows) {
    // Check if user already exists (by email or ID)
    const existing = await newDb.query(
      `SELECT id FROM users WHERE id = $1 OR email = $2 LIMIT 1`,
      [user.id, user.email],
    );

    if (existing.rows.length > 0) {
      warn(`User already exists: ${user.firstName} ${user.lastName} <${user.email}> — skipping`);
      // Still track the ID for role migration
      migratedIds.push(user.id);
      continue;
    }

    // Handle duplicate employeeIds by appending suffix
    let employeeId = user.employeeId;
    if (usedEmployeeIds.has(employeeId)) {
      employeeId = `${employeeId}-${user.id.substring(0, 4)}`;
      warn(`Duplicate employeeId '${user.employeeId}' → renamed to '${employeeId}'`);
    }
    usedEmployeeIds.add(employeeId);

    // Also check if employeeId already exists in new DB
    const empIdExists = await newDb.query(
      `SELECT id FROM users WHERE "employeeId" = $1 LIMIT 1`,
      [employeeId],
    );
    if (empIdExists.rows.length > 0) {
      employeeId = `${employeeId}-MIG`;
      warn(`employeeId '${user.employeeId}' exists in new DB → renamed to '${employeeId}'`);
    }

    await newDb.query(
      `
      INSERT INTO users (
        id, "firstName", "lastName", email, password, "contactNumber",
        "profilePicture", status, "employeeId", "fatherName",
        "emergencyContactNumber", gender, "dateOfBirth", "bloodGroup",
        "streetName", "dateOfJoining", "previousExperience", "employeeType",
        designation, "aadharNumber", "panNumber", "uanNumber", "esicNumber",
        "passportNumber", "dlNumber", "bankName", "ifscCode", "accountNumber",
        "bankHolderName", timezone, "noticePeriodWaived", "whatsappOptIn",
        "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28,
        $29, $30, $31, $32,
        $33, $34, $35
      )
    `,
      [
        user.id,
        user.firstName,
        user.lastName,
        user.email,
        user.password,
        user.contactNumber,
        user.profilePicture,
        STATUS_MAP[user.employeeStatus] || 'ACTIVE',
        employeeId,
        user.fatherName,
        user.emergencyContactNumber,
        user.gender,
        user.dateOfBirth ? new Date(user.dateOfBirth) : null,
        user.bloodGroup,
        user.permanentAddress, // → streetName
        user.dateOfJoining ? new Date(user.dateOfJoining) : null,
        user.previousExperience,
        user.employeeType,
        user.designation,
        user.aadharNumber,
        user.panNumber,
        user.uanNumber,
        user.esicNumber,
        user.passportNumber,
        user.drivingLicenseNumber, // → dlNumber
        user.bankName,
        user.bankIFSC, // → ifscCode
        user.bankAccountNumber, // → accountNumber
        user.bankHoldersName, // → bankHolderName
        'Asia/Kolkata',
        false, // noticePeriodWaived
        false, // whatsappOptIn
        user.createdAt,
        user.updatedAt,
        SYSTEM_USER_ID,
      ],
    );

    migratedIds.push(user.id);
    log(`  ✓ ${user.employeeId} ${user.firstName} ${user.lastName} <${user.email}> [${user.employeeStatus}]`);
  }

  log(`Users: ${migratedIds.length} processed (${oldUsers.rows.length} total in old DB)`);
  return migratedIds;
}

// ─── STEP 2: MIGRATE USER ROLES ─────────────────────────────────────────────

async function migrateUserRoles(
  oldDb: Client,
  newDb: Client,
  userIds: string[],
): Promise<void> {
  log('Step 2: Migrating user roles...');

  // Get role IDs from new DB
  const rolesResult = await newDb.query(
    `SELECT id, name FROM roles WHERE "deletedAt" IS NULL`,
  );
  const roleIdMap: Record<string, string> = {};
  for (const role of rolesResult.rows) {
    roleIdMap[role.name] = role.id;
  }
  log(`  Available roles: ${Object.keys(roleIdMap).join(', ')}`);

  // Get old users with roles
  const oldUsers = await oldDb.query(
    `SELECT id, "roleId" FROM users WHERE "deletedAt" IS NULL`,
  );

  let count = 0;
  for (const user of oldUsers.rows) {
    if (!userIds.includes(user.id)) continue;

    const newRoleName = ROLE_MAP[user.roleId];
    if (!newRoleName) {
      warn(`  Unknown role '${user.roleId}' for user ${user.id} — skipping role`);
      continue;
    }

    const newRoleId = roleIdMap[newRoleName];
    if (!newRoleId) {
      warn(`  Role '${newRoleName}' not found in new DB — skipping`);
      continue;
    }

    // Check if role already assigned
    const existing = await newDb.query(
      `SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2 LIMIT 1`,
      [user.id, newRoleId],
    );

    if (existing.rows.length > 0) continue;

    await newDb.query(
      `INSERT INTO user_roles ("userId", "roleId", "createdAt", "updatedAt")
       VALUES ($1, $2, NOW(), NOW())`,
      [user.id, newRoleId],
    );
    count++;
  }

  log(`User roles: ${count} created`);
}

// ─── STEP 3: MIGRATE ATTENDANCE ──────────────────────────────────────────────

async function migrateAttendance(oldDb: Client, newDb: Client): Promise<string[]> {
  log('Step 3: Migrating attendance...');

  // Get shift config ID (may be null)
  const shiftResult = await newDb.query(`
    SELECT cs.id FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.key = 'shift_configs' AND cs."isActive" = true AND cs."deletedAt" IS NULL
    LIMIT 1
  `);
  const shiftConfigId = shiftResult.rows[0]?.id || null;
  log(`  Shift config ID: ${shiftConfigId || 'NULL (not configured)'}`);

  const oldAttendance = await oldDb.query(`
    SELECT * FROM "attendanceLogs"
    WHERE "deletedAt" IS NULL AND "createdAt" >= $1
    ORDER BY "createdAt"
  `, [MIGRATION_START_DATE]);

  const migratedIds: string[] = [];

  for (const att of oldAttendance.rows) {
    // Check if already migrated
    const existing = await newDb.query(
      `SELECT id FROM attendances WHERE id = $1 LIMIT 1`,
      [att.id],
    );
    if (existing.rows.length > 0) {
      migratedIds.push(att.id);
      continue;
    }

    const status = ATTENDANCE_STATUS_MAP[att.status] || 'present';
    const approvalStatus = APPROVAL_STATUS_MAP[att.attendanceApproval] || 'approval_pending';
    const attendanceType = att.forced ? 'regularized' : 'system';

    await newDb.query(
      `
      INSERT INTO attendances (
        id, "userId", "attendanceDate", "checkInTime", "checkOutTime",
        status, "shiftConfigId", "isActive", "entrySourceType", "attendanceType",
        "approvalStatus", "approvalBy", "approvalAt", "approvalComment", notes,
        "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        $1, $2, ($3::timestamptz AT TIME ZONE 'Asia/Kolkata')::date, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17
      )
    `,
      [
        att.id,
        att.userId,
        att.checkIn, // used for both attendanceDate (converted to IST date) and checkInTime
        att.checkOut,
        status,
        shiftConfigId,
        att.currentRecord,
        'mobile',
        attendanceType,
        approvalStatus,
        att.approvalBy,
        att.approvalAt,
        att.approvalReason,
        att.checkInNote,
        att.createdAt,
        att.updatedAt,
        att.userId, // createdBy = user themselves
      ],
    );

    migratedIds.push(att.id);
  }

  log(`Attendance: ${migratedIds.length} migrated`);
  return migratedIds;
}

// ─── STEP 4: MIGRATE EXPENSES ────────────────────────────────────────────────

async function migrateExpenses(oldDb: Client, newDb: Client): Promise<string[]> {
  log('Step 4: Migrating expenses...');

  const oldExpenses = await oldDb.query(`
    SELECT * FROM expenses
    WHERE "deletedAt" IS NULL
      AND "createdAt" >= $1
      AND "expenseType" != 'Month Start'
      AND "transactionType" != 'Month Start'
    ORDER BY "createdAt"
  `, [MIGRATION_START_DATE]);

  const migratedIds: string[] = [];

  for (const exp of oldExpenses.rows) {
    // Check if already migrated
    const existing = await newDb.query(
      `SELECT id FROM expenses WHERE id = $1 LIMIT 1`,
      [exp.id],
    );
    if (existing.rows.length > 0) {
      migratedIds.push(exp.id);
      continue;
    }

    const category = EXPENSE_CATEGORY_MAP[exp.expenseType];
    if (!category) {
      warn(`  Unknown expense type '${exp.expenseType}' for expense ${exp.id} — skipping`);
      continue;
    }

    const approvalStatus = EXPENSE_APPROVAL_MAP[exp.approvalStatus] || 'pending';
    const transactionType = exp.transactionType?.toLowerCase() || 'debit';
    const paymentMode = PAYMENT_MODE_MAP[exp.paymentMode] || exp.paymentMode?.toLowerCase() || 'cash';

    await newDb.query(
      `
      INSERT INTO expenses (
        id, "userId", category, description, amount,
        "transactionId", "expenseDate", "approvalStatus", "approvalBy",
        "approvalAt", "approvalReason", "transactionType", "paymentMode",
        "isActive", "entrySourceType", "expenseEntryType", "versionNumber",
        "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20
      )
    `,
      [
        exp.id,
        exp.userId,
        category,
        exp.description || 'Migrated from old system',
        parseFloat(exp.amount) || 0,
        exp.transactionId,
        exp.expenseDate,
        approvalStatus,
        exp.approvalBy,
        exp.approvalDate, // → approvalAt
        exp.approvalReason,
        transactionType,
        paymentMode,
        true, // isActive
        'mobile', // entrySourceType
        'original', // expenseEntryType
        1, // versionNumber
        exp.createdBy,
        exp.createdAt,
        exp.updatedAt,
      ],
    );

    migratedIds.push(exp.id);
  }

  log(`Expenses: ${migratedIds.length} migrated (${oldExpenses.rows.length - migratedIds.length} skipped)`);
  return migratedIds;
}

// ─── STEP 4b: MIGRATE EXPENSE FILES ──────────────────────────────────────────

async function migrateExpenseFiles(oldDb: Client, newDb: Client): Promise<string[]> {
  log('Step 4b: Migrating expense files (proofs)...');

  const oldExpenses = await oldDb.query(`
    SELECT id, "expenseProof", "userId", "createdAt"
    FROM expenses
    WHERE "deletedAt" IS NULL
      AND "createdAt" >= $1
      AND "expenseType" != 'Month Start'
      AND "transactionType" != 'Month Start'
      AND "expenseProof" IS NOT NULL
      AND "expenseProof" != ''
    ORDER BY "createdAt"
  `, [MIGRATION_START_DATE]);

  const migratedIds: string[] = [];

  for (const exp of oldExpenses.rows) {
    // Check if expense exists in new DB (it should, from Step 4)
    const expExists = await newDb.query(
      `SELECT id FROM expenses WHERE id = $1 LIMIT 1`,
      [exp.id],
    );
    if (expExists.rows.length === 0) continue;

    // Check if file already migrated
    const existing = await newDb.query(
      `SELECT id FROM expense_files WHERE "expenseId" = $1 AND "fileKey" = $2 LIMIT 1`,
      [exp.id, exp.expenseProof],
    );
    if (existing.rows.length > 0) {
      migratedIds.push(existing.rows[0].id);
      continue;
    }

    const result = await newDb.query(
      `INSERT INTO expense_files ("expenseId", "fileKey", "createdAt", "updatedAt", "createdBy")
       VALUES ($1, $2, $3, $3, $4) RETURNING id`,
      [exp.id, exp.expenseProof, exp.createdAt, exp.userId],
    );

    migratedIds.push(result.rows[0].id);
  }

  log(`Expense files: ${migratedIds.length} migrated (of ${oldExpenses.rows.length} with proofs)`);
  return migratedIds;
}

// ─── STEP 5: CREATE LEAVE BALANCES ───────────────────────────────────────────

async function createLeaveBalances(newDb: Client, userIds: string[]): Promise<string[]> {
  log('Step 5: Creating leave balances...');

  // Get leave config setting ID for FY 2026-2027
  const leaveConfigResult = await newDb.query(`
    SELECT cs.id FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.key = 'leave_categories_config'
      AND cs."contextKey" = $1
      AND cs."isActive" = true
      AND cs."deletedAt" IS NULL
    LIMIT 1
  `, [FINANCIAL_YEAR]);

  const leaveConfigId = leaveConfigResult.rows[0]?.id || null;
  if (!leaveConfigId) {
    warn('No leave_categories_config found for FY 2026-2027. Skipping leave balance creation.');
    warn('Create the leave config first, then re-run migration.');
    return [];
  }

  const currentFYMonth = getFYMonth();
  const totalAllocated = Math.floor((LEAVE_ANNUAL_QUOTA * currentFYMonth) / 12);
  log(`  FY month: ${currentFYMonth}, totalAllocated: ${totalAllocated} (of ${LEAVE_ANNUAL_QUOTA} annual)`);

  // Get only ACTIVE users
  const activeUsers = await newDb.query(
    `SELECT id FROM users WHERE id = ANY($1) AND status = 'ACTIVE' AND "deletedAt" IS NULL`,
    [userIds],
  );

  const migratedIds: string[] = [];

  for (const user of activeUsers.rows) {
    // Check if leave balance already exists
    const existing = await newDb.query(
      `SELECT id FROM leave_balances
       WHERE "userId" = $1 AND "leaveCategory" = 'earned' AND "financialYear" = $2
       AND "deletedAt" IS NULL LIMIT 1`,
      [user.id, FINANCIAL_YEAR],
    );

    if (existing.rows.length > 0) {
      migratedIds.push(existing.rows[0].id);
      continue;
    }

    const result = await newDb.query(
      `
      INSERT INTO leave_balances (
        "userId", "leaveConfigId", "leaveCategory", "financialYear",
        "totalAllocated", "creditSource", consumed, "carriedForward",
        adjusted, notes, "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, NOW(), NOW()
      ) RETURNING id
    `,
      [
        user.id,
        leaveConfigId,
        'earned',
        FINANCIAL_YEAR,
        totalAllocated.toString(),
        'monthly_accrual',
        '0', // consumed
        '0', // carriedForward
        '0', // adjusted
        `Migration: ${totalAllocated} days credited (FY month ${currentFYMonth})`,
      ],
    );

    migratedIds.push(result.rows[0].id);
  }

  log(`Leave balances: ${migratedIds.length} created for ${activeUsers.rows.length} active users`);
  return migratedIds;
}

// ─── MIGRATION MANIFEST ──────────────────────────────────────────────────────

async function saveMigrationManifest(
  newDb: Client,
  data: {
    userIds: string[];
    attendanceIds: string[];
    expenseIds: string[];
    expenseFileIds: string[];
    leaveBalanceIds: string[];
  },
) {
  // Store manifest as a JSON comment in a simple tracking approach
  // We'll use a temp table or just log it
  const manifest = JSON.stringify({
    migratedAt: new Date().toISOString(),
    sourceDb: OLD_DB.database,
    targetDb: NEW_DB.database,
    counts: {
      users: data.userIds.length,
      attendance: data.attendanceIds.length,
      expenses: data.expenseIds.length,
      leaveBalances: data.leaveBalanceIds.length,
    },
    ids: data,
  });

  // Write manifest to file for rollback reference
  const fs = await import('fs');
  const path = await import('path');
  const manifestPath = path.join(__dirname, 'migration-manifest.json');
  fs.writeFileSync(manifestPath, manifest, 'utf-8');
  log(`Migration manifest saved to: ${manifestPath}`);
}

// ─── ROLLBACK ────────────────────────────────────────────────────────────────

async function rollback(newDb: Client) {
  log('Starting ROLLBACK...');

  const fs = await import('fs');
  const path = await import('path');
  const manifestPath = path.join(__dirname, 'migration-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    error('No migration manifest found. Cannot rollback.');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const { userIds, attendanceIds, expenseIds, expenseFileIds, leaveBalanceIds } = manifest.ids;

  await newDb.query('BEGIN');

  try {
    // Reverse order: leave_balances → expenses → attendance → user_roles → users
    if (leaveBalanceIds?.length) {
      await newDb.query(`DELETE FROM leave_balances WHERE id = ANY($1)`, [leaveBalanceIds]);
      log(`  Deleted ${leaveBalanceIds.length} leave balances`);
    }

    if (expenseFileIds?.length) {
      await newDb.query(`DELETE FROM expense_files WHERE id = ANY($1)`, [expenseFileIds]);
      log(`  Deleted ${expenseFileIds.length} expense files`);
    }

    if (expenseIds?.length) {
      await newDb.query(`DELETE FROM expenses WHERE id = ANY($1)`, [expenseIds]);
      log(`  Deleted ${expenseIds.length} expenses`);
    }

    if (attendanceIds?.length) {
      await newDb.query(`DELETE FROM attendances WHERE id = ANY($1)`, [attendanceIds]);
      log(`  Deleted ${attendanceIds.length} attendance records`);
    }

    if (userIds?.length) {
      await newDb.query(`DELETE FROM user_roles WHERE "userId" = ANY($1)`, [userIds]);
      log(`  Deleted user roles`);

      // Only delete users that were actually created by migration (not pre-existing)
      await newDb.query(
        `DELETE FROM users WHERE id = ANY($1) AND "createdBy" = $2`,
        [userIds, SYSTEM_USER_ID],
      );
      log(`  Deleted migrated users`);
    }

    await newDb.query('COMMIT');
    log('ROLLBACK completed successfully');

    // Remove manifest
    fs.unlinkSync(manifestPath);
    log('Migration manifest removed');
  } catch (err) {
    await newDb.query('ROLLBACK');
    error(`Rollback failed: ${err.message}`);
    throw err;
  }
}

// ─── RUN ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
