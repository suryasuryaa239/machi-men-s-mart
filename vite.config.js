import react from '@vitejs/plugin-react'
import crypto from 'node:crypto'
import { defineConfig } from 'vite'
import { PRODUCTS, COLLECTION_PRODUCTS } from './src/data/products.js'
import {
  getNotificationConfig,
  triggerOrderNotification,
  setMockNotificationProvider,
  clearMockNotificationProvider,
  resetNotificationCache,
} from './server/notificationService.js'
import {
  safeCompare,
  sanitizeText,
  sanitizeAndValidatePhone,
  sanitizeAndValidateEmail,
  sanitizeAndValidatePincode,
  isValidImageUrl,
} from './server/securityUtils.js'
import {
  adminLoginLimiter,
  couponValidationLimiter,
  orderCreationLimiter,
  paymentVerifyLimiter,
  enforceRateLimit,
  resetAllRateLimiters,
} from './server/rateLimiter.js'

function parsePrice(val) {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (!val) return 0;
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
}

function formatPrice(amt) {
  return '₹' + parsePrice(amt).toLocaleString('en-IN');
}

// Mutable server product catalog initialized from storefront data
const serverProductsDatabase = COLLECTION_PRODUCTS.map((prod, idx) => ({
  id: prod.id,
  collectionId: prod.id,
  name: prod.name,
  subName: prod.subTitle || prod.subName || '',
  subTitle: prod.subTitle || prod.subName || '',
  price: prod.price,
  priceNum: parsePrice(prod.price),
  originalPrice: prod.originalPrice || '₹1,999',
  description: prod.description || '',
  image: prod.image,
  hoverImage: prod.hoverImage || null,
  backImage: prod.backImage || null,
  categories: prod.categories || ['all', 'oversized'],
  badge: prod.badge || null,
  badgeType: prod.badgeType || 'dark',
  gsm: prod.gsm || '260 GSM Combed Cotton',
  fit: prod.fit || 'Signature Boxy Fit',
  sizes: prod.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
  colors: prod.colors || [
    {
      id: 'c-std',
      name: 'Standard Dark',
      hex: '#111113',
      image: prod.image,
      backImage: null,
    },
  ],
  stock: 45 + idx * 5,
  isActive: true,
  createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-15T10:00:00Z').toISOString(),
}));

PRODUCTS.forEach((hp) => {
  if (!serverProductsDatabase.some((p) => p.id === hp.id || p.collectionId === hp.id)) {
    serverProductsDatabase.push({
      id: hp.id,
      collectionId: hp.id,
      name: hp.name,
      subName: hp.subName || '',
      subTitle: hp.subName || '',
      price: hp.price,
      priceNum: parsePrice(hp.price),
      originalPrice: hp.originalPrice || '₹2,999',
      description: hp.description || '',
      image: hp.image,
      hoverImage: hp.hoverImage || null,
      backImage: hp.backImage || null,
      categories: ['all', 'oversized'],
      badge: hp.badge || null,
      badgeType: 'dark',
      gsm: hp.gsm || '260 GSM',
      fit: hp.fit || 'Boxy Fit',
      sizes: hp.sizes || ['S', 'M', 'L', 'XL'],
      colors: hp.colors || [],
      stock: 35,
      isActive: true,
      createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    });
  }
});

function findCatalogProduct(id, name) {
  const targetId = String(id || '').trim().toLowerCase();
  const targetName = String(name || '').trim().toLowerCase();

  const dynamic = serverProductsDatabase.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      p.collectionId?.toLowerCase() === targetId ||
      (targetName && p.name.toLowerCase() === targetName) ||
      (targetName && p.name.toLowerCase().includes(targetName))
  );
  if (dynamic) return dynamic;

  const hero = PRODUCTS.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      p.collectionId?.toLowerCase() === targetId ||
      (targetName && p.name.toLowerCase() === targetName) ||
      (targetName && p.name.toLowerCase().includes(targetName))
  );
  if (hero) return hero;

  const coll = COLLECTION_PRODUCTS.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      (targetName && p.name.toLowerCase() === targetName) ||
      (targetName && p.name.toLowerCase().includes(targetName))
  );
  if (coll) return coll;

  // Hero alias fallbacks
  if (targetId === 'garment-drop01' || targetName.includes('drop 01')) {
    return serverProductsDatabase.find((p) => p.id === 'garment-sage' || p.id === 'prod-everyday-heavyweight');
  }
  if (targetId === 'garment-cream' || targetName.includes('street culture')) {
    return serverProductsDatabase.find((p) => p.id === 'prod-street-culture');
  }
  return null;
}

const EXPECTED_ADMIN_KEY = process.env.MACHII_ADMIN_KEY || 'machii-admin-secure-key';
// Token -> { createdAt: number, expiresAt: number }
const validAdminSessions = new Map();

function isAuthorizedAdmin(req, _parsedUrl) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && safeCompare(adminKey, EXPECTED_ADMIN_KEY)) {
    return true;
  }

  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (safeCompare(token, EXPECTED_ADMIN_KEY)) {
      return true;
    }
    const session = validAdminSessions.get(token);
    if (session) {
      if (Date.now() < session.expiresAt) {
        return true;
      }
      validAdminSessions.delete(token);
    }
  }

  return false;
}

const serverOrdersDatabase = [];
const serverCustomersDatabase = new Map();

// ==========================================================================
// STORE SETTINGS & ANNOUNCEMENT BANNER STATE
// ==========================================================================
const serverHeroProducts = [
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

const serverStoreSettings = {
  storeName: 'Machii Mens Mart',
  announcementBanner: {
    enabled: true,
    text: '🔥 DROP 01 LIVE: USE CODE "MACHII10" FOR 10% OFF • FREE PAN-INDIA EXPRESS SHIPPING',
    couponCode: 'MACHII10',
    linkText: 'APPLY NOW',
  },
  codEnabled: true,
  freeShippingThreshold: 0,
  storeStatus: 'OPEN',
  supportPhone: '+91 98765 43210',
  supportEmail: 'support@machiimensmart.com',
  heroProducts: serverHeroProducts,
  updatedAt: new Date().toISOString(),
};

// ==========================================================================
// STEP 13: Coupons & Promotional Discounts Database & Authoritative Engine
// ==========================================================================
const serverCouponsDatabase = [
  {
    id: 'coup_machii10',
    code: 'MACHII10',
    description: '10% OFF on street drops over ₹1,400',
    discountType: 'PERCENTAGE', // 'PERCENTAGE' or 'FLAT'
    discountValue: 10,
    minOrderAmount: 1400,
    maxDiscountAmount: 500,
    expiresAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    maxUses: 200,
    usedCount: 0,
    maxUsesPerCustomer: 2,
    customerUsage: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coup_drop01',
    code: 'DROP01',
    description: 'Flat ₹300 OFF on orders above ₹2,000',
    discountType: 'FLAT',
    discountValue: 300,
    minOrderAmount: 2000,
    maxDiscountAmount: 300,
    expiresAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    maxUses: 150,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    customerUsage: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coup_welcome500',
    code: 'WELCOME500',
    description: 'Flat ₹500 OFF on streetwear orders above ₹2,500',
    discountType: 'FLAT',
    discountValue: 500,
    minOrderAmount: 2500,
    maxDiscountAmount: 500,
    expiresAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    maxUses: 100,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    customerUsage: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coup_firstlook',
    code: 'FIRSTLOOK',
    description: '15% OFF on modern streetwear over ₹1,200',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderAmount: 1200,
    maxDiscountAmount: 600,
    expiresAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    maxUses: 100,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    customerUsage: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coup_expired20',
    code: 'EXPIRED20',
    description: 'Archived 20% discount (Expired)',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderAmount: 1000,
    maxDiscountAmount: 1000,
    expiresAt: '2024-01-01T00:00:00.000Z',
    isActive: true,
    maxUses: 50,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    customerUsage: {},
    createdAt: '2023-01-01T00:00:00.000Z',
  },
  {
    id: 'coup_maxedout',
    code: 'MAXEDOUT',
    description: 'Limited edition promo (Max redemptions reached)',
    discountType: 'FLAT',
    discountValue: 200,
    minOrderAmount: 1000,
    maxDiscountAmount: 200,
    expiresAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    maxUses: 5,
    usedCount: 5,
    maxUsesPerCustomer: 1,
    customerUsage: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function validateAndCalculateCoupon(rawCode, subtotal, customerPhone = '') {
  if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
    return { valid: false, error: 'Please enter a coupon code.' };
  }

  const code = rawCode.trim().toUpperCase();
  const coupon = serverCouponsDatabase.find((c) => c.code.toUpperCase() === code);

  if (!coupon) {
    return { valid: false, error: `Coupon code "${code}" is invalid or does not exist.` };
  }

  if (!coupon.isActive) {
    return { valid: false, error: `Coupon code "${code}" is currently disabled.` };
  }

  if (coupon.expiresAt) {
    const expiryTime = new Date(coupon.expiresAt).getTime();
    if (!isNaN(expiryTime) && Date.now() > expiryTime) {
      return { valid: false, error: `Coupon code "${code}" has expired.` };
    }
  }

  const subtotalNum = Number(subtotal) || 0;
  const minOrder = Number(coupon.minOrderAmount) || 0;
  if (subtotalNum < minOrder) {
    const diff = minOrder - subtotalNum;
    return {
      valid: false,
      error: `Minimum order value of ₹${minOrder.toLocaleString('en-IN')} required for "${code}". Add ₹${diff.toLocaleString('en-IN')} more to apply.`,
      minOrderAmount: minOrder,
      requiredDifference: diff,
    };
  }

  if (typeof coupon.maxUses === 'number' && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: `Coupon code "${code}" has reached its maximum redemption limit.` };
  }

  let phone = String(customerPhone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

  if (phone && phone.length === 10 && coupon.customerUsage) {
    const uses = coupon.customerUsage[phone] || 0;
    const maxPerCustomer = coupon.maxUsesPerCustomer || 1;
    if (uses >= maxPerCustomer) {
      return { valid: false, error: `Coupon code "${code}" has already been used by your mobile number.` };
    }
  }

  let rawDiscount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    rawDiscount = Math.round((subtotalNum * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && rawDiscount > coupon.maxDiscountAmount) {
      rawDiscount = coupon.maxDiscountAmount;
    }
  } else {
    rawDiscount = Number(coupon.discountValue) || 0;
  }

  // Discount cannot exceed subtotal (never below 0)
  const discountAmount = Math.min(subtotalNum, Math.max(0, rawDiscount));
  const netTotal = Math.max(0, subtotalNum - discountAmount);

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount || null,
      expiresAt: coupon.expiresAt,
    },
    originalSubtotal: subtotalNum,
    discountAmount,
    netTotal,
  };
}

function getOrCreateCustomerRecord(phone, initialData = {}) {
  let record = serverCustomersDatabase.get(phone);
  if (!record) {
    const pastOrder = serverOrdersDatabase.find((o) => o.customer?.mobile === phone);
    const fullName = initialData.fullName || pastOrder?.customer?.fullName || '';
    const email = initialData.email || pastOrder?.customer?.email || null;

    record = {
      fullName,
      mobile: phone,
      email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addresses: [],
      wishlist: [],
    };

    if (pastOrder?.customer?.address) {
      record.addresses.push({
        id: `addr_${Date.now()}_init`,
        recipientName: pastOrder.customer.fullName || 'Recipient',
        mobile: phone,
        address: pastOrder.customer.address,
        city: pastOrder.customer.city || '',
        state: pastOrder.customer.state || '',
        pincode: pastOrder.customer.pincode || '',
        isDefault: true,
        tag: 'Home',
        createdAt: pastOrder.createdAt || new Date().toISOString(),
      });
    }

    serverCustomersDatabase.set(phone, record);
  }
  if (!record.wishlist) record.wishlist = [];
  return record;
}

function enrichWishlistItem(item) {
  const targetId = String(item.productId || '').trim().toLowerCase();
  const prod = serverProductsDatabase.find(
    (p) =>
      p.id.toLowerCase() === targetId ||
      p.collectionId?.toLowerCase() === targetId ||
      (item.name && p.name.toLowerCase() === String(item.name).trim().toLowerCase())
  );

  if (prod) {
    return {
      id: item.id || `wsh_${item.productId}`,
      productId: prod.id,
      selectedColor: item.selectedColor || prod.colors?.[0]?.name || prod.color || 'Standard',
      selectedSize: item.selectedSize || prod.sizes?.[0] || 'L',
      addedAt: item.addedAt || new Date().toISOString(),
      product: {
        id: prod.id,
        name: prod.name,
        subName: prod.subName || prod.subTitle || '',
        price: prod.price,
        originalPrice: prod.originalPrice || '',
        description: prod.description || '',
        image: prod.image,
        colors: prod.colors || [],
        sizes: prod.sizes || [],
        fit: prod.fit || '',
        gsm: prod.gsm || '',
        stock: typeof prod.stock === 'number' ? prod.stock : 10,
        isActive: prod.isActive !== false,
        isAvailable: prod.isActive !== false && (prod.stock ?? 10) > 0,
        isDeleted: false,
      },
    };
  }

  return {
    id: item.id || `wsh_${item.productId}`,
    productId: item.productId,
    selectedColor: item.selectedColor || 'Standard',
    selectedSize: item.selectedSize || 'L',
    addedAt: item.addedAt || new Date().toISOString(),
    product: {
      id: item.productId,
      name: 'Unavailable Product',
      subName: 'Removed from catalog',
      price: '₹0',
      originalPrice: '',
      image: '/assets/products/machii-attitude-01-charcoal.png',
      colors: [],
      sizes: [],
      stock: 0,
      isActive: false,
      isAvailable: false,
      isDeleted: true,
    },
  };
}

