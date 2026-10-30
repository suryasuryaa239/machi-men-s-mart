// test_notification_flow.mjs
// ============================================================================
// MACHII MENS MART — STEP 14: CUSTOMER ORDER NOTIFICATIONS TEST SUITE
// Tests multi-channel triggers, payment alerts, status transitions,
// deduplication / idempotency, provider failure isolation, and zero PII leaks.
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

async function runNotificationSuite() {
  console.log('\n=============================================================');
  console.log('MACHII MENS MART — STEP 14: ORDER NOTIFICATIONS TEST SUITE');
  console.log('=============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Public Notification Config & Provider Health (No Credential Leaks)
  // --------------------------------------------------------------------------
  console.log('--- 1. Provider Configuration & Health Inspection ---');
  try {
    const res = await fetch(`${BASE_URL}/api/notifications/config`);
    const data = await res.json();

    assert(res.status === 200, 'GET /api/notifications/config returns 200 OK');
    assert(data.success === true, 'Response success is true');
    assert(data.config !== undefined, 'Config object is present');
    assert(typeof data.config.email === 'object', 'Email configuration object returned');
    assert(typeof data.config.sms === 'object', 'SMS configuration object returned');
    assert(
      !data.config.email.apiKey && !data.config.sms.authToken,
      'No sensitive API keys, secrets, or auth tokens exposed in config response'
    );
    assert(
      Array.isArray(data.config.email.requiredEnv) && Array.isArray(data.config.sms.requiredEnv),
      'Documents required environment variables for unconfigured providers'
    );
  } catch (err) {
    assert(false, 'Config test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Reset Idempotency Cache Before Tests
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Cache Reset & Admin Authorization ---');
  try {
    const unauthorizedRes = await fetch(`${BASE_URL}/api/notifications/reset-cache`, {
      method: 'POST',
    });
    assert(unauthorizedRes.status === 401, 'POST /api/notifications/reset-cache requires admin key (401)');

    const authorizedRes = await fetch(`${BASE_URL}/api/notifications/reset-cache`, {
      method: 'POST',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const authData = await authorizedRes.json();
    assert(authorizedRes.status === 200, 'Authorized cache reset returns 200 OK');
    assert(authData.success === true, 'Cache successfully cleared');
  } catch (err) {
    assert(false, 'Cache reset test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Order Confirmation Trigger on Order Creation (Unconfigured Fallback)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Order Creation Notification Trigger (Unconfigured Mode) ---');
  let testOrderRef = null;
  const testMobile = '9876543210';
  const testEmail = 'streetwear.collector@example.com';

  try {
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Karthik Raja',
          mobile: testMobile,
          email: testEmail,
          address: '42 Besant Nagar 2nd Avenue, Near Beach Promenade',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600090',
        },
        items: [
          {
            id: 'machii-oversized-heavyweight-tee',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            size: 'L',
            quantity: 1,
            color: 'Electric Cobalt',
          },
        ],
        paymentMethod: 'COD',
      }),
    });

    const orderData = await orderRes.json();
    assert(orderRes.status === 201, 'POST /api/orders creates order successfully (201)');
    assert(orderData.success === true, 'Order created flag is true');
    assert(Boolean(orderData.order?.orderRef), 'Order has authoritative orderRef');
    testOrderRef = orderData.order.orderRef;

    // Check notifications array on the returned order
    const notifications = orderData.order.notifications || [];
    assert(Array.isArray(notifications), 'Order has notifications audit array');
    assert(notifications.length >= 2, 'Generated both Email and SMS notification audit records', `Got ${notifications.length}`);

    const emailNotif = notifications.find((n) => n.channel === 'EMAIL');
    const smsNotif = notifications.find((n) => n.channel === 'SMS');

    assert(Boolean(emailNotif), 'Email notification record generated');
    assert(Boolean(smsNotif), 'SMS notification record generated');
    assert(
      emailNotif.status === 'NOT_CONFIGURED',
      'Accurately records NOT_CONFIGURED when live provider credentials are absent (does NOT fake SENT)'
    );
    assert(
      emailNotif.delivered === false,
      'Email marked delivered: false when provider is not active'
    );
    assert(
      emailNotif.recipientMasked.includes('***'),
      'Customer email address is safely masked in notification audit record'
    );
    assert(
      smsNotif.recipientMasked.includes('******'),
      'Customer phone number is safely masked in notification audit record'
    );
  } catch (err) {
    assert(false, 'Order creation notification test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Mock Provider Execution for Live Flow Simulation
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Active Provider Dispatch Simulation (Mock Provider) ---');
  try {
    // Enable mock provider via admin hook
    const mockRes = await fetch(`${BASE_URL}/api/notifications/test-mock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({ enableMock: true }),
    });
    const mockData = await mockRes.json();
    assert(mockRes.status === 200, 'POST /api/notifications/test-mock enables mock provider');
    assert(mockData.mockActive === true, 'Mock provider is active for testing');

    // Create a new order with mock provider active
    const order2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Vikram Seth',
          mobile: '9840123456',
          email: 'vikram.seth@example.com',
          address: '15 Sterling Road, Nungambakkam',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600034',
        },
        items: [
          {
            id: 'machii-oversized-heavyweight-tee',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            size: 'M',
            quantity: 1,
            color: 'Obsidian Black',
          },
        ],
        paymentMethod: 'COD',
      }),
    });

    const order2Data = await order2Res.json();
    assert(order2Res.status === 201, 'Order 2 placed with active provider');
    const order2 = order2Data.order;
    const notifs = order2.notifications || [];
    assert(notifs.length > 0, 'Notification records exist');
    const deliveredNotif = notifs.find((n) => n.status === 'SENT' && n.delivered === true);
    assert(Boolean(deliveredNotif), 'Notification marked status: SENT and delivered: true when provider is active');
    assert(
      deliveredNotif.subject.includes(order2.orderRef),
      'Notification subject includes accurate orderRef'
    );
  } catch (err) {
    assert(false, 'Mock provider test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Status Transitions Notifications (Confirmed, Shipped, Out for Delivery, Delivered)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Order Status Lifecycle Notifications ---');
  try {
    const statusesToTest = [
      { status: 'Confirmed', desc: 'Order confirmed and station assigned' },
      {
        status: 'Packed',
        desc: 'Garments boxed in signature Machii packaging',
      },
      {
        status: 'Shipped',
        carrier: 'BlueDart Express',
        trackingNumber: 'BLUEDART-8829104',
        trackingUrl: 'https://bluedart.com/track/8829104',
        desc: 'Package dispatched from Chennai fulfillment center',
      },
      {
        status: 'Out for Delivery',
        desc: 'Courier out for delivery today',
      },
      {
        status: 'Delivered',
        desc: 'Delivered to recipient doorstep',
      },
    ];

    for (const step of statusesToTest) {
      const patchRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(testOrderRef)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify(step),
      });

      const patchData = await patchRes.json();
      assert(patchRes.status === 200, `Admin status update to "${step.status}" returns 200`);
      assert(patchData.order.status === step.status, `Order status updated to "${step.status}"`);

      // Verify notification recorded for this status
      const updatedNotifs = patchData.order.notifications || [];
      const statusNotif = updatedNotifs.find(
        (n) =>
          n.metadata?.status === step.status ||
          n.summary?.includes(step.status) ||
          n.idempotencyKey?.includes(step.status)
      );

      assert(Boolean(statusNotif), `Notification triggered for status: ${step.status}`);
      if (step.status === 'Shipped') {
        assert(
          patchData.order.tracking?.carrier === 'BlueDart Express',
          'Carrier recorded in tracking details'
        );
        assert(
          patchData.order.tracking?.trackingNumber === 'BLUEDART-8829104',
          'AWB number recorded in tracking details'
        );
      }
    }
  } catch (err) {
    assert(false, 'Status transition test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Idempotency & Deduplication on Retried Events
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Deduplication & Idempotency on Retries ---');
  try {
    // Fetch count of notifications before retry
    const detailBefore = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(testOrderRef)}/notifications`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const beforeData = await detailBefore.json();
    const countBefore = beforeData.count;

    // Retry sending the EXACT same status update: "Delivered"
    const retryRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(testOrderRef)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        status: 'Delivered',
        description: 'Delivered to recipient doorstep',
      }),
    });

    assert(retryRes.status === 200, 'Duplicate status update request accepted cleanly');

    // Fetch count of notifications after retry
    const detailAfter = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(testOrderRef)}/notifications`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const afterData = await detailAfter.json();
    const countAfter = afterData.count;

    assert(
      countAfter === countBefore,
      `Duplicate notification prevented! (Count stayed ${countBefore}, did not increment to ${countBefore + 1})`
    );
  } catch (err) {
    assert(false, 'Deduplication test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Payment Confirmation Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Payment Confirmation Notification Trigger ---');
  try {
    const payRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(testOrderRef)}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        paymentStatus: 'PAID',
        transactionId: 'TXN_BLUE_773910',
      }),
    });

    const payData = await payRes.json();
    assert(payRes.status === 200, 'PATCH /api/admin/orders/:orderRef/payment returns 200');
    assert(payData.order.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID');

    const paymentNotif = payData.order.notifications?.find(
      (n) => n.eventType === 'PAYMENT_CONFIRMATION' || n.category === 'PAYMENT'
    );
    assert(Boolean(paymentNotif), 'Payment confirmation notification triggered on verified payment');
  } catch (err) {
    assert(false, 'Payment confirmation test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Payment Failure Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Payment Failure Notification Trigger ---');
  try {
    const failRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(testOrderRef)}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        paymentStatus: 'FAILED',
        error: 'Bank gateway timeout during 3D secure authentication',
      }),
    });

    const failData = await failRes.json();
    assert(failRes.status === 200, 'PATCH payment failure returns 200');
    assert(failData.order.paymentStatus === 'FAILED', 'Order paymentStatus updated to FAILED');

    const failNotif = failData.order.notifications?.find(
      (n) => n.eventType === 'PAYMENT_FAILURE' || n.title?.includes('Failed')
    );
    assert(Boolean(failNotif), 'Payment failure notification triggered on failed payment');
  } catch (err) {
    assert(false, 'Payment failure test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Resilient Provider Failure Isolation (Order Status Never Corrupted)
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Safe Provider Failure Isolation ---');
  try {
    // Configure mock provider to throw an unexpected network exception
    await fetch(`${BASE_URL}/api/notifications/test-mock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        enableMock: true,
        shouldFail: true,
        failReason: 'Upstream SMS provider connection timeout (504 Gateway Timeout)',
      }),
    });

    // Create an order while provider is failing
    const corruptTestRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          fullName: 'Ananya Sharma',
          mobile: '9789012345',
          email: 'ananya@example.com',
          address: '88 Poes Garden, Cathedral Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600086',
        },
        items: [
          {
            id: 'machii-oversized-heavyweight-tee',
            name: 'Attitude 01 Oversized Tee',
            price: '₹1,499',
            size: 'S',
            quantity: 1,
            color: 'Electric Cobalt',
          },
        ],
        paymentMethod: 'COD',
      }),
    });

    assert(
      corruptTestRes.status === 201,
      'Order creation SUCCEEDS (201) even when notification provider throws a fatal error'
    );
    const corruptData = await corruptTestRes.json();
    assert(corruptData.success === true, 'Order created flag remains true');
    assert(corruptData.order.status === 'Order Placed', 'Order status remains uncorrupted');
    assert(corruptData.order.paymentStatus === 'PENDING', 'Payment status remains uncorrupted');

    // Restore clean mock provider state
    await fetch(`${BASE_URL}/api/notifications/test-mock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({ enableMock: false }),
    });
  } catch (err) {
    assert(false, 'Provider failure isolation test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Customer Order Tracking & History Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Customer Order Tracking Integration ---');
  try {
    const trackRes = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(testOrderRef)}/tracking?phone=${testMobile}`);
    const trackData = await trackRes.json();

    assert(trackRes.status === 200, 'GET /api/orders/:orderRef/tracking returns 200');
    assert(trackData.success === true, 'Tracking response success is true');
    assert(Array.isArray(trackData.notifications), 'Tracking includes notifications array');
    assert(
      trackData.customer.fullName === 'Karthik Raja',
      'Masked / verified customer returned in tracking'
    );
  } catch (err) {
    assert(false, 'Tracking integration test threw error', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log('ALL STEP 14 CUSTOMER NOTIFICATION TESTS PASSED FLAWLESSLY! 🎉');
  } else {
    console.error(`SOME TESTS FAILED: ${totalTests - passedTests} failure(s) detected.`);
  }
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runNotificationSuite();

