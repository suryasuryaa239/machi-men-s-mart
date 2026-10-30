/* ==========================================================================
   MACHII MENS MART — STEP 12 WISHLIST & SAVE-FOR-LATER VERIFICATION SUITE
   Tests customer wishlist CRUD, server-side authorization, duplicate prevention,
   guest-to-authenticated merge, live stock enrichment, and customer isolation.
   ========================================================================== */

import assert from 'node:assert';
import http from 'node:http';

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ✓ PASS: ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`  ✗ FAIL: ${msg}`);
  if (err) console.error(err);
  failed++;
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: parsed, raw: data });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

console.log('============================================================');
console.log('MACHII MENS MART: STEP 12 WISHLIST & SAVE-FOR-LATER SUITE');
console.log('============================================================\n');

async function runTests() {
  const CUSTOMER_A = '9876543210';
  const CUSTOMER_B = '9123456789';
  const TEST_PRODUCT_1 = 'prod-essential-oversized';
  const TEST_PRODUCT_2 = 'garment-hoodie';

  try {
    // -------------------------------------------------------------
    // TEST GROUP 1: Server-Side Authorization & Isolation
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Server-Side Authorization & Isolation ---');

    // 1.1 Unauthenticated request returns 401
    const unauthRes = await request('/api/wishlist');
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
    assert.strictEqual(unauthRes.data.success, false);
    pass('Request without customer phone returns HTTP 401 Unauthorized');

    // 1.2 Invalid phone returns 401
    const invalidPhoneRes = await request('/api/wishlist?phone=123');
    assert.strictEqual(invalidPhoneRes.status, 401, 'Invalid phone must return 401');
    pass('Invalid customer phone returns HTTP 401 Unauthorized');

    // 1.3 Authorized customer gets empty initial wishlist
    // Clear first to ensure clean state
    await request('/api/wishlist?clear=true', {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });

    const custARes = await request('/api/wishlist', {
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });
    assert.strictEqual(custARes.status, 200);
    assert.strictEqual(custARes.data.success, true);
    assert.strictEqual(custARes.data.count, 0);
    pass('Authorized customer retrieves wishlist with HTTP 200');

    // -------------------------------------------------------------
    // TEST GROUP 2: Add to Wishlist & Live Catalog Enrichment
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Add to Wishlist & Live Catalog Enrichment ---');

    // 2.1 Add product without ID returns 400
    const emptyAddRes = await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: {},
    });
    assert.strictEqual(emptyAddRes.status, 400);
    pass('Adding without product ID rejected with HTTP 400');

    // 2.2 Add product 1 to Customer A wishlist
    const add1Res = await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: {
        productId: TEST_PRODUCT_1,
        selectedColor: 'Washed Charcoal',
        selectedSize: 'XL',
      },
    });
    assert.strictEqual(add1Res.status, 201);
    assert.strictEqual(add1Res.data.success, true);
    assert.strictEqual(add1Res.data.count, 1);
    const item1 = add1Res.data.items[0];
    assert.strictEqual(item1.productId, TEST_PRODUCT_1);
    assert.ok(item1.product, 'Item must be enriched with product metadata');
    assert.ok(item1.product.name.includes('Attitude 01') || item1.product.name.length > 0);
    assert.strictEqual(item1.product.isAvailable, true);
    assert.ok(item1.product.stock > 0);
    pass('Product 1 added successfully with HTTP 201 and live catalog metadata');

    // 2.3 Add product 2 to Customer A wishlist
    const add2Res = await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: {
        productId: TEST_PRODUCT_2,
        selectedColor: 'Mineral Slate',
        selectedSize: 'L',
      },
    });
    assert.strictEqual(add2Res.status, 201);
    assert.strictEqual(add2Res.data.count, 2);
    pass('Product 2 added successfully; total wishlist count is 2');

    // -------------------------------------------------------------
    // TEST GROUP 3: Duplicate Prevention (Requirement 5)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Duplicate Prevention (Requirement 5) ---');

    // 3.1 Attempt to add Product 1 again for Customer A
    const dupRes = await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: {
        productId: TEST_PRODUCT_1,
        selectedColor: 'Washed Charcoal',
        selectedSize: 'M',
      },
    });
    assert.strictEqual(dupRes.status, 200, 'Duplicate add returns HTTP 200');
    assert.strictEqual(dupRes.data.duplicate, true, 'Response flags duplicate = true');
    assert.strictEqual(dupRes.data.count, 2, 'Count must NOT increase on duplicate');
    pass('Duplicate wishlist addition prevented; count remains strictly 2');

    // -------------------------------------------------------------
    // TEST GROUP 4: Customer Isolation & Privacy (Requirement 8)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Customer Isolation & Privacy (Requirement 8) ---');

    // Clear Customer B first
    await request('/api/wishlist?clear=true', {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_B },
    });

    // 4.1 Customer B requests wishlist — must NOT see Customer A's items
    const custBRes = await request('/api/wishlist', {
      headers: { 'X-Customer-Phone': CUSTOMER_B },
    });
    assert.strictEqual(custBRes.status, 200);
    assert.strictEqual(custBRes.data.count, 0, "Customer B's wishlist must be strictly empty");
    pass("Customer B wishlist is completely isolated and cannot access Customer A's items");

    // -------------------------------------------------------------
    // TEST GROUP 5: Guest Wishlist Merge (Requirement 7)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Guest Wishlist Merge (Requirement 7) ---');

    // 5.1 Merge guest items into Customer B account
    const guestItems = [
      { productId: 'prod-street-culture', selectedColor: 'Tokyo Bone', selectedSize: 'L' },
      { productId: 'prod-retro-print', selectedColor: 'Olive Sage', selectedSize: 'XL' },
    ];

    const mergeRes = await request('/api/wishlist/merge', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_B },
      body: { guestItems },
    });
    assert.strictEqual(mergeRes.status, 200);
    assert.strictEqual(mergeRes.data.success, true);
    assert.strictEqual(mergeRes.data.count, 2);
    pass('Guest items merged into customer account on login (count = 2)');

    // 5.2 Merge existing items does not duplicate
    const mergeDupRes = await request('/api/wishlist/merge', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_B },
      body: { guestItems },
    });
    assert.strictEqual(mergeDupRes.status, 200);
    assert.strictEqual(mergeDupRes.data.count, 2, 'Merge must be idempotent without duplicates');
    pass('Idempotent guest merge creates zero duplicates');

    // -------------------------------------------------------------
    // TEST GROUP 6: Remove from Wishlist & Graceful Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Remove from Wishlist & Graceful Handling ---');

    // 6.1 Remove product 1 from Customer A
    const removeRes = await request(`/api/wishlist?productId=${TEST_PRODUCT_1}`, {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });
    assert.strictEqual(removeRes.status, 200);
    assert.strictEqual(removeRes.data.success, true);
    assert.strictEqual(removeRes.data.count, 1);
    assert.strictEqual(
      removeRes.data.items.some((it) => it.productId === TEST_PRODUCT_1),
      false,
      'Product 1 must be removed'
    );
    pass('Product 1 removed successfully; remaining count is 1');

    // 6.2 Clear entire wishlist for Customer A
    const clearRes = await request('/api/wishlist?clear=true', {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });
    assert.strictEqual(clearRes.status, 200);
    assert.strictEqual(clearRes.data.count, 0);
    pass('Clear wishlist successfully clears all items');

    // -------------------------------------------------------------
    // TEST GROUP 7: Unavailable & Deactivated Products Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Unavailable & Deactivated Products Handling ---');

    // Add a non-existent / deactivated product ID
    const addMissingRes = await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: { productId: 'prod-deleted-retro-1999' },
    });
    assert.strictEqual(addMissingRes.status, 201);
    const missingEnriched = addMissingRes.data.items[0];
    assert.strictEqual(missingEnriched.product.isDeleted, true);
    assert.strictEqual(missingEnriched.product.isAvailable, false);
    assert.strictEqual(missingEnriched.product.stock, 0);
    pass('Deleted or unavailable product handled gracefully without crashing');

    // -------------------------------------------------------------
    // TEST GROUP 8: Database Persistence & Re-Query
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Database Persistence & Re-Query ---');

    // Add valid product to Customer A
    await request('/api/wishlist', {
      method: 'POST',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
      body: { productId: TEST_PRODUCT_1, selectedColor: 'Washed Charcoal', selectedSize: 'XL' },
    });

    // Re-query database to ensure state was persisted
    const requeryRes = await request('/api/wishlist', {
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });
    assert.strictEqual(requeryRes.status, 200);
    assert.ok(requeryRes.data.count >= 1);
    const persisted = requeryRes.data.items.find((it) => it.productId === TEST_PRODUCT_1);
    assert.ok(persisted, 'Persisted product must exist in database');
    assert.strictEqual(persisted.selectedColor, 'Washed Charcoal');
    assert.strictEqual(persisted.selectedSize, 'XL');
    pass('Wishlist items persist authoritatively across backend queries');

    // -------------------------------------------------------------
    // TEST GROUP 9: Phone Normalization (+91 and leading 0)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 9: Phone Normalization (+91 and leading 0) ---');

    // Query with +91 prefix
    const prefixRes = await request('/api/wishlist', {
      headers: { 'X-Customer-Phone': `+91${CUSTOMER_A}` },
    });
    assert.strictEqual(prefixRes.status, 200);
    assert.strictEqual(prefixRes.data.count, requeryRes.data.count);
    pass('Phone with +91 prefix normalizes and accesses same customer record');

    // Query with leading 0 prefix
    const zeroRes = await request('/api/wishlist', {
      headers: { 'X-Customer-Phone': `0${CUSTOMER_A}` },
    });
    assert.strictEqual(zeroRes.status, 200);
    assert.strictEqual(zeroRes.data.count, requeryRes.data.count);
    pass('Phone with leading 0 normalizes and accesses same customer record');

    // -------------------------------------------------------------
    // TEST GROUP 10: Metadata Integrity (Images, Colors, Sizes, GSM)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 10: Metadata Integrity (Images, Colors, Sizes, GSM) ---');

    assert.ok(persisted.product.image.startsWith('/'), 'Product image URL must be valid path');
    assert.ok(persisted.product.price.includes('₹'), 'Product price must include currency symbol');
    assert.ok(Array.isArray(persisted.product.sizes), 'Sizes must be an array');
    assert.ok(persisted.product.sizes.length > 0, 'Sizes array must not be empty');
    assert.ok(Array.isArray(persisted.product.colors), 'Colors must be an array');
    pass('Enriched wishlist metadata includes valid images, prices, sizes, and colors');

    // Clean up Customer A and B
    await request('/api/wishlist?clear=true', {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_A },
    });
    await request('/api/wishlist?clear=true', {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': CUSTOMER_B },
    });

  } catch (err) {
    fail('Unexpected exception during wishlist tests', err);
  }

  console.log('\n============================================================');
  console.log(`STEP 12 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
