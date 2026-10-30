/* =====================================================================
   MACHII MENS MART — CART STORAGE & PRICE CALCULATIONS
   Persistent local storage management and currency helpers.
   ===================================================================== */

export const CART_STORAGE_KEY = 'machii_cart_items_ss26';

/**
 * Safely parse integer price from currency string (e.g. "₹1,499" -> 1499)
 */
export const parsePrice = (priceVal) => {
  if (typeof priceVal === 'number') return Math.max(0, Math.round(priceVal));
  if (!priceVal) return 0;
  const digits = String(priceVal).replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
};

/**
 * Format numeric price to Indian Rupee currency string (e.g. 1499 -> "₹1,499")
 */
export const formatPrice = (amount) => {
  const num = typeof amount === 'number' ? amount : parsePrice(amount);
  return '₹' + num.toLocaleString('en-IN');
};

/**
 * Generate unique composite key for a product variant (id + color + size)
 */
export const getCartItemKey = (id, color, size) => {
  const safeId = String(id || 'garment').trim();
  const safeColor = String(color || 'Standard').trim().toLowerCase();
  const safeSize = String(size || 'L').trim().toUpperCase();
  return `${safeId}_${safeColor}_${safeSize}`;
};

/**
 * Read cart items array safely from localStorage
 */
export const loadCartFromStorage = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse cart from localStorage:', err);
    return [];
  }
};

/**
 * Save cart items array to localStorage
 */
export const saveCartToStorage = (items) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save cart to localStorage:', err);
  }
};

/**
 * Calculate total quantity count of all items in cart
 */
export const calculateCartCount = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
};

/**
 * Calculate subtotal based on real prices and quantities
 */
export const calculateCartSubtotal = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const unitPrice = parsePrice(item.price);
    const qty = Number(item.quantity) || 1;
    return sum + unitPrice * qty;
  }, 0);
};