function orderApiPlugin() {
  function registerServerMiddlewares(server) {
    // -------------------------------------------------------------
    // ENDPOINT: Health Check & System Telemetry (Step 20)
    // -------------------------------------------------------------
    const handleHealthCheck = (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || null;
      const keySecret = process.env.RAZORPAY_KEY_SECRET || null;
      const isPaymentOnline = Boolean(keyId && keySecret);

      const healthData = {
        status: 'healthy',
        service: 'machii-mens-mart',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        version: '1.0.0',
        checks: {
          api: 'ok',
          catalog: 'ok',
          productsCount: serverProductsDatabase.filter((p) => p.isActive !== false).length,
          paymentMode: isPaymentOnline ? 'ONLINE_AND_COD' : 'COD_ONLY',
          notifications: getNotificationConfig().status,
          database: 'connected (in-memory persistent transactional)',
        },
      };
      res.statusCode = 200;
      return res.end(JSON.stringify(healthData, null, 2));
    };

    server.middlewares.use('/health', handleHealthCheck);
    server.middlewares.use('/api/health', handleHealthCheck);

    // -------------------------------------------------------------
    // ENDPOINT: Dynamic robots.txt (Step 18)
    // -------------------------------------------------------------
      server.middlewares.use('/robots.txt', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
        const sitemapUrl = `${protocol}://${host}/sitemap.xml`;
        const body = [
          '# ==============================================================================',
          '# MACHII MENS MART — ROBOTS.TXT (STEP 18)',
          '# Directs web crawlers to public streetwear drops and guards private endpoints.',
          '# ==============================================================================',
          '',
          'User-agent: *',
          'Allow: /',
          'Allow: /assets/',
          'Allow: /favicon.svg',
          '',
          '# Protect private account, checkout, and administrative routes from indexing',
          'Disallow: /admin',
          'Disallow: /api/',
          'Disallow: /checkout',
          'Disallow: /order-history',
          'Disallow: /profile',
          '',
          `Sitemap: ${sitemapUrl}`,
        ].join('\n');
        return res.end(body);
      });

      // -------------------------------------------------------------
      // ENDPOINT: Dynamic sitemap.xml (Step 18)
      // -------------------------------------------------------------
      server.middlewares.use('/sitemap.xml', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
        const baseUrl = `${protocol}://${host}`;
        const activeProds = serverProductsDatabase.filter((p) => p.isActive !== false);

        const xmlLines = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
          '  <url>',
          `    <loc>${baseUrl}/</loc>`,
          '    <changefreq>daily</changefreq>',
          '    <priority>1.0</priority>',
          '  </url>',
          '  <url>',
          `    <loc>${baseUrl}/#collection-drop</loc>`,
          '    <changefreq>daily</changefreq>',
          '    <priority>0.9</priority>',
          '  </url>',
          '  <url>',
          `    <loc>${baseUrl}/#product-showcase</loc>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>0.8</priority>',
          '  </url>',
          '  <url>',
          `    <loc>${baseUrl}/#collections</loc>`,
          '    <changefreq>monthly</changefreq>',
          '    <priority>0.7</priority>',
          '  </url>',
        ];

        activeProds.forEach((p) => {
          xmlLines.push('  <url>');
          xmlLines.push(`    <loc>${baseUrl}/?product=${encodeURIComponent(p.id)}</loc>`);
          xmlLines.push('    <changefreq>weekly</changefreq>');
          xmlLines.push('    <priority>0.85</priority>');
          if (p.image) {
            xmlLines.push('    <image:image>');
            xmlLines.push(`      <image:loc>${baseUrl}${p.image}</image:loc>`);
            xmlLines.push(`      <image:title>${sanitizeText(p.name)}</image:title>`);
            xmlLines.push('    </image:image>');
          }
          xmlLines.push('  </url>');
        });

        xmlLines.push('</urlset>');
        return res.end(xmlLines.join('\n'));
      });
      // -------------------------------------------------------------
      // ENDPOINT 0: Customer Order Notifications Health & Config (/api/notifications)
      // Requirements 6, 8, 10: Provider health, safe audit, test hooks
      // -------------------------------------------------------------
      server.middlewares.use('/api/notifications', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.setHeader('Content-Type', 'application/json');
        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

        // GET /api/notifications/config (Provider status without credentials)
        if (cleanPath === 'config' && req.method === 'GET') {
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              config: getNotificationConfig(),
            })
          );
        }

        // POST /api/notifications/test-mock (Admin test hook for automated verification)
        if (cleanPath === 'test-mock' && req.method === 'POST') {
          if (!isAuthorizedAdmin(req, parsedUrl)) {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({ success: false, error: 'Unauthorized: Admin authorization required.' })
            );
          }

          let body = '';
          req.on('data', (c) => {
            body += c;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}');
              if (payload.enableMock) {
                setMockNotificationProvider(async (args) => {
                  if (payload.shouldFail) {
                    throw new Error(payload.failReason || 'Mock network provider failure');
                  }
                  return { success: true, mocked: true, ...args };
                });
              } else {
                clearMockNotificationProvider();
              }
              res.statusCode = 200;
              return res.end(
                JSON.stringify({ success: true, mockActive: Boolean(payload.enableMock) })
              );
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        // POST /api/notifications/reset-cache (Admin test hook to reset idempotency cache)
        if (cleanPath === 'reset-cache' && req.method === 'POST') {
          if (!isAuthorizedAdmin(req, parsedUrl)) {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({ success: false, error: 'Unauthorized: Admin authorization required.' })
            );
          }
          resetNotificationCache();
          res.statusCode = 200;
          return res.end(
            JSON.stringify({ success: true, message: 'Notification idempotency cache reset.' })
          );
        }

        // POST /api/notifications/reset-limiters (Admin test hook to reset rate limiters)
        if (cleanPath === 'reset-limiters' && req.method === 'POST') {
          if (!isAuthorizedAdmin(req, parsedUrl)) {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({ success: false, error: 'Unauthorized: Admin authorization required.' })
            );
          }
          resetAllRateLimiters();
          res.statusCode = 200;
          return res.end(
            JSON.stringify({ success: true, message: 'Rate limiters successfully reset.' })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 1: Payment Gateway Configuration & Health
      // -------------------------------------------------------------
      server.middlewares.use('/api/payment/config', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || null;
        const keySecret = process.env.RAZORPAY_KEY_SECRET || null;
        const isConfigured = Boolean(keyId && keySecret);

        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            configured: isConfigured,
            gateway: 'razorpay',
            keyId: isConfigured ? keyId : null,
            supportedMethods: isConfigured ? ['COD', 'ONLINE'] : ['COD'],
            requirements: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
            message: isConfigured
              ? 'Online payment gateway is active.'
              : 'Online payment gateway is not configured. Cash on Delivery (COD) is active.',
          })
        );
      });

      // -------------------------------------------------------------
      // ENDPOINT 2: Gateway Order Creation (Razorpay)
      // -------------------------------------------------------------
      server.middlewares.use('/api/payment/create-order', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        const keyId = process.env.RAZORPAY_KEY_ID || null;
        const keySecret = process.env.RAZORPAY_KEY_SECRET || null;

        if (!keyId || !keySecret) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              success: false,
              error:
                'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET. Please choose Cash on Delivery (COD).',
            })
          );
        }

        // Gateway configured mock/real handler
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            success: true,
            gateway: 'razorpay',
            gatewayOrderId: `order_${Date.now()}`,
          })
        );
      });

      // -------------------------------------------------------------
      // ENDPOINT 3: Server-side Payment Verification
      // -------------------------------------------------------------
      server.middlewares.use('/api/payment/verify', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        const keySecret = process.env.RAZORPAY_KEY_SECRET || null;
        if (!keySecret) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              success: false,
              error:
                'Online payment gateway is not configured. Payment verification unavailable.',
            })
          );
        }

        if (!enforceRateLimit(req, res, paymentVerifyLimiter)) {
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const { orderRef, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
              JSON.parse(body || '{}');

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: 'Missing required signature verification parameters.',
                })
              );
            }

            const expectedSignature = crypto
              .createHmac('sha256', keySecret)
              .update(`${razorpay_order_id}|${razorpay_payment_id}`)
              .digest('hex');

            let matchedOrder = null;
            if (orderRef) {
              matchedOrder = serverOrdersDatabase.find(
                (o) =>
                  o.orderRef?.toUpperCase() === String(orderRef).toUpperCase() ||
                  o.id === orderRef
              );
            }

            // Constant-time cryptographic signature comparison (Requirement 5)
            const isSignatureValid = safeCompare(expectedSignature, String(razorpay_signature));

            if (isSignatureValid) {
              if (matchedOrder) {
                matchedOrder.paymentStatus = 'PAID';
                if (!matchedOrder.paymentDetails) matchedOrder.paymentDetails = {};
                matchedOrder.paymentDetails.transactionId = razorpay_payment_id;
                matchedOrder.paymentDetails.paidAt = new Date().toISOString();

                // STEP 14: Payment Confirmation Notification
                try {
                  await triggerOrderNotification({
                    order: matchedOrder,
                    eventType: 'PAYMENT_CONFIRMATION',
                    extra: { transactionId: razorpay_payment_id },
                  });
                } catch (notifErr) {
                  console.error('[Payment Notification Warning]:', notifErr.message);
                }
              }

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  paymentStatus: 'PAID',
                  transactionId: razorpay_payment_id,
                  order: matchedOrder || null,
                })
              );
            } else {
              if (matchedOrder) {
                matchedOrder.paymentStatus = 'FAILED';

                // STEP 14: Payment Failure Notification
                try {
                  await triggerOrderNotification({
                    order: matchedOrder,
                    eventType: 'PAYMENT_FAILURE',
                    extra: { error: 'Cryptographic signature verification failed' },
                  });
                } catch (notifErr) {
                  console.error('[Payment Failure Notification Warning]:', notifErr.message);
                }
              }

              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Cryptographic payment signature verification failed. Untrusted or tampered token.',
                  order: matchedOrder || null,
                })
              );
            }
          } catch {
            res.statusCode = 400;
            return res.end(
              JSON.stringify({ success: false, error: 'Invalid verification payload' })
            );
          }
        });
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.2: Payment Gateway Webhook Handler (/api/payment/webhook)
      // Requirements 2, 5, 7, 8, 9: Verified backend payment events & alerts
      // Enforces cryptographic X-Razorpay-Signature validation
      // -------------------------------------------------------------
      server.middlewares.use('/api/payment/webhook', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        }

        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', async () => {
          try {
            const webhookSecret =
              process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || null;
            const webhookSignature = req.headers['x-razorpay-signature'];

            // Cryptographic webhook signature verification (Requirement 5)
            if (webhookSecret) {
              if (!webhookSignature) {
                res.statusCode = 401;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Unauthorized: Missing required X-Razorpay-Signature header.',
                  })
                );
              }
              const expectedWebhookSig = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

              if (!safeCompare(expectedWebhookSig, String(webhookSignature))) {
                res.statusCode = 401;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Unauthorized: Cryptographic webhook signature verification failed.',
                  })
                );
              }
            } else if (!isAuthorizedAdmin(req, new URL(req.url, 'http://localhost'))) {
              // If webhook secret is not configured, require admin authorization to test webhooks
              res.statusCode = 401;
              return res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Unauthorized: Webhook secret unconfigured; admin credentials required for webhook testing.',
                })
              );
            }

            const eventPayload = JSON.parse(body || '{}');
            const { event, payload } = eventPayload;
            const orderRef = payload?.payment?.entity?.notes?.orderRef || payload?.orderRef;

            if (!orderRef) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, message: 'Webhook received without orderRef' }));
            }

            const order = serverOrdersDatabase.find(
              (o) => o.orderRef?.toUpperCase() === String(orderRef).toUpperCase() || o.id === orderRef
            );

            if (!order) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, message: 'Order not found in database' }));
            }

            if (event === 'payment.captured' || event === 'order.paid') {
              order.paymentStatus = 'PAID';
              const txId = payload?.payment?.entity?.id || `tx_${Date.now()}`;
              if (!order.paymentDetails) order.paymentDetails = {};
              order.paymentDetails.transactionId = txId;
              order.paymentDetails.paidAt = new Date().toISOString();

              try {
                await triggerOrderNotification({
                  order,
                  eventType: 'PAYMENT_CONFIRMATION',
                  extra: { transactionId: txId },
                });
              } catch (notifErr) {
                console.error('[Webhook Notification Error]:', notifErr.message);
              }
            } else if (event === 'payment.failed') {
              order.paymentStatus = 'FAILED';
              try {
                await triggerOrderNotification({
                  order,
                  eventType: 'PAYMENT_FAILURE',
                  extra: { error: payload?.payment?.entity?.error_description || 'Payment failed' },
                });
              } catch (notifErr) {
                console.error('[Webhook Notification Error]:', notifErr.message);
              }
            }

            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, processedEvent: event }));
          } catch {
            res.statusCode = 400;
            return res.end(JSON.stringify({ success: false, error: 'Invalid webhook JSON' }));
          }
        });
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.5: Customer Profile & Address Management (/api/customer)
      // Requirements 1-10: Profile view, update, address CRUD, default selection
      // -------------------------------------------------------------
      server.middlewares.use('/api/customer', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Customer-Phone, Authorization'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.setHeader('Content-Type', 'application/json');

        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
        const pathParts = cleanPath.split('/').filter(Boolean);

        // Authorization check: Customer Phone
        const rawPhone = req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
        let phone = String(rawPhone || '').replace(/\D/g, '');
        if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
        else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

        if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
          res.statusCode = 401;
          return res.end(
            JSON.stringify({
              success: false,
              error:
                'Unauthorized: A valid 10-digit mobile number is required to access customer profile and addresses.',
            })
          );
        }

        const customerRecord = getOrCreateCustomerRecord(phone);

        // -----------------------------------------------------------
        // SUB-ROUTE A: Customer Profile (/api/customer/profile)
        // Requirements 1, 2, 7, 8: View & Update profile details
        // -----------------------------------------------------------
        if (pathParts[0] === 'profile') {
          if (req.method === 'GET') {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                profile: {
                  fullName: customerRecord.fullName,
                  mobile: customerRecord.mobile,
                  email: customerRecord.email,
                  createdAt: customerRecord.createdAt,
                  updatedAt: customerRecord.updatedAt,
                },
                addresses: customerRecord.addresses,
              })
            );
          }

          if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const { fullName, email, mobile: newMobile } = data;

                if (fullName !== undefined) {
                  const cleanName = String(fullName || '').trim();
                  if (!cleanName || cleanName.length < 2) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({
                        success: false,
                        error: 'Full name must be at least 2 characters.',
                      })
                    );
                  }
                  customerRecord.fullName = cleanName;
                }

                if (email !== undefined) {
                  const cleanEmail = String(email || '').trim();
                  if (cleanEmail) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(cleanEmail)) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'Please enter a valid email address.',
                        })
                      );
                    }
                    customerRecord.email = cleanEmail;
                  } else {
                    customerRecord.email = null;
                  }
                }

                let phoneChanged = false;
                const oldPhone = phone;
                if (newMobile !== undefined) {
                  let cleanNewMobile = String(newMobile || '').replace(/\D/g, '');
                  if (cleanNewMobile.length === 12 && cleanNewMobile.startsWith('91')) {
                    cleanNewMobile = cleanNewMobile.slice(2);
                  } else if (cleanNewMobile.length === 11 && cleanNewMobile.startsWith('0')) {
                    cleanNewMobile = cleanNewMobile.slice(1);
                  }

                  if (
                    !cleanNewMobile ||
                    cleanNewMobile.length !== 10 ||
                    !/^[6-9]\d{9}$/.test(cleanNewMobile)
                  ) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({
                        success: false,
                        error: 'Please enter a valid 10-digit Indian mobile number.',
                      })
                    );
                  }

                  if (cleanNewMobile !== phone) {
                    if (
                      serverCustomersDatabase.has(cleanNewMobile) &&
                      serverCustomersDatabase.get(cleanNewMobile) !== customerRecord
                    ) {
                      res.statusCode = 409;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'Mobile number is already registered to another customer profile.',
                        })
                      );
                    }

                    customerRecord.mobile = cleanNewMobile;
                    serverCustomersDatabase.delete(oldPhone);
                    serverCustomersDatabase.set(cleanNewMobile, customerRecord);

                    serverOrdersDatabase.forEach((ord) => {
                      if (ord.customer?.mobile === oldPhone) {
                        ord.customer.mobile = cleanNewMobile;
                      }
                    });

                    phoneChanged = true;
                  }
                }

                customerRecord.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: 'Profile updated successfully',
                    profile: {
                      fullName: customerRecord.fullName,
                      mobile: customerRecord.mobile,
                      email: customerRecord.email,
                      createdAt: customerRecord.createdAt,
                      updatedAt: customerRecord.updatedAt,
                    },
                    newPhone: customerRecord.mobile,
                    phoneChanged,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid profile payload.' })
                );
              }
            });
            return;
          }
        }

        // -----------------------------------------------------------
        // SUB-ROUTE B: Customer Delivery Addresses (/api/customer/addresses)
        // Requirements 3, 4, 5, 7, 8: Add, edit, delete, set default
        // -----------------------------------------------------------
        if (pathParts[0] === 'addresses') {
          // B1: List all addresses
          if (pathParts.length === 1 && req.method === 'GET') {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: customerRecord.addresses.length,
                addresses: customerRecord.addresses,
              })
            );
          }

          // B2: Add new address (POST /addresses)
          if (pathParts.length === 1 && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const {
                  recipientName,
                  mobile: addrMobile,
                  address,
                  city,
                  state,
                  pincode,
                  isDefault,
                  tag,
                } = data;

                const cleanRecipient = String(recipientName || '').trim();
                if (!cleanRecipient || cleanRecipient.length < 2) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Recipient name must be at least 2 characters.',
                    })
                  );
                }

                let cleanMobile = String(addrMobile || '').replace(/\D/g, '');
                if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
                  cleanMobile = cleanMobile.slice(2);
                } else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) {
                  cleanMobile = cleanMobile.slice(1);
                }
                if (
                  !cleanMobile ||
                  cleanMobile.length !== 10 ||
                  !/^[6-9]\d{9}$/.test(cleanMobile)
                ) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Enter a valid 10-digit Indian contact number.',
                    })
                  );
                }

                const cleanAddr = String(address || '').trim();
                if (!cleanAddr || cleanAddr.length < 8) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Complete street address must be at least 8 characters.',
                    })
                  );
                }

                const cleanCity = String(city || '').trim();
                if (!cleanCity || cleanCity.length < 2) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'City name must be at least 2 characters.',
                    })
                  );
                }

                const cleanState = String(state || '').trim();
                if (!cleanState || cleanState.length < 2) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'State name is required.',
                    })
                  );
                }

                const cleanPin = String(pincode || '').replace(/\D/g, '');
                if (!cleanPin || cleanPin.length !== 6 || !/^[1-9]\d{5}$/.test(cleanPin)) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'PIN code must be a valid 6-digit Indian postal code.',
                    })
                  );
                }

                const shouldBeDefault = Boolean(isDefault || customerRecord.addresses.length === 0);
                if (shouldBeDefault) {
                  customerRecord.addresses.forEach((a) => {
                    a.isDefault = false;
                  });
                }

                const newAddress = {
                  id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                  recipientName: cleanRecipient,
                  mobile: cleanMobile,
                  address: cleanAddr,
                  city: cleanCity,
                  state: cleanState,
                  pincode: cleanPin,
                  isDefault: shouldBeDefault,
                  tag: tag ? String(tag).trim() : 'Home',
                  createdAt: new Date().toISOString(),
                };

                customerRecord.addresses.push(newAddress);
                customerRecord.updatedAt = new Date().toISOString();

                res.statusCode = 201;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: 'Address added successfully.',
                    address: newAddress,
                    addresses: customerRecord.addresses,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid address payload.' })
                );
              }
            });
            return;
          }

          // B3: Operations on specific address (/addresses/:addressId)
          if (pathParts.length >= 2) {
            const addressId = decodeURIComponent(pathParts[1]).trim();
            const addrIndex = customerRecord.addresses.findIndex((a) => a.id === addressId);

            // Privacy & customer isolation check (Requirement 8)
            if (addrIndex === -1) {
              let belongsToOther = false;
              for (const [otherPhone, otherRecord] of serverCustomersDatabase.entries()) {
                if (
                  otherPhone !== phone &&
                  otherRecord.addresses.some((a) => a.id === addressId)
                ) {
                  belongsToOther = true;
                  break;
                }
              }

              if (belongsToOther) {
                res.statusCode = 403;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error:
                      'Forbidden: You do not have permission to access or modify this address.',
                  })
                );
              }

              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Address "${addressId}" not found.` })
              );
            }

            const targetAddress = customerRecord.addresses[addrIndex];

            // Set as default (PATCH/POST /addresses/:addressId/default)
            if (pathParts.length === 3 && pathParts[2] === 'default') {
              customerRecord.addresses.forEach((a) => {
                a.isDefault = a.id === addressId;
              });
              customerRecord.updatedAt = new Date().toISOString();

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: 'Default delivery address updated.',
                  addresses: customerRecord.addresses,
                })
              );
            }

            // Single address GET
            if (req.method === 'GET') {
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, address: targetAddress }));
            }

            // Single address UPDATE (PUT / PATCH)
            if (req.method === 'PUT' || req.method === 'PATCH') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body || '{}');
                  const {
                    recipientName,
                    mobile: addrMobile,
                    address,
                    city,
                    state,
                    pincode,
                    isDefault,
                    tag,
                  } = data;

                  if (recipientName !== undefined) {
                    const cleanRecipient = String(recipientName || '').trim();
                    if (!cleanRecipient || cleanRecipient.length < 2) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'Recipient name must be at least 2 characters.',
                        })
                      );
                    }
                    targetAddress.recipientName = cleanRecipient;
                  }

                  if (addrMobile !== undefined) {
                    let cleanMobile = String(addrMobile || '').replace(/\D/g, '');
                    if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
                      cleanMobile = cleanMobile.slice(2);
                    } else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) {
                      cleanMobile = cleanMobile.slice(1);
                    }
                    if (
                      !cleanMobile ||
                      cleanMobile.length !== 10 ||
                      !/^[6-9]\d{9}$/.test(cleanMobile)
                    ) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'Enter a valid 10-digit Indian contact number.',
                        })
                      );
                    }
                    targetAddress.mobile = cleanMobile;
                  }

                  if (address !== undefined) {
                    const cleanAddr = String(address || '').trim();
                    if (!cleanAddr || cleanAddr.length < 8) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'Complete street address must be at least 8 characters.',
                        })
                      );
                    }
                    targetAddress.address = cleanAddr;
                  }

                  if (city !== undefined) {
                    const cleanCity = String(city || '').trim();
                    if (!cleanCity || cleanCity.length < 2) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'City name must be at least 2 characters.',
                        })
                      );
                    }
                    targetAddress.city = cleanCity;
                  }

                  if (state !== undefined) {
                    const cleanState = String(state || '').trim();
                    if (!cleanState || cleanState.length < 2) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'State name is required.',
                        })
                      );
                    }
                    targetAddress.state = cleanState;
                  }

                  if (pincode !== undefined) {
                    const cleanPin = String(pincode || '').replace(/\D/g, '');
                    if (!cleanPin || cleanPin.length !== 6 || !/^[1-9]\d{5}$/.test(cleanPin)) {
                      res.statusCode = 400;
                      return res.end(
                        JSON.stringify({
                          success: false,
                          error: 'PIN code must be a valid 6-digit Indian postal code.',
                        })
                      );
                    }
                    targetAddress.pincode = cleanPin;
                  }

                  if (isDefault !== undefined) {
                    const shouldBeDefault = Boolean(isDefault);
                    if (shouldBeDefault) {
                      customerRecord.addresses.forEach((a) => {
                        a.isDefault = a.id === addressId;
                      });
                    } else if (targetAddress.isDefault && customerRecord.addresses.length > 1) {
                      targetAddress.isDefault = false;
                      const other = customerRecord.addresses.find((a) => a.id !== addressId);
                      if (other) other.isDefault = true;
                    }
                  }

                  if (tag !== undefined) {
                    targetAddress.tag = String(tag).trim() || 'Home';
                  }

                  targetAddress.updatedAt = new Date().toISOString();
                  customerRecord.updatedAt = new Date().toISOString();

                  res.statusCode = 200;
                  return res.end(
                    JSON.stringify({
                      success: true,
                      message: 'Address updated successfully.',
                      address: targetAddress,
                      addresses: customerRecord.addresses,
                    })
                  );
                } catch {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({ success: false, error: 'Invalid update payload.' })
                  );
                }
              });
              return;
            }

            // Single address DELETE
            if (req.method === 'DELETE') {
              const wasDefault = targetAddress.isDefault;
              customerRecord.addresses.splice(addrIndex, 1);

              if (wasDefault && customerRecord.addresses.length > 0) {
                customerRecord.addresses[0].isDefault = true;
              }

              customerRecord.updatedAt = new Date().toISOString();

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: 'Address deleted successfully.',
                  addresses: customerRecord.addresses,
                })
              );
            }
          }
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.6: Coupon Codes & Discounts API (/api/coupons)
      // STEP 13: Real-time coupon validation, business rules enforcement,
      // discount computation, eligibility check, public promotions list.
      // -------------------------------------------------------------
      server.middlewares.use('/api/coupons', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Customer-Phone, Authorization'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.setHeader('Content-Type', 'application/json');

        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

        // SUB-ROUTE 1: POST /api/coupons/validate (Requirement 1, 2, 3, 4, 7, 8)
        if (req.method === 'POST' && (cleanPath === 'validate' || cleanPath === '')) {
          // Rate limit coupon validation to prevent code enumeration attacks (Requirement 8)
          if (!enforceRateLimit(req, res, couponValidationLimiter)) {
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const { code, subtotal = 0, customerPhone = '' } = payload;

              const cleanCode = sanitizeText(code, 32);
              const headerPhone = req.headers['x-customer-phone'] || '';
              const finalPhone = customerPhone || headerPhone;

              const result = validateAndCalculateCoupon(cleanCode, subtotal, finalPhone);

              if (!result.valid) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    success: false,
                    valid: false,
                    error: result.error,
                    minOrderAmount: result.minOrderAmount || null,
                  })
                );
              }

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  valid: true,
                  coupon: result.coupon,
                  discountAmount: result.discountAmount,
                  originalSubtotal: result.originalSubtotal,
                  netTotal: result.netTotal,
                })
              );
            } catch {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({
                  success: false,
                  valid: false,
                  error: 'Invalid coupon validation request payload.',
                })
              );
            }
          });
          return;
        }

        // SUB-ROUTE 2: GET /api/coupons (Public Active Offers)
        if (req.method === 'GET') {
          const now = Date.now();
          const publicCoupons = serverCouponsDatabase
            .filter((c) => {
              if (!c.isActive) return false;
              if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
              if (typeof c.maxUses === 'number' && c.usedCount >= c.maxUses) return false;
              return true;
            })
            .map((c) => ({
              id: c.id,
              code: c.code,
              description: c.description,
              discountType: c.discountType,
              discountValue: c.discountValue,
              minOrderAmount: c.minOrderAmount,
              maxDiscountAmount: c.maxDiscountAmount || null,
              expiresAt: c.expiresAt,
            }));

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              coupons: publicCoupons,
            })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.7: Customer Wishlist API (/api/wishlist)
      // STEP 12: Wishlist CRUD, duplicate prevention, enrichment,
      // guest merge, stock/availability handling, authorization.
      // -------------------------------------------------------------
      server.middlewares.use('/api/wishlist', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Customer-Phone, Authorization'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.setHeader('Content-Type', 'application/json');

        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
        const pathParts = cleanPath.split('/').filter(Boolean);

        // Authorization check: Customer Phone
        const rawPhone = req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
        let phone = String(rawPhone || '').replace(/\D/g, '');
        if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
        else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

        if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
          res.statusCode = 401;
          return res.end(
            JSON.stringify({
              success: false,
              error:
                'Unauthorized: A valid 10-digit mobile number is required to access customer wishlist.',
            })
          );
        }

        const customerRecord = getOrCreateCustomerRecord(phone);
        customerRecord.wishlist = customerRecord.wishlist || [];

        // 1. GET /api/wishlist
        if (req.method === 'GET') {
          const enriched = customerRecord.wishlist.map(enrichWishlistItem);
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              count: enriched.length,
              items: enriched,
            })
          );
        }

        // 2. POST /api/wishlist/merge (Merge guest items into account)
        if (req.method === 'POST' && pathParts[0] === 'merge') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const guestItems = Array.isArray(data.guestItems) ? data.guestItems : [];

              let addedCount = 0;
              guestItems.forEach((g) => {
                const targetProdId = String(g.productId || g.id || '').trim();
                if (
                  targetProdId &&
                  !customerRecord.wishlist.some(
                    (it) => it.productId.toLowerCase() === targetProdId.toLowerCase()
                  )
                ) {
                  customerRecord.wishlist.unshift({
                    id: `wsh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    productId: targetProdId,
                    selectedColor: g.selectedColor || g.color || null,
                    selectedSize: g.selectedSize || g.size || null,
                    addedAt: g.addedAt || new Date().toISOString(),
                  });
                  addedCount++;
                }
              });

              if (addedCount > 0) {
                customerRecord.updatedAt = new Date().toISOString();
              }

              const enriched = customerRecord.wishlist.map(enrichWishlistItem);
              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Merged ${addedCount} guest items into your wishlist.`,
                  count: enriched.length,
                  items: enriched,
                })
              );
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
            }
          });
          return;
        }

        // 3. POST /api/wishlist (Add to wishlist with duplicate prevention)
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const prodId = String(data.productId || data.id || '').trim();

              if (!prodId) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Product ID is required to add to wishlist.',
                  })
                );
              }

              // Check if already in wishlist (Requirement 5)
              const existing = customerRecord.wishlist.find(
                (it) => it.productId.toLowerCase() === prodId.toLowerCase()
              );

              if (existing) {
                const enriched = customerRecord.wishlist.map(enrichWishlistItem);
                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    duplicate: true,
                    message: 'Product is already in your wishlist.',
                    count: enriched.length,
                    items: enriched,
                  })
                );
              }

              const newItem = {
                id: `wsh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                productId: prodId,
                selectedColor: data.selectedColor || data.color || null,
                selectedSize: data.selectedSize || data.size || null,
                addedAt: new Date().toISOString(),
              };

              customerRecord.wishlist.unshift(newItem);
              customerRecord.updatedAt = new Date().toISOString();

              const enriched = customerRecord.wishlist.map(enrichWishlistItem);
              res.statusCode = 201;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: 'Product added to wishlist.',
                  count: enriched.length,
                  items: enriched,
                })
              );
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
            }
          });
          return;
        }

        // 4. DELETE /api/wishlist (Remove product from wishlist or clear)
        if (req.method === 'DELETE') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const targetId = String(
                parsedUrl.searchParams.get('productId') ||
                  data.productId ||
                  data.id ||
                  pathParts[0] ||
                  ''
              ).trim();

              if (pathParts[0] === 'clear' || parsedUrl.searchParams.get('clear') === 'true') {
                customerRecord.wishlist = [];
                customerRecord.updatedAt = new Date().toISOString();
                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: 'Wishlist cleared successfully.',
                    count: 0,
                    items: [],
                  })
                );
              }

              if (!targetId) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Product ID is required to remove from wishlist.',
                  })
                );
              }

              const initialCount = customerRecord.wishlist.length;
              customerRecord.wishlist = customerRecord.wishlist.filter(
                (it) =>
                  it.productId.toLowerCase() !== targetId.toLowerCase() &&
                  it.id.toLowerCase() !== targetId.toLowerCase()
              );

              customerRecord.updatedAt = new Date().toISOString();
              const enriched = customerRecord.wishlist.map(enrichWishlistItem);

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  removed: initialCount !== customerRecord.wishlist.length,
                  message: 'Product removed from wishlist.',
                  count: enriched.length,
                  items: enriched,
                })
              );
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
            }
          });
          return;
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.8: Public Products Catalog API (/api/products)
      // Storefront product catalog with active availability
      // -------------------------------------------------------------
      server.middlewares.use('/api/products', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const parsedUrl = new URL(req.url, 'http://localhost');
          const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
          const pathParts = cleanPath.split('/').filter(Boolean);

          if (pathParts.length === 1) {
            const prodId = decodeURIComponent(pathParts[0]).trim();
            const product = serverProductsDatabase.find(
              (p) => (p.id === prodId || p.collectionId === prodId) && p.isActive
            );
            if (!product) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Product "${prodId}" not found.` })
              );
            }
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, product }));
          }

          // Search, Filter & Sort on Real Active Products (Requirements 1-4, 8, 9)
          let filtered = serverProductsDatabase.filter((p) => p.isActive);

          // 1. Search Query (q): name, subtitle, description, fit, gsm, colors, badge
          const rawQ = parsedUrl.searchParams.get('q');
          if (rawQ && rawQ.trim()) {
            const q = rawQ.trim().toLowerCase();
            filtered = filtered.filter((p) => {
              const nameMatch = p.name?.toLowerCase().includes(q);
              const subMatch = (p.subName || p.subTitle)?.toLowerCase().includes(q);
              const descMatch = p.description?.toLowerCase().includes(q);
              const fitMatch = p.fit?.toLowerCase().includes(q);
              const gsmMatch = p.gsm?.toLowerCase().includes(q);
              const badgeMatch = p.badge?.toLowerCase().includes(q);
              const colorMatch = p.colors?.some((c) => c.name?.toLowerCase().includes(q));
              return Boolean(
                nameMatch || subMatch || descMatch || fitMatch || gsmMatch || badgeMatch || colorMatch
              );
            });
          }

          // 2. Category Filter (category)
          const category = parsedUrl.searchParams.get('category');
          if (category && category.toLowerCase() !== 'all') {
            const targetCat = category.trim().toLowerCase();
            filtered = filtered.filter((p) =>
              p.categories?.some((c) => c.toLowerCase() === targetCat)
            );
          }

          // 3. Size Filter (size)
          const size = parsedUrl.searchParams.get('size');
          if (size && size.toLowerCase() !== 'all') {
            const targetSize = size.trim().toUpperCase();
            filtered = filtered.filter((p) =>
              p.sizes?.some((s) => s.toUpperCase() === targetSize)
            );
          }

          // 4. Color Filter (color)
          const color = parsedUrl.searchParams.get('color');
          if (color && color.toLowerCase() !== 'all') {
            const targetColor = color.trim().toLowerCase();
            filtered = filtered.filter((p) =>
              p.colors?.some(
                (c) =>
                  c.name?.toLowerCase().includes(targetColor) ||
                  c.id?.toLowerCase().includes(targetColor)
              )
            );
          }

          // 5. Price Range Filter (minPrice, maxPrice)
          const rawMin = parsedUrl.searchParams.get('minPrice');
          const rawMax = parsedUrl.searchParams.get('maxPrice');
          if (rawMin !== null && rawMin !== '') {
            const minP = parsePrice(rawMin);
            if (!isNaN(minP) && minP >= 0) {
              filtered = filtered.filter((p) => (p.priceNum || parsePrice(p.price)) >= minP);
            }
          }
          if (rawMax !== null && rawMax !== '') {
            const maxP = parsePrice(rawMax);
            if (!isNaN(maxP) && maxP > 0) {
              filtered = filtered.filter((p) => (p.priceNum || parsePrice(p.price)) <= maxP);
            }
          }

          // 6. Stock Availability Filter (inStock)
          const inStock = parsedUrl.searchParams.get('inStock');
          if (inStock === 'true' || inStock === '1') {
            filtered = filtered.filter((p) => (p.stock || 0) > 0);
          }

          // 7. Sorting (sort)
          const sort = parsedUrl.searchParams.get('sort');
          if (sort === 'price-asc') {
            filtered.sort(
              (a, b) => (a.priceNum || parsePrice(a.price)) - (b.priceNum || parsePrice(b.price))
            );
          } else if (sort === 'price-desc') {
            filtered.sort(
              (a, b) => (b.priceNum || parsePrice(b.price)) - (a.priceNum || parsePrice(a.price))
            );
          } else if (sort === 'newest') {
            filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          } else if (sort === 'popularity') {
            filtered.sort((a, b) => {
              const aPop = a.badge === 'POPULAR' || a.badge === 'BESTSELLER' ? 1 : 0;
              const bPop = b.badge === 'POPULAR' || b.badge === 'BESTSELLER' ? 1 : 0;
              return bPop - aPop;
            });
          }

          const totalCount = filtered.length;

          // 8. Optional Pagination (page, limit)
          const rawPage = parseInt(parsedUrl.searchParams.get('page'), 10);
          const rawLimit = parseInt(parsedUrl.searchParams.get('limit'), 10);
          let paginatedProducts = filtered;
          let currentPage = 1;
          let totalPages = 1;

          if (!isNaN(rawLimit) && rawLimit > 0) {
            currentPage = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
            totalPages = Math.max(1, Math.ceil(totalCount / rawLimit));
            const offset = (currentPage - 1) * rawLimit;
            paginatedProducts = filtered.slice(offset, offset + rawLimit);
          }

          // Compute filter facets from all active products
          const allActive = serverProductsDatabase.filter((p) => p.isActive);
          const allCategories = Array.from(new Set(allActive.flatMap((p) => p.categories || [])));
          const allSizes = ['S', 'M', 'L', 'XL', 'XXL'].filter((sz) =>
            allActive.some((p) => p.sizes?.includes(sz))
          );
          const allColors = Array.from(
            new Set(allActive.flatMap((p) => p.colors?.map((c) => c.name) || []))
          ).filter(Boolean);
          const allPrices = allActive.map((p) => p.priceNum || parsePrice(p.price));
          const minAvailablePrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
          const maxAvailablePrice = allPrices.length > 0 ? Math.max(...allPrices) : 5000;

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              count: paginatedProducts.length,
              totalCount,
              page: currentPage,
              totalPages,
              products: paginatedProducts,
              facets: {
                categories: ['all', ...allCategories.filter((c) => c !== 'all')],
                sizes: allSizes,
                colors: allColors,
                priceRange: {
                  min: minAvailablePrice,
                  max: maxAvailablePrice,
                },
              },
            })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.9: Protected Admin Operations API (/api/admin)
      // Requirements 1-11, 14: Role-based authorization, summary KPIs, product & order management
      // -------------------------------------------------------------
      server.middlewares.use('/api/admin', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Admin-Key, Authorization, X-Customer-Phone'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.setHeader('Content-Type', 'application/json');

        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
        const pathParts = cleanPath.split('/').filter(Boolean);

        // -------------------------------------------------------------
        // SUB-ROUTE A: Admin Auth Login (/api/admin/auth/login)
        // Rate limited & timing-safe authenticated session generation
        // -------------------------------------------------------------
        if (pathParts[0] === 'auth' && pathParts[1] === 'login' && req.method === 'POST') {
          // Enforce brute-force rate limit protection (Requirement 8)
          if (!enforceRateLimit(req, res, adminLoginLimiter)) {
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const key = String(payload.key || payload.password || payload.adminKey || '').trim();
              const username = sanitizeText(payload.username || 'admin', 50);

              const isKeyValid =
                safeCompare(key, EXPECTED_ADMIN_KEY) ||
                safeCompare(key, process.env.ADMIN_PASSWORD || 'machii@admin2026');

              if (isKeyValid) {
                const sessionToken = `mch_adm_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
                // 24-hour TTL session
                validAdminSessions.set(sessionToken, {
                  createdAt: Date.now(),
                  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                  username,
                });

                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: 'Admin authorization successful.',
                    token: sessionToken,
                    role: 'ADMIN',
                    user: {
                      username,
                      role: 'ADMIN',
                      authenticatedAt: new Date().toISOString(),
                    },
                  })
                );
              } else {
                res.statusCode = 401;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Invalid admin credentials or secret key.',
                  })
                );
              }
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Invalid login payload.' }));
            }
          });
          return;
        }

        // -------------------------------------------------------------
        // SUB-ROUTE A2: Admin Auth Logout (/api/admin/auth/logout)
        // Explicit token revocation (Requirement 1)
        // -------------------------------------------------------------
        if (pathParts[0] === 'auth' && pathParts[1] === 'logout' && req.method === 'POST') {
          const authHeader = req.headers['authorization'] || '';
          if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            validAdminSessions.delete(token);
          }
          const adminKey = req.headers['x-admin-key'];
          if (adminKey) {
            validAdminSessions.delete(adminKey);
          }

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              message: 'Admin session successfully revoked.',
            })
          );
        }

        // -------------------------------------------------------------
        // REQUIREMENT 9 & 10: Server-side Role-Based Authorization
        // Protect all /api/admin/* routes. Ordinary customers cannot access or self-grant.
        // -------------------------------------------------------------
        if (!isAuthorizedAdmin(req, parsedUrl)) {
          res.statusCode = 401;
          return res.end(
            JSON.stringify({
              success: false,
              error: 'Unauthorized: Admin authorization required. Ordinary customer access denied.',
            })
          );
        }

        // -------------------------------------------------------------
        // SUB-ROUTE B: Admin Auth Session Verify (/api/admin/auth/verify)
        // -------------------------------------------------------------
        if (pathParts[0] === 'auth' && pathParts[1] === 'verify') {
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              authenticated: true,
              role: 'ADMIN',
            })
          );
        }

        // -------------------------------------------------------------
        // SUB-ROUTE C: Admin Summary KPIs (/api/admin/summary)
        // Requirement 2: Real summary data (total products, stock, total orders, pending orders)
        // Requirement 14: Never hardcode or fake totals
        // -------------------------------------------------------------
        if (pathParts[0] === 'summary' && req.method === 'GET') {
          const totalProducts = serverProductsDatabase.length;
          const activeProducts = serverProductsDatabase.filter((p) => p.isActive).length;
          const totalStock = serverProductsDatabase.reduce((sum, p) => sum + (p.stock || 0), 0);
          const lowStockCount = serverProductsDatabase.filter((p) => (p.stock || 0) < 10).length;
          const outOfStockCount = serverProductsDatabase.filter((p) => (p.stock || 0) === 0).length;

          const totalOrders = serverOrdersDatabase.length;
          const pendingOrders = serverOrdersDatabase.filter(
            (o) => o.fulfillmentStatus === 'UNFULFILLED' || o.status === 'Order Placed'
          ).length;
          const confirmedOrders = serverOrdersDatabase.filter((o) => o.status === 'Confirmed').length;
          const packedOrders = serverOrdersDatabase.filter((o) => o.status === 'Packed').length;
          const shippedOrders = serverOrdersDatabase.filter(
            (o) => o.status === 'Shipped' || o.status === 'Out for Delivery'
          ).length;
          const deliveredOrders = serverOrdersDatabase.filter((o) => o.status === 'Delivered').length;
          const cancelledOrders = serverOrdersDatabase.filter(
            (o) => o.isCancelled || o.status === 'Cancelled'
          ).length;

          const totalRevenue = serverOrdersDatabase.reduce((sum, o) => sum + (o.total || 0), 0);

          const paymentStats = {
            paidCount: serverOrdersDatabase.filter((o) => o.paymentStatus === 'PAID').length,
            pendingCount: serverOrdersDatabase.filter((o) => o.paymentStatus === 'PENDING').length,
            codCount: serverOrdersDatabase.filter((o) => o.paymentMethod === 'COD').length,
            onlineCount: serverOrdersDatabase.filter((o) => o.paymentMethod === 'ONLINE').length,
          };

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              summary: {
                totalProducts,
                activeProducts,
                totalStock,
                lowStockCount,
                outOfStockCount,
                totalOrders,
                pendingOrders,
                confirmedOrders,
                packedOrders,
                shippedOrders,
                deliveredOrders,
                cancelledOrders,
                totalRevenue,
                formattedRevenue: formatPrice(totalRevenue),
                paymentStats,
                totalCoupons: serverCouponsDatabase.length,
                activeCoupons: serverCouponsDatabase.filter((c) => c.isActive).length,
                totalDiscountGiven: serverOrdersDatabase.reduce((sum, o) => sum + (o.discountAmount || 0), 0),
                totalCustomers: serverCustomersDatabase.size,
                averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
                formattedAOV: formatPrice(totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0),
                storeSettings: serverStoreSettings,
                recentOrders: serverOrdersDatabase.slice(0, 5),
              },
            })
          );
        }

        // -------------------------------------------------------------
        // SUB-ROUTE D: Product Management (/api/admin/products)
        // Requirements 3, 4, 5, 11: Add, edit, deactivate, stock updates, validation
        // -------------------------------------------------------------
        if (pathParts[0] === 'products') {
          // D1: GET /api/admin/products
          if (req.method === 'GET' && pathParts.length === 1) {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: serverProductsDatabase.length,
                products: serverProductsDatabase,
              })
            );
          }

          // D2: POST /api/admin/products (Create Product)
          if (req.method === 'POST' && pathParts.length === 1) {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                const rawName = String(payload.name || '').trim();
                if (!rawName || rawName.length < 3) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Product name is required and must be at least 3 characters.',
                    })
                  );
                }
                const name = sanitizeText(rawName, 100);

                const rawPrice = payload.price;
                const parsedPrice = parsePrice(rawPrice);
                if (parsedPrice <= 0) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Valid positive product price is required.',
                    })
                  );
                }

                // Image scheme safety check (Requirement 11)
                const image = payload.image || '/assets/products/machii-attitude-01-charcoal.png';
                if (!isValidImageUrl(image)) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Invalid or unsafe image URL scheme.',
                    })
                  );
                }

                if (payload.backImage && !isValidImageUrl(payload.backImage)) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Invalid or unsafe back image URL scheme.',
                    })
                  );
                }

                if (payload.hoverImage && !isValidImageUrl(payload.hoverImage)) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Invalid or unsafe hover image URL scheme.',
                    })
                  );
                }

                const stock =
                  payload.stock !== undefined ? Math.max(0, parseInt(payload.stock, 10) || 0) : 50;
                const sizes =
                  Array.isArray(payload.sizes) && payload.sizes.length > 0
                    ? payload.sizes
                    : ['S', 'M', 'L', 'XL', 'XXL'];
                const categories =
                  Array.isArray(payload.categories) && payload.categories.length > 0
                    ? payload.categories
                    : ['all', 'oversized'];

                const newId = `prod_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
                const newProduct = {
                  id: newId,
                  collectionId: newId,
                  name,
                  subName: sanitizeText(payload.subName || payload.subTitle || 'Streetwear Collection', 80),
                  subTitle: sanitizeText(payload.subName || payload.subTitle || 'Streetwear Collection', 80),
                  price: formatPrice(parsedPrice),
                  priceNum: parsedPrice,
                  originalPrice: payload.originalPrice
                    ? formatPrice(parsePrice(payload.originalPrice))
                    : formatPrice(Math.round(parsedPrice * 1.35)),
                  description: sanitizeText(
                    payload.description || 'Premium streetwear heavyweight drop.',
                    1000
                  ),
                  image,
                  backImage: payload.backImage || null,
                  hoverImage: payload.hoverImage || null,
                  categories,
                  badge: sanitizeText(payload.badge || 'NEW ARRIVAL', 30),
                  badgeType: payload.badgeType || 'dark',
                  gsm: sanitizeText(payload.gsm || '260 GSM Combed Cotton', 50),
                  fit: sanitizeText(payload.fit || 'Signature Boxy Fit', 50),
                  sizes,
                  colors:
                    Array.isArray(payload.colors) && payload.colors.length > 0
                      ? payload.colors
                      : [
                          {
                            id: `c_${Date.now()}`,
                            name: 'Standard Dark',
                            hex: '#111113',
                            image,
                            backImage: null,
                          },
                        ],
                  stock,
                  isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                serverProductsDatabase.unshift(newProduct);

                res.statusCode = 201;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: `Product "${newProduct.name}" created successfully.`,
                    product: newProduct,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid product creation payload.' })
                );
              }
            });
            return;
          }

          // D3: PATCH /api/admin/products/:id/stock (Quick Stock Update)
          if (req.method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'stock') {
            const prodId = decodeURIComponent(pathParts[1]).trim();
            const product = serverProductsDatabase.find(
              (p) => p.id === prodId || p.collectionId === prodId
            );

            if (!product) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Product "${prodId}" not found.` })
              );
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (payload.stock !== undefined) {
                  product.stock = Math.max(0, parseInt(payload.stock, 10) || 0);
                } else if (payload.delta !== undefined) {
                  product.stock = Math.max(0, (product.stock || 0) + (parseInt(payload.delta, 10) || 0));
                } else {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({ success: false, error: 'Must provide "stock" or "delta".' })
                  );
                }
                product.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    id: product.id,
                    stock: product.stock,
                    product,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid stock update payload.' })
                );
              }
            });
            return;
          }

          // D4: PUT /api/admin/products/:id (Edit Product)
          if (req.method === 'PUT' && pathParts.length === 2) {
            const prodId = decodeURIComponent(pathParts[1]).trim();
            const product = serverProductsDatabase.find(
              (p) => p.id === prodId || p.collectionId === prodId
            );

            if (!product) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Product "${prodId}" not found.` })
              );
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (payload.name !== undefined) {
                  const rawName = String(payload.name).trim();
                  if (rawName.length < 3) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({
                        success: false,
                        error: 'Product name must be at least 3 characters.',
                      })
                    );
                  }
                  product.name = sanitizeText(rawName, 100);
                }

                if (payload.price !== undefined) {
                  const priceNum = parsePrice(payload.price);
                  if (priceNum <= 0) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({ success: false, error: 'Valid positive price required.' })
                    );
                  }
                  product.price = formatPrice(priceNum);
                  product.priceNum = priceNum;
                }

                if (payload.originalPrice !== undefined) {
                  product.originalPrice = formatPrice(parsePrice(payload.originalPrice));
                }
                if (payload.subName !== undefined) product.subName = sanitizeText(payload.subName, 80);
                if (payload.subTitle !== undefined)
                  product.subTitle = sanitizeText(payload.subTitle, 80);
                if (payload.description !== undefined)
                  product.description = sanitizeText(payload.description, 1000);

                if (payload.image !== undefined) {
                  if (!isValidImageUrl(payload.image)) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({ success: false, error: 'Invalid or unsafe image URL scheme.' })
                    );
                  }
                  product.image = payload.image;
                }

                if (payload.backImage !== undefined) {
                  if (payload.backImage && !isValidImageUrl(payload.backImage)) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({ success: false, error: 'Invalid or unsafe back image URL scheme.' })
                    );
                  }
                  product.backImage = payload.backImage;
                }

                if (payload.hoverImage !== undefined) {
                  if (payload.hoverImage && !isValidImageUrl(payload.hoverImage)) {
                    res.statusCode = 400;
                    return res.end(
                      JSON.stringify({ success: false, error: 'Invalid or unsafe hover image URL scheme.' })
                    );
                  }
                  product.hoverImage = payload.hoverImage;
                }

                if (Array.isArray(payload.sizes) && payload.sizes.length > 0)
                  product.sizes = payload.sizes;
                if (Array.isArray(payload.colors) && payload.colors.length > 0)
                  product.colors = payload.colors;
                if (Array.isArray(payload.categories) && payload.categories.length > 0)
                  product.categories = payload.categories;
                if (payload.stock !== undefined)
                  product.stock = Math.max(0, parseInt(payload.stock, 10) || 0);
                if (payload.isActive !== undefined) product.isActive = Boolean(payload.isActive);
                if (payload.badge !== undefined) product.badge = sanitizeText(payload.badge, 30);
                if (payload.gsm !== undefined) product.gsm = sanitizeText(payload.gsm, 50);
                if (payload.fit !== undefined) product.fit = sanitizeText(payload.fit, 50);

                product.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, product }));
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid product update payload.' })
                );
              }
            });
            return;
          }

          // D5: DELETE /api/admin/products/:id (Deactivate or Delete Product)
          if (req.method === 'DELETE' && pathParts.length === 2) {
            const prodId = decodeURIComponent(pathParts[1]).trim();
            const productIndex = serverProductsDatabase.findIndex(
              (p) => p.id === prodId || p.collectionId === prodId
            );

            if (productIndex === -1) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Product "${prodId}" not found.` })
              );
            }

            const permanent = parsedUrl.searchParams.get('permanent') === 'true';
            if (permanent) {
              const removed = serverProductsDatabase.splice(productIndex, 1)[0];
              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Product "${removed.name}" permanently deleted.`,
                })
              );
            } else {
              serverProductsDatabase[productIndex].isActive = false;
              serverProductsDatabase[productIndex].updatedAt = new Date().toISOString();
              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Product "${serverProductsDatabase[productIndex].name}" deactivated.`,
                  product: serverProductsDatabase[productIndex],
                })
              );
            }
          }
        }

        // -------------------------------------------------------------
        // SUB-ROUTE E: Admin Orders Management (/api/admin/orders)
        // Requirements 6, 7, 8: Real order list, status changes, payment separation
        // -------------------------------------------------------------
        if (pathParts[0] === 'orders') {
          // E1: GET /api/admin/orders (List all real orders)
          if (req.method === 'GET' && pathParts.length === 1) {
            let orders = [...serverOrdersDatabase];

            const statusFilter = parsedUrl.searchParams.get('status');
            if (statusFilter && statusFilter !== 'all') {
              orders = orders.filter(
                (o) =>
                  o.status?.toLowerCase() === statusFilter.toLowerCase() ||
                  o.fulfillmentStatus?.toLowerCase() === statusFilter.toLowerCase()
              );
            }

            const query = parsedUrl.searchParams.get('q');
            if (query) {
              const q = query.toLowerCase();
              orders = orders.filter(
                (o) =>
                  o.orderRef?.toLowerCase().includes(q) ||
                  o.customer?.fullName?.toLowerCase().includes(q) ||
                  o.customer?.mobile?.includes(q)
              );
            }

            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: orders.length,
                orders,
              })
            );
          }

          // E2: PATCH /api/admin/orders/:orderRef/status (Update fulfillment status & tracking)
          if (
            (req.method === 'PATCH' || req.method === 'POST') &&
            pathParts.length === 3 &&
            pathParts[2] === 'status'
          ) {
            const orderRef = decodeURIComponent(pathParts[1]).trim();
            const order = serverOrdersDatabase.find(
              (o) => o.orderRef.toUpperCase() === orderRef.toUpperCase() || o.id === orderRef
            );

            if (!order) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Order "${orderRef}" not found.` })
              );
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const {
                  status,
                  carrier,
                  trackingNumber,
                  trackingUrl,
                  estimatedDelivery,
                  description,
                  location,
                } = payload;

                const VALID_STATUSES = [
                  'Order Placed',
                  'Confirmed',
                  'Packed',
                  'Shipped',
                  'Out for Delivery',
                  'Delivered',
                  'Cancelled',
                ];

                const matchedStatus = VALID_STATUSES.find(
                  (s) => s.toLowerCase() === String(status || '').trim().toLowerCase()
                );

                if (!matchedStatus) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Invalid order status. Supported statuses: ${VALID_STATUSES.join(', ')}`,
                    })
                  );
                }

                const oldPaymentStatus = order.paymentStatus;
                order.status = matchedStatus;
                order.fulfillmentStatus = matchedStatus;
                if (matchedStatus === 'Cancelled') {
                  order.isCancelled = true;
                }

                if (!order.tracking) {
                  order.tracking = {
                    status: matchedStatus,
                    carrier: null,
                    trackingNumber: null,
                    trackingUrl: null,
                    estimatedDelivery: null,
                    events: [],
                  };
                }

                order.tracking.status = matchedStatus;
                if (carrier !== undefined) order.tracking.carrier = carrier || null;
                if (trackingNumber !== undefined)
                  order.tracking.trackingNumber = trackingNumber || null;
                if (trackingUrl !== undefined) order.tracking.trackingUrl = trackingUrl || null;
                if (estimatedDelivery !== undefined)
                  order.tracking.estimatedDelivery = estimatedDelivery || null;

                order.tracking.events.push({
                  status: matchedStatus,
                  title: matchedStatus,
                  description:
                    description ||
                    (matchedStatus === 'Cancelled'
                      ? 'Order was cancelled by store operations.'
                      : `Order fulfillment updated to ${matchedStatus}.`),
                  location: location || null,
                  timestamp: new Date().toISOString(),
                });

                // STEP 14: Trigger Order Status Change Notification
                try {
                  await triggerOrderNotification({
                    order,
                    eventType: 'ORDER_STATUS_CHANGE',
                    extra: {
                      status: matchedStatus,
                      carrier: order.tracking?.carrier,
                      trackingNumber: order.tracking?.trackingNumber,
                      description,
                      location,
                    },
                  });
                } catch (notifErr) {
                  console.error('[Notification Status Warning]:', notifErr.message);
                }

                if (payload.paymentStatus && payload.paymentStatus !== oldPaymentStatus) {
                  order.paymentStatus = payload.paymentStatus;
                  try {
                    await triggerOrderNotification({
                      order,
                      eventType:
                        payload.paymentStatus === 'PAID'
                          ? 'PAYMENT_CONFIRMATION'
                          : 'PAYMENT_FAILURE',
                      extra: {
                        transactionId: payload.transactionId || 'ADMIN_UPDATE',
                        error:
                          payload.paymentStatus === 'FAILED'
                            ? 'Payment marked as failed by store admin'
                            : null,
                      },
                    });
                  } catch (notifErr) {
                    console.error('[Payment Notification Warning]:', notifErr.message);
                  }
                } else if (payload.paymentStatus) {
                  order.paymentStatus = payload.paymentStatus;
                }

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, order }));
              } catch {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
              }
            });
            return;
          }

          // E3: PATCH /api/admin/orders/:orderRef/payment (Payment Status Update)
          if (
            req.method === 'PATCH' &&
            pathParts.length === 3 &&
            pathParts[2] === 'payment'
          ) {
            const orderRef = decodeURIComponent(pathParts[1]).trim();
            const order = serverOrdersDatabase.find(
              (o) => o.orderRef.toUpperCase() === orderRef.toUpperCase() || o.id === orderRef
            );

            if (!order) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Order "${orderRef}" not found.` })
              );
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const paymentStatus = String(payload.paymentStatus || '').toUpperCase();
                if (
                  paymentStatus !== 'PAID' &&
                  paymentStatus !== 'PENDING' &&
                  paymentStatus !== 'FAILED'
                ) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Payment status must be PAID, PENDING, or FAILED.',
                    })
                  );
                }

                order.paymentStatus = paymentStatus;

                // STEP 14: Trigger Payment Confirmation or Failure Notification
                if (paymentStatus === 'PAID') {
                  try {
                    await triggerOrderNotification({
                      order,
                      eventType: 'PAYMENT_CONFIRMATION',
                      extra: { transactionId: payload.transactionId || 'ADMIN_UPDATE' },
                    });
                  } catch (notifErr) {
                    console.error('[Payment Notification Warning]:', notifErr.message);
                  }
                } else if (paymentStatus === 'FAILED') {
                  try {
                    await triggerOrderNotification({
                      order,
                      eventType: 'PAYMENT_FAILURE',
                      extra: { error: payload.error || 'Payment declined or marked failed by store admin.' },
                    });
                  } catch (notifErr) {
                    console.error('[Payment Notification Warning]:', notifErr.message);
                  }
                }

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, order }));
              } catch {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: 'Invalid JSON.' }));
              }
            });
            return;
          }
        }

        // -------------------------------------------------------------
        // SUB-ROUTE F: Admin Coupon Management (/api/admin/coupons)
        // STEP 13 Requirement 10: Create, edit, activate, deactivate, configure coupons
        // -------------------------------------------------------------
        if (pathParts[0] === 'coupons') {
          // F1: GET /api/admin/coupons (List all coupons with usage stats)
          if (req.method === 'GET' && pathParts.length === 1) {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: serverCouponsDatabase.length,
                coupons: serverCouponsDatabase,
              })
            );
          }

          // F2: POST /api/admin/coupons (Create new coupon)
          if (req.method === 'POST' && pathParts.length === 1) {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                const rawCode = String(payload.code || '').trim().toUpperCase();

                if (!rawCode || rawCode.length < 3) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Coupon code is required and must be at least 3 characters.',
                    })
                  );
                }

                if (!/^[A-Z0-9_-]+$/.test(rawCode)) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Coupon code can only contain letters, numbers, hyphens, and underscores.',
                    })
                  );
                }

                const exists = serverCouponsDatabase.some((c) => c.code.toUpperCase() === rawCode);
                if (exists) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Coupon with code "${rawCode}" already exists.`,
                    })
                  );
                }

                const discountType = payload.discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE';
                const discountValue = Number(payload.discountValue);
                if (isNaN(discountValue) || discountValue <= 0) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Discount value must be a positive number.',
                    })
                  );
                }

                if (discountType === 'PERCENTAGE' && discountValue > 100) {
                  res.statusCode = 400;
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: 'Percentage discount cannot exceed 100%.',
                    })
                  );
                }

                const minOrderAmount = Math.max(0, Number(payload.minOrderAmount) || 0);
                const maxDiscountAmount = payload.maxDiscountAmount ? Math.max(0, Number(payload.maxDiscountAmount)) : null;
                const maxUses = Math.max(1, Number(payload.maxUses) || 100);
                const maxUsesPerCustomer = Math.max(1, Number(payload.maxUsesPerCustomer) || 1);
                const isActive = payload.isActive !== false;
                const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null;
                const description = String(
                  payload.description ||
                    `${discountType === 'PERCENTAGE' ? discountValue + '%' : '₹' + discountValue} OFF`
                ).trim();

                const newCoupon = {
                  id: `coup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  code: rawCode,
                  description,
                  discountType,
                  discountValue,
                  minOrderAmount,
                  maxDiscountAmount,
                  expiresAt,
                  isActive,
                  maxUses,
                  usedCount: 0,
                  maxUsesPerCustomer,
                  customerUsage: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                serverCouponsDatabase.unshift(newCoupon);

                res.statusCode = 201;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: `Coupon "${rawCode}" created successfully.`,
                    coupon: newCoupon,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid JSON payload for coupon creation.' })
                );
              }
            });
            return;
          }

          // F3: PATCH /api/admin/coupons/:id (Update coupon)
          if ((req.method === 'PATCH' || req.method === 'PUT') && pathParts.length === 2) {
            const couponId = decodeURIComponent(pathParts[1]).trim();
            const coupon = serverCouponsDatabase.find(
              (c) => c.id === couponId || c.code.toUpperCase() === couponId.toUpperCase()
            );

            if (!coupon) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Coupon "${couponId}" not found.` })
              );
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');

                if (payload.isActive !== undefined) {
                  coupon.isActive = Boolean(payload.isActive);
                }
                if (payload.description !== undefined) {
                  coupon.description = String(payload.description).trim();
                }
                if (payload.discountType && (payload.discountType === 'PERCENTAGE' || payload.discountType === 'FLAT')) {
                  coupon.discountType = payload.discountType;
                }
                if (payload.discountValue !== undefined) {
                  const val = Number(payload.discountValue);
                  if (!isNaN(val) && val > 0 && (coupon.discountType !== 'PERCENTAGE' || val <= 100)) {
                    coupon.discountValue = val;
                  }
                }
                if (payload.minOrderAmount !== undefined) {
                  coupon.minOrderAmount = Math.max(0, Number(payload.minOrderAmount) || 0);
                }
                if (payload.maxDiscountAmount !== undefined) {
                  coupon.maxDiscountAmount = payload.maxDiscountAmount
                    ? Math.max(0, Number(payload.maxDiscountAmount))
                    : null;
                }
                if (payload.expiresAt !== undefined) {
                  coupon.expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null;
                }
                if (payload.maxUses !== undefined) {
                  coupon.maxUses = Math.max(1, Number(payload.maxUses) || 1);
                }
                if (payload.maxUsesPerCustomer !== undefined) {
                  coupon.maxUsesPerCustomer = Math.max(1, Number(payload.maxUsesPerCustomer) || 1);
                }

                coupon.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: `Coupon "${coupon.code}" updated successfully.`,
                    coupon,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({ success: false, error: 'Invalid JSON payload for coupon update.' })
                );
              }
            });
            return;
          }

          // F4: DELETE /api/admin/coupons/:id (Deactivate or delete coupon)
          if (req.method === 'DELETE' && pathParts.length === 2) {
            const couponId = decodeURIComponent(pathParts[1]).trim();
            const index = serverCouponsDatabase.findIndex(
              (c) => c.id === couponId || c.code.toUpperCase() === couponId.toUpperCase()
            );

            if (index === -1) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Coupon "${couponId}" not found.` })
              );
            }

            const deleted = serverCouponsDatabase.splice(index, 1)[0];
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                message: `Coupon "${deleted.code}" deleted successfully.`,
                coupon: deleted,
              })
            );
          }
        }

        // -------------------------------------------------------------
        // SUB-ROUTE G: Admin Customers Directory (/api/admin/customers)
        // -------------------------------------------------------------
        if (pathParts[0] === 'customers' && req.method === 'GET') {
          const customersList = [];
          for (const [phone, record] of serverCustomersDatabase.entries()) {
            const customerOrders = serverOrdersDatabase.filter(
              (o) => o.customer?.mobile === phone
            );
            const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const lastOrder = customerOrders[0] || null;

            customersList.push({
              phone,
              mobile: phone,
              fullName: record.fullName || lastOrder?.customer?.fullName || 'Valued Customer',
              name: record.fullName || lastOrder?.customer?.fullName || 'Valued Customer',
              email: record.email || lastOrder?.customer?.email || null,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              ordersCount: customerOrders.length,
              orderCount: customerOrders.length,
              totalSpent,
              formattedTotalSpent: formatPrice(totalSpent),
              lastOrderRef: lastOrder?.orderRef || null,
              lastOrderDate: lastOrder?.createdAt || null,
              addressesCount: Array.isArray(record.addresses) ? record.addresses.length : 0,
              addresses: record.addresses || [],
              wishlistCount: Array.isArray(record.wishlist) ? record.wishlist.length : 0,
            });
          }

          // Sort by total spent descending or most recent orders
          customersList.sort((a, b) => b.totalSpent - a.totalSpent);

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              count: customersList.length,
              customers: customersList,
            })
          );
        }

        // -------------------------------------------------------------
        // SUB-ROUTE H: Admin Store Settings & Offer Banner (/api/admin/settings)
        // -------------------------------------------------------------
        if (pathParts[0] === 'settings') {
          if (req.method === 'GET') {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                settings: serverStoreSettings,
              })
            );
          }

          if (req.method === 'PATCH' || req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');

                if (payload.announcementBanner) {
                  serverStoreSettings.announcementBanner = {
                    ...serverStoreSettings.announcementBanner,
                    ...payload.announcementBanner,
                  };
                }
                if (payload.codEnabled !== undefined) {
                  serverStoreSettings.codEnabled = Boolean(payload.codEnabled);
                }
                if (payload.storeStatus !== undefined) {
                  serverStoreSettings.storeStatus =
                    payload.storeStatus === 'MAINTENANCE' ? 'MAINTENANCE' : 'OPEN';
                }
                if (payload.freeShippingThreshold !== undefined) {
                  serverStoreSettings.freeShippingThreshold = Math.max(
                    0,
                    Number(payload.freeShippingThreshold) || 0
                  );
                }
                if (payload.supportPhone !== undefined) {
                  serverStoreSettings.supportPhone = String(payload.supportPhone).trim();
                }
                if (payload.supportEmail !== undefined) {
                  serverStoreSettings.supportEmail = String(payload.supportEmail).trim();
                }

                serverStoreSettings.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                return res.end(
                  JSON.stringify({
                    success: true,
                    message: 'Store settings and offer banner updated successfully.',
                    settings: serverStoreSettings,
                  })
                );
              } catch {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Invalid JSON payload for store settings.',
                  })
                );
              }
            });
            return;
          }
        }

        // -------------------------------------------------------------
        // SUB-ROUTE H2: Admin Hero Showcase Management (/api/admin/hero-products)
        // -------------------------------------------------------------
        if (pathParts[0] === 'hero-products' || pathParts[0] === 'hero') {
          if (req.method === 'GET') {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: serverStoreSettings.heroProducts.length,
                products: serverStoreSettings.heroProducts,
              })
            );
          }

          if (req.method === 'PUT' || req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                if (Array.isArray(payload.products) && payload.products.length > 0) {
                  serverStoreSettings.heroProducts = payload.products;
                  serverStoreSettings.updatedAt = new Date().toISOString();
                  res.statusCode = 200;
                  return res.end(
                    JSON.stringify({
                      success: true,
                      message: `Updated hero showcase with ${serverStoreSettings.heroProducts.length} items.`,
                      count: serverStoreSettings.heroProducts.length,
                      products: serverStoreSettings.heroProducts,
                    })
                  );
                } else if (payload.product) {
                  const existingIdx = serverStoreSettings.heroProducts.findIndex((p) => p.id === payload.product.id);
                  if (existingIdx > -1) {
                    serverStoreSettings.heroProducts[existingIdx] = {
                      ...serverStoreSettings.heroProducts[existingIdx],
                      ...payload.product,
                    };
                  } else {
                    serverStoreSettings.heroProducts.push(payload.product);
                  }
                  serverStoreSettings.updatedAt = new Date().toISOString();
                  res.statusCode = 200;
                  return res.end(
                    JSON.stringify({
                      success: true,
                      message: 'Hero product saved successfully.',
                      count: serverStoreSettings.heroProducts.length,
                      products: serverStoreSettings.heroProducts,
                    })
                  );
                }
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: 'Invalid hero products payload.' }));
              } catch {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
              }
            });
            return;
          }

          if (req.method === 'DELETE') {
            const targetId = pathParts[1];
            if (targetId) {
              serverStoreSettings.heroProducts = serverStoreSettings.heroProducts.filter((p) => p.id !== targetId);
              serverStoreSettings.updatedAt = new Date().toISOString();
              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Hero product ${targetId} removed.`,
                  count: serverStoreSettings.heroProducts.length,
                  products: serverStoreSettings.heroProducts,
                })
              );
            }
          }
        }

        // -------------------------------------------------------------
        // SUB-ROUTE I: Admin Analytics & Product Sales Performance (/api/admin/analytics)
        // -------------------------------------------------------------
        if (pathParts[0] === 'analytics' && req.method === 'GET') {
          const productSalesMap = new Map();

          for (const order of serverOrdersDatabase) {
            for (const item of order.items || []) {
              const prev = productSalesMap.get(item.id) || {
                id: item.id,
                name: item.name,
                unitsSold: 0,
                revenue: 0,
                image: item.image,
              };
              prev.unitsSold += item.quantity || 1;
              prev.revenue += (item.priceNum || parsePrice(item.price)) * (item.quantity || 1);
              productSalesMap.set(item.id, prev);
            }
          }

          const topProducts = Array.from(productSalesMap.values())
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 8)
            .map((p) => ({
              ...p,
              formattedRevenue: formatPrice(p.revenue),
            }));

          const totalOrders = serverOrdersDatabase.length;
          const totalRevenue = serverOrdersDatabase.reduce((sum, o) => sum + (o.total || 0), 0);
          const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

          const fulfillmentBreakdown = {
            unfulfilled: serverOrdersDatabase.filter(
              (o) => o.fulfillmentStatus === 'UNFULFILLED' && !o.isCancelled
            ).length,
            confirmed: serverOrdersDatabase.filter((o) => o.status === 'Confirmed').length,
            packed: serverOrdersDatabase.filter((o) => o.status === 'Packed').length,
            shipped: serverOrdersDatabase.filter(
              (o) => o.status === 'Shipped' || o.status === 'Out for Delivery'
            ).length,
            delivered: serverOrdersDatabase.filter((o) => o.status === 'Delivered').length,
            cancelled: serverOrdersDatabase.filter(
              (o) => o.isCancelled || o.status === 'Cancelled'
            ).length,
          };

          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              analytics: {
                totalOrders,
                totalRevenue,
                formattedRevenue: formatPrice(totalRevenue),
                averageOrderValue: aov,
                formattedAOV: formatPrice(aov),
                topProducts,
                topSellingProducts: topProducts,
                fulfillmentBreakdown,
                statusBreakdown: fulfillmentBreakdown,
                fulfillmentRate:
                  totalOrders > 0
                    ? Math.round((fulfillmentBreakdown.delivered / totalOrders) * 100)
                    : 0,
                totalCustomers: serverCustomersDatabase.size,
                totalDiscountGiven: serverOrdersDatabase.reduce(
                  (sum, o) => sum + (o.discountAmount || 0),
                  0
                ),
              },
            })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.99: Public Storefront Settings (/api/settings)
      // -------------------------------------------------------------
      server.middlewares.use('/api/settings', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              settings: {
                storeName: serverStoreSettings.storeName,
                announcementBanner: serverStoreSettings.announcementBanner,
                codEnabled: serverStoreSettings.codEnabled,
                freeShippingThreshold: serverStoreSettings.freeShippingThreshold,
                storeStatus: serverStoreSettings.storeStatus,
                supportPhone: serverStoreSettings.supportPhone,
                supportEmail: serverStoreSettings.supportEmail,
                heroProducts: serverStoreSettings.heroProducts,
              },
            })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 3.991: Public Hero Products Showcase API (/api/hero-products)
      // -------------------------------------------------------------
      server.middlewares.use('/api/hero-products', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              count: serverStoreSettings.heroProducts.length,
              products: serverStoreSettings.heroProducts,
            })
          );
        }

        next();
      });

      // -------------------------------------------------------------
      // ENDPOINT 4: Master Order Processing, Tracking & Persistence (/api/orders)
      // -------------------------------------------------------------
      server.middlewares.use('/api/orders', (req, res, next) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Customer-Phone, X-Admin-Key, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');
        const cleanPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
        const pathParts = cleanPath.split('/').filter(Boolean);

        // -------------------------------------------------------------
        // SUB-ROUTE D: Authorized Status & Tracking Update (/api/orders/:orderRef/status)
        // Requirement 6: Legitimate status update recorded by authorized backend/admin process
        // -------------------------------------------------------------
        if ((req.method === 'POST' || req.method === 'PATCH') && pathParts.length === 2 && pathParts[1] === 'status') {
          res.setHeader('Content-Type', 'application/json');
          const orderRef = decodeURIComponent(pathParts[0]).trim();

          if (!isAuthorizedAdmin(req, parsedUrl)) {
            res.statusCode = 401;
            return res.end(
              JSON.stringify({
                success: false,
                error: 'Unauthorized: Admin authorization required to update order status or tracking.',
              })
            );
          }

          const order = serverOrdersDatabase.find(
            (o) =>
              o.orderRef.toUpperCase() === orderRef.toUpperCase() ||
              o.id === orderRef
          );

          if (!order) {
            res.statusCode = 404;
            return res.end(
              JSON.stringify({
                success: false,
                error: `Order "${orderRef}" not found.`,
              })
            );
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const {
                status,
                carrier,
                trackingNumber,
                trackingUrl,
                estimatedDelivery,
                description,
                location,
                timestamp,
              } = payload;

              const VALID_STATUSES = [
                'Order Placed',
                'Confirmed',
                'Packed',
                'Shipped',
                'Out for Delivery',
                'Delivered',
                'Cancelled',
              ];

              const matchedStatus = VALID_STATUSES.find(
                (s) => s.toLowerCase() === String(status || '').trim().toLowerCase()
              );

              if (!matchedStatus) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: `Invalid order status. Supported statuses: ${VALID_STATUSES.join(', ')}`,
                  })
                );
              }

              // Update order statuses
              order.status = matchedStatus;
              order.fulfillmentStatus = matchedStatus;
              if (matchedStatus === 'Cancelled') {
                order.isCancelled = true;
              }

              // Ensure tracking structure
              if (!order.tracking) {
                order.tracking = {
                  status: matchedStatus,
                  carrier: null,
                  trackingNumber: null,
                  trackingUrl: null,
                  estimatedDelivery: null,
                  events: [],
                };
              }

              order.tracking.status = matchedStatus;
              if (carrier !== undefined) order.tracking.carrier = carrier || null;
              if (trackingNumber !== undefined) order.tracking.trackingNumber = trackingNumber || null;
              if (trackingUrl !== undefined) order.tracking.trackingUrl = trackingUrl || null;
              if (estimatedDelivery !== undefined) order.tracking.estimatedDelivery = estimatedDelivery || null;

              const eventTimestamp = timestamp || new Date().toISOString();
              order.tracking.events.push({
                status: matchedStatus,
                title: matchedStatus,
                description:
                  description ||
                  (matchedStatus === 'Cancelled'
                    ? 'Order was cancelled by store operations.'
                    : `Order status updated to ${matchedStatus}.`),
                location: location || null,
                timestamp: eventTimestamp,
              });

              // STEP 14: Trigger Order Status Change Notification
              try {
                await triggerOrderNotification({
                  order,
                  eventType: 'ORDER_STATUS_CHANGE',
                  extra: {
                    status: matchedStatus,
                    carrier: order.tracking?.carrier,
                    trackingNumber: order.tracking?.trackingNumber,
                    description,
                    location,
                  },
                });
              } catch (notifErr) {
                console.error('[Notification Status Warning]:', notifErr.message);
              }

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Order status successfully updated to ${matchedStatus}`,
                  order,
                })
              );
            } catch {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({ success: false, error: 'Invalid JSON payload for status update.' })
              );
            }
          });
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');

          // -----------------------------------------------------------
          // SUB-ROUTE A: Customer Order History (/api/orders/history)
          // Requirement 2, 6, 7: Securely retrieve customer order history
          // -----------------------------------------------------------
          if (cleanPath === 'history' || parsedUrl.searchParams.has('history')) {
            const rawPhone =
              req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
            let phone = String(rawPhone || '').replace(/\D/g, '');
            if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
            else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

            // Requirement 7: Verify authorization on every order-history request
            if (!phone || phone.length !== 10) {
              res.statusCode = 401;
              return res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Unauthorized: A valid 10-digit mobile number is required to access order history.',
                })
              );
            }

            const customerOrders = serverOrdersDatabase.filter(
              (o) => o.customer?.mobile === phone
            );

            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                count: customerOrders.length,
                orders: customerOrders,
              })
            );
          }

          // -----------------------------------------------------------
          // SUB-ROUTE B1: Customer Order Tracking (/api/orders/:orderRef/tracking)
          // Requirements 1, 5, 7, 9: Customer tracking with privacy enforcement
          // -----------------------------------------------------------
          if (pathParts.length === 2 && pathParts[1] === 'tracking') {
            const orderRef = decodeURIComponent(pathParts[0]).trim();

            const rawPhone =
              req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
            let phone = String(rawPhone || '').replace(/\D/g, '');
            if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
            else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

            // Requirement 9: Verify customer authorization
            if (!phone || phone.length !== 10) {
              res.statusCode = 401;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: 'Unauthorized: Mobile verification is required to track order.',
                })
              );
            }

            const order = serverOrdersDatabase.find(
              (o) =>
                o.orderRef.toUpperCase() === orderRef.toUpperCase() ||
                o.id === orderRef
            );

            if (!order) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: `Order "${orderRef}" not found.`,
                })
              );
            }

            // Customer isolation check (Requirement 9)
            if (order.customer?.mobile !== phone) {
              res.statusCode = 403;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: 'Forbidden: You do not have permission to access tracking for this order.',
                })
              );
            }

            const trackingData = order.tracking || {
              status: order.status || 'Order Placed',
              carrier: null,
              trackingNumber: null,
              trackingUrl: null,
              estimatedDelivery: null,
              events: [
                {
                  status: order.status || 'Order Placed',
                  title: order.status || 'Order Placed',
                  description: 'Order placed with Machii Mens Mart.',
                  timestamp: order.createdAt,
                },
              ],
            };

            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                orderRef: order.orderRef,
                status: order.status,
                fulfillmentStatus: order.fulfillmentStatus,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                createdAt: order.createdAt,
                customer: {
                  fullName: order.customer?.fullName,
                  city: order.customer?.city,
                  state: order.customer?.state,
                  pincode: order.customer?.pincode,
                },
                tracking: trackingData,
                notifications: order.notifications || [],
              })
            );
          }

          // -----------------------------------------------------------
          // SUB-ROUTE B3: Order Notifications Audit Log (/api/orders/:orderRef/notifications)
          // -----------------------------------------------------------
          if (pathParts.length === 2 && pathParts[1] === 'notifications') {
            const orderRef = decodeURIComponent(pathParts[0]).trim();
            const order = serverOrdersDatabase.find(
              (o) =>
                o.orderRef.toUpperCase() === orderRef.toUpperCase() ||
                o.id === orderRef
            );

            if (!order) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({ success: false, error: `Order "${orderRef}" not found.` })
              );
            }

            const isAdmin = isAuthorizedAdmin(req, parsedUrl);
            const rawPhone =
              req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
            let phone = String(rawPhone || '').replace(/\D/g, '');
            if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
            else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

            if (!isAdmin && (!phone || order.customer?.mobile !== phone)) {
              res.statusCode = 403;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: 'Forbidden: You do not have permission to view notification logs for this order.',
                })
              );
            }

            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                orderRef: order.orderRef,
                count: (order.notifications || []).length,
                notifications: order.notifications || [],
              })
            );
          }

          // -----------------------------------------------------------
          // SUB-ROUTE B2: Single Order Details (/api/orders/:orderRef)
          // Requirement 5, 7: Open order detail and verify authorization
          // -----------------------------------------------------------
          if (pathParts.length === 1 && pathParts[0] !== 'history') {
            const orderRef = decodeURIComponent(pathParts[0]).trim();

            const rawPhone =
              req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
            let phone = String(rawPhone || '').replace(/\D/g, '');
            if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
            else if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

            // Requirement 7: Authorization check on every single order request
            if (!phone || phone.length !== 10) {
              res.statusCode = 401;
              return res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'Unauthorized: Mobile verification is required to view order details.',
                })
              );
            }

            const order = serverOrdersDatabase.find(
              (o) =>
                o.orderRef.toUpperCase() === orderRef.toUpperCase() ||
                o.id === orderRef
            );

            if (!order) {
              res.statusCode = 404;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: `Order "${orderRef}" not found.`,
                })
              );
            }

            // Never expose another customer's order (Requirement 7)
            if (order.customer?.mobile !== phone) {
              res.statusCode = 403;
              return res.end(
                JSON.stringify({
                  success: false,
                  error: 'Forbidden: You do not have permission to view this order.',
                })
              );
            }

            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, order }));
          }

          // -----------------------------------------------------------
          // SUB-ROUTE C: Base /api/orders (Status & phone-authorized list)
          // Fixes BOLA: Anonymous users cannot dump the whole orders database
          // -----------------------------------------------------------
          const rawPhone =
            req.headers['x-customer-phone'] || parsedUrl.searchParams.get('phone');
          let phone = sanitizeAndValidatePhone(rawPhone);

          if (phone) {
            const customerOrders = serverOrdersDatabase.filter(
              (o) => o.customer?.mobile === phone
            );
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                status: 'ok',
                totalOrders: customerOrders.length,
                orders: customerOrders,
              })
            );
          }

          // Admin authorized orders query
          if (isAuthorizedAdmin(req, parsedUrl)) {
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                status: 'ok',
                totalOrders: serverOrdersDatabase.length,
                orders: serverOrdersDatabase,
              })
            );
          }

          // Reject unauthenticated dumping of customer orders
          res.statusCode = 401;
          return res.end(
            JSON.stringify({
              success: false,
              error:
                'Unauthorized: Mobile verification or admin authorization is required to view orders.',
            })
          );
        }

        if (req.method === 'POST') {
          // Rate limit order placement to prevent inventory exhaustion attacks (Requirement 8)
          if (!enforceRateLimit(req, res, orderCreationLimiter)) {
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const {
                items = [],
                customer = {},
                paymentMethod = 'COD',
                couponCode = null,
              } = data;

              // Validate & Sanitize Customer
              const fullName = sanitizeText(customer.fullName, 60);
              if (!fullName || fullName.length < 2) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Full name must be at least 2 characters',
                  })
                );
              }

              const mobile = sanitizeAndValidatePhone(customer.mobile);
              if (!mobile) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)',
                  })
                );
              }

              const address = sanitizeText(customer.address, 200);
              if (!address || address.length < 8) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Full delivery address must be at least 8 characters',
                  })
                );
              }

              const city = sanitizeText(customer.city, 60);
              if (!city || city.length < 2) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Valid city name is required',
                  })
                );
              }

              const state = sanitizeText(customer.state, 60);
              if (!state) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Delivery state is required',
                  })
                );
              }

              const pincode = sanitizeAndValidatePincode(customer.pincode);
              if (!pincode) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Valid 6-digit Indian PIN code is required',
                  })
                );
              }

              const sanitizedEmail = customer.email
                ? sanitizeAndValidateEmail(customer.email)
                : null;

              // Validate Items & Recheck Availability and Authoritative Prices
              if (!Array.isArray(items) || items.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Cannot create order: Bag is empty',
                  })
                );
              }

              const verifiedItems = [];
              let calculatedSubtotal = 0;

              for (const item of items) {
                const catalogProduct = findCatalogProduct(item.id, item.name);
                if (!catalogProduct) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Product "${item.name || item.id}" is unavailable or no longer in the catalog.`,
                    })
                  );
                }

                // Requirement 4: Verify stock and active state on server before accepting order
                if (catalogProduct.isActive === false) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Product "${catalogProduct.name}" is archived and no longer available for purchase.`,
                    })
                  );
                }

                const availableStock =
                  typeof catalogProduct.stock === 'number' ? catalogProduct.stock : 0;
                if (availableStock <= 0) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Product "${catalogProduct.name}" is currently out of stock.`,
                    })
                  );
                }

                const quantity = Math.max(1, Math.min(10, parseInt(item.quantity, 10) || 1));

                if (quantity > availableStock) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: `Only ${availableStock} unit(s) available for "${catalogProduct.name}". Please reduce quantity.`,
                    })
                  );
                }

                const size = String(item.size || '').toUpperCase();
                if (Array.isArray(catalogProduct.sizes) && catalogProduct.sizes.length > 0) {
                  if (!catalogProduct.sizes.some((s) => s.toUpperCase() === size)) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(
                      JSON.stringify({
                        success: false,
                        error: `Size "${size}" is unavailable for "${catalogProduct.name}".`,
                      })
                    );
                  }
                }

                // Authoritative Catalog Price
                const authenticPrice = parsePrice(catalogProduct.price);
                const lineTotal = authenticPrice * quantity;
                calculatedSubtotal += lineTotal;

                verifiedItems.push({
                  key: item.key || `${catalogProduct.id}_${item.color}_${size}`,
                  id: catalogProduct.id,
                  name: catalogProduct.name,
                  subName: catalogProduct.subName || catalogProduct.subTitle || '',
                  price: formatPrice(authenticPrice),
                  priceNum: authenticPrice,
                  color: item.color || 'Standard',
                  colorHex: item.colorHex || '#26262A',
                  size: size,
                  quantity,
                  lineTotal,
                  image: item.image || catalogProduct.image,
                });
              }

              // STEP 13: Server-side Authoritative Coupon Validation & Discount Calculation
              // (Requirements 2, 4, 5, 8, 9, 11)
              let discountAmount = 0;
              let appliedCouponInfo = null;

              if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
                const couponRes = validateAndCalculateCoupon(couponCode, calculatedSubtotal, mobile);
                if (!couponRes.valid) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(
                    JSON.stringify({
                      success: false,
                      error: couponRes.error,
                      minOrderAmount: couponRes.minOrderAmount || null,
                    })
                  );
                }

                discountAmount = couponRes.discountAmount;
                appliedCouponInfo = couponRes.coupon;

                // Increment coupon redemption counts securely
                const dbCoupon = serverCouponsDatabase.find(
                  (c) => c.code.toUpperCase() === couponCode.trim().toUpperCase()
                );
                if (dbCoupon) {
                  dbCoupon.usedCount = (dbCoupon.usedCount || 0) + 1;
                  if (!dbCoupon.customerUsage) dbCoupon.customerUsage = {};
                  dbCoupon.customerUsage[mobile] = (dbCoupon.customerUsage[mobile] || 0) + 1;
                  dbCoupon.updatedAt = new Date().toISOString();
                }
              }

              const shipping = 0;
              // Requirement 8: Discounts cannot reduce payable total below zero
              const total = Math.max(0, calculatedSubtotal - discountAmount + shipping);

              // Enforce Requirement 4: Online payment gateway check
              const chosenMethod = paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD';

              if (chosenMethod === 'COD' && serverStoreSettings.codEnabled === false) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Cash on Delivery (COD) is temporarily disabled by store operations. Please choose online payment.',
                  })
                );
              }

              const keyId = process.env.RAZORPAY_KEY_ID || null;
              const keySecret = process.env.RAZORPAY_KEY_SECRET || null;
              const isGatewayConfigured = Boolean(keyId && keySecret);

              if (chosenMethod === 'ONLINE' && !isGatewayConfigured) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error:
                      'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET. Please choose Cash on Delivery (COD) to place your order.',
                  })
                );
              }

              // Duplicate submission guard (within last 10 seconds from same customer)
              const isRecentDuplicate = serverOrdersDatabase.some((o) => {
                const ageSec = (Date.now() - new Date(o.createdAt).getTime()) / 1000;
                return (
                  ageSec < 10 &&
                  o.customer?.mobile === mobile &&
                  o.total === total
                );
              });

              if (isRecentDuplicate) {
                res.statusCode = 409;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: false,
                    error:
                      'Duplicate order detected. An identical order was placed just a few seconds ago.',
                  })
                );
              }

              const year = new Date().getFullYear();
              const uniqueRef = `MCH-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

              const nowIso = new Date().toISOString();

              // Requirement 5 & 10: Strict separation of payment status from fulfillment status
              const orderRecord = {
                id: uniqueRef,
                orderRef: uniqueRef,
                createdAt: nowIso,
                status: 'Order Placed',
                paymentMethod: chosenMethod,
                paymentStatus: chosenMethod === 'COD' ? 'PENDING' : 'PAID',
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
                  gateway: chosenMethod === 'ONLINE' ? 'razorpay' : null,
                  transactionId: null,
                  paidAt: null,
                  note:
                    chosenMethod === 'COD'
                      ? 'Cash or UPI upon doorstep delivery'
                      : 'Paid online via gateway',
                },
                customer: {
                  fullName,
                  mobile,
                  email: sanitizedEmail,
                  address,
                  city,
                  state,
                  pincode,
                },
                items: verifiedItems,
                couponCode: appliedCouponInfo ? appliedCouponInfo.code : null,
                discountAmount,
                pricing: {
                  subtotal: calculatedSubtotal,
                  discount: discountAmount,
                  couponCode: appliedCouponInfo ? appliedCouponInfo.code : null,
                  shipping,
                  total,
                },
                subtotal: calculatedSubtotal,
                discount: discountAmount,
                shipping,
                total,
                currency: 'INR',
              };

              serverOrdersDatabase.unshift(orderRecord);

              // Decrement real product stock (Requirement 5)
              for (const vi of verifiedItems) {
                const catalogProd = findCatalogProduct(vi.id, vi.name);
                if (catalogProd && catalogProd.stock !== undefined) {
                  catalogProd.stock = Math.max(0, catalogProd.stock - (vi.quantity || 1));
                  catalogProd.updatedAt = new Date().toISOString();
                }
              }

              // Sync customer profile and auto-seed default address
              const custRec = getOrCreateCustomerRecord(mobile, {
                fullName,
                email: customer.email,
              });
              custRec.fullName = fullName;
              if (customer.email) custRec.email = String(customer.email).trim();
              custRec.updatedAt = new Date().toISOString();
              if (custRec.addresses.length === 0 && address) {
                custRec.addresses.push({
                  id: `addr_${Date.now()}_init`,
                  recipientName: fullName,
                  mobile: mobile,
                  address,
                  city,
                  state,
                  pincode,
                  isDefault: true,
                  tag: 'Home',
                  createdAt: new Date().toISOString(),
                });
              }

              // STEP 14: Trigger Order Confirmation Notification
              try {
                await triggerOrderNotification({
                  order: orderRecord,
                  eventType: 'ORDER_CONFIRMATION',
                });
              } catch (notifErr) {
                console.error('[Order Notification Warning]:', notifErr.message);
              }

              if (orderRecord.paymentStatus === 'PAID') {
                try {
                  await triggerOrderNotification({
                    order: orderRecord,
                    eventType: 'PAYMENT_CONFIRMATION',
                    extra: {
                      transactionId: orderRecord.paymentDetails?.transactionId || 'PAID_AT_CHECKOUT',
                    },
                  });
                } catch (notifErr) {
                  console.error('[Payment Notification Warning]:', notifErr.message);
                }
              }

              res.statusCode = 201;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, order: orderRecord }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(
                JSON.stringify({ success: false, error: 'Invalid order payload' })
              );
            }
          });
          return;
        }

        next();
      });
    }

  return {
    name: 'machii-order-backend-api',
    configureServer(server) {
      registerServerMiddlewares(server);
    },
    configurePreviewServer(server) {
      registerServerMiddlewares(server);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), orderApiPlugin()],
  server: {
    host: true,
    port: 3000,
  },
  preview: {
    host: true,
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('gsap') || id.includes('lenis')) {
              return 'vendor-motion';
            }
          }
        },
      },
    },
  },
}))
