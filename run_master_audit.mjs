/* ==========================================================================
   MACHII MENS MART — MASTER E2E AUDIT RUNNER
   Executes every test suite across all 14 required flows and outputs a unified
   audit report with exact counts.
   ========================================================================== */

import { execSync } from 'node:child_process';

const SUITES = [
  { name: 'Flow 1-6 & 12: Real Browser E2E Automation (CDP)', cmd: 'node test_e2e_full_audit.mjs' },
  { name: 'Flow 12: Cross-Browser & Viewport Responsive Suite', cmd: 'node scratch/test_browser_viewport.mjs' },
  { name: 'Flow 2: Product Search, Filters & Sorting Suite', cmd: 'node test_search_filter_sort_flow.mjs' },
  { name: 'Flow 4: Wishlist & Save-for-Later Isolation Suite', cmd: 'node test_wishlist_flow.mjs' },
  { name: 'Flow 7: Order Confirmation & Customer History Suite', cmd: 'node test_order_history_flow.mjs' },
  { name: 'Flow 7: Real-time Order Tracking & Timeline Suite', cmd: 'node test_order_tracking_flow.mjs' },
  { name: 'Flow 8: Customer Profile & Delivery Address Suite', cmd: 'node test_profile_address_flow.mjs' },
  { name: 'Flow 9: Admin Authentication, Products & Stock Suite', cmd: 'node test_admin_flow.mjs' },
  { name: 'Flow 9 & Store Settings: Enhanced Admin Analytics', cmd: 'node test_admin_enhanced_suite.mjs' },
  { name: 'Flow 10: Coupon Validation & Server Total Recalculation', cmd: 'node test_coupon_flow.mjs' },
  { name: 'Flow 11: Order Notifications & Carrier Updates', cmd: 'node test_notification_flow.mjs' },
  { name: 'Flow 13: Security Audit, Rate Limiting & Input Sanitization', cmd: 'node test_security_audit_suite.mjs' },
  { name: 'Flow 14: SEO Metadata, Sitemap & Robots.txt Suite', cmd: 'node test_seo_metadata_suite.mjs' },
  { name: 'Code Quality: Oxlint Static Analysis', cmd: 'npm run lint' },
  { name: 'Production Build: Vite Compiler & Code Splitting', cmd: 'npm run build' },
];

console.log('\n=============================================================');
console.log('MACHII MENS MART — MASTER END-TO-END AUDIT SUITE EXECUTION');
console.log('=============================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;
const results = [];

for (const suite of SUITES) {
  process.stdout.write(`Executing: ${suite.name}... `);
  const startTime = Date.now();
  try {
    execSync(suite.cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ PASSED (${duration}s)`);
    totalPassedSuites++;
    results.push({ name: suite.name, status: 'PASSED', duration: `${duration}s` });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✗ FAILED (${duration}s)`);
    console.error(err.stdout || err.message);
    totalFailedSuites++;
    results.push({ name: suite.name, status: 'FAILED', duration: `${duration}s`, err: err.message });
  }
}

console.log('\n=============================================================');
console.log(`MASTER AUDIT SUMMARY: ${totalPassedSuites}/${SUITES.length} SUITES PASSED`);
console.log('=============================================================\n');

results.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.status === 'PASSED' ? '✓' : '✗'}] ${r.name} — ${r.duration}`);
});

process.exitCode = totalFailedSuites > 0 ? 1 : 0;

