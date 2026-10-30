// test_security_audit_suite.mjs
// ============================================================================
// MACHII MENS MART — STEP 15: SECURITY AUDIT & DEFENSIVE VERIFICATION SUITE
// Tests authorization boundaries (BOLA), customer isolation, rate limiting,
// stock enforcement, input sanitization, safe error handling, and webhook security.
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_KEY = 'machii-admin-secure-key';

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runSecuritySuite() {
  console.log('\n=============================================================');
  console.log('MACHII MENS MART — STEP 15: SECURITY AUDIT & DEFENSIVE SUITE');
  console.log('=============================================================\n');

  // Reset rate limiters before test run
  try {
    await fetch(`${BASE_URL}/api/notifications/reset-limiters`, {
      method: 'POST',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
  } catch {
    // Continue
  }

  // --------------------------------------------------------------------------
  // TEST 1: BOLA / Information Disclosure on GET /api/orders
  // --------------------------------------------------------------------------
  console.log('--- 1. BOLA & Information Disclosure Protection ---');
  try {
    // An anonymous user requests /api/orders without phone or admin auth
    const anonRes = await fetch(`${BASE_URL}/api/orders`);
    const anonData = await anonRes.json();

    assert(
      anonRes.status === 401,
      'Unauthenticated GET /api/orders is rejected with 401 Unauthorized (does not dump database)',
      `Got status ${anonRes.status}`
    );
    assert(
      !anonData.orders || anonData.orders.length === 0,
      'No customer orders dumped to unauthenticated caller'
    );
    assert(
      anonData.error && anonData.error.includes('Unauthorized'),
      'Clear, safe error message explaining authorization is required'
    );

    // Admin request with X-Admin-Key is allowed
    const adminOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersRes.status === 200, 'Admin with X-Admin-Key can retrieve orders list (200 OK)');
    assert(Array.isArray(adminOrdersData.orders), 'Admin receives authorized orders array');
  } catch (err) {
    assert(false, 'BOLA test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Customer Cross-Access & Data Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Customer Cross-Access Isolation (IDOR/BOLA Protection) ---');
  let customerAOrderRef = null;
  const customerAPhone = '9876500001';
  const customerBPhone = '9876500002';

  try {
    // Place order for Customer A
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Customer Alpha',
          mobile: customerAPhone,
          email: 'alpha@example.com',
          address: '100 Marina Bay Boulevard',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
        },
        items: [
          {
            id: 'machii-oversized-heavyweight-tee',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            size: 'M',
            quantity: 1,
            color: 'Electric Cobalt',
          },
        ],
        paymentMethod: 'COD',
      }),
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 201, 'Customer A order created');
    customerAOrderRef = orderData.order?.orderRef;

    // Customer B attempts to view Customer A's order details
    const stealDetailRes = await fetch(
      `${BASE_URL}/api/orders/${encodeURIComponent(customerAOrderRef)}?phone=${customerBPhone}`
    );
    assert(
      stealDetailRes.status === 403,
      'Customer B cannot view Customer A order details (403 Forbidden)',
      `Got ${stealDetailRes.status}`
    );

    // Customer B attempts to view Customer A's tracking
    const stealTrackRes = await fetch(
      `${BASE_URL}/api/orders/${encodeURIComponent(customerAOrderRef)}/tracking?phone=${customerBPhone}`
    );
    assert(
      stealTrackRes.status === 403,
      'Customer B cannot view Customer A tracking timeline (403 Forbidden)',
      `Got ${stealTrackRes.status}`
    );

    // Customer B attempts to view Customer A's notification audit log
    const stealNotifRes = await fetch(
      `${BASE_URL}/api/orders/${encodeURIComponent(customerAOrderRef)}/notifications?phone=${customerBPhone}`
    );
    assert(
      stealNotifRes.status === 403,
      'Customer B cannot view Customer A notification audit log (403 Forbidden)',
      `Got ${stealNotifRes.status}`
    );

    // Customer A CAN view their own order
    const ownOrderRes = await fetch(
      `${BASE_URL}/api/orders/${encodeURIComponent(customerAOrderRef)}?phone=${customerAPhone}`
    );
    assert(ownOrderRes.status === 200, 'Customer A can view their own order (200 OK)');
  } catch (err) {
    assert(false, 'Cross-access test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Out-of-Stock and Inactive Product Enforcement
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Out-of-Stock and Inactive Product Enforcement ---');
  try {
    // 1. Create a zero-stock product via admin
    const zeroStockRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        name: 'Depleted Stock Tee',
        price: '₹1,299',
        stock: 0,
        sizes: ['M', 'L'],
      }),
    });
    const zeroProdData = await zeroStockRes.json();
    assert(zeroStockRes.status === 201, 'Created zero-stock test product');
    const zeroStockProdId = zeroProdData.product?.id;

    // Customer attempts to order zero-stock product
    const orderZeroRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Test Buyer',
          mobile: '9840112233',
          address: '44 Test Road, Adyar',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600020',
        },
        items: [
          {
            id: zeroStockProdId,
            name: 'Depleted Stock Tee',
            price: '₹1,299',
            size: 'M',
            quantity: 1,
          },
        ],
        paymentMethod: 'COD',
      }),
    });
    const orderZeroData = await orderZeroRes.json();
    assert(
      orderZeroRes.status === 400,
      'Ordering out-of-stock product is rejected with 400 Bad Request',
      `Got status ${orderZeroRes.status}`
    );
    assert(
      orderZeroData.error && orderZeroData.error.toLowerCase().includes('out of stock'),
      'Clear error message indicating item is out of stock',
      `Got error: "${orderZeroData.error}"`
    );

    // 2. Create an inactive/archived product
    const inactiveProdRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        name: 'Archived Vault Tee',
        price: '₹1,799',
        stock: 25,
        isActive: false,
        sizes: ['L'],
      }),
    });
    const inactiveProdData = await inactiveProdRes.json();
    assert(inactiveProdRes.status === 201, 'Created inactive/archived test product');
    const inactiveProdId = inactiveProdData.product?.id;

    // Customer attempts to order archived product
    const orderArchivedRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Test Buyer',
          mobile: '9840112233',
          address: '44 Test Road, Adyar',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600020',
        },
        items: [
          {
            id: inactiveProdId,
            name: 'Archived Vault Tee',
            price: '₹1,799',
            size: 'L',
            quantity: 1,
          },
        ],
        paymentMethod: 'COD',
      }),
    });
    const orderArchivedData = await orderArchivedRes.json();
    assert(
      orderArchivedRes.status === 400,
      'Ordering archived product is rejected with 400 Bad Request',
      `Got status ${orderArchivedRes.status}`
    );
    assert(
      orderArchivedData.error && orderArchivedData.error.toLowerCase().includes('archived'),
      'Clear error message indicating item is archived',
      `Got error: "${orderArchivedData.error}"`
    );
  } catch (err) {
    assert(false, 'Stock enforcement test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Input Sanitization & HTML/XSS Escaping
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Input Sanitization & XSS Escaping ---');
  try {
    const xssPayload = '<script>alert("XSS")</script><b>Hacker</b>';
    const xssOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: xssPayload,
          mobile: '9840556677',
          email: 'safe.collector@example.com',
          address: '55 Stored XSS Avenue <img src=x onerror=alert(1)>',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600004',
        },
        items: [
          {
            id: 'machii-oversized-heavyweight-tee',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            size: 'XL',
            quantity: 1,
            color: 'Electric Cobalt',
          },
        ],
        paymentMethod: 'COD',
      }),
    });

    const xssData = await xssOrderRes.json();
    assert(xssOrderRes.status === 201, 'Order created with sanitized payload');
    const savedCustomer = xssData.order?.customer;

    assert(
      !savedCustomer.fullName.includes('<script>'),
      'HTML <script> tags stripped/escaped from customer name',
      `Saved name was: ${savedCustomer.fullName}`
    );
    assert(
      savedCustomer.fullName.includes('&lt;script&gt;') || !savedCustomer.fullName.includes('<'),
      'Customer name is safely entity-encoded or neutralized'
    );
    assert(
      !savedCustomer.address.includes('<img'),
      'HTML <img> tag stripped/escaped from address field'
    );
  } catch (err) {
    assert(false, 'Sanitization test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Image URL Scheme Safety Check
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Product Image URL Scheme Validation ---');
  try {
    const unsafeImageRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        name: 'XSS Image Tee',
        price: '₹1,499',
        image: 'javascript:alert("XSS")',
      }),
    });

    const unsafeImageData = await unsafeImageRes.json();
    assert(
      unsafeImageRes.status === 400,
      'Product creation with "javascript:" image URL is rejected (400)',
      `Got status ${unsafeImageRes.status}`
    );
    assert(
      unsafeImageData.error && unsafeImageData.error.toLowerCase().includes('unsafe image url'),
      'Error identifies unsafe image URL scheme'
    );

    // Valid asset URL accepted
    const validImageRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        name: 'Valid Image Tee',
        price: '₹1,499',
        image: '/assets/products/machii-attitude-01-charcoal.png',
      }),
    });
    assert(validImageRes.status === 201, 'Product creation with safe /assets image URL succeeds (201)');
  } catch (err) {
    assert(false, 'Image URL validation test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Payment Gateway Webhook Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Payment Gateway Webhook Security ---');
  try {
    // Unsigned / unauthenticated webhook attempt
    const spoofedWebhookRes = await fetch(`${BASE_URL}/api/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'payment.captured',
        payload: {
          orderRef: customerAOrderRef,
          payment: { entity: { id: 'fake_tx_123' } },
        },
      }),
    });

    assert(
      spoofedWebhookRes.status === 401,
      'Unsigned webhook spoofing is rejected with 401 Unauthorized',
      `Got status ${spoofedWebhookRes.status}`
    );

    // Customer A's order must NOT be marked PAID by an unauthorized webhook
    const checkOrderRes = await fetch(
      `${BASE_URL}/api/orders/${encodeURIComponent(customerAOrderRef)}?phone=${customerAPhone}`
    );
    const checkOrderData = await checkOrderRes.json();
    assert(
      checkOrderData.order?.paymentStatus !== 'PAID',
      'Order paymentStatus was NOT corrupted by spoofed webhook'
    );
  } catch (err) {
    assert(false, 'Webhook security test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Admin Session Handling & Token Revocation
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Admin Session Token Lifecycle & Revocation ---');
  try {
    // Login to obtain a session token
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ADMIN_KEY }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Admin login succeeds with 200');
    assert(Boolean(loginData.token), 'Session token issued');
    const sessionToken = loginData.token;

    // Verify session token works
    const verifyRes = await fetch(`${BASE_URL}/api/admin/auth/verify`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(verifyRes.status === 200, 'Issued session token is valid (200 OK)');

    // Logout and revoke token
    const logoutRes = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(logoutRes.status === 200, 'POST /api/admin/auth/logout revokes session token (200 OK)');

    // Attempt to use revoked session token
    const postLogoutVerify = await fetch(`${BASE_URL}/api/admin/auth/verify`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(
      postLogoutVerify.status === 401,
      'Revoked session token is rejected with 401 Unauthorized',
      `Got ${postLogoutVerify.status}`
    );
  } catch (err) {
    assert(false, 'Admin session lifecycle test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Rate Limiting on Brute-Force Sensitive Routes
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Rate Limiting on Sensitive Endpoints ---');
  try {
    // Attempt rapid failed logins
    let blocked429 = false;
    let retryAfterHeader = null;

    for (let i = 0; i < 7; i++) {
      const bruteRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `wrong_pass_${i}` }),
      });

      if (bruteRes.status === 429) {
        blocked429 = true;
        retryAfterHeader = bruteRes.headers.get('Retry-After');
        break;
      }
    }

    assert(blocked429 === true, 'Admin login enforces rate limit (returns 429 Too Many Requests)');
    assert(Boolean(retryAfterHeader), '429 response includes Retry-After header');

    // Reset rate limiters so other operations continue normally
    await fetch(`${BASE_URL}/api/notifications/reset-limiters`, {
      method: 'POST',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
  } catch (err) {
    assert(false, 'Rate limit test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log('ALL STEP 15 SECURITY AUDIT TESTS PASSED FLAWLESSLY! 🛡️');
  } else {
    console.error(`SOME TESTS FAILED: ${totalTests - passedTests} failure(s) detected.`);
  }
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSecuritySuite();
