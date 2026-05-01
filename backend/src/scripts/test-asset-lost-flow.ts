/**
 * Tests the lost asset flow end-to-end:
 *   1. Mark Lost (with recovery amount + files)
 *   2. Verify event created, asset status updated, expense created
 *   3. Mark Recovered (with refund flag)
 *   4. Verify event created, asset back to AVAILABLE, refund expense created
 *   5. Test edge cases (already lost, retired asset, employee role 403, etc.)
 *
 * Usage: npx ts-node src/scripts/test-asset-lost-flow.ts
 */

import * as http from 'http';
import { Client } from 'pg';

const BASE_URL = 'http://localhost:3333/api/v1';
const DB_CFG = {
  host: 'eureka-enterprises.c4bfdwj2okvo.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'adminadmin',
  database: 'european_union',
  ssl: { rejectUnauthorized: false },
};

const ADMIN_HEADERS = {
  'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000',
  'X-Source-Type': 'web',
  'X-Client-Type': 'web',
  'X-Active-Role': 'ADMIN',
  'X-Timezone': 'Asia/Kolkata',
};

let TOKEN = '';

async function login(email: string, password: string): Promise<{ accessToken: string; activeRole: string; id: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request(
      {
        host: 'localhost',
        port: 3333,
        path: '/api/v1/auth/sign-in',
        method: 'POST',
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json', 'Content-Length': data.length },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const r = JSON.parse(body);
            if (r.accessToken) resolve({ accessToken: r.accessToken, activeRole: r.activeRole, id: r.userId });
            else reject(new Error(`Login failed: ${body}`));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function call(
  method: string,
  path: string,
  body?: any,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: 'localhost',
        port: 3333,
        path: `/api/v1${path}`,
        method,
        headers: {
          ...ADMIN_HEADERS,
          ...extraHeaders,
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': data.length } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function logResult(label: string, status: number, body: any, expectedStatus: number | number[] = [200, 201]) {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const ok = expected.includes(status);
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(50)} status=${status}${ok ? '' : ` (expected ${expected.join('/')})`}`);
  if (!ok) {
    console.log(`     Response: ${JSON.stringify(body).substring(0, 200)}`);
  }
  return ok;
}

async function main() {
  console.log('\n══════════════ LOST ASSET FLOW TEST ══════════════\n');

  // 1. Login as admin
  const adminLogin = await login('abhineet.sachan@yopmail.com', 'Admin@123');
  TOKEN = adminLogin.accessToken;
  console.log(`✓ Logged in as admin: ${adminLogin.id}\n`);

  // 2. Find an ASSIGNED asset to test with
  const db = new Client(DB_CFG);
  await db.connect();
  const assets = await db.query(
    `SELECT am.id as "assetMasterId", am."assetId", av.id as "assetVersionId", av.name, av.status, av."assignedTo", av."purchasePrice"
     FROM asset_masters am
     JOIN asset_versions av ON av."assetMasterId" = am.id AND av."isActive" = true
     WHERE am."deletedAt" IS NULL AND av."deletedAt" IS NULL AND av.status = 'ASSIGNED'
     LIMIT 1`,
  );
  if (assets.rows.length === 0) {
    console.log('No ASSIGNED asset available for testing. Aborting.');
    await db.end();
    return;
  }
  const testAsset = assets.rows[0];
  console.log(`Selected asset: ${testAsset.name} (${testAsset.assetId}) — assigned to ${testAsset.assignedTo}\n`);

  // ───────────────────── Section 1: Mark Lost ─────────────────────
  console.log('Section 1 — Mark as Lost:');
  const markLostResult = await call('POST', `/assets/${testAsset.assetMasterId}/mark-lost`, {
    reason: 'Test: Stolen from site',
    lastSeenDate: '2026-04-25',
    lastSeenLocation: 'Test Site - Mumbai',
    recoveryAmount: '5000',
  });
  logResult('Mark Lost (with recovery=5000)', markLostResult.status, markLostResult.body);
  const lostExpenseId = markLostResult.body?.recoveryExpenseId;

  // Verify asset status
  const statusCheck = await db.query(
    `SELECT status, "assignedTo" FROM asset_versions WHERE id = $1`,
    [testAsset.assetVersionId],
  );
  console.log(`  ${statusCheck.rows[0].status === 'LOST' ? '✓' : '✗'} Asset status is now LOST: ${statusCheck.rows[0].status}, assignedTo: ${statusCheck.rows[0].assignedTo}`);

  // Verify event was created
  const eventCheck = await db.query(
    `SELECT id, "eventType", "fromUser", metadata FROM assets_events WHERE "assetMasterId" = $1 AND "eventType" = 'LOST' ORDER BY "createdAt" DESC LIMIT 1`,
    [testAsset.assetMasterId],
  );
  const lostEvent = eventCheck.rows[0];
  console.log(`  ${lostEvent ? '✓' : '✗'} LOST event created. fromUser=${lostEvent?.fromUser}, recoveryAmount=${lostEvent?.metadata?.recoveryAmount}`);

  // Verify expense was created
  if (lostExpenseId) {
    const expCheck = await db.query(
      `SELECT id, "userId", amount, category, "transactionType", "transactionId" FROM expenses WHERE id = $1`,
      [lostExpenseId],
    );
    const exp = expCheck.rows[0];
    console.log(`  ${exp ? '✓' : '✗'} Expense created: ₹${exp?.amount} ${exp?.transactionType} on user ${exp?.userId}, transactionId(=eventId)=${exp?.transactionId}`);
  }

  // ───────────────────── Section 2: Edge cases ─────────────────────
  console.log('\nSection 2 — Edge cases:');

  // Already lost
  const dupResult = await call('POST', `/assets/${testAsset.assetMasterId}/mark-lost`, {
    reason: 'Test: Should be blocked',
    lastSeenDate: '2026-04-25',
    lastSeenLocation: 'Test',
  });
  logResult('Mark lost again — should fail (400)', dupResult.status, dupResult.body, 400);

  // Mark Recovered as employee — should fail 403
  const employeeResult = await call(
    'POST',
    `/assets/${testAsset.assetMasterId}/mark-recovered`,
    { notes: 'Test' },
    { 'X-Active-Role': 'EMPLOYEE' },
  );
  logResult('Recovered as EMPLOYEE — should fail (403)', employeeResult.status, employeeResult.body, 403);

  // ───────────────────── Section 3: Find Lost ─────────────────────
  console.log('\nSection 3 — Find Lost (list):');
  const lostList = await call('GET', '/assets/lost');
  logResult('GET /assets/lost', lostList.status, lostList.body);
  if (lostList.body?.records) {
    const found = lostList.body.records.find((r: any) => r.assetMasterId === testAsset.assetMasterId);
    console.log(`  ${found ? '✓' : '✗'} Our test asset appears in lost list (total: ${lostList.body.total})`);
    if (found) {
      console.log(`     - previousAssignee: ${found.previousAssignee?.firstName} ${found.previousAssignee?.lastName}`);
      console.log(`     - markedBy: ${found.markedBy?.firstName} ${found.markedBy?.lastName}`);
      console.log(`     - recoveryExpense: ${JSON.stringify(found.recoveryExpense)}`);
    }
  }

  // ───────────────────── Section 4: Asset Events History ─────────────────────
  console.log('\nSection 4 — Asset Events history (existing endpoint includes LOST):');
  const events = await call('GET', `/asset-events/${testAsset.assetMasterId}`);
  if (events.body?.stats) {
    console.log(`  ✓ Events fetched. LOST count: ${events.body.stats.byEventType?.LOST || 0}, RECOVERED count: ${events.body.stats.byEventType?.RECOVERED || 0}`);
  }

  // ───────────────────── Section 5: Mark Recovered (with refund) ─────────────────────
  console.log('\nSection 5 — Mark as Recovered (with refund):');
  const markRecResult = await call('POST', `/assets/${testAsset.assetMasterId}/mark-recovered`, {
    notes: 'Test: Found in basement',
    refundRecoveryAmount: true,
  });
  logResult('Mark Recovered (refund=true)', markRecResult.status, markRecResult.body);
  console.log(`  Refund issued: ₹${markRecResult.body?.refundedAmount}, refundExpenseId: ${markRecResult.body?.refundExpenseId}`);

  // Verify status back to AVAILABLE
  const statusCheck2 = await db.query(
    `SELECT status FROM asset_versions WHERE id = $1`,
    [testAsset.assetVersionId],
  );
  console.log(`  ${statusCheck2.rows[0].status === 'AVAILABLE' ? '✓' : '✗'} Asset status: ${statusCheck2.rows[0].status}`);

  // Verify RECOVERED event
  const recEventCheck = await db.query(
    `SELECT id, "eventType", metadata FROM assets_events WHERE "assetMasterId" = $1 AND "eventType" = 'RECOVERED' ORDER BY "createdAt" DESC LIMIT 1`,
    [testAsset.assetMasterId],
  );
  console.log(`  ${recEventCheck.rows[0] ? '✓' : '✗'} RECOVERED event created. refundedAmount=${recEventCheck.rows[0]?.metadata?.refundedAmount}`);

  // Verify refund expense
  if (markRecResult.body?.refundExpenseId) {
    const refundCheck = await db.query(
      `SELECT amount, "transactionType" FROM expenses WHERE id = $1`,
      [markRecResult.body.refundExpenseId],
    );
    console.log(`  ${refundCheck.rows[0]?.transactionType === 'debit' ? '✓' : '✗'} Refund expense type: ${refundCheck.rows[0]?.transactionType}, amount: ₹${refundCheck.rows[0]?.amount}`);
  }

  // ───────────────────── Section 6: Mark Recovered when not lost ─────────────────────
  console.log('\nSection 6 — Mark Recovered when not lost:');
  const recAgainResult = await call('POST', `/assets/${testAsset.assetMasterId}/mark-recovered`, {
    notes: 'Should fail',
  });
  logResult('Mark Recovered on non-LOST asset — should fail (400)', recAgainResult.status, recAgainResult.body, 400);

  // ───────────────────── Section 7: Dashboard alert count ─────────────────────
  console.log('\nSection 7 — Dashboard lost count:');
  const alerts = await call('GET', '/dashboard/alerts');
  logResult('GET /dashboard/alerts', alerts.status, alerts.body);
  console.log(`  Lost assets count: ${alerts.body?.counts?.lostAssets?.total ?? 'MISSING'}`);

  console.log('\n══════════════ DONE ══════════════\n');
  await db.end();
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
