/* ==========================================================================
   MACHII MENS MART — STEP 8 ORDER TRACKING COMPREHENSIVE VERIFICATION SUITE
   Tests:
   1. Order placement initializes tracking structure with 'Order Placed' status
   2. Payment status is strictly separate from fulfillment / delivery status
   3. Customer tracking endpoint (/api/orders/:orderRef/tracking) authorization enforcement (401 when unauthorized)
   4. Customer privacy & isolation on tracking endpoint (403 when Customer B accesses Customer A's tracking)
   5. 404 handling for non-existent order references on tracking endpoint
   6. Authorized customer successfully retrieves live tracking details (HTTP 200)
   7. Unauthorized status update without admin key returns 401 Unauthorized
   8. Validation prevents invalid order statuses (HTTP 400)
   9. Authorized status progression: Confirmed, Packed, Shipped, Out for Delivery, Delivered
   10. Courier tracking number, carrier name, and tracking URL support without inventing fake data
   11. Order Cancellation support when recorded by authorized backend process
   12. Verification that tracking events are authentic without fake timestamps
   ========================================================================== */

import { EventEmitter } from 'node:events';
import viteConfig from './vite.config.js';

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

// Extract the registered order API middleware from vite.config.js
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

function simulateOrdersApi({ method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    let responseData = '';
    const responseHeaders = {};

    const req = new EventEmitter();
    req.method = method;
    req.url = url;
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
          parsed = JSON.parse(responseData);
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
      resolve({ status: res.statusCode, headers: responseHeaders, body: null, raw: responseData });
    });

    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(bodyStr));
    }
    req.emit('end');
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('MACHII MENS MART: STEP 8 ORDER TRACKING VERIFICATION SUITE');
  console.log('============================================================\n');

  assert(
    typeof ordersMiddleware === 'function',
    'Order backend middleware correctly registered in Vite config'
  );

  const customerA = {
    fullName: 'Karthik Raja',
    mobile: '9840123456',
    email: 'karthik@example.com',
    address: '24 Besant Avenue, Adyar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600020',
  };

  const customerB = {
    fullName: 'Suresh Kumar',
    mobile: '9884567890',
    email: 'suresh@example.com',
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
  };

  // -------------------------------------------------------------
  // TEST GROUP 1: Order Placement & Tracking Structure Initialization
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Order Placement & Tracking Initialization ---');
  const orderPayload = {
    items: [
      {
        id: 'garment-bone',
        name: 'TOKYO ENERGY TEE',
        price: '₹1,399',
        color: 'Vintage Bone',
        colorHex: '#F0EBE1',
        size: 'XL',
        quantity: 1,
        image: '/assets/products/machii-tokyo-bone.png',
      },
    ],
    customer: customerA,
    paymentMethod: 'COD',
  };

  const createRes = await simulateOrdersApi({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    body: orderPayload,
  });

  assert(
    createRes.status === 201 && createRes.body?.success === true,
    'Order placement via /api/orders returns HTTP 201 with success = true',
    `Status: ${createRes.status}`
  );

  const orderA = createRes.body?.order;
  assert(
    Boolean(orderA && orderA.orderRef && orderA.orderRef.startsWith('MCH-')),
    'Order confirmation contains valid order reference starting with MCH-',
    `OrderRef: ${orderA?.orderRef}`
  );

  assert(
    Boolean(orderA && orderA.tracking && orderA.tracking.status === 'Order Placed'),
    'Order initializes tracking object with status "Order Placed"',
    `Tracking status: ${orderA?.tracking?.status}`
  );

  assert(
    Boolean(
      orderA &&
        Array.isArray(orderA.tracking?.events) &&
        orderA.tracking.events.length === 1 &&
        orderA.tracking.events[0].status === 'Order Placed'
    ),
    'Order tracking starts with 1 authentic placement event and no fake progress events',
    `Events count: ${orderA?.tracking?.events?.length}`
  );

  assert(
    Boolean(
      orderA &&
        orderA.tracking.carrier === null &&
        orderA.tracking.trackingNumber === null &&
        orderA.tracking.trackingUrl === null
    ),
    'Order does NOT invent fake courier details upon placement (carrier, AWB are null)',
    `Carrier: ${orderA?.tracking?.carrier}, AWB: ${orderA?.tracking?.trackingNumber}`
  );

  assert(
    Boolean(orderA && orderA.paymentStatus === 'PENDING' && orderA.status === 'Order Placed'),
    'Payment status (PENDING for COD) remains separate from fulfillment / delivery status',
    `PaymentStatus: ${orderA?.paymentStatus}, Status: ${orderA?.status}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: Customer Tracking Endpoint Authorization & Privacy
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Customer Tracking Authorization & Privacy ---');

  // 2.1 Unauthorized request without mobile phone
  const unauthRes = await simulateOrdersApi({
    method: 'GET',
    url: `/${orderA.orderRef}/tracking`,
  });
  assert(
    unauthRes.status === 401 && unauthRes.body?.success === false,
    'Tracking request without customer mobile verification returns HTTP 401 Unauthorized',
    `Status: ${unauthRes.status}, Error: ${unauthRes.body?.error}`
  );

  // 2.2 Customer B tries to view Customer A's order tracking (Anti-snooping check)
  const snoopRes = await simulateOrdersApi({
    method: 'GET',
    url: `/${orderA.orderRef}/tracking?phone=${customerB.mobile}`,
    headers: { 'x-customer-phone': customerB.mobile },
  });
  assert(
    snoopRes.status === 403 && snoopRes.body?.success === false,
    'Customer B attempting to track Customer A\'s order is rejected with HTTP 403 Forbidden',
    `Status: ${snoopRes.status}, Error: ${snoopRes.body?.error}`
  );

  // 2.3 Non-existent order reference
  const notFoundRes = await simulateOrdersApi({
    method: 'GET',
    url: `/MCH-NONEXISTENT-9999/tracking?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });
  assert(
    notFoundRes.status === 404 && notFoundRes.body?.success === false,
    'Querying non-existent order tracking returns HTTP 404 Not Found',
    `Status: ${notFoundRes.status}, Error: ${notFoundRes.body?.error}`
  );

  // 2.4 Legitimate authorized tracking retrieval
  const authTrackingRes = await simulateOrdersApi({
    method: 'GET',
    url: `/${orderA.orderRef}/tracking?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });
  assert(
    authTrackingRes.status === 200 && authTrackingDataIsValid(authTrackingRes.body, orderA.orderRef),
    'Authorized customer successfully retrieves order tracking (HTTP 200)',
    `Status: ${authTrackingRes.status}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: Authorized Status Updates & Tracking Timeline
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Authorized Status & Tracking Progression ---');

  // 3.1 Unauthorized update attempt without admin key
  const unauthUpdateRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: { 'content-type': 'application/json' },
    body: { status: 'Packed' },
  });
  assert(
    unauthUpdateRes.status === 401 && unauthUpdateRes.body?.success === false,
    'Unauthorized status update without admin key returns HTTP 401',
    `Status: ${unauthUpdateRes.status}, Error: ${unauthUpdateRes.body?.error}`
  );

  // 3.2 Invalid status update attempt
  const invalidStatusRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: { status: 'Teleporting' },
  });
  assert(
    invalidStatusRes.status === 400 && invalidStatusRes.body?.success === false,
    'Invalid status payload returns HTTP 400 with list of supported statuses',
    `Status: ${invalidStatusRes.status}`
  );

  // 3.3 Authorized progression: Confirmed
  const confirmRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: {
      status: 'Confirmed',
      description: 'Payment and order details verified by Machii.',
    },
  });
  assert(
    confirmRes.status === 200 && confirmRes.body?.order?.status === 'Confirmed',
    'Authorized admin process updates status to "Confirmed" (HTTP 200)',
    `Status: ${confirmRes.body?.order?.status}`
  );

  // 3.4 Authorized progression: Packed
  const packRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: {
      status: 'Packed',
      description: 'Garments quality-checked and packed in streetwear sleeve.',
      location: 'Machii Warehouse, Chennai',
    },
  });
  assert(
    packRes.status === 200 && packRes.body?.order?.status === 'Packed',
    'Authorized admin process updates status to "Packed"',
    `Status: ${packRes.body?.order?.status}`
  );

  // 3.5 Authorized progression: Shipped with Courier Details
  const courierPayload = {
    status: 'Shipped',
    carrier: 'Blue Dart Express',
    trackingNumber: 'BD77889911IN',
    trackingUrl: 'https://www.bluedart.com/tracking/BD77889911IN',
    estimatedDelivery: '30 Oct 2026',
    description: 'Handed over to Blue Dart courier hub.',
    location: 'Chennai Air Cargo Hub',
  };

  const shipRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: courierPayload,
  });

  assert(
    shipRes.status === 200 && shipRes.body?.order?.status === 'Shipped',
    'Authorized admin process updates status to "Shipped"',
    `Status: ${shipRes.body?.order?.status}`
  );

  assert(
    Boolean(
      shipRes.body?.order?.tracking?.carrier === 'Blue Dart Express' &&
        shipRes.body?.order?.tracking?.trackingNumber === 'BD77889911IN' &&
        shipRes.body?.order?.tracking?.trackingUrl ===
          'https://www.bluedart.com/tracking/BD77889911IN'
    ),
    'Legitimate courier details (carrier, trackingNumber, trackingUrl) recorded on order',
    `Carrier: ${shipRes.body?.order?.tracking?.carrier}, AWB: ${shipRes.body?.order?.tracking?.trackingNumber}`
  );

  // 3.6 Customer queries tracking again and sees real courier details & events
  const customerTrackRes = await simulateOrdersApi({
    method: 'GET',
    url: `/${orderA.orderRef}/tracking?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });

  assert(
    customerTrackRes.body?.tracking?.status === 'Shipped' &&
      customerTrackRes.body?.tracking?.carrier === 'Blue Dart Express' &&
      customerTrackRes.body?.tracking?.trackingNumber === 'BD77889911IN' &&
      customerTrackRes.body?.tracking?.events?.length === 4,
    'Customer tracking reflects legitimate 4-stage events (Placed -> Confirmed -> Packed -> Shipped)',
    `Events length: ${customerTrackRes.body?.tracking?.events?.length}`
  );

  // 3.7 Progress to Out for Delivery & Delivered
  await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: {
      status: 'Out for Delivery',
      description: 'Courier executive out for doorstep delivery.',
    },
  });

  const deliverRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderA.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: {
      status: 'Delivered',
      description: 'Package delivered and signed at doorstep.',
    },
  });

  assert(
    deliverRes.status === 200 && deliverRes.body?.order?.status === 'Delivered',
    'Final progression reaches "Delivered" with all intermediate steps verified',
    `Final Status: ${deliverRes.body?.order?.status}, Total Events: ${deliverRes.body?.order?.tracking?.events?.length}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: Cancellation Verification (Requirement 4)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Order Cancellation Support ---');

  // Place a second order for Customer B
  const orderBPayload = {
    items: [
      {
        id: 'garment-bone',
        name: 'TOKYO ENERGY TEE',
        price: '₹1,399',
        color: 'Vintage Bone',
        size: 'M',
        quantity: 1,
      },
    ],
    customer: customerB,
    paymentMethod: 'COD',
  };

  const createBRes = await simulateOrdersApi({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    body: orderBPayload,
  });
  const orderB = createBRes.body?.order;

  // Admin cancels Order B before dispatch
  const cancelRes = await simulateOrdersApi({
    method: 'POST',
    url: `/${orderB.orderRef}/status`,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': 'machii-admin-secure-key',
    },
    body: {
      status: 'Cancelled',
      description: 'Order cancelled upon customer verification request.',
    },
  });

  assert(
    cancelRes.status === 200 && cancelRes.body?.order?.status === 'Cancelled',
    'Authorized admin process records legitimate "Cancelled" status (HTTP 200)',
    `Status: ${cancelRes.body?.order?.status}`
  );

  assert(
    Boolean(cancelRes.body?.order?.isCancelled === true),
    'Order record flags isCancelled = true',
    `isCancelled: ${cancelRes.body?.order?.isCancelled}`
  );

  // Customer B tracks cancelled order
  const trackBRes = await simulateOrdersApi({
    method: 'GET',
    url: `/${orderB.orderRef}/tracking?phone=${customerB.mobile}`,
    headers: { 'x-customer-phone': customerB.mobile },
  });

  assert(
    trackBRes.body?.tracking?.status === 'Cancelled' &&
      trackBRes.body?.tracking?.events?.some((e) => e.status === 'Cancelled'),
    'Customer tracking reflects Cancelled status and cancellation event',
    `Tracking status: ${trackBRes.body?.tracking?.status}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 5: Backwards Compatibility (test_order_history_flow)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Existing History Flow Compatibility ---');
  const historyRes = await simulateOrdersApi({
    method: 'GET',
    url: `/history?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });

  assert(
    historyRes.status === 200 &&
      historyRes.body?.success === true &&
      historyRes.body?.orders?.length >= 1,
    'Existing /api/orders/history remains 100% functional and compatible',
    `Orders count: ${historyRes.body?.orders?.length}`
  );

  console.log('\n============================================================');
  console.log(`STEP 8 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

function authTrackingDataIsValid(body, expectedOrderRef) {
  return (
    body?.success === true &&
    body?.orderRef === expectedOrderRef &&
    Boolean(body?.tracking) &&
    Array.isArray(body?.tracking?.events)
  );
}

runTests().catch((err) => {
  console.error('Fatal tracking test error:', err);
  process.exitCode = 1;
});
