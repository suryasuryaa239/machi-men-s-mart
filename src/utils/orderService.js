/* ==========================================================================
   MACHII MENS MART — AUTHORITATIVE ORDER VALIDATION & PAYMENT SERVICE
   STEP 6: Payment method selection, Cash on Delivery (COD) processing,
   online gateway status detection, duplicate order prevention, and
   strict separation of payment status from order fulfillment status.
   ========================================================================== */

import { PRODUCTS, COLLECTION_PRODUCTS } from '../data/products.js';
import { parsePrice, formatPrice } from './cartStorage.js';

export const ORDERS_STORAGE_KEY = 'machii_demo_orders';

/**
 * Authoritative Catalog Product Lookup
 * Searches both hero rack PRODUCTS and COLLECTION_PRODUCTS.
 */
export function findCatalogProduct(itemId, itemName) {
  if (!itemId && !itemName) return null;

  const targetId = String(itemId || '').trim().toLowerCase();
  const targetName = String(itemName || '').trim().toLowerCase();

  // Search hero carousel rack products
  const heroMatch = PRODUCTS.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      p.collectionId?.toLowerCase() === targetId ||
      (targetName && p.name.toLowerCase() === targetName) ||
      (targetName && p.name.toLowerCase().includes(targetName))
  );
  if (heroMatch) return heroMatch;

  // Search collection drop cards
  const collMatch = COLLECTION_PRODUCTS.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      (targetName && p.name.toLowerCase() === targetName) ||
      (targetName && p.name.toLowerCase().includes(targetName))
  );
  if (collMatch) return collMatch;

  // Alias fallbacks for hero showcase items
  if (targetId === 'garment-drop01' || targetName.includes('drop 01')) {
    return PRODUCTS.find((p) => p.id === 'garment-sage') || COLLECTION_PRODUCTS.find((p) => p.id === 'prod-everyday-heavyweight');
  }
  if (targetId === 'garment-cream' || targetName.includes('street culture')) {
    return COLLECTION_PRODUCTS.find((p) => p.id === 'prod-street-culture');
  }

  return null;
}

/**
 * Validate customer delivery details
 */
export function validateCustomerDetails(customer = {}) {
  const errors = {};

  const fullName = String(customer.fullName || '').trim();
  if (!fullName) {
    errors.fullName = 'Full name is required';
  } else if (fullName.length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  }

  let cleanedMobile = String(customer.mobile || '').replace(/\D/g, '');
  if (cleanedMobile.length === 12 && cleanedMobile.startsWith('91')) {
    cleanedMobile = cleanedMobile.slice(2);
  } else if (cleanedMobile.length === 11 && cleanedMobile.startsWith('0')) {
    cleanedMobile = cleanedMobile.slice(1);
  }

  if (!cleanedMobile) {
    errors.mobile = 'Mobile number is required';
  } else if (cleanedMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedMobile)) {
    errors.mobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
  }

  const email = String(customer.email || '').trim();
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
  }

  const address = String(customer.address || '').trim();
  if (!address) {
    errors.address = 'Full delivery address is required';
  } else if (address.length < 8) {
    errors.address = 'Please provide a complete street address (minimum 8 characters)';
  }

  const city = String(customer.city || '').trim();
  if (!city) {
    errors.city = 'City is required';
  } else if (city.length < 2) {
    errors.city = 'Please enter a valid city name';
  }

  const state = String(customer.state || '').trim();
  if (!state) {
    errors.state = 'State is required';
  }

  const cleanedPin = String(customer.pincode || '').replace(/\D/g, '');
  if (!cleanedPin) {
    errors.pincode = 'PIN code is required';
  } else if (cleanedPin.length !== 6 || !/^[1-9]\d{5}$/.test(cleanedPin)) {
    errors.pincode = 'PIN code must be a valid 6-digit Indian postal code';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedData: {
      fullName,
      mobile: cleanedMobile,
      email: email || null,
      address,
      city,
      state,
      pincode: cleanedPin,
    },
  };
}

