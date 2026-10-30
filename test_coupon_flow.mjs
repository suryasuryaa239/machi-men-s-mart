/* ==========================================================================
   MACHII MENS MART — STEP 13: COUPON & DISCOUNT COMPREHENSIVE VERIFICATION SUITE
   Tests real-time coupon validation, percentage & flat discounts, business rules,
   min order enforcement, expiry, usage limits, duplicate prevention, secure
   authoritative server total calculation, and admin coupon CRUD.
   ========================================================================== */

const BASE_URL = 'http://localhost:3000';
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

async function runCouponTests() {
  console.log('\n=============================================================');
  console.log('MACHII MENS MART — STEP 13: COUPONS & DISCOUNTS TEST SUITE');
  console.log('=============================================================\n');

  // Test 1: Valid Percentage Coupon (MACHII10 - 10% off min ₹1400)
  console.log('--- 1. Percentage Coupon Validation ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MACHII10', subtotal: 1499 }),
    });
    const data = await res.json();
    assert(res.status === 200, 'POST /api/coupons/validate returns 200 for valid percentage coupon');
    assert(data.valid === true, 'Response valid flag is true');
    assert(data.coupon.code === 'MACHII10', 'Coupon code matches MACHII10');
    assert(data.coupon.discountType === 'PERCENTAGE', 'Discount type is PERCENTAGE');
    assert(data.discountAmount === 150, 'Discount amount correctly calculated as 10% (₹150 on ₹1,499)', `Got ${data.discountAmount}`);
    assert(data.netTotal === 1349, 'Net payable total correctly calculated as ₹1,349', `Got ${data.netTotal}`);
  } catch (err) {
    assert(false, 'Percentage coupon test threw error', err.message);
  }

  // Test 2: Valid Flat Discount Coupon (DROP01 - Flat ₹300 off min ₹2000)
  console.log('\n--- 2. Flat Amount Discount Validation ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DROP01', subtotal: 2499 }),
    });
    const data = await res.json();
    assert(res.status === 200, 'POST /api/coupons/validate returns 200 for valid flat coupon');
    assert(data.valid === true, 'Response valid flag is true');
    assert(data.coupon.discountType === 'FLAT', 'Discount type is FLAT');
    assert(data.discountAmount === 300, 'Discount amount is ₹300 flat', `Got ${data.discountAmount}`);
    assert(data.netTotal === 2199, 'Net payable total is ₹2,199', `Got ${data.netTotal}`);
  } catch (err) {
    assert(false, 'Flat discount coupon test threw error', err.message);
  }

  // Test 3: Minimum Order Amount Rule Enforcement
  console.log('\n--- 3. Minimum Order Amount Rule Enforcement ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME500', subtotal: 1499 }), // Min order ₹2500
    });
    const data = await res.json();
    assert(res.status === 400, 'POST /api/coupons/validate returns 400 when subtotal < minOrderAmount');
    assert(data.valid === false, 'Coupon marked as invalid');
    assert(data.error.includes('Minimum order value of ₹2,500 required'), 'Clear error explaining minimum order requirement', data.error);
    assert(data.minOrderAmount === 2500, 'Reports minimum order amount threshold');
  } catch (err) {
    assert(false, 'Min order amount test threw error', err.message);
  }

  // Test 4: Expired Coupon Rule Enforcement
  console.log('\n--- 4. Coupon Expiry Rule Enforcement ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'EXPIRED20', subtotal: 2000 }),
    });
    const data = await res.json();
    assert(res.status === 400, 'POST /api/coupons/validate returns 400 for expired coupon');
    assert(data.valid === false, 'Expired coupon marked invalid');
    assert(data.error.includes('expired'), 'Clear error stating coupon has expired', data.error);
  } catch (err) {
    assert(false, 'Expired coupon test threw error', err.message);
  }

  // Test 5: Maximum Redemption Limits Enforcement
  console.log('\n--- 5. Maximum Redemptions Limit Enforcement ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MAXEDOUT', subtotal: 2000 }),
    });
    const data = await res.json();
    assert(res.status === 400, 'POST /api/coupons/validate returns 400 when redemption limit is reached');
    assert(data.valid === false, 'Maxed out coupon marked invalid');
    assert(data.error.includes('maximum redemption limit'), 'Error mentions maximum redemption limit reached', data.error);
  } catch (err) {
    assert(false, 'Max redemptions test threw error', err.message);
  }

  // Test 6: Non-Existent / Invalid Coupon Code
  console.log('\n--- 6. Invalid / Non-Existent Coupon Code ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BOGUS_CODE_999', subtotal: 2000 }),
    });
    const data = await res.json();
    assert(res.status === 400, 'POST /api/coupons/validate returns 400 for unknown code');
    assert(data.valid === false, 'Unknown code marked invalid');
    assert(data.error.includes('invalid or does not exist'), 'Clear message that code is invalid', data.error);
  } catch (err) {
    assert(false, 'Invalid coupon test threw error', err.message);
  }

  // Test 7: Case-Insensitivity
  console.log('\n--- 7. Case-Insensitive Code Handling ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'machii10', subtotal: 1600 }),
    });
    const data = await res.json();
    assert(res.status === 200, 'Lowercase code "machii10" accepted');
    assert(data.coupon.code === 'MACHII10', 'Normalized to uppercase code MACHII10');
    assert(data.discountAmount === 160, 'Correct 10% discount applied (₹160)');
  } catch (err) {
    assert(false, 'Case insensitivity test threw error', err.message);
  }

  // Test 8: Public Active Promo List
  console.log('\n--- 8. Public Active Promo List ---');
  try {
    const res = await fetch(`${BASE_URL}/api/coupons`);
    const data = await res.json();
    assert(res.status === 200, 'GET /api/coupons returns 200');
    assert(Array.isArray(data.coupons), 'Returns coupons array');
    assert(data.coupons.some((c) => c.code === 'MACHII10'), 'Active coupon MACHII10 present');
    assert(!data.coupons.some((c) => c.code === 'EXPIRED20'), 'Expired coupon EXPIRED20 excluded from public list');
    assert(!data.coupons.some((c) => c.code === 'MAXEDOUT'), 'Maxed coupon MAXEDOUT excluded from public list');
  } catch (err) {
    assert(false, 'Public promo list test threw error', err.message);
  }

  // Test 9: Authoritative Server-Side Order Recalculation with Valid Coupon
  console.log('\n--- 9. Authoritative Server Total Recalculation on Order Creation ---');
  let _placedOrderRef = null;
  const testPhone = '9876543210';
  try {
    const orderPayload = {
      items: [
        {
          id: 'prod-essential-oversized',
          name: 'Attitude 01 Oversized Tee',
          price: '₹1,499',
          quantity: 1,
          size: 'M',
          color: 'Washed Charcoal',
        },
      ],
      customer: {
        fullName: 'Vikram Seth',
        mobile: testPhone,
        address: '42 Khader Nawaz Khan Road, Nungambakkam',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600006',
      },
      paymentMethod: 'COD',
      couponCode: 'MACHII10',
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();
    assert(res.status === 201, 'POST /api/orders returns 201 Created with coupon applied');
    assert(data.success === true, 'Order created successfully');
    assert(data.order.couponCode === 'MACHII10', 'Coupon code MACHII10 recorded on order');
    assert(data.order.discountAmount === 150, 'Authoritative discount amount ₹150 recorded', `Got ${data.order.discountAmount}`);
    assert(data.order.subtotal === 1499, 'Original subtotal ₹1,499 preserved');
    assert(data.order.total === 1349, 'Authoritative discounted final total is ₹1,349 (never trusting client calculation)', `Got ${data.order.total}`);
    assert(data.order.pricing.discount === 150, 'Pricing breakdown includes discount');
    _placedOrderRef = data.order.orderRef;
  } catch (err) {
    assert(false, 'Authoritative order creation test threw error', err.message);
  }

  // Test 10: Ineligible Coupon Rejection on Order Creation
  console.log('\n--- 10. Ineligible Coupon Rejection on Order Creation ---');
  try {
    const invalidOrderPayload = {
      items: [
        {
          id: 'prod-essential-oversized',
          name: 'Attitude 01 Oversized Tee',
          price: '₹1,499',
          quantity: 1,
          size: 'M',
        },
      ],
      customer: {
        fullName: 'Karthik Raja',
        mobile: '9876543211',
        address: '10 Anna Salai, Mount Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
      },
      paymentMethod: 'COD',
      couponCode: 'WELCOME500', // Requires min ₹2500, but order is only ₹1499
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidOrderPayload),
    });

    const data = await res.json();
    assert(res.status === 400, 'POST /api/orders returns 400 when order total is below coupon minOrderAmount');
    assert(data.success === false, 'Order rejected');
    assert(data.error.includes('Minimum order value of ₹2,500 required'), 'Clear error rejecting order for ineligible coupon');
  } catch (err) {
    assert(false, 'Ineligible coupon order creation test threw error', err.message);
  }

  // Test 11: Admin Coupon Management (CRUD)
  console.log('\n--- 11. Admin Coupon Management (Authorization & CRUD) ---');
  let createdCouponId = null;
  try {
    // 11.1 Unauthorized request without key
    const unauthRes = await fetch(`${BASE_URL}/api/admin/coupons`);
    assert(unauthRes.status === 401, 'GET /api/admin/coupons returns 401 Unauthorized without admin key');

    // 11.2 Authorized list request
    const listRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /api/admin/coupons returns 200 with X-Admin-Key');
    assert(listData.coupons.length >= 6, 'Admin sees full coupons list including internal stats');

    // Check usage tracking on MACHII10 from Test 9
    const machiiCoup = listData.coupons.find((c) => c.code === 'MACHII10');
    assert(machiiCoup && machiiCoup.usedCount >= 1, `Usage count incremented authoritatively (usedCount: ${machiiCoup?.usedCount})`);

    // 11.3 Admin creates new custom coupon
    const createRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({
        code: 'STREET25',
        description: '25% OFF Festival drop',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        minOrderAmount: 1800,
        maxDiscountAmount: 750,
        maxUses: 50,
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, 'POST /api/admin/coupons creates new coupon with 201');
    assert(createData.coupon.code === 'STREET25', 'Created coupon code is STREET25');
    createdCouponId = createData.coupon.id;

    // 11.4 Validate newly created coupon via public API
    const valNewRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'STREET25', subtotal: 2000 }),
    });
    const valNewData = await valNewRes.json();
    assert(valNewRes.status === 200, 'Newly created coupon is immediately active and valid on backend');
    assert(valNewData.discountAmount === 500, '25% discount on ₹2,000 gives ₹500 discount');

    // 11.5 Admin updates/deactivates coupon
    const patchRes = await fetch(`${BASE_URL}/api/admin/coupons/${createdCouponId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200, 'PATCH /api/admin/coupons/:id deactivates coupon');
    assert(patchData.coupon.isActive === false, 'Coupon isActive set to false');

    // 11.6 Validating deactivated coupon returns disabled error
    const valDeactivatedRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'STREET25', subtotal: 2000 }),
    });
    const valDeactivatedData = await valDeactivatedRes.json();
    assert(valDeactivatedRes.status === 400, 'Validating deactivated coupon returns 400');
    assert(valDeactivatedData.error.includes('disabled'), 'Error confirms coupon is currently disabled', valDeactivatedData.error);

    // 11.7 Admin deletes test coupon
    const delRes = await fetch(`${BASE_URL}/api/admin/coupons/${createdCouponId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    assert(delRes.status === 200, 'DELETE /api/admin/coupons/:id successfully deletes coupon');
  } catch (err) {
    assert(false, 'Admin coupon CRUD test threw error', err.message);
  }

  // Test 12: Admin Summary KPIs includes Coupon metrics
  console.log('\n--- 12. Admin Summary KPIs Metrics ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/summary`, {
      headers: { 'X-Admin-Key': ADMIN_KEY },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/summary returns 200');
    assert(typeof data.summary.totalCoupons === 'number', 'Summary includes totalCoupons metric');
    assert(typeof data.summary.activeCoupons === 'number', 'Summary includes activeCoupons metric');
    assert(typeof data.summary.totalDiscountGiven === 'number', 'Summary includes totalDiscountGiven metric');
  } catch (err) {
    assert(false, 'Admin summary metrics test threw error', err.message);
  }

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log('ALL STEP 13 COUPON & DISCOUNT TESTS PASSED CONVINCINGLY! 🎉');
  } else {
    console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
  }
  console.log('=============================================================\n');
}

runCouponTests();

