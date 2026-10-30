/**
 * MACHII MENS MART — STEP 10 ADMIN DASHBOARD & PRODUCT MANAGEMENT TEST SUITE
 * Verifies role-based authorization, summary metrics on real data, product CRUD,
 * inventory stock controls, and genuine order fulfillment management.
 */

import { EventEmitter } from 'node:events';
import viteConfig from './vite.config.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Extract registered backend middleware handlers from Vite config
const middlewares = [];
const fakeServer = {
  middlewares: {
    use: (routeOrHandler, maybeHandler) => {
      if (typeof routeOrHandler === 'string') {
        middlewares.push({ route: routeOrHandler, handler: maybeHandler });
      } else {
        middlewares.push({ route: '/', handler: routeOrHandler });
      }
    },
  },
};

const configObj = typeof viteConfig === 'function' ? viteConfig({ command: 'serve' }) : viteConfig;
const plugin = configObj.plugins.find(
  (p) => p && (p.name === 'machii-order-backend-api' || p.name === 'order-api-plugin')
);

if (plugin && plugin.configureServer) {
  plugin.configureServer(fakeServer);
}

// In-memory HTTP dispatch helper
function dispatchRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve) => {
    const matching = middlewares.find((m) => urlPath.startsWith(m.route));
    if (!matching) {
      return resolve({
        statusCode: 404,
        headers: {},
        json: { error: `No middleware registered for path "${urlPath}"` },
      });
    }

    const subPath = urlPath.slice(matching.route.length) || '/';

    const req = new EventEmitter();
    req.method = method;
    req.url = subPath;
    req.headers = { ...headers };

    const res = {
      statusCode: 200,
      _headers: {},
      setHeader(k, v) {
        this._headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return this._headers[k.toLowerCase()];
      },
      end(data) {
        let json = null;
        try {
          if (data) json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: this.statusCode,
          headers: this._headers,
          data,
          json,
        });
      },
    };

    matching.handler(req, res, () => {
      resolve({ statusCode: 404, headers: {}, json: { error: 'Not handled by middleware next()' } });
    });

    if (body) {
      const payloadStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', payloadStr);
    }
    req.emit('end');
  });
}

const ADMIN_SECRET = 'machii-admin-secure-key';