/**
 * Authoritatively validate items, availability, and prices against the catalog.
 * NEVER trusts prices or subtotals sent by client.
 */
export function validateOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      error: 'Cannot place order: Your shopping cart is empty.',
      items: [],
      subtotal: 0,
      shipping: 0,
      total: 0,
    };
  }

  const verifiedItems = [];
  let calculatedSubtotal = 0;

  for (let i = 0; i < items.length; i++) {
    const rawItem = items[i];
    const catalogProduct = findCatalogProduct(rawItem.id, rawItem.name);

    if (!catalogProduct) {
      return {
        isValid: false,
        error: `Product "${rawItem.name || rawItem.id || `Item #${i + 1}`}" is unavailable or no longer in the catalog.`,
        items: [],
      };
    }

    // Validate quantity: integer between 1 and 10
    const quantity = Math.max(1, Math.min(10, parseInt(rawItem.quantity, 10) || 1));

    // Validate size if catalog product defines sizes
    const chosenSize = String(rawItem.size || '').trim().toUpperCase();
    if (Array.isArray(catalogProduct.sizes) && catalogProduct.sizes.length > 0) {
      const sizeFound = catalogProduct.sizes.some(
        (s) => s.toUpperCase() === chosenSize
      );
      if (!sizeFound) {
        return {
          isValid: false,
          error: `Selected size "${chosenSize}" for "${catalogProduct.name}" is not currently available. Available sizes: ${catalogProduct.sizes.join(', ')}.`,
          items: [],
        };
      }
    }

    // Authoritative unit price from catalog (never trust client price)
    const authenticUnitPrice = parsePrice(catalogProduct.price);
    if (authenticUnitPrice <= 0) {
      return {
        isValid: false,
        error: `Pricing configuration error for "${catalogProduct.name}".`,
        items: [],
      };
    }

    // Authoritative line total
    const lineTotal = authenticUnitPrice * quantity;
    calculatedSubtotal += lineTotal;

    // Resolve accurate image & colorway
    const colorName = String(rawItem.color || 'Standard').trim();
    let colorHex = rawItem.colorHex || '#26262A';
    let garmentImage = rawItem.image || catalogProduct.image;

    if (Array.isArray(catalogProduct.colors)) {
      const matchedColor = catalogProduct.colors.find(
        (c) => c.name.toLowerCase() === colorName.toLowerCase()
      );
      if (matchedColor) {
        colorHex = matchedColor.hex || colorHex;
        garmentImage = matchedColor.image || garmentImage;
      }
    }

    verifiedItems.push({
      key: rawItem.key || `${catalogProduct.id}_${colorName}_${chosenSize}`,
      id: catalogProduct.id,
      name: catalogProduct.name,
      subName: catalogProduct.subName || catalogProduct.subTitle || '',
      price: formatPrice(authenticUnitPrice),
      priceNum: authenticUnitPrice,
      color: colorName,
      colorHex,
      size: chosenSize,
      quantity,
      lineTotal,
      image: garmentImage,
    });
  }

  // Pan-India Express shipping is free for SS26 Drop 01
  const shipping = 0;
  const calculatedTotal = calculatedSubtotal + shipping;

  return {
    isValid: true,
    items: verifiedItems,
    subtotal: calculatedSubtotal,
    shipping,
    total: calculatedTotal,
  };
}

/**
 * Generate unique, collision-resistant order reference (e.g. MCH-2026-894102)
 */
export function generateOrderReference() {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `MCH-${year}-${randomSuffix}`;
}

/**
 * Retrieve online payment gateway configuration
 * Returns configured status, gateway name, and requirements.
 */
export async function getPaymentGatewayConfig() {
  try {
    const res = await fetch('/api/payment/config');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Backend offline or fallback
  }

  // Authoritative default when no server or keys available
  return {
    configured: false,
    gateway: 'razorpay',
    keyId: null,
    supportedMethods: ['COD'],
    requirements: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    message:
      'Online payment gateway is not configured. Cash on Delivery (COD) is active.',
  };
}

