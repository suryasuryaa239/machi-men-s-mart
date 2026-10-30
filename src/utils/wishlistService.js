/* ==========================================================================
   MACHII MENS MART — CUSTOMER WISHLIST & SAVE-FOR-LATER SERVICE
   STEP 12: Wishlist state synchronization, guest persistence, backend sync,
   duplicate prevention, stock availability enrichment, and move-to-cart.
   ========================================================================== */

import { COLLECTION_PRODUCTS, PRODUCTS } from '../data/products.js';
import { getCustomerSessionPhone } from './orderService.js';

export const GUEST_WISHLIST_STORAGE_KEY = 'machii_guest_wishlist';

/**
 * Retrieve guest wishlist items from localStorage
 */
export function getGuestWishlist() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist guest wishlist items to localStorage
 */
export function saveGuestWishlist(items = []) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_WISHLIST_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent('machii:wishlist-update', {
        detail: { count: items.length, items },
      })
    );
  } catch (err) {
    console.warn('[Machii Wishlist] Failed to save guest wishlist:', err);
  }
}

/**
 * Enriches local product item from static catalog if backend data is not yet attached
 */
export function enrichLocalProduct(productId, colorName, _size) {
  const targetId = String(productId || '').trim().toLowerCase();
  const prod =
    COLLECTION_PRODUCTS.find(
      (p) => p.id.toLowerCase() === targetId || p.collectionId?.toLowerCase() === targetId
    ) ||
    PRODUCTS.find(
      (p) => p.id.toLowerCase() === targetId || p.collectionId?.toLowerCase() === targetId
    );

  if (prod) {
    const activeColor =
      prod.colors?.find((c) => c.name.toLowerCase() === String(colorName || '').toLowerCase()) ||
      prod.colors?.[0] ||
      null;

    return {
      id: prod.id,
      name: prod.name,
      subName: prod.subTitle || prod.subName || '',
      price: prod.price,
      originalPrice: prod.originalPrice || '',
      description: prod.description || '',
      image: activeColor?.image || prod.image,
      colors: prod.colors || [],
      sizes: prod.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
      fit: prod.fit || 'Boxy Oversized Fit',
      gsm: prod.gsm || '240 GSM',
      stock: 12,
      isActive: true,
      isAvailable: true,
      isDeleted: false,
    };
  }

  return {
    id: productId,
    name: 'Streetwear Fit',
    subName: 'Limited Edition Drop',
    price: '₹1,499',
    originalPrice: '₹2,499',
    image: '/assets/products/machii-attitude-01-charcoal.png',
    colors: [],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 0,
    isActive: false,
    isAvailable: false,
    isDeleted: false,
  };
}

/**
 * Fetch Wishlist Items (Authenticated backend if phone provided, else Guest local)
 */
export async function fetchWishlist(phoneOverride) {
  const phone = phoneOverride || getCustomerSessionPhone();

  // If customer is authenticated, fetch authoritative list from backend
  if (phone) {
    try {
      const response = await fetch(`/api/wishlist?phone=${encodeURIComponent(phone)}`, {
        headers: {
          'X-Customer-Phone': phone,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          // Cache to local customer key for resilient offline access
          if (typeof window !== 'undefined') {
            localStorage.setItem(`machii_user_wishlist_${phone}`, JSON.stringify(data.items));
            window.dispatchEvent(
              new CustomEvent('machii:wishlist-update', {
                detail: { count: data.items.length, items: data.items },
              })
            );
          }
          return { success: true, count: data.count, items: data.items };
        }
      }
    } catch (err) {
      console.warn('[Machii Wishlist] Server fetch failed, falling back to cached:', err);
    }

    // Offline cache fallback for authenticated user
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`machii_user_wishlist_${phone}`);
        if (cached) {
          const items = JSON.parse(cached);
          return { success: true, count: items.length, items };
        }
      } catch {
        // Fall through to guest
      }
    }
  }

  // Guest fallback
  const guestItems = getGuestWishlist().map((it) => {
    if (!it.product) {
      it.product = enrichLocalProduct(it.productId, it.selectedColor, it.selectedSize);
    }
    return it;
  });

  return { success: true, count: guestItems.length, items: guestItems };
}

/**
 * Add product to Wishlist (Duplicate-safe)
 */
