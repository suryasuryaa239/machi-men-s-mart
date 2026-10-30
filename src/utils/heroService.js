/**
 * MACHII MENS MART — DYNAMIC HERO SHOWCASE SERVICE
 * Allows admin to configure, add, update, and reorder hero garments
 * with front and back photography, pricing, labels, and colorways.
 */

export const HERO_STORAGE_KEY = 'machii_hero_products_v2';

export const DEFAULT_HERO_PRODUCTS = [
  {
    id: 'garment-sage',
    collectionId: 'prod-everyday-heavyweight',
    name: 'Drop 01 Oversized Tee',
    label: 'LIMITED RUN',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.0,
    ar: 1.34,
    front: '/assets/products/machii-drop01-sage.png',
    back: '/assets/products/machii-drop01-sage-back.png',
    colors: [
      {
        name: 'Olive Sage',
        hex: '#5d5c4a',
        front: '/assets/products/machii-drop01-sage.png',
        back: '/assets/products/machii-drop01-sage-back.png',
      },
      {
        name: 'Washed Charcoal',
        hex: '#26262A',
        front: '/assets/products/machii-attitude-01-charcoal.png',
        back: '/assets/products/machii-drop01-sage-back.png',
      },
    ],
  },
  {
    id: 'prod-street-culture',
    collectionId: 'prod-street-culture',
    name: 'Street Culture Oversized Tee',
    label: '-20%',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.0,
    ar: 1.34,
    front: '/assets/products/machii-retro-cream.png',
    back: '/assets/products/machii-retro-cream-back.png',
    colors: [
      {
        name: 'Vintage Cream',
        hex: '#aca190',
        front: '/assets/products/machii-retro-cream.png',
        back: '/assets/products/machii-retro-cream-back.png',
      },
      {
        name: 'Bone White',
        hex: '#F5EFE3',
        front: '/assets/products/machii-tokyo-bone.png',
        back: '/assets/products/machii-retro-cream-back.png',
      },
    ],
  },
  {
    id: 'garment-featured-attitude',
    collectionId: 'prod-essential-oversized',
    name: 'Attitude 01 Oversized Tee',
    label: 'FLAGSHIP',
    price: '₹1,499',
    originalPrice: '₹2,499',
    desc: '280 GSM heavyweight cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.0,
    ar: 1.34,
    front: '/assets/products/machii-attitude-01-charcoal.png',
    back: '/assets/products/machii-attitude-01-back.png',
    colors: [
      {
        name: 'Washed Black',
        hex: '#222221',
        front: '/assets/products/machii-attitude-01-charcoal.png',
        back: '/assets/products/machii-attitude-01-back.png',
      },
      {
        name: 'Charcoal Grey',
        hex: '#484846',
        front: '/assets/products/machii-tokyo-bone.png',
        back: '/assets/products/machii-attitude-01-back.png',
      },
    ],
  },
  {
    id: 'garment-cobalt',
    collectionId: 'prod-midnight-graphic',
    name: 'Mens Mart Oversized Tee',
    label: 'NEW DROP',
    price: '₹1,499',
    originalPrice: '₹2,299',
    desc: '280 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.0,
    ar: 1.34,
    front: '/assets/products/machii-cyber-cobalt.png',
    back: '/assets/products/machii-cyber-cobalt-back.png',
    colors: [
      {
        name: 'Royal Cobalt',
        hex: '#06377f',
        front: '/assets/products/machii-cyber-cobalt.png',
        back: '/assets/products/machii-cyber-cobalt-back.png',
      },
      {
        name: 'Mineral Slate',
        hex: '#384252',
        front: '/assets/products/machii-attitude-01-charcoal.png',
        back: '/assets/products/machii-cyber-cobalt-back.png',
      },
    ],
  },
  {
    id: 'garment-bone',
    collectionId: 'prod-retro-print',
    name: 'Tokyo Energy Oversized Tee',
    label: 'POPULAR',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.0,
    ar: 1.34,
    front: '/assets/products/machii-tokyo-bone.png',
    back: '/assets/products/machii-tokyo-bone-back.png',
    colors: [
      {
        name: 'Bone Off-White',
        hex: '#a6a5a0',
        front: '/assets/products/machii-tokyo-bone.png',
        back: '/assets/products/machii-tokyo-bone-back.png',
      },
      {
        name: 'Vintage Cream',
        hex: '#F5EFE3',
        front: '/assets/products/machii-retro-cream.png',
        back: '/assets/products/machii-tokyo-bone-back.png',
      },
    ],
  },
];