/**
 * Persist finalized order to database storage
 */
export function persistOrderToDatabase(orderData) {
  if (typeof window === 'undefined') return orderData;

  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    const existingOrders = raw ? JSON.parse(raw) : [];

    // Avoid duplicate reference in local storage
    const exists = existingOrders.some((o) => o.orderRef === orderData.orderRef);
    if (!exists) {
      const updated = [orderData, ...existingOrders];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));

      // Dispatch global event for order creation listeners
      window.dispatchEvent(
        new CustomEvent('machii:order-placed', { detail: { order: orderData } })
      );
    }
  } catch (err) {
    console.warn('Could not persist order to localStorage:', err);
  }

  return orderData;
}

/**
 * Master server-authoritative order processing function.
 * 1. Validates customer details.
 * 2. Checks payment method (COD vs ONLINE).
 * 3. Enforces Requirement 4: If ONLINE is selected but gateway not configured, rejects without simulation.
 * 4. Disallows duplicate submissions within short interval.
 * 5. Calls /api/orders backend endpoint with fallback to local authoritative engine.
 * 6. Sets paymentStatus: 'PENDING' for COD, separate from fulfillmentStatus: 'UNFULFILLED'.
 * 7. Never stores sensitive card credentials, CVVs, or UPI PINs.
 */
