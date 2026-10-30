/**
 * MACHII MENS MART — ADMIN OPERATIONS CLIENT SERVICE
 * Handles server-side authenticated admin operations for summary KPIs,
 * product management, inventory tracking, and order fulfillment updates.
 */

const ADMIN_TOKEN_KEY = 'machii_admin_token';
const ADMIN_USER_KEY = 'machii_admin_user';

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || null;
}

export function saveAdminSession(token, user = { username: 'admin', role: 'ADMIN' }) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminUser() {
  if (typeof window === 'undefined') return null;
  const user = sessionStorage.getItem(ADMIN_USER_KEY);
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function isAdminAuthenticated() {
  return Boolean(getAdminToken());
}

function getAdminHeaders() {
  const token = getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    // Also include X-Admin-Key as fallback for flexibility
    headers['X-Admin-Key'] = token;
  }
  return headers;
}

/**
 * Admin Login Authentication (Requirement 9 & 10)
 */
export async function adminLogin(passwordOrKey, username = 'admin') {
  try {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: passwordOrKey, password: passwordOrKey, username }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      saveAdminSession(data.token, data.user || { username, role: 'ADMIN' });
      return { success: true, token: data.token, user: data.user };
    }
    return {
      success: false,
      error: data.error || 'Authentication failed. Invalid admin credentials.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error during admin login.' };
  }
}

/**
 * Admin Logout (revokes server session and clears local storage)
 */
export async function adminLogout() {
  const token = getAdminToken();
  if (token) {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
    } catch {
      // Safe fallback
    }
  }
  clearAdminSession();
}

/**
 * Verify current session with server
 */
export async function verifyAdminSession() {
  const token = getAdminToken();
  if (!token) return { success: false, authenticated: false };

  try {
    const res = await fetch('/api/admin/auth/verify', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, authenticated: true };
    }
    clearAdminSession();
    return { success: false, authenticated: false };
  } catch {
    return { success: false, authenticated: false };
  }
}

/**
 * Fetch real admin dashboard summary KPIs (Requirement 2 & 14)
 */
export async function fetchAdminSummary() {
  try {
    const res = await fetch('/api/admin/summary', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, summary: data.summary };
    }
    return {
      success: false,
      error: data.error || 'Failed to retrieve admin summary.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error loading summary.' };
  }
}

/**
 * Fetch all products for admin catalog management (Requirement 3, 4, 5)
 */
export async function fetchAdminProducts() {
  try {
    const res = await fetch('/api/admin/products', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, products: data.products || [] };
    }
    return {
      success: false,
      error: data.error || 'Failed to load products.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error loading products.' };
  }
}

/**
 * Create a new product (Requirement 3, 4, 11)
 */
export async function createAdminProduct(productData) {
  try {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(productData),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, product: data.product };
    }
    return {
      success: false,
      error: data.error || 'Failed to create product.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error creating product.' };
  }
}

/**
 * Update existing product (Requirement 3, 4, 5, 11)
 */
export async function updateAdminProduct(id, productData) {
  try {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(productData),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, product: data.product };
    }
    return {
      success: false,
      error: data.error || 'Failed to update product.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating product.' };
  }
}

/**
 * Quick stock update (Requirement 5)
 */
export async function updateAdminProductStock(id, stockOrDelta) {
  try {
    const payload =
      typeof stockOrDelta === 'object'
        ? stockOrDelta
        : { stock: stockOrDelta };

    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/stock`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, product: data.product, stock: data.stock };
    }
    return {
      success: false,
      error: data.error || 'Failed to update stock.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating stock.' };
  }
}

/**
 * Deactivate or permanently delete product (Requirement 3)
 */
export async function deleteAdminProduct(id, permanent = false) {
  try {
    const res = await fetch(
      `/api/admin/products/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`,
      {
        method: 'DELETE',
        headers: getAdminHeaders(),
      }
    );
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message, product: data.product };
    }
    return {
      success: false,
      error: data.error || 'Failed to remove product.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error deleting product.' };
  }
}

/**
 * Fetch all orders for admin management (Requirement 6, 8)
 */
export async function fetchAdminOrders(status = 'all', searchQuery = '') {
  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (searchQuery) params.append('q', searchQuery);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/orders${qs}`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, orders: data.orders || [] };
    }
    return {
      success: false,
      error: data.error || 'Failed to load orders.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error loading orders.' };
  }
}