/**
 * Standardize hero product structure
 */
export function normalizeHeroProduct(p, idx = 0) {
  const primaryFront = p.front || p.image || (p.colors && p.colors[0]?.front) || '/hero/img/machii-black.png';
  const primaryBack = p.back || p.backImage || (p.colors && p.colors[0]?.back) || primaryFront;
  const primaryColorName = (p.colors && p.colors[0]?.name) || p.color || 'Standard';
  const primaryColorHex = (p.colors && p.colors[0]?.hex) || p.colorHex || '#222221';

  const colors = Array.isArray(p.colors) && p.colors.length > 0
    ? p.colors.map((c) => ({
        name: c.name || 'Color',
        hex: c.hex || '#333333',
        front: c.front || c.image || primaryFront,
        back: c.back || c.backImage || primaryBack,
      }))
    : [
        {
          name: primaryColorName,
          hex: primaryColorHex,
          front: primaryFront,
          back: primaryBack,
        },
      ];

  return {
    id: p.id || `hero_${Date.now()}_${idx}`,
    collectionId: p.collectionId || p.id || '',
    name: p.name || `Hero Piece #${idx + 1}`,
    label: p.label || p.badge || '',
    price: p.price || '₹1,499',
    originalPrice: p.originalPrice || '₹2,299',
    desc: p.desc || p.description || '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: typeof p.rel === 'number' && !Number.isNaN(p.rel) ? p.rel : 1.0,
    ar: typeof p.ar === 'number' && !Number.isNaN(p.ar) ? p.ar : 1.34,
    front: primaryFront,
    back: primaryBack,
    colors,
    ci: 0,
  };
}

/**
 * Get synchronously from local storage or defaults
 */
export function getStoredHeroProducts() {
  if (typeof window === 'undefined') return DEFAULT_HERO_PRODUCTS;
  try {
    const raw = localStorage.getItem(HERO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p, idx) => normalizeHeroProduct(p, idx));
      }
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_HERO_PRODUCTS.map((p, idx) => normalizeHeroProduct(p, idx));
}

/**
 * Fetch hero products from API with fallback to localStorage
 */
export async function fetchHeroProducts() {
  try {
    const res = await fetch('/api/hero-products');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
        const normalized = data.products.map((p, idx) => normalizeHeroProduct(p, idx));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(normalized));
          } catch {}
        }
        return { success: true, products: normalized };
      }
    }
  } catch {
    // Backend offline or dev mode
  }

  const local = getStoredHeroProducts();
  return { success: true, products: local };
}

/**
 * Save hero products (Admin operation)
 */
export async function saveHeroProducts(products, token = null) {
  if (!Array.isArray(products) || products.length === 0) {
    return { success: false, error: 'Hero Showcase requires at least one product.' };
  }

  const normalized = products.map((p, idx) => normalizeHeroProduct(p, idx));

  // 1. Save to local storage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      console.warn('Could not save hero products to localStorage:', err);
    }
  }

  // 2. Dispatch custom event for instant live storefront sync
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('machii:hero-products-updated', { detail: { products: normalized } })
    );
  }

  // 3. Save to backend API
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/admin/hero-products', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ products: normalized }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, products: data.products || normalized };
    }
  } catch {
    // Fall back to local saved state
  }

  return { success: true, products: normalized };
}

/**
 * Reset hero products to factory default
 */
export async function resetHeroProducts(token = null) {
  return saveHeroProducts(DEFAULT_HERO_PRODUCTS, token);
}