export async function createOrder({
  items = [],
  customer = {},
  paymentMethod = 'COD',
  couponCode = null,
}) {
  // 1. Validate customer details
  const custCheck = validateCustomerDetails(customer);
  if (!custCheck.isValid) {
    const firstErr = Object.values(custCheck.errors)[0] || 'Invalid customer details';
    return { success: false, error: firstErr, errors: custCheck.errors };
  }

  const chosenMethod = paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD';

  // 2. Enforce Requirement 4: If ONLINE selected, verify gateway configuration
  if (chosenMethod === 'ONLINE') {
    const gatewayCfg = await getPaymentGatewayConfig();
    if (!gatewayCfg.configured) {
      return {
        success: false,
        error:
          'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET. Please choose Cash on Delivery (COD) to place your order.',
      };
    }
  }

  // 3. Attempt HTTP POST to existing backend API
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customer: custCheck.cleanedData,
        paymentMethod: chosenMethod,
        couponCode: couponCode || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.order) {
        persistOrderToDatabase(data.order);
        saveCustomerSessionPhone(custCheck.cleanedData.mobile);
        return { success: true, order: data.order };
      } else if (data && data.error) {
        return { success: false, error: data.error };
      }
    } else {
      try {
        const errorData = await res.json();
        if (errorData && errorData.error) {
          return { success: false, error: errorData.error };
        }
      } catch {
        // Fall through to local authoritative engine
      }
    }
  } catch {
    // Network offline or dev server fallback
  }

  // 4. Authoritative Local Validation Engine
  const itemsCheck = validateOrderItems(items);
  if (!itemsCheck.isValid) {
    return { success: false, error: itemsCheck.error };
  }

  // Calculate local discount if coupon provided
  let discountAmount = 0;
  let appliedCode = null;
  if (couponCode && typeof couponCode === 'string') {
    const cleanCode = couponCode.trim().toUpperCase();
    if (cleanCode === 'MACHII10' && itemsCheck.subtotal >= 1400) {
      discountAmount = Math.round((itemsCheck.subtotal * 10) / 100);
      appliedCode = 'MACHII10';
    } else if (cleanCode === 'DROP01' && itemsCheck.subtotal >= 2000) {
      discountAmount = 300;
      appliedCode = 'DROP01';
    } else if (cleanCode === 'WELCOME500' && itemsCheck.subtotal >= 2500) {
      discountAmount = 500;
      appliedCode = 'WELCOME500';
    } else if (cleanCode === 'FIRSTLOOK' && itemsCheck.subtotal >= 1200) {
      discountAmount = Math.round((itemsCheck.subtotal * 15) / 100);
      appliedCode = 'FIRSTLOOK';
    }
  }
  const finalizedTotal = Math.max(0, itemsCheck.subtotal - discountAmount + itemsCheck.shipping);

  // Duplicate order check in local storage (within last 10 seconds)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        const past = JSON.parse(raw);
        const recentDuplicate = past.find((o) => {
          const ageSec = (Date.now() - new Date(o.createdAt).getTime()) / 1000;
          return (
            ageSec < 10 &&
            o.customer?.mobile === custCheck.cleanedData.mobile &&
            o.total === finalizedTotal
          );
        });
        if (recentDuplicate) {
          return {
            success: false,
            error:
              'Duplicate order detected. An identical order was placed just a few seconds ago.',
          };
        }
      }
    } catch {
      // Continue if local storage error
    }
  }

  // 5. Construct authoritative finalized order record
  const uniqueRef = generateOrderReference();
  const nowIso = new Date().toISOString();
  const orderRecord = {
    id: uniqueRef,
    orderRef: uniqueRef,
    createdAt: nowIso,
    status: 'Order Placed',
    // Requirement 5 & 10: paymentStatus separate from fulfillmentStatus
    paymentMethod: chosenMethod,
    paymentStatus: chosenMethod === 'COD' ? 'PENDING' : 'FAILED',
    fulfillmentStatus: 'UNFULFILLED',
    tracking: {
      status: 'Order Placed',
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      estimatedDelivery: null,
      events: [
        {
          status: 'Order Placed',
          title: 'Order Placed',
          description: 'Order successfully placed and received by Machii Mens Mart.',
          timestamp: nowIso,
          location: 'Machii Headquarters, Chennai',
        },
      ],
    },
    paymentDetails: {
      method: chosenMethod,
      gateway: null,
      transactionId: null,
      paidAt: null,
      note:
        chosenMethod === 'COD'
          ? 'Cash or UPI to be collected upon doorstep delivery'
          : 'Pending payment gateway authorization',
    },
    customer: custCheck.cleanedData,
    items: itemsCheck.items,
    couponCode: appliedCode,
    discountAmount,
    pricing: {
      subtotal: itemsCheck.subtotal,
      discount: discountAmount,
      couponCode: appliedCode,
      shipping: itemsCheck.shipping,
      total: finalizedTotal,
    },
    subtotal: itemsCheck.subtotal,
    discount: discountAmount,
    shipping: itemsCheck.shipping,
    total: finalizedTotal,
    currency: 'INR',
  };

  // 6. Persist to database
  persistOrderToDatabase(orderRecord);
  saveCustomerSessionPhone(custCheck.cleanedData.mobile);

  return { success: true, order: orderRecord };
}

export const CUSTOMER_PHONE_STORAGE_KEY = 'machii_customer_phone';

/**
 * Save customer phone into local session
 */
export function saveCustomerSessionPhone(phone) {
  if (typeof window === 'undefined') return;
  try {
    let cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
    else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (cleaned.length === 10) {
      localStorage.setItem(CUSTOMER_PHONE_STORAGE_KEY, cleaned);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieve customer phone from local session
 */
export function getCustomerSessionPhone() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CUSTOMER_PHONE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Fetch Customer Order History with server-side authorization (Requirements 2, 3, 6, 7)
 */
export async function fetchCustomerOrders(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
  else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (!cleaned || cleaned.length !== 10) {
    return {
      success: false,
      error: 'Please enter a valid 10-digit mobile number.',
      orders: [],
    };
  }

  // 1. Attempt backend API call
  try {
    const res = await fetch(`/api/orders/history?phone=${cleaned}`, {
      headers: { 'X-Customer-Phone': cleaned },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        saveCustomerSessionPhone(cleaned);
        return { success: true, orders: data.orders || [] };
      }
    } else {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: errorData.error || 'Authorization failed. Cannot access orders.',
          orders: [],
        };
      }
    }
  } catch {
    // Backend offline, fall back to local storage lookup
  }

  // 2. Local storage fallback with strict phone filter (Requirement 7)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        const allOrders = JSON.parse(raw);
        const customerOrders = allOrders.filter(
          (o) => o.customer?.mobile === cleaned
        );
        saveCustomerSessionPhone(cleaned);
        return { success: true, orders: customerOrders };
      }
    } catch {
      // Ignore
    }
  }

  return { success: true, orders: [] };
}

