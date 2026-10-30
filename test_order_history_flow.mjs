/* ==========================================================================
   MACHII MENS MART — STEP 7 COMPREHENSIVE AUTOMATED VERIFICATION SUITE
   Tests:
   1. Order Confirmation payload verification (orderRef, date, items, total, address, payment, statuses)
   2. Customer Order History retrieval via /api/orders/history
   3. Individual Order Details retrieval via /api/orders/:orderRef
   4. Authorization enforcement on history endpoint (401 when unauthorized)
   5. Authorization enforcement on detail endpoint (401 when unauthorized)
   6. Privacy enforcement against snooping (403 when Customer B accesses Customer A's order)
   7. Customer order isolation (Customer B history does not contain Customer A's order)
   8. 404 handling for non-existent order references
   9. Empty history handling for new customer phone
   ========================================================================== */

import http from 'node:http';
import { EventEmitter } from 'node:events';
import viteConfig from './vite.config.js';

const BASE_HOST = '127.0.0.1';
const BASE_PORT = 3000;

// Extract the registered order API middleware from vite.config.js for self-contained testing
const registeredRoutes = {};
const fakeServer = {
  middlewares: {
    use(route, handler) {
      if (typeof route === 'string') {
        registeredRoutes[route] = handler;
      }
    },
  },
};
const configObj = typeof viteConfig === 'function' ? viteConfig({ command: 'serve' }) : viteConfig;
const plugin = configObj.plugins.find((p) => p && p.name === 'machii-order-backend-api');
if (plugin && plugin.configureServer) {
  plugin.configureServer(fakeServer);
}
const ordersMiddleware = registeredRoutes['/api/orders'];