export async function addToWishlist(product, colorObj, size, phoneOverride) {
  if (!product || !product.id) return { success: false, error: 'Invalid product' };

  const phone = phoneOverride || getCustomerSessionPhone();
  const prodId = product.id;
  const colorName = typeof colorObj === 'string' ? colorObj : colorObj?.name || product.colors?.[0]?.name || 'Standard';
  const selectedSize = size || product.sizes?.[0] || 'L';

  // 1. Authenticated user path: sync to backend
  if (phone) {
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Phone': phone,
        },
        body: JSON.stringify({
          productId: prodId,
          selectedColor: colorName,
          selectedSize,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`machii_user_wishlist_${phone}`, JSON.stringify(data.items));
            window.dispatchEvent(
              new CustomEvent('machii:wishlist-update', {
                detail: { count: data.items.length, items: data.items },
              })
            );
          }
          return data;
        }
      }
    } catch (err) {
      console.warn('[Machii Wishlist] Server add failed, applying local fallback:', err);
    }
  }

  // 2. Guest fallback path (or offline fallback)
  const currentGuest = getGuestWishlist();
  const existing = currentGuest.find(
    (it) => it.productId.toLowerCase() === prodId.toLowerCase()
  );

  if (existing) {
    return {
      success: true,
      duplicate: true,
      message: 'Product is already in your wishlist.',
      count: currentGuest.length,
      items: currentGuest,
    };
  }

  const newItem = {
    id: `wsh_guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    productId: prodId,
    selectedColor: colorName,
    selectedSize,
    addedAt: new Date().toISOString(),
    product: {
      id: product.id,
      name: product.name,
      subName: product.subTitle || product.subName || '',
      price: product.price,
      originalPrice: product.originalPrice || '',
      description: product.description || '',
      image: (typeof colorObj === 'object' && colorObj?.image) || product.image,
      colors: product.colors || [],
      sizes: product.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
      fit: product.fit || 'Boxy Oversized Fit',
      gsm: product.gsm || '240 GSM',
      stock: typeof product.stock === 'number' ? product.stock : 12,
      isActive: true,
      isAvailable: true,
      isDeleted: false,
    },
  };

  const updated = [newItem, ...currentGuest];
  saveGuestWishlist(updated);

  return {
    success: true,
    message: 'Added to wishlist.',
    count: updated.length,
    items: updated,
  };
}

/**
 * Remove product from Wishlist
 */
export async function removeFromWishlist(productId, phoneOverride) {
  if (!productId) return { success: false, error: 'Product ID required' };

  const phone = phoneOverride || getCustomerSessionPhone();

  // 1. Authenticated user path
  if (phone) {
    try {
      const response = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: {
          'X-Customer-Phone': phone,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`machii_user_wishlist_${phone}`, JSON.stringify(data.items));
            window.dispatchEvent(
              new CustomEvent('machii:wishlist-update', {
                detail: { count: data.items.length, items: data.items },
              })
            );
          }
          return data;
        }
      }
    } catch (err) {
      console.warn('[Machii Wishlist] Server remove failed, applying local fallback:', err);
    }
  }

  // 2. Guest fallback path
  const currentGuest = getGuestWishlist();
  const updated = currentGuest.filter(
    (it) => it.productId.toLowerCase() !== productId.toLowerCase() && it.id !== productId
  );
  saveGuestWishlist(updated);

  return {
    success: true,
    message: 'Removed from wishlist.',
    count: updated.length,
    items: updated,
  };
}

/**
 * Clear entire Wishlist
 */
export async function clearWishlist(phoneOverride) {
  const phone = phoneOverride || getCustomerSessionPhone();

  if (phone) {
    try {
      await fetch('/api/wishlist/clear', {
        method: 'DELETE',
        headers: {
          'X-Customer-Phone': phone,
        },
      });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`machii_user_wishlist_${phone}`);
      }
    } catch {
      // Ignore
    }
  }

  saveGuestWishlist([]);
  return { success: true, count: 0, items: [] };
}

/**
 * Merge Guest Wishlist items into Authenticated Customer Account
 */
export async function mergeGuestWishlist(phone) {
  if (!phone) return { success: false, error: 'Phone required' };

  const guestItems = getGuestWishlist();
  if (guestItems.length === 0) {
    return fetchWishlist(phone);
  }

  try {
    const response = await fetch('/api/wishlist/merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Phone': phone,
      },
      body: JSON.stringify({ guestItems }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Clear guest items now that they are merged
        saveGuestWishlist([]);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`machii_user_wishlist_${phone}`, JSON.stringify(data.items));
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('[Machii Wishlist] Merge request failed:', err);
  }

  return fetchWishlist(phone);
}

/**
 * Check if a product ID exists in the given wishlist items
 */
export function isProductInWishlist(items = [], productId) {
  if (!productId || !Array.isArray(items)) return false;
  const target = String(productId).trim().toLowerCase();
  return items.some((it) => it.productId?.toLowerCase() === target || it.product?.id?.toLowerCase() === target);
}