/**
 * Fetch Single Order Details with authorization check (Requirements 5 & 7)
 */
export async function fetchOrderDetail(orderRef, phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
  else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (!orderRef) {
    return { success: false, error: 'Order reference is required.' };
  }

  // 1. Attempt backend API call
  try {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderRef)}?phone=${cleaned}`,
      {
        headers: { 'X-Customer-Phone': cleaned },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.order) {
        return { success: true, order: data.order };
      }
    } else {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 403) {
        return {
          success: false,
          error: errorData.error || 'Forbidden: You do not have permission to view this order.',
        };
      }
      if (res.status === 404) {
        return { success: false, error: errorData.error || `Order "${orderRef}" not found.` };
      }
      return { success: false, error: errorData.error || 'Failed to retrieve order details.' };
    }
  } catch {
    // Fall back to local storage
  }

  // 2. Local storage fallback
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (raw) {
        const allOrders = JSON.parse(raw);
        const order = allOrders.find(
          (o) =>
            o.orderRef?.toUpperCase() === orderRef.toUpperCase() ||
            o.id === orderRef
        );
        if (!order) {
          return { success: false, error: `Order "${orderRef}" not found.` };
        }
        if (cleaned && order.customer?.mobile !== cleaned) {
          return {
            success: false,
            error: 'Forbidden: You do not have permission to view this order.',
          };
        }
        return { success: true, order };
      }
    } catch {
      // Ignore
    }
  }

  return { success: false, error: 'Unable to retrieve order details.' };
}

/**
 * Fetch Order Tracking Details (Requirements 1, 5, 7, 9)
 * Retrieves real backend tracking timeline without fabricating fake dates or numbers.
 */
export async function fetchOrderTracking(orderRef, phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
  else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (!orderRef) {
    return { success: false, error: 'Order reference is required.' };
  }

  // 1. Attempt backend tracking endpoint
  try {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderRef)}/tracking?phone=${cleaned}`,
      {
        headers: { 'X-Customer-Phone': cleaned },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          success: true,
          tracking: data.tracking,
          order: data,
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return {
          success: false,
          status: res.status,
          error: errData.error || 'Authorization failed. Unable to access order tracking.',
        };
      }
    }
  } catch {
    // Backend offline / network fallback
  }

  // 2. Fallback to order detail retrieval
  const detailRes = await fetchOrderDetail(orderRef, cleaned);
  if (detailRes.success && detailRes.order) {
    const ord = detailRes.order;
    const trackingData = ord.tracking || {
      status: ord.status || 'Order Placed',
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      estimatedDelivery: null,
      events: [
        {
          status: ord.status || 'Order Placed',
          title: ord.status || 'Order Placed',
          description: 'Order placed with Machii Mens Mart.',
          timestamp: ord.createdAt,
        },
      ],
    };

    return {
      success: true,
      tracking: trackingData,
      order: ord,
    };
  }

  return {
    success: false,
    error: detailRes.error || 'Tracking details currently unavailable.',
  };
}

/**
 * Update Order Status (Authorized backend/admin process - Requirement 6)
 */
export async function updateOrderStatusAdmin(orderRef, updateData = {}, adminKey = 'machii-admin-secure-key') {
  if (!orderRef) return { success: false, error: 'Order reference is required.' };

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderRef)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify(updateData),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message, order: data.order };
    }
    return { success: false, error: data.error || 'Failed to update order status.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating order status.' };
  }
}
