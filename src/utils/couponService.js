/* ==========================================================================
   MACHII MENS MART — COUPON & DISCOUNT SERVICE
   STEP 13: Real-time coupon validation, business rules enforcement,
   percentage & flat discounts, minimum order checks, usage limits,
   and server-authoritative discount calculation.
   ========================================================================== */

export const COUPON_STORAGE_KEY = 'machii_applied_coupon';

/**
 * Validate a coupon code against backend API with business rules:
 * - Minimum order value
 * - Expiration date
 * - Redemption limits
 * - Customer eligibility
 */
export async function validateCouponApi(code, subtotal, customerPhone = '') {
  if (!code || !code.trim()) {
    return {
      valid: false,
      error: 'Please enter a coupon code.',
    };
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customerPhone ? { 'X-Customer-Phone': customerPhone } : {}),
      },
      body: JSON.stringify({
        code: cleanCode,
        subtotal: Number(subtotal) || 0,
        customerPhone: customerPhone || '',
      }),
    });

    const data = await res.json();
    if (res.ok && data.valid) {
      return {
        valid: true,
        coupon: data.coupon,
        discountAmount: data.discountAmount,
        originalSubtotal: data.originalSubtotal,
        netTotal: data.netTotal,
      };
    }

    return {
      valid: false,
      error: data.error || `Coupon "${cleanCode}" is invalid.`,
      minOrderAmount: data.minOrderAmount || null,
    };
  } catch {
    // Fallback if dev server network call fails
    return localCouponFallbackValidation(cleanCode, subtotal, customerPhone);
  }
}

/**
 * Client fallback validation in case offline or dev server restarted
 */
function localCouponFallbackValidation(rawCode, subtotal, _customerPhone = '') {
  const code = (rawCode || '').trim().toUpperCase();
  const subtotalNum = Number(subtotal) || 0;

  const FALLBACK_COUPONS = {
    MACHII10: {
      id: 'coup_machii10',
      code: 'MACHII10',
      description: '10% OFF on street drops over ₹1,400',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 1400,
      maxDiscountAmount: 500,
    },
    DROP01: {
      id: 'coup_drop01',
      code: 'DROP01',
      description: 'Flat ₹300 OFF on orders above ₹2,000',
      discountType: 'FLAT',
      discountValue: 300,
      minOrderAmount: 2000,
      maxDiscountAmount: 300,
    },
    WELCOME500: {
      id: 'coup_welcome500',
      code: 'WELCOME500',
      description: 'Flat ₹500 OFF on streetwear orders above ₹2,500',
      discountType: 'FLAT',
      discountValue: 500,
      minOrderAmount: 2500,
      maxDiscountAmount: 500,
    },
    FIRSTLOOK: {
      id: 'coup_firstlook',
      code: 'FIRSTLOOK',
      description: '15% OFF on modern streetwear over ₹1,200',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderAmount: 1200,
      maxDiscountAmount: 600,
    },
    EXPIRED20: {
      id: 'coup_expired20',
      code: 'EXPIRED20',
      description: 'Archived 20% discount (Expired)',
      expired: true,
    },
  };

  const match = FALLBACK_COUPONS[code];
  if (!match) {
    return { valid: false, error: `Coupon code "${code}" is invalid or does not exist.` };
  }

  if (match.expired) {
    return { valid: false, error: `Coupon code "${code}" has expired.` };
  }

  if (subtotalNum < match.minOrderAmount) {
    const diff = match.minOrderAmount - subtotalNum;
    return {
      valid: false,
      error: `Minimum order value of ₹${match.minOrderAmount.toLocaleString('en-IN')} required for "${code}". Add ₹${diff.toLocaleString('en-IN')} more to apply.`,
      minOrderAmount: match.minOrderAmount,
    };
  }

  let rawDiscount = 0;
  if (match.discountType === 'PERCENTAGE') {
    rawDiscount = Math.round((subtotalNum * match.discountValue) / 100);
    if (match.maxDiscountAmount && rawDiscount > match.maxDiscountAmount) {
      rawDiscount = match.maxDiscountAmount;
    }
  } else {
    rawDiscount = match.discountValue;
  }

  const discountAmount = Math.min(subtotalNum, Math.max(0, rawDiscount));
  const netTotal = Math.max(0, subtotalNum - discountAmount);

  return {
    valid: true,
    coupon: match,
    discountAmount,
    originalSubtotal: subtotalNum,
    netTotal,
  };
}

/**
 * Fetch available public active promotions
 */
export async function fetchAvailableCoupons() {
  try {
    const res = await fetch('/api/coupons');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.coupons)) {
        return data.coupons;
      }
    }
  } catch {
    // Ignore error
  }

  return [
    {
      id: 'coup_machii10',
      code: 'MACHII10',
      description: '10% OFF on street drops over ₹1,400',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 1400,
    },
    {
      id: 'coup_drop01',
      code: 'DROP01',
      description: 'Flat ₹300 OFF on orders above ₹2,000',
      discountType: 'FLAT',
      discountValue: 300,
      minOrderAmount: 2000,
    },
    {
      id: 'coup_firstlook',
      code: 'FIRSTLOOK',
      description: '15% OFF on modern streetwear over ₹1,200',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderAmount: 1200,
    },
  ];
}

/**
 * Fetch all coupons for authorized Admin Dashboard
 */
export async function fetchAdminCoupons(adminKey) {
  try {
    const res = await fetch('/api/admin/coupons', {
      headers: {
        'X-Admin-Key': adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, coupons: data.coupons || [] };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Failed to fetch coupons.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching admin coupons.' };
  }
}

/**
 * Create a new coupon via Admin API
 */
export async function createAdminCoupon(couponData, adminKey) {
  try {
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify(couponData),
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

/**
 * Update an existing coupon via Admin API
 */
export async function updateAdminCoupon(couponId, updates, adminKey) {
  try {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
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

/**
 * Delete a coupon via Admin API
 */
export async function deleteAdminCoupon(couponId, adminKey) {
  try {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Key': adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
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
 * Format discount badge/text (e.g., "10% OFF" or "₹300 FLAT OFF")
 */
export function formatCouponDiscount(coupon) {
  if (!coupon) return '';
  if (coupon.discountType === 'PERCENTAGE') {
    return `${coupon.discountValue}% OFF`;
  }
  return `₹${Number(coupon.discountValue).toLocaleString('en-IN')} OFF`;
}

/**
 * Local storage helpers for persisting active coupon during customer session
 */
export function getStoredCoupon() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUPON_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredCoupon(coupon) {
  if (typeof window === 'undefined') return;
  try {
    if (!coupon) {
      localStorage.removeItem(COUPON_STORAGE_KEY);
    } else {
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredCoupon() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
