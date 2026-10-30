/* ==========================================================================
   MACHII MENS MART — SEO & SOCIAL SHARING SERVICE (STEP 18)
   Manages dynamic document titles, meta descriptions, Open Graph (OG),
   Twitter/X cards, canonical URLs, robots indexing directives, and
   Schema.org JSON-LD structured data without hardcoding.
   ========================================================================== */

export const DEFAULT_SEO = {
  title: 'MACHII MENS MART — Wear Your Attitude | Gen Z Oversized Streetwear',
  description: "Discover Machii Mens Mart: Premium Gen Z Indian men's fashion specializing in heavyweight (260–420 GSM) oversized graphic tees, drop-shoulder cuts, and limited streetwear drops. Free pan-India express shipping.",
  siteName: 'Machii Mens Mart',
  defaultImage: '/assets/products/machii-attitude-01-charcoal.png',
  locale: 'en_IN',
  twitterHandle: '@machiimensmart',
};

/**
 * Resolves the absolute canonical origin for URLs based on environment or browser location.
 */
export function getSiteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://machiimensmart.com';
}

/**
 * Converts a relative path into an absolute URL if needed.
 */
export function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return `${getSiteOrigin()}${DEFAULT_SEO.defaultImage}`;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteOrigin()}${cleanPath}`;
}

/**
 * Creates or updates a `<meta>` tag in `<head>`.
 */
function setMetaTag(attrName, attrValue, content) {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content || '');
}

/**
 * Creates or updates the `<link rel="canonical">` element in `<head>`.
 */
export function setCanonicalUrl(url) {
  if (typeof document === 'undefined') return;
  const canonicalUrl = toAbsoluteUrl(url || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', canonicalUrl);
}

/**
 * Injects or updates a JSON-LD structured data block in `<head>`.
 */
export function injectJsonLd(id, data) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('id', id);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data, null, 2);
}

/**
 * Removes a JSON-LD structured data block from `<head>`.
 */
export function removeJsonLd(id) {
  if (typeof document === 'undefined') return;
  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
}

/**
 * Parses numeric price from string formatted prices (e.g., '₹1,499' -> 1499).
 */
export function parsePriceNum(val) {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (!val) return 0;
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Updates full page SEO, Open Graph, and Twitter metadata.
 */
export function updatePageSeo({
  title,
  description,
  image,
  url,
  type = 'website',
  noindex = false,
}) {
  if (typeof document === 'undefined') return;

  const resolvedTitle = title || DEFAULT_SEO.title;
  const resolvedDesc = description || DEFAULT_SEO.description;
  const resolvedImage = toAbsoluteUrl(image || DEFAULT_SEO.defaultImage);
  const resolvedUrl = toAbsoluteUrl(url || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'));

  // 1. Document Title
  document.title = resolvedTitle;

  // 2. Standard Meta
  setMetaTag('name', 'description', resolvedDesc);
  setMetaTag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

  // 3. Open Graph (Facebook, WhatsApp, LinkedIn, Discord)
  setMetaTag('property', 'og:site_name', DEFAULT_SEO.siteName);
  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:title', resolvedTitle);
  setMetaTag('property', 'og:description', resolvedDesc);
  setMetaTag('property', 'og:image', resolvedImage);
  setMetaTag('property', 'og:url', resolvedUrl);
  setMetaTag('property', 'og:locale', DEFAULT_SEO.locale);

  // 4. Twitter / X Cards
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', resolvedTitle);
  setMetaTag('name', 'twitter:description', resolvedDesc);
  setMetaTag('name', 'twitter:image', resolvedImage);
  setMetaTag('name', 'twitter:site', DEFAULT_SEO.twitterHandle);

  // 5. Canonical URL
  setCanonicalUrl(resolvedUrl);
}

/**
 * Applies dynamic SEO, Open Graph, Twitter Cards, and Product JSON-LD schema
 * for an active product view.
 */
export function setProductSeo(product, selectedColor = null) {
  if (!product) return;

  const colorName = selectedColor?.name || product.colors?.[0]?.name || product.color || '';
  const priceNum = parsePriceNum(product.price);
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  const title = `${product.name}${colorName ? ` (${colorName})` : ''} — Machii Mens Mart`;
  const description = `${product.description || product.desc || 'Signature Gen Z drop-shoulder cut'}. Heavyweight ${product.gsm || '280 GSM combed cotton'} oversized streetwear. Price: ${product.price}. In stock with free pan-India express shipping.`;
  const image = selectedColor?.front || selectedColor?.image || product.image || DEFAULT_SEO.defaultImage;
  const productUrl = `/?product=${encodeURIComponent(product.id)}`;

  updatePageSeo({
    title,
    description,
    image,
    url: productUrl,
    type: 'product',
    noindex: false,
  });

  // Inject Schema.org Product Structured Data
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.desc || 'Premium streetwear garment by Machii Mens Mart',
    image: [toAbsoluteUrl(image)],
    sku: String(product.id),
    mpn: `MCH-${String(product.id).toUpperCase()}`,
    brand: {
      '@type': 'Brand',
      name: 'Machii Mens Mart',
    },
    category: 'Apparel & Accessories > Clothing > Shirts & Tops',
    color: colorName || undefined,
    material: product.gsm || 'Heavyweight Combed Cotton',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: priceNum,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: isOutOfStock
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: toAbsoluteUrl(productUrl),
      seller: {
        '@type': 'Organization',
        name: 'Machii Mens Mart',
      },
    },
  };

  injectJsonLd('machii-product-schema', productSchema);
}

/**
 * Enforces noindex on private administrative routes.
 */
export function setAdminSeo() {
  updatePageSeo({
    title: 'Admin Operations Portal — Machii Mens Mart',
    description: 'Internal operations dashboard for inventory management, store settings, and order dispatch.',
    noindex: true,
  });
  removeJsonLd('machii-product-schema');
}

/**
 * Enforces noindex on private customer checkout flows.
 */
export function setCheckoutSeo() {
  updatePageSeo({
    title: 'Secure Checkout — Machii Mens Mart',
    description: 'Complete your order with Cash on Delivery or Instant Online UPI/Card payment.',
    noindex: true,
  });
  removeJsonLd('machii-product-schema');
}

/**
 * Resets document metadata and structured data to default storefront branding.
 */
export function resetDefaultSeo() {
  updatePageSeo({
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    image: DEFAULT_SEO.defaultImage,
    url: '/',
    type: 'website',
    noindex: false,
  });

  removeJsonLd('machii-product-schema');

  // Inject Global WebSite and Organization Structured Data
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${getSiteOrigin()}/#organization`,
        name: 'Machii Mens Mart',
        url: getSiteOrigin(),
        logo: {
          '@type': 'ImageObject',
          url: toAbsoluteUrl('/favicon.svg'),
        },
        description: "Premium Gen Z Indian men's streetwear brand specializing in heavyweight oversized graphic t-shirts and hoodies.",
        sameAs: [
          'https://instagram.com/machiimensmart',
          'https://discord.gg/machiimensmart',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${getSiteOrigin()}/#website`,
        url: getSiteOrigin(),
        name: 'Machii Mens Mart',
        description: 'Wear Your Attitude. Gen Z Oversized Streetwear & Heavyweight Drops.',
        publisher: {
          '@id': `${getSiteOrigin()}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${getSiteOrigin()}/?q={search_term_string}#collection-drop`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  injectJsonLd('machii-website-schema', websiteSchema);
}