/**
 * Update order fulfillment status and tracking timeline (Requirement 7)
 */
export async function updateAdminOrderStatus(orderRef, statusPayload) {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderRef)}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify(statusPayload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, order: data.order };
    }
    return {
      success: false,
      error: data.error || 'Failed to update order status.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating order status.' };
  }
}

/**
 * Update payment status (Requirement 8 - keep payment separate from fulfillment)
 */
export async function updateAdminOrderPayment(orderRef, paymentStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderRef)}/payment`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ paymentStatus }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, order: data.order };
    }
    return {
      success: false,
      error: data.error || 'Failed to update payment status.',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating payment.' };
  }
}

/**
 * STEP 13: Admin Coupon & Discount Management
 */
export async function fetchAdminCoupons() {
  try {
    const res = await fetch('/api/admin/coupons', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, coupons: data.coupons || [] };
    }
    return { success: false, error: data.error || 'Failed to fetch coupons.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching coupons.' };
  }
}

export async function createAdminCoupon(couponPayload) {
  try {
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(couponPayload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, coupon: data.coupon, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to create coupon.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error creating coupon.' };
  }
}

export async function updateAdminCoupon(couponId, updates) {
  try {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, coupon: data.coupon, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to update coupon.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating coupon.' };
  }
}

export async function deleteAdminCoupon(couponId) {
  try {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to delete coupon.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error deleting coupon.' };
  }
}

/**
 * Fetch Customer Accounts Directory
 */
export async function fetchAdminCustomers() {
  try {
    const res = await fetch('/api/admin/customers', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, customers: data.customers || [] };
    }
    return { success: false, error: data.error || 'Failed to fetch customers directory.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching customers.' };
  }
}

/**
 * Fetch Admin Store Settings (Announcement Offer Banner, COD toggle, Support)
 */
export async function fetchAdminStoreSettings() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, settings: data.settings };
    }
    return { success: false, error: data.error || 'Failed to load store settings.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error loading store settings.' };
  }
}

/**
 * Update Admin Store Settings
 */
export async function updateAdminStoreSettings(updates) {
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, settings: data.settings, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to update store settings.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating store settings.' };
  }
}

/**
 * Fetch Admin Analytics (Top Products, AOV, Fulfillment rates)
 */
export async function fetchAdminAnalytics() {
  try {
    const res = await fetch('/api/admin/analytics', {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, analytics: data.analytics };
    }
    return { success: false, error: data.error || 'Failed to load analytics.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error loading analytics.' };
  }
}

/**
 * Client-Side Order CSV Export Utility
 */
export function exportOrdersToCSV(orders = []) {
  if (!orders || orders.length === 0) return false;

  const headers = [
    'Order Reference',
    'Date Placed',
    'Customer Name',
    'Mobile',
    'City',
    'State',
    'Pincode',
    'Items Count',
    'Subtotal (INR)',
    'Coupon Code',
    'Discount (INR)',
    'Total Payable (INR)',
    'Payment Method',
    'Payment Status',
    'Fulfillment Status',
    'Carrier',
    'Tracking AWB',
  ];

  const rows = orders.map((o) => [
    `"${o.orderRef}"`,
    `"${new Date(o.createdAt).toLocaleString('en-IN')}"`,
    `"${(o.customer?.fullName || '').replace(/"/g, '""')}"`,
    `"${o.customer?.mobile || ''}"`,
    `"${(o.customer?.city || '').replace(/"/g, '""')}"`,
    `"${(o.customer?.state || '').replace(/"/g, '""')}"`,
    `"${o.customer?.pincode || ''}"`,
    (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
    o.subtotal || o.total || 0,
    `"${o.couponCode || 'NONE'}"`,
    o.discountAmount || 0,
    o.total || 0,
    `"${o.paymentMethod || 'COD'}"`,
    `"${o.paymentStatus || 'PENDING'}"`,
    `"${o.fulfillmentStatus || o.status || 'UNFULFILLED'}"`,
    `"${o.tracking?.carrier || 'NOT ASSIGNED'}"`,
    `"${o.tracking?.trackingNumber || 'NONE'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `machii_orders_export_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}



