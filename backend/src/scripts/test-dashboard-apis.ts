/**
 * Tests all dashboard endpoints against the running local server.
 * Usage: npx ts-node src/scripts/test-dashboard-apis.ts
 */

import * as http from 'http';

const BASE_URL = 'http://localhost:3333/api/v1';

// Use real JWT obtained via /auth/sign-in endpoint
const ADMIN_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVlMmEwMjE3LWYwZjEtNDMwNy05NzIwLWM4OTQzYzM1NmI0OCIsImVtYWlsIjoiYWJoaW5lZXQuc2FjaGFuQHlvcG1haWwuY29tIiwicm9sZXMiOlsiQURNSU4iXSwiYWN0aXZlUm9sZSI6IkFETUlOIiwiaWF0IjoxNzc3NDMxMTU5LCJleHAiOjE3Nzk4NTAzNTl9.VoHmXmGoRfmvxvy9aqfmEj2O45HOU2wkfMCC7Y4uphs';
const EMPLOYEE_TOKEN = ADMIN_TOKEN; // Will override role via header

const HEADERS = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  'X-Active-Role': 'ADMIN',
  'X-Correlation-Id': '550e8400-e29b-41d4-a716-446655440000',
  'X-Source-Type': 'web',
  'X-Client-Type': 'web',
  'X-Timezone': 'Asia/Kolkata',
};

const EMPLOYEE_HEADERS = {
  ...HEADERS,
  Authorization: `Bearer ${EMPLOYEE_TOKEN}`,
  'X-Active-Role': 'EMPLOYEE',
};

interface TestResult {
  endpoint: string;
  status: number;
  ok: boolean;
  duration: number;
  error?: string;
  preview?: any;
}

function get(path: string, headers: Record<string, string>): Promise<TestResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(BASE_URL + path, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const duration = Date.now() - start;
        const status = res.statusCode || 0;
        let parsed: any;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body.substring(0, 100);
        }
        const ok = status >= 200 && status < 300;
        resolve({
          endpoint: path,
          status,
          ok,
          duration,
          error: ok ? undefined : parsed?.error?.message || parsed?.message || 'Unknown',
          preview: ok ? parsed : undefined,
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        endpoint: path,
        status: 0,
        ok: false,
        duration: Date.now() - start,
        error: err.message,
      });
    });
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({
        endpoint: path,
        status: 0,
        ok: false,
        duration: 15000,
        error: 'TIMEOUT',
      });
    });
  });
}

const ENDPOINTS = [
  // Wrappers around existing methods
  '/dashboard/overview',
  '/dashboard/alerts',
  '/dashboard/approvals',
  '/dashboard/attendance-summary',
  '/dashboard/leave-summary',
  '/dashboard/expense-summary',
  '/dashboard/employees-summary',
  '/dashboard/payroll-summary',
  '/dashboard/birthdays',
  '/dashboard/anniversaries',
  '/dashboard/festivals',
  // New endpoints
  '/dashboard/vehicle-readings',
  '/dashboard/projects-pipeline',
  '/dashboard/ledger-balances',
  '/dashboard/cron-health',
  '/dashboard/leave-exhaustion',
  '/dashboard/payroll-status',
  // Mobile
  '/dashboard/mobile',
];

async function main() {
  console.log('\n══════════════ DASHBOARD API TESTS ══════════════\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Admin JWT: ${ADMIN_TOKEN.substring(0, 40)}...\n`);

  console.log('Testing as ADMIN role:\n');
  const adminResults: TestResult[] = [];
  for (const endpoint of ENDPOINTS) {
    const result = await get(endpoint, HEADERS);
    adminResults.push(result);
    const emoji = result.ok ? '✓' : '✗';
    const status = result.status === 0 ? 'FAIL' : result.status;
    console.log(
      `  ${emoji} ${endpoint.padEnd(40)} ${String(status).padEnd(5)} ${result.duration}ms ${result.error ? `→ ${result.error}` : ''}`,
    );
  }

  console.log('\n\nTesting EMPLOYEE access (should be 403 for admin endpoints):\n');
  const adminOnly = [
    '/dashboard/overview',
    '/dashboard/cron-health',
    '/dashboard/ledger-balances',
    '/dashboard/leave-exhaustion',
    '/dashboard/payroll-status',
  ];
  for (const endpoint of adminOnly) {
    const result = await get(endpoint, EMPLOYEE_HEADERS);
    const expected403 = result.status === 403;
    console.log(
      `  ${expected403 ? '✓' : '✗'} ${endpoint.padEnd(40)} ${result.status} (expected 403) ${result.error || ''}`,
    );
  }

  // Public (employee accessible)
  console.log('\n\nEmployee should access these:\n');
  const publicEndpoints = ['/dashboard/birthdays', '/dashboard/anniversaries', '/dashboard/festivals', '/dashboard/mobile'];
  for (const endpoint of publicEndpoints) {
    const result = await get(endpoint, EMPLOYEE_HEADERS);
    console.log(
      `  ${result.ok ? '✓' : '✗'} ${endpoint.padEnd(40)} ${result.status} ${result.error || ''}`,
    );
  }

  // Summary
  const passed = adminResults.filter((r) => r.ok).length;
  const failed = adminResults.length - passed;
  console.log(`\n══════════════ SUMMARY ══════════════`);
  console.log(`Admin endpoints: ${passed}/${adminResults.length} passed`);
  if (failed > 0) {
    console.log(`\nFailed endpoints:`);
    adminResults
      .filter((r) => !r.ok)
      .forEach((r) => console.log(`  ✗ ${r.endpoint} → ${r.status}: ${r.error}`));
  }

  // Show sample data for one endpoint
  const overview = adminResults.find((r) => r.endpoint === '/dashboard/cron-health' && r.ok);
  if (overview?.preview) {
    console.log(`\n\nSample response (cron-health):`);
    console.log(JSON.stringify(overview.preview, null, 2).substring(0, 800));
  }
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