function httpRequest({ path, method = 'GET', headers = {}, body = null }) {
  // If ordersMiddleware is available, simulate in-memory for instant sandbox verification
  if (ordersMiddleware && path.startsWith('/api/orders')) {
    return new Promise((resolve) => {
      let responseData = '';
      const responseHeaders = {};
      const subPath = path.replace(/^\/api\/orders/, '') || '/';

      const req = new EventEmitter();
      req.method = method;
      req.url = subPath;
      req.headers = { ...headers };

      const res = {
        statusCode: 200,
        setHeader(name, val) {
          responseHeaders[name.toLowerCase()] = val;
        },
        end(chunk) {
          if (chunk) responseData += chunk;
          let parsed = null;
          try {
            parsed = JSON.parse(responseData || '{}');
          } catch {
            // not JSON
          }
          resolve({
            status: this.statusCode,
            headers: responseHeaders,
            body: parsed,
            raw: responseData,
          });
        },
      };

      ordersMiddleware(req, res, () => {
        resolve({
          status: res.statusCode,
          headers: responseHeaders,
          body: null,
          raw: responseData,
        });
      });

      if (body) {
        req.emit('data', Buffer.from(body));
      }
      req.emit('end');
    });
  }

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path,
      method,
      headers: {
        ...headers,
      },
    };

    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: null, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName, extraInfo = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (extraInfo) console.error(`    Details: ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('MACHII MENS MART: STEP 7 ORDER CONFIRMATION & HISTORY TESTS');
  console.log('============================================================\n');

  const customerA = {
    fullName: 'Aditya Vardhan',
    mobile: '9876543210',
    email: 'aditya@example.com',
    address: '42 MG Road, Anna Nagar West',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600040',
  };

  const customerB = {
    fullName: 'Rohan Mehra',
    mobile: '9123456789',
    email: 'rohan@example.com',
    address: '15 Indiranagar 100ft Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
  };

  // TEST 1: Place an Order for Customer A
  console.log('--- TEST GROUP 1: Order Placement & Confirmation Payload ---');
  const orderPayload = JSON.stringify({
    items: [
      {
        id: 'garment-bone',
        name: 'TOKYO ENERGY TEE',
        price: '₹1,399',
        color: 'Vintage Bone',
        colorHex: '#F0EBE1',
        size: 'L',
        quantity: 2,
        image: '/assets/products/machii-tokyo-bone.png',
      },
    ],
    customer: customerA,
    paymentMethod: 'COD',
  });

  const createRes = await httpRequest({
    path: '/api/orders',
    method: 'POST',
    body: orderPayload,
  });

  assert(
    (createRes.status === 200 || createRes.status === 201) && createRes.body?.success === true,
    'Order placement via /api/orders returns HTTP 200/201 with success = true',
    `Status: ${createRes.status}, Body: ${JSON.stringify(createRes.body)}`
  );

  const orderA = createRes.body?.order;
  assert(
    Boolean(orderA && orderA.orderRef && orderA.orderRef.startsWith('MCH-')),
    'Order confirmation includes unique order reference starting with MCH-',
    `OrderRef: ${orderA?.orderRef}`
  );

  assert(
    Boolean(orderA && orderA.createdAt),
    'Order confirmation includes order date (createdAt ISO timestamp)',
    `CreatedAt: ${orderA?.createdAt}`
  );

  assert(
    Boolean(orderA && orderA.customer && orderA.customer.mobile === '9876543210'),
    'Order confirmation includes correct customer delivery details and phone',
    `Mobile: ${orderA?.customer?.mobile}`
  );

  assert(
    Boolean(
      orderA &&
        orderA.items?.length === 1 &&
        orderA.items[0].size === 'L' &&
        orderA.items[0].quantity === 2
    ),
    'Order confirmation includes purchased products with size, color, and quantity',
    `Items: ${JSON.stringify(orderA?.items)}`
  );

  assert(
    Boolean(orderA && orderA.total === 2798 && orderA.paymentMethod === 'COD'),
    'Order confirmation includes correct total amount (2x 1399 = 2798) and COD method',
    `Total: ${orderA?.total}, Method: ${orderA?.paymentMethod}`
  );

  assert(
    Boolean(
      orderA &&
        orderA.paymentStatus === 'PENDING' &&
        orderA.fulfillmentStatus === 'UNFULFILLED'
    ),
    'Order confirmation separates paymentStatus (PENDING for COD) from fulfillmentStatus (UNFULFILLED)',
    `PaymentStatus: ${orderA?.paymentStatus}, FulfillmentStatus: ${orderA?.fulfillmentStatus}`
  );

  // TEST 2: Retrieve Customer Order History
  console.log('\n--- TEST GROUP 2: Customer Order History Retrieval ---');
  const historyRes = await httpRequest({
    path: `/api/orders/history?phone=${customerA.mobile}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': customerA.mobile },
  });

  assert(
    historyRes.status === 200 && historyRes.body?.success === true,
    'Retrieve customer order history returns HTTP 200 with success = true',
    `Status: ${historyRes.status}, Body: ${JSON.stringify(historyRes.body)}`
  );

  assert(
    Array.isArray(historyRes.body?.orders) && historyRes.body.orders.length >= 1,
    'Order history returns a list of orders for Customer A',
    `Count: ${historyRes.body?.orders?.length}`
  );

  const foundOrder = historyRes.body?.orders?.find((o) => o.orderRef === orderA?.orderRef);
  assert(
    Boolean(
      foundOrder &&
        foundOrder.orderRef === orderA?.orderRef &&
        foundOrder.createdAt &&
        foundOrder.total === 2798 &&
        foundOrder.paymentStatus === 'PENDING' &&
        foundOrder.fulfillmentStatus === 'UNFULFILLED'
    ),
    'Order history item displays date, order number, total amount, payment status, and fulfillment status',
    `FoundOrder: ${JSON.stringify(foundOrder)}`
  );

  // TEST 3: Retrieve Individual Order Details
  console.log('\n--- TEST GROUP 3: Individual Order Details Retrieval ---');
  const detailRes = await httpRequest({
    path: `/api/orders/${orderA?.orderRef}?phone=${customerA.mobile}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': customerA.mobile },
  });

  assert(
    detailRes.status === 200 && detailRes.body?.success === true,
    'Retrieve single order detail returns HTTP 200 with success = true',
    `Status: ${detailRes.status}`
  );

  assert(
    detailRes.body?.order?.orderRef === orderA?.orderRef &&
      detailRes.body?.order?.customer?.address === customerA.address &&
      detailRes.body?.order?.items?.[0]?.name === 'TOKYO ENERGY TEE',
    'Order detail payload contains complete itemized breakdown and delivery address',
    `Detail Order: ${detailRes.body?.order?.orderRef}`
  );

  // TEST 4: Authorization Verification on History Endpoint
  console.log('\n--- TEST GROUP 4: Authorization Enforcement ---');
  const unauthorizedHistoryRes = await httpRequest({
    path: '/api/orders/history',
    method: 'GET',
  });

  assert(
    unauthorizedHistoryRes.status === 401 && unauthorizedHistoryRes.body?.success === false,
    'Unauthorized order-history request without phone returns HTTP 401 Unauthorized',
    `Status: ${unauthorizedHistoryRes.status}, Error: ${unauthorizedHistoryRes.body?.error}`
  );

  const unauthorizedDetailRes = await httpRequest({
    path: `/api/orders/${orderA?.orderRef}`,
    method: 'GET',
  });

  assert(
    unauthorizedDetailRes.status === 401 && unauthorizedDetailRes.body?.success === false,
    'Unauthorized order-detail request without phone returns HTTP 401 Unauthorized',
    `Status: ${unauthorizedDetailRes.status}, Error: ${unauthorizedDetailRes.body?.error}`
  );

  // TEST 5: Customer Privacy & Anti-Snooping (Never expose another customer's orders)
  console.log('\n--- TEST GROUP 5: Privacy & Customer Isolation ---');
  const forbiddenDetailRes = await httpRequest({
    path: `/api/orders/${orderA?.orderRef}?phone=${customerB.mobile}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': customerB.mobile },
  });

  assert(
    forbiddenDetailRes.status === 403 && forbiddenDetailRes.body?.success === false,
    'Customer B attempting to view Customer A\'s order is rejected with HTTP 403 Forbidden',
    `Status: ${forbiddenDetailRes.status}, Error: ${forbiddenDetailRes.body?.error}`
  );

  const customerBHistoryRes = await httpRequest({
    path: `/api/orders/history?phone=${customerB.mobile}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': customerB.mobile },
  });

  const containsCustomerAOrder = customerBHistoryRes.body?.orders?.some(
    (o) => o.orderRef === orderA?.orderRef
  );
  assert(
    customerBHistoryRes.status === 200 && containsCustomerAOrder === false,
    'Customer B order history NEVER exposes Customer A\'s orders',
    `Customer B Orders Count: ${customerBHistoryRes.body?.orders?.length}`
  );

  // TEST 6: Error Handling (Non-existent order & Empty History)
  console.log('\n--- TEST GROUP 6: Robust Error Handling & Empty States ---');
  const notFoundRes = await httpRequest({
    path: `/api/orders/MCH-NONEXISTENT-REF?phone=${customerA.mobile}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': customerA.mobile },
  });

  assert(
    notFoundRes.status === 404 && notFoundRes.body?.success === false,
    'Querying non-existent order reference returns HTTP 404 with helpful error message',
    `Status: ${notFoundRes.status}, Error: ${notFoundRes.body?.error}`
  );

  const emptyHistoryPhone = '9999988888';
  const emptyHistoryRes = await httpRequest({
    path: `/api/orders/history?phone=${emptyHistoryPhone}`,
    method: 'GET',
    headers: { 'X-Customer-Phone': emptyHistoryPhone },
  });

  assert(
    emptyHistoryRes.status === 200 &&
      emptyHistoryRes.body?.success === true &&
      Array.isArray(emptyHistoryRes.body?.orders) &&
      emptyHistoryRes.body.orders.length === 0,
    'Querying phone with no prior orders returns HTTP 200 with empty orders list',
    `Orders length: ${emptyHistoryRes.body?.orders?.length}`
  );

  console.log('\n============================================================');
  console.log(`STEP 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exitCode = 1;
});
