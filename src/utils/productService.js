/**
 * MACHII MENS MART — STOREFRONT PRODUCT SERVICE
 * Handles fetching active products from the server catalog with resilient query parameters,
 * filtering, sorting, and offline fallback.
 */

import { COLLECTION_PRODUCTS } from '../data/products';
import { parsePrice } from './cartStorage';

export async function fetchStorefrontProducts(filters = {}) {
  const {
    q,
    category,
    size,
    color,
    minPrice,
    maxPrice,
    inStock,
    sort,
    page,
    limit,
  } = filters;

  const params = new URLSearchParams();
  if (q && q.trim()) params.append('q', q.trim());
  if (category && category !== 'all') params.append('category', category);
  if (size && size !== 'all') params.append('size', size);
  if (color && color !== 'all') params.append('color', color);
  if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.append('minPrice', String(minPrice));
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.append('maxPrice', String(maxPrice));
  if (inStock) params.append('inStock', 'true');
  if (sort && sort !== 'featured') params.append('sort', sort);
  if (page) params.append('page', String(page));
  if (limit) params.append('limit', String(limit));

  const queryString = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await fetch(`/api/products${queryString}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        return {
          success: true,
          products: data.products,
          count: data.count || data.products.length,
          totalCount: data.totalCount || data.products.length,
          page: data.page || 1,
          totalPages: data.totalPages || 1,
          facets: data.facets || null,
          isFallback: false,
        };
      }
    }
  } catch {
    // Fall back to resilient local calculation
  }

  // Resilient Local Filtering & Sorting Fallback
  let localFiltered = [...COLLECTION_PRODUCTS];

  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    localFiltered = localFiltered.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(query);
      const subMatch = (p.subTitle || p.subName)?.toLowerCase().includes(query);
      const descMatch = p.description?.toLowerCase().includes(query);
      const fitMatch = p.fit?.toLowerCase().includes(query);
      const gsmMatch = p.gsm?.toLowerCase().includes(query);
      const colorMatch = p.colors?.some((c) => c.name?.toLowerCase().includes(query));
      return Boolean(nameMatch || subMatch || descMatch || fitMatch || gsmMatch || colorMatch);
    });
  }

  if (category && category !== 'all') {
    localFiltered = localFiltered.filter((p) =>
      p.categories?.includes(category.toLowerCase())
    );
  }

  if (size && size !== 'all') {
    localFiltered = localFiltered.filter((p) =>
      p.sizes?.some((s) => s.toUpperCase() === size.toUpperCase())
    );
  }

  if (color && color !== 'all') {
    const targetCol = color.toLowerCase();
    localFiltered = localFiltered.filter((p) =>
      p.colors?.some((c) => c.name?.toLowerCase().includes(targetCol))
    );
  }

  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    const minP = parsePrice(minPrice);
    localFiltered = localFiltered.filter((p) => parsePrice(p.price) >= minP);
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    const maxP = parsePrice(maxPrice);
    if (maxP > 0) {
      localFiltered = localFiltered.filter((p) => parsePrice(p.price) <= maxP);
    }
  }

  if (inStock) {
    localFiltered = localFiltered.filter((p) => p.stock === undefined || p.stock > 0);
  }

  if (sort === 'price-asc') {
    localFiltered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  } else if (sort === 'price-desc') {
    localFiltered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  } else if (sort === 'popularity') {
    localFiltered.sort((a, b) => {
      const aPop = a.badge === 'POPULAR' ? 1 : 0;
      const bPop = b.badge === 'POPULAR' ? 1 : 0;
      return bPop - aPop;
    });
  }

  return {
    success: true,
    products: localFiltered,
    count: localFiltered.length,
    totalCount: localFiltered.length,
    page: 1,
    totalPages: 1,
    isFallback: true,
  };
}