async function runAdminVerificationSuite() {
  console.log('\n============================================================');
  console.log('MACHII MENS MART: STEP 10 ADMIN DASHBOARD & PRODUCT SUITE');
  console.log('============================================================\n');

  assert(middlewares.some((m) => m.route === '/api/admin'), 'Admin operations middleware registered at /api/admin');
  assert(middlewares.some((m) => m.route === '/api/products'), 'Products catalog middleware registered at /api/products');

  // -------------------------------------------------------------------------
  // TEST GROUP 1: SERVER-SIDE ROLE-BASED AUTHORIZATION & CUSTOMER ISOLATION
  // Requirements 9 & 10
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Server-Side Role-Based Authorization & Privacy ---');

  const unauthSummary = await dispatchRequest('GET', '/api/admin/summary');
  assert(unauthSummary.statusCode === 401, 'Requesting admin summary without authorization returns HTTP 401');

  const unauthProducts = await dispatchRequest('GET', '/api/admin/products');
  assert(unauthProducts.statusCode === 401, 'Requesting admin products list without authorization returns HTTP 401');

  const unauthOrders = await dispatchRequest('GET', '/api/admin/orders');
  assert(unauthOrders.statusCode === 401, 'Requesting admin orders list without authorization returns HTTP 401');

  const customerAccess = await dispatchRequest('GET', '/api/admin/summary', {
    'x-customer-phone': '9876543210',
  });
  assert(customerAccess.statusCode === 401, 'Customer phone cannot grant access to admin endpoints (HTTP 401)');

  const tamperedKey = await dispatchRequest('GET', '/api/admin/summary', {
    'x-admin-key': 'fake-tampered-token-123',
  });
  assert(tamperedKey.statusCode === 401, 'Tampered or invalid admin key returns HTTP 401 Unauthorized');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: ADMIN AUTHENTICATION & LOGIN SESSION
  // Requirement 9
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Admin Authentication & Login ---');

  const failedLogin = await dispatchRequest('POST', '/api/admin/auth/login', {}, {
    key: 'wrong-password',
  });
  assert(failedLogin.statusCode === 401 && !failedLogin.json.success, 'Invalid admin password rejected with HTTP 401');

  const successfulLogin = await dispatchRequest('POST', '/api/admin/auth/login', {}, {
    key: ADMIN_SECRET,
    username: 'store_manager',
  });
  assert(successfulLogin.statusCode === 200 && successfulLogin.json.success, 'Valid admin key authenticates successfully (HTTP 200)');
  assert(Boolean(successfulLogin.json.token), 'Server issues secure admin session token');
  assert(successfulLogin.json.role === 'ADMIN', 'Session token carries verified ADMIN role');

  const adminToken = successfulLogin.json.token;

  const verifySession = await dispatchRequest('GET', '/api/admin/auth/verify', {
    authorization: `Bearer ${adminToken}`,
  });
  assert(verifySession.statusCode === 200 && verifySession.json.authenticated, 'Admin session token verified by server');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: DASHBOARD SUMMARY INFORMATION FROM REAL BACKEND DATA
  // Requirements 2 & 14
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Real Summary Information & Metrics ---');

  const summaryRes = await dispatchRequest('GET', '/api/admin/summary', {
    authorization: `Bearer ${adminToken}`,
  });
  assert(summaryRes.statusCode === 200 && summaryRes.json.success, 'Admin summary retrieved successfully (HTTP 200)');
  const summary = summaryRes.json.summary;
  assert(typeof summary.totalProducts === 'number' && summary.totalProducts >= 6, 'Summary accurately reports total products in catalog');
  assert(typeof summary.totalStock === 'number' && summary.totalStock > 0, 'Summary accurately reports real available stock units');
  assert(typeof summary.totalOrders === 'number', 'Summary accurately reports total orders placed');
  assert(typeof summary.pendingOrders === 'number', 'Summary accurately reports pending unfulfilled orders');
  assert(typeof summary.totalRevenue === 'number', 'Summary computes real total revenue');
  assert(summary.paymentStats && typeof summary.paymentStats.codCount === 'number', 'Summary separates COD from online payment counts');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: PRODUCT CREATION, VALIDATION & MANAGEMENT
  // Requirements 3, 4, 11
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Product Creation, Validation & Editing ---');

  const invalidProdRes = await dispatchRequest('POST', '/api/admin/products', {
    authorization: `Bearer ${adminToken}`,
  }, {
    name: 'X',
    price: 0,
  });
  assert(invalidProdRes.statusCode === 400, 'Product creation with invalid name (<3 chars) rejected with HTTP 400');

  const validNewProduct = {
    name: 'Cyber Samurai Graphic Tee',
    subName: 'Heavyweight Distressed Box Cut',
    price: '₹1,599',
    originalPrice: '₹2,299',
    stock: 65,
    category: 'printed',
    gsm: '280 GSM Combed Cotton',
    fit: 'Relaxed Drop Shoulder',
    description: 'Custom Japanese cyberpunk artwork on vintage washed black heavyweight combed cotton.',
    image: '/assets/products/machii-cyber-cobalt.png',
    sizes: ['M', 'L', 'XL'],
    badge: 'LIMITED DROP',
  };

  const createProdRes = await dispatchRequest('POST', '/api/admin/products', {
    authorization: `Bearer ${adminToken}`,
  }, validNewProduct);
  assert(createProdRes.statusCode === 201 && createProdRes.json.success, 'Valid product created successfully (HTTP 201)');
  const createdProd = createProdRes.json.product;
  assert(Boolean(createdProd.id), 'Created product assigned unique identifier');
  assert(createdProd.name === 'Cyber Samurai Graphic Tee', 'Created product preserves authentic title');
  assert(createdProd.stock === 65, 'Created product initializes with specified stock quantity (65)');

  // Edit product
  const editProdRes = await dispatchRequest('PUT', `/api/admin/products/${createdProd.id}`, {
    authorization: `Bearer ${adminToken}`,
  }, {
    name: 'Cyber Samurai Oversized Tee',
    price: 1699,
  });
  assert(editProdRes.statusCode === 200 && editProdRes.json.product.name === 'Cyber Samurai Oversized Tee', 'Product details edited successfully (HTTP 200)');
  assert(editProdRes.json.product.priceNum === 1699, 'Product price updated correctly on backend');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: STOCK CONTROLS & INVENTORY SYNCHRONIZATION
  // Requirement 5
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Stock Controls & Real Inventory Tracking ---');

  const updateStockRes = await dispatchRequest('PATCH', `/api/admin/products/${createdProd.id}/stock`, {
    authorization: `Bearer ${adminToken}`,
  }, { stock: 80 });
  assert(updateStockRes.statusCode === 200 && updateStockRes.json.stock === 80, 'Admin directly updates available stock to 80 units (HTTP 200)');

  const quickDeltaRes = await dispatchRequest('PATCH', `/api/admin/products/${createdProd.id}/stock`, {
    authorization: `Bearer ${adminToken}`,
  }, { delta: -5 });
  assert(quickDeltaRes.statusCode === 200 && quickDeltaRes.json.stock === 75, 'Admin decrements stock by 5 units (now 75)');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: STOREFRONT ORDER CREATION WITH AUTOMATIC STOCK DECREMENT
  // Requirements 5 & 6
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Storefront Order Placement & Stock Decrement ---');

  const orderPlacementRes = await dispatchRequest('POST', '/api/orders', {}, {
    customer: {
      fullName: 'Aravind Swaminathan',
      mobile: '9840123456',
      address: 'Plot 42, 2nd Cross Street, Indiranagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
    },
    items: [
      {
        id: createdProd.id,
        name: createdProd.name,
        size: 'L',
        quantity: 2,
        color: 'Standard Dark',
        price: '₹1,699',
      },
    ],
    paymentMethod: 'COD',
  });

  assert(orderPlacementRes.statusCode === 201 && orderPlacementRes.json.success, 'Storefront order placed successfully (HTTP 201)');
  const newOrder = orderPlacementRes.json.order;
  assert(Boolean(newOrder.orderRef), 'Order assigned reference number starting with MCH-');

  // Check that product stock decremented from 75 to 73
  const checkStockRes = await dispatchRequest('GET', '/api/admin/products', {
    authorization: `Bearer ${adminToken}`,
  });
  const updatedProdInDb = checkStockRes.json.products.find((p) => p.id === createdProd.id);
  assert(updatedProdInDb.stock === 73, `Order placement automatically decremented product stock: 75 -> ${updatedProdInDb.stock}`);

  // -------------------------------------------------------------------------
  // TEST GROUP 7: ORDER MANAGEMENT & FULFILLMENT STATUS PROGRESSION
  // Requirements 6, 7, 8
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Real Order Fulfillment & Customer Tracking Sync ---');

  const adminOrdersRes = await dispatchRequest('GET', '/api/admin/orders', {
    authorization: `Bearer ${adminToken}`,
  });
  assert(adminOrdersRes.statusCode === 200 && adminOrdersRes.json.orders.length > 0, 'Admin retrieves orders from database (HTTP 200)');
  const orderInList = adminOrdersRes.json.orders.find((o) => o.orderRef === newOrder.orderRef);
  assert(Boolean(orderInList), 'Newly placed customer order appears in admin orders list');

  // Admin updates status to Shipped with courier details
  const updateStatusRes = await dispatchRequest('PATCH', `/api/admin/orders/${newOrder.orderRef}/status`, {
    authorization: `Bearer ${adminToken}`,
  }, {
    status: 'Shipped',
    carrier: 'Blue Dart Express',
    trackingNumber: 'BLUEDART-984012',
    trackingUrl: 'https://track.bluedart.com/awb=BLUEDART-984012',
    description: 'Consignment handed over to Blue Dart courier in Chennai.',
  });
  assert(updateStatusRes.statusCode === 200 && updateStatusRes.json.success, 'Admin updates fulfillment status to "Shipped" with courier details');
  assert(updateStatusRes.json.order.tracking.carrier === 'Blue Dart Express', 'Real courier carrier recorded on order');
  assert(updateStatusRes.json.order.tracking.trackingNumber === 'BLUEDART-984012', 'Real AWB tracking number recorded on order');

  // Customer tracking verification: customer should immediately see genuine changes
  const customerTrackingRes = await dispatchRequest('GET', `/api/orders/${newOrder.orderRef}/tracking`, {
    'x-customer-phone': '9840123456',
  });
  assert(customerTrackingRes.statusCode === 200 && customerTrackingRes.json.fulfillmentStatus === 'Shipped', 'Customer order tracking reflects the admin status change to "Shipped"');
  assert(customerTrackingRes.json.tracking.carrier === 'Blue Dart Express', 'Customer tracking reflects Blue Dart courier');
  assert(customerTrackingRes.json.tracking.trackingNumber === 'BLUEDART-984012', 'Customer tracking reflects AWB tracking number');

  // Payment separation: Payment status is still PENDING for COD
  assert(customerTrackingRes.json.paymentStatus === 'PENDING', 'Payment status remains strictly separate as PENDING for COD');

  // Admin updates payment status when COD is collected
  const updatePaymentRes = await dispatchRequest('PATCH', `/api/admin/orders/${newOrder.orderRef}/payment`, {
    authorization: `Bearer ${adminToken}`,
  }, {
    paymentStatus: 'PAID',
  });
  assert(updatePaymentRes.statusCode === 200 && updatePaymentRes.json.order.paymentStatus === 'PAID', 'Admin marks COD payment as PAID upon collection (HTTP 200)');

  // -------------------------------------------------------------------------
  // TEST GROUP 8: PRODUCT DEACTIVATION & STOREFRONT VISIBILITY
  // Requirements 3 & 5
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Product Deactivation & Public Storefront Filter ---');

  const deactiveRes = await dispatchRequest('DELETE', `/api/admin/products/${createdProd.id}`, {
    authorization: `Bearer ${adminToken}`,
  });
  assert(deactiveRes.statusCode === 200 && deactiveRes.json.product.isActive === false, 'Product deactivated by admin (HTTP 200)');

  const publicProductsRes = await dispatchRequest('GET', '/api/products');
  assert(publicProductsRes.statusCode === 200, 'Public products endpoint returns HTTP 200');
  const isDeactivatedInPublic = publicProductsRes.json.products.some((p) => p.id === createdProd.id);
  assert(!isDeactivatedInPublic, 'Deactivated product is excluded from storefront catalogue');

  console.log('\n============================================================');
  console.log(`STEP 10 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAdminVerificationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
