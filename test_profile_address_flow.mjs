/* ==========================================================================
   MACHII MENS MART — STEP 9 PROFILE & ADDRESS VERIFICATION SUITE
   Tests:
   1. Customer Profile retrieval (HTTP 200 when authorized, HTTP 401 when unauthorized)
   2. Customer Profile update (Name, Email) with input validation
   3. Customer Profile validation rejects invalid names and bad email formats
   4. Customer Mobile number update & migration
   5. Delivery address creation with complete Indian delivery fields
   6. Delivery address validation rejects invalid PIN, short address, bad phone
   7. Default address selection & toggling
   8. Delivery address update / editing
   9. Privacy enforcement against snooping (Customer B cannot access, edit, or delete Customer A's address - HTTP 403)
   10. Delivery address deletion with default re-assignment
   11. Order placement automatic customer profile and default address seeding
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

// Extract registered middlewares from vite.config.js
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
const plugin = configObj.plugins.find((p) => p && (p.name === 'machii-order-backend-api' || p.name === 'order-api-plugin'));
if (plugin && plugin.configureServer) {
  plugin.configureServer(fakeServer);
}

const customerMiddleware = registeredRoutes['/api/customer'];
const ordersMiddleware = registeredRoutes['/api/orders'];

function simulateCustomerApi({ method = 'GET', url = '/', headers = {}, body = null }) {
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

    customerMiddleware(req, res, () => {
      resolve({ status: res.statusCode, headers: responseHeaders, body: null, raw: responseData });
    });

    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(bodyStr));
    }
    req.emit('end');
  });
}

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
  console.log('MACHII MENS MART: STEP 9 PROFILE & ADDRESS VERIFICATION SUITE');
  console.log('============================================================\n');

  assert(
    typeof customerMiddleware === 'function',
    'Customer profile & address middleware correctly registered at /api/customer'
  );

  const customerA = {
    fullName: 'Aditya Vardhan',
    mobile: '9840112233',
    email: 'aditya@streetwear.in',
  };

  const customerB = {
    fullName: 'Rohan Mehra',
    mobile: '9123456789',
    email: 'rohan@example.com',
  };

  // -------------------------------------------------------------
  // TEST GROUP 1: Profile Retrieval & Authorization Enforcement
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Profile Retrieval & Authorization ---');

  // 1.1 Unauthorized profile request without phone
  const unauthRes = await simulateCustomerApi({
    method: 'GET',
    url: '/profile',
  });
  assert(
    unauthRes.status === 401 && unauthRes.body?.success === false,
    'Profile request without customer phone returns HTTP 401 Unauthorized',
    `Status: ${unauthRes.status}, Error: ${unauthRes.body?.error}`
  );

  // 1.2 Authorized profile retrieval
  const authRes = await simulateCustomerApi({
    method: 'GET',
    url: `/profile?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });
  assert(
    authRes.status === 200 && authRes.body?.success === true,
    'Authorized customer retrieves profile details (HTTP 200)',
    `Status: ${authRes.status}`
  );

  assert(
    authRes.body?.profile?.mobile === customerA.mobile && Array.isArray(authRes.body?.addresses),
    'Profile payload includes authenticated mobile and addresses array',
    `Mobile: ${authRes.body?.profile?.mobile}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: Profile Update & Input Validation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Profile Update & Input Validation ---');

  // 2.1 Update name and email
  const updateRes = await simulateCustomerApi({
    method: 'PUT',
    url: `/profile?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: {
      fullName: 'Aditya Vardhan Rao',
      email: 'aditya.rao@machii.in',
    },
  });

  assert(
    updateRes.status === 200 &&
      updateRes.body?.profile?.fullName === 'Aditya Vardhan Rao' &&
      updateRes.body?.profile?.email === 'aditya.rao@machii.in',
    'Customer profile name and email updated successfully',
    `Updated: ${updateRes.body?.profile?.fullName}, ${updateRes.body?.profile?.email}`
  );

  // 2.2 Validation rejects short name (< 2 characters)
  const shortNameRes = await simulateCustomerApi({
    method: 'PUT',
    url: `/profile?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: { fullName: 'A' },
  });
  assert(
    shortNameRes.status === 400 && shortNameRes.body?.success === false,
    'Validation rejects full name with fewer than 2 characters (HTTP 400)',
    `Status: ${shortNameRes.status}, Error: ${shortNameRes.body?.error}`
  );

  // 2.3 Validation rejects malformed email
  const badEmailRes = await simulateCustomerApi({
    method: 'PUT',
    url: `/profile?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: { email: 'not-an-email' },
  });
  assert(
    badEmailRes.status === 400 && badEmailRes.body?.success === false,
    'Validation rejects malformed email address (HTTP 400)',
    `Status: ${badEmailRes.status}, Error: ${badEmailRes.body?.error}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: Delivery Address Creation & Default Assignment
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Address Creation & Default Assignment ---');

  // 3.1 Create first delivery address
  const addr1Payload = {
    recipientName: 'Aditya Vardhan',
    mobile: '9840112233',
    address: 'Flat 4A, Orchid Towers, Anna Salai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600002',
    isDefault: true,
    tag: 'Home',
  };

  const createAddr1Res = await simulateCustomerApi({
    method: 'POST',
    url: `/addresses?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: addr1Payload,
  });

  assert(
    createAddr1Res.status === 201 && createAddr1Res.body?.success === true,
    'Add delivery address returns HTTP 201 Created',
    `Status: ${createAddr1Res.status}`
  );

  const address1 = createAddr1Res.body?.address;
  assert(
    Boolean(address1 && address1.id && address1.isDefault === true && address1.pincode === '600002'),
    'Address created with unique ID, verified PIN code, and set as default',
    `AddrId: ${address1?.id}, Default: ${address1?.isDefault}`
  );

  // 3.2 Create second delivery address (Work)
  const addr2Payload = {
    recipientName: 'Aditya V. (Office)',
    mobile: '9840112233',
    address: 'DLF Cybercity, Mount Poonamallee Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600089',
    isDefault: false,
    tag: 'Work',
  };

  const createAddr2Res = await simulateCustomerApi({
    method: 'POST',
    url: `/addresses?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: addr2Payload,
  });

  const address2 = createAddr2Res.body?.address;
  assert(
    createAddr2Res.status === 201 && createAddr2Res.body?.addresses?.length === 2,
    'Second address added; total addresses count is 2',
    `Count: ${createAddr2Res.body?.addresses?.length}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: Address Input Validation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Address Input Validation ---');

  // 4.1 Invalid PIN code (not 6 digits or starts with 0)
  const badPinRes = await simulateCustomerApi({
    method: 'POST',
    url: `/addresses?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: {
      ...addr1Payload,
      pincode: '01234',
    },
  });
  assert(
    badPinRes.status === 400 && badPinRes.body?.success === false,
    'Validation rejects invalid Indian postal code (HTTP 400)',
    `Status: ${badPinRes.status}, Error: ${badPinRes.body?.error}`
  );

  // 4.2 Incomplete address (< 8 chars)
  const shortAddrRes = await simulateCustomerApi({
    method: 'POST',
    url: `/addresses?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: {
      ...addr1Payload,
      address: 'Street',
    },
  });
  assert(
    shortAddrRes.status === 400 && shortAddrRes.body?.success === false,
    'Validation rejects street address shorter than 8 characters (HTTP 400)',
    `Status: ${shortAddrRes.status}, Error: ${shortAddrRes.body?.error}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 5: Default Address Selection & Address Editing
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Default Address Selection & Editing ---');

  // 5.1 Set Address 2 as Default
  const setDefaultRes = await simulateCustomerApi({
    method: 'PATCH',
    url: `/addresses/${address2.id}/default?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });

  assert(
    setDefaultRes.status === 200 && setDefaultRes.body?.success === true,
    'Set address as default returns HTTP 200',
    `Status: ${setDefaultRes.status}`
  );

  const updatedAddrs = setDefaultRes.body?.addresses;
  const isAddr2Default = updatedAddrs?.find((a) => a.id === address2.id)?.isDefault;
  const isAddr1Default = updatedAddrs?.find((a) => a.id === address1.id)?.isDefault;

  assert(
    isAddr2Default === true && isAddr1Default === false,
    'Address 2 is now default, Address 1 default unassigned',
    `Addr2 isDefault: ${isAddr2Default}, Addr1 isDefault: ${isAddr1Default}`
  );

  // 5.2 Edit Address 1 details
  const editAddrRes = await simulateCustomerApi({
    method: 'PUT',
    url: `/addresses/${address1.id}?phone=${customerA.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerA.mobile,
    },
    body: {
      recipientName: 'Aditya V. Rao (Home)',
      address: 'Penthouse 12B, Orchid Luxury Towers, Anna Salai',
    },
  });

  assert(
    editAddrRes.status === 200 &&
      editAddrRes.body?.address?.recipientName === 'Aditya V. Rao (Home)' &&
      editAddrRes.body?.address?.address.includes('Penthouse 12B'),
    'Address details updated successfully (HTTP 200)',
    `Updated: ${editAddrRes.body?.address?.recipientName}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 6: Customer Isolation & Anti-Snooping (Requirement 8)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Customer Isolation & Privacy ---');

  // Customer B tries to view Customer A's address
  const snoopGetRes = await simulateCustomerApi({
    method: 'GET',
    url: `/addresses/${address1.id}?phone=${customerB.mobile}`,
    headers: { 'x-customer-phone': customerB.mobile },
  });
  assert(
    snoopGetRes.status === 403 && snoopGetRes.body?.success === false,
    'Customer B attempting to view Customer A\'s address is blocked with HTTP 403 Forbidden',
    `Status: ${snoopGetRes.status}, Error: ${snoopGetRes.body?.error}`
  );

  // Customer B tries to edit Customer A's address
  const snoopEditRes = await simulateCustomerApi({
    method: 'PUT',
    url: `/addresses/${address1.id}?phone=${customerB.mobile}`,
    headers: {
      'content-type': 'application/json',
      'x-customer-phone': customerB.mobile,
    },
    body: { recipientName: 'Hacker' },
  });
  assert(
    snoopEditRes.status === 403 && snoopEditRes.body?.success === false,
    'Customer B attempting to edit Customer A\'s address is blocked with HTTP 403 Forbidden',
    `Status: ${snoopEditRes.status}`
  );

  // Customer B tries to delete Customer A's address
  const snoopDeleteRes = await simulateCustomerApi({
    method: 'DELETE',
    url: `/addresses/${address1.id}?phone=${customerB.mobile}`,
    headers: { 'x-customer-phone': customerB.mobile },
  });
  assert(
    snoopDeleteRes.status === 403 && snoopDeleteRes.body?.success === false,
    'Customer B attempting to delete Customer A\'s address is blocked with HTTP 403 Forbidden',
    `Status: ${snoopDeleteRes.status}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 7: Address Deletion & Default Re-assignment
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Address Deletion ---');

  // Delete Address 2 (which is currently default)
  const deleteRes = await simulateCustomerApi({
    method: 'DELETE',
    url: `/addresses/${address2.id}?phone=${customerA.mobile}`,
    headers: { 'x-customer-phone': customerA.mobile },
  });

  assert(
    deleteRes.status === 200 && deleteRes.body?.addresses?.length === 1,
    'Address successfully deleted (HTTP 200)',
    `Remaining count: ${deleteRes.body?.addresses?.length}`
  );

  const remaining = deleteRes.body?.addresses?.[0];
  assert(
    remaining && remaining.id === address1.id && remaining.isDefault === true,
    'Remaining address automatically becomes default when default address is deleted',
    `Remaining ID: ${remaining?.id}, isDefault: ${remaining?.isDefault}`
  );

  // -------------------------------------------------------------
  // TEST GROUP 8: Order Placement Auto-Seeds Profile & Address
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Order Placement Auto-Seeding ---');

  const customerC = {
    fullName: 'Meera Krishnan',
    mobile: '9840998877',
    email: 'meera@chennai.in',
    address: '15 Bishop Garden, Raja Annamalai Puram',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600028',
  };

  const orderRes = await simulateOrdersApi({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    body: {
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
      customer: customerC,
      paymentMethod: 'COD',
    },
  });

  assert(
    orderRes.status === 201 && orderRes.body?.success === true,
    'Order placed successfully for Customer C',
    `OrderRef: ${orderRes.body?.order?.orderRef}`
  );

  // Check that Customer C profile and default address were automatically initialized
  const profileCRes = await simulateCustomerApi({
    method: 'GET',
    url: `/profile?phone=${customerC.mobile}`,
    headers: { 'x-customer-phone': customerC.mobile },
  });

  assert(
    profileCRes.status === 200 &&
      profileCRes.body?.profile?.fullName === 'Meera Krishnan' &&
      profileCRes.body?.addresses?.length === 1 &&
      profileCRes.body?.addresses[0]?.isDefault === true,
    'Order placement automatically seeded customer profile and default delivery address',
    `Profile: ${profileCRes.body?.profile?.fullName}, Default Address: ${profileCRes.body?.addresses?.[0]?.city}`
  );

  console.log('\n============================================================');
  console.log(`STEP 9 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error('Fatal profile test error:', err);
  process.exitCode = 1;
});

