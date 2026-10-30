// test_admin_enhanced_suite.mjs
// Comprehensive test suite for Admin Directory, Store Settings, COD enforcement, and Analytics

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_KEY = 'machii-admin-secure-key';

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ` - ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('MACHII MENS MART — ENHANCED ADMIN & SETTINGS TEST SUITE');
  console.log('====================================================');

  // Test 1: Unauthorized access to new admin endpoints rejected with 401
  console.log('\n--- 1. Unauthorized Access Protection ---');
  console.log('Testing against BASE_URL:', BASE_URL);
  try {
    const custRes = await fetch(`${BASE_URL}/api/admin/customers`);
    assert(custRes.status === 401, 'GET /api/admin/customers requires authorization (401)');

    const settRes = await fetch(`${BASE_URL}/api/admin/settings`);
    assert(settRes.status === 401, 'GET /api/admin/settings requires authorization (401)');

    const anaRes = await fetch(`${BASE_URL}/api/admin/analytics`);
    assert(anaRes.status === 401, 'GET /api/admin/analytics requires authorization (401)');

    const patchRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codEnabled: false }),
    });
    assert(patchRes.status === 401, 'PATCH /api/admin/settings requires authorization (401)');
  } catch (err) {
    console.error('Detailed fetch error:', err.cause || err);
    assert(false, 'Unauthorized access test threw error', err.message);
  }

  // Test 2: Authorized GET /api/admin/customers
  console.log('\n--- 2. Authorized Customers Directory ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/customers`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/customers returns 200 OK');
    assert(data.success === true, 'Response success is true');
    assert(Array.isArray(data.customers), 'Customers is an array');
    console.log(`    Retrieved ${data.customers.length} customer records.`);
    if (data.customers.length > 0) {
      const first = data.customers[0];
      assert(typeof first.mobile === 'string', 'Customer has mobile phone');
      assert(typeof first.orderCount === 'number', 'Customer has orderCount metric');
      assert(typeof first.totalSpent === 'number', 'Customer has totalSpent (LTV) metric');
      assert(Array.isArray(first.addresses), 'Customer has addresses array');
    }
  } catch (err) {
    assert(false, 'Authorized customers directory test threw error', err.message);
  }

  // Test 3: Public GET /api/settings
  console.log('\n--- 3. Public Storefront Settings ---');
  try {
    const res = await fetch(`${BASE_URL}/api/settings`);
    const data = await res.json();
    assert(res.status === 200, 'GET /api/settings returns 200 OK without admin auth');
    assert(data.success === true, 'Public settings success is true');
    assert(data.settings?.storeName === 'Machii Mens Mart', 'Store name is Machii Mens Mart');
    assert(typeof data.settings?.codEnabled === 'boolean', 'Public settings exposes codEnabled');
    assert(typeof data.settings?.announcementBanner === 'object', 'Public settings exposes announcementBanner');
  } catch (err) {
    assert(false, 'Public storefront settings test threw error', err.message);
  }

  // Test 4: Authorized GET and PATCH /api/admin/settings
  console.log('\n--- 4. Authorized Store Settings & Announcement Banner ---');
  try {
    const getRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /api/admin/settings returns 200 OK');
    assert(getData.success === true, 'Admin settings GET success is true');

    // Update announcement banner & support details
    const newHeadline = 'SUMMER 26 DROP • FLAT 15% OFF USE CODE:';
    const patchRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        announcementBanner: {
          enabled: true,
          text: newHeadline,
          promoCode: 'WEEKEND15',
        },
        supportPhone: '+91 99887 76655',
      }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200, 'PATCH /api/admin/settings returns 200 OK');
    assert(patchData.success === true, 'Settings update succeeded');
    assert(patchData.settings.announcementBanner.text === newHeadline, 'Banner headline text updated');
    assert(patchData.settings.announcementBanner.promoCode === 'WEEKEND15', 'Banner promo code updated');
    assert(patchData.settings.supportPhone === '+91 99887 76655', 'Support phone updated');

    // Verify public settings immediately reflects the update
    const publicRes = await fetch(`${BASE_URL}/api/settings`);
    const publicData = await publicRes.json();
    assert(publicData.settings.announcementBanner.text === newHeadline, 'Public storefront reflects updated headline');
    assert(publicData.settings.announcementBanner.promoCode === 'WEEKEND15', 'Public storefront reflects updated promo code');
  } catch (err) {
    assert(false, 'Admin settings update test threw error', err.message);
  }

  // Test 5: Master COD Toggle Enforcement
  console.log('\n--- 5. Master Cash on Delivery (COD) Enforcement ---');
  try {
    // Disable COD
    const disableCodRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({ codEnabled: false }),
    });
    const disableCodData = await disableCodRes.json();
    assert(disableCodData.settings.codEnabled === false, 'COD disabled on admin settings');

    // Attempt to place a COD order while COD is disabled
    const codOrderAttempt = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: 'prod-essential-oversized',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            quantity: 1,
            size: 'M',
            color: 'Charcoal',
          },
        ],
        customer: {
          fullName: 'Test Customer',
          mobile: '9876543210',
          address: 'Test Street',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
        },
        paymentMethod: 'COD',
      }),
    });
    const codOrderData = await codOrderAttempt.json();
    assert(codOrderAttempt.status === 400, 'Order creation with COD rejected with 400 when COD is disabled');
    assert(codOrderData.success === false, 'Order rejected response success is false');
    assert(codOrderData.error?.includes('Cash on Delivery (COD) is temporarily disabled'), 'Proper rejection message returned');

    // Re-enable COD for normal storefront operations
    const enableCodRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({ codEnabled: true }),
    });
    const enableCodData = await enableCodRes.json();
    assert(enableCodData.settings.codEnabled === true, 'COD re-enabled successfully');
  } catch (err) {
    assert(false, 'COD toggle enforcement test threw error', err.message);
  }

  // Test 6: Authorized GET /api/admin/analytics
  console.log('\n--- 6. Financial & Operational Analytics ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/analytics`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/analytics returns 200 OK');
    assert(data.success === true, 'Analytics success is true');
    assert(typeof data.analytics?.averageOrderValue === 'number', 'AOV metric computed');
    assert(typeof data.analytics?.fulfillmentRate === 'number', 'Fulfillment rate computed');
    assert(Array.isArray(data.analytics?.topSellingProducts), 'Top selling products array returned');
    assert(typeof data.analytics?.statusBreakdown === 'object', 'Status breakdown returned');
  } catch (err) {
    assert(false, 'Admin analytics test threw error', err.message);
  }

  // Test 7: Enriched /api/admin/summary
  console.log('\n--- 7. Enriched Admin Overview Summary ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/summary`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/summary returns 200 OK');
    assert(data.success === true, 'Summary success is true');
    assert(typeof data.summary?.totalCustomers === 'number', 'Summary includes totalCustomers');
    assert(typeof data.summary?.averageOrderValue === 'number', 'Summary includes averageOrderValue');
    assert(typeof data.summary?.storeSettings === 'object', 'Summary includes storeSettings snapshot');
  } catch (err) {
    assert(false, 'Enriched summary test threw error', err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL ADMIN ENHANCEMENTS AND STORE SETTINGS VERIFIED SUCCESSFULLY!');
    process.exitCode = 0;
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exitCode = 1;
  }
}

runTests();
