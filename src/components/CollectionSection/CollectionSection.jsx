import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Sparkles,
  ArrowRight,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Check,
  PackageX,
  TrendingUp,
  Tag,
  DollarSign,
} from 'lucide-react';
import ProductCard from '../ProductCard/ProductCard';
import { COLLECTION_PRODUCTS } from '../../data/products';
import { fetchStorefrontProducts } from '../../utils/productService';
import './CollectionSection.css';

const QuickViewModal = lazy(() => import('../QuickViewModal/QuickViewModal'));

gsap.registerPlugin(ScrollTrigger);

const FILTER_TABS = [
  { id: 'all', label: 'All Fits' },
  { id: 'oversized', label: 'Oversized' },
  { id: 'printed', label: 'Printed' },
  { id: 'new-arrivals', label: 'New Arrivals' },
  { id: 'hoodies', label: 'Hoodies' },
];

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const COLOR_OPTIONS = [
  { id: 'all', name: 'All Colors', hex: null },
  { id: 'charcoal', name: 'Charcoal', hex: '#26262A' },
  { id: 'bone', name: 'Bone White', hex: '#F0EBE1' },
  { id: 'cobalt', name: 'Cobalt', hex: '#1D4ED8' },
  { id: 'sage', name: 'Olive Sage', hex: '#636954' },
  { id: 'cream', name: 'Vintage Cream', hex: '#F5EFE3' },
  { id: 'slate', name: 'Mineral Slate', hex: '#585961' },
];

const PRICE_RANGE_OPTIONS = [
  { id: 'all', label: 'All Prices' },
  { id: 'under-1500', label: 'Under ₹1,500', max: 1500 },
  { id: '1500-2000', label: '₹1,500 – ₹2,000', min: 1500, max: 2000 },
  { id: 'above-2000', label: 'Above ₹2,000', min: 2000 },
];

const SORT_OPTIONS = [
  { id: 'featured', label: 'Featured / Drop Order' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest First' },
  { id: 'popularity', label: 'Popularity / Bestsellers' },
];

export default function CollectionSection({
  onSelectProduct,
  wishlistIds = new Set(),
  onToggleWishlist,
}) {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSize, setActiveSize] = useState('all');
  const [activeColor, setActiveColor] = useState('all');
  const [activePriceRange, setActivePriceRange] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Pagination & Data states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [products, setProducts] = useState(COLLECTION_PRODUCTS);
  const [totalCount, setTotalCount] = useState(COLLECTION_PRODUCTS.length);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  const sectionRef = useRef(null);
  const gridRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debounce search query input (200ms) for responsive, low-latency search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch filtered & sorted products from backend API
  const loadFilteredProducts = useCallback(async () => {
    setIsLoading(true);

    const priceConfig = PRICE_RANGE_OPTIONS.find((p) => p.id === activePriceRange);
    const minPrice = priceConfig?.min !== undefined ? priceConfig.min : '';
    const maxPrice = priceConfig?.max !== undefined ? priceConfig.max : '';

    const res = await fetchStorefrontProducts({
      q: debouncedQuery,
      category: activeCategory,
      size: activeSize,
      color: activeColor,
      minPrice,
      maxPrice,
      inStock: inStockOnly,
      sort: sortBy,
      page: currentPage,
      limit: itemsPerPage,
    });

    if (res.success && Array.isArray(res.products)) {
      setProducts(res.products);
      setTotalCount(res.totalCount !== undefined ? res.totalCount : res.products.length);
      setTotalPages(res.totalPages !== undefined ? res.totalPages : 1);
    }
    setIsLoading(false);
  }, [
    debouncedQuery,
    activeCategory,
    activeSize,
    activeColor,
    activePriceRange,
    inStockOnly,
    sortBy,
    currentPage,
  ]);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        loadFilteredProducts();
      }
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [loadFilteredProducts]);

  // Initial GSAP reveal
  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set('.streetwear-product-card', { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        '.streetwear-product-card',
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 85%',
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Animate cards on results change
  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      '.streetwear-product-card',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
    );
  }, [products]);

  // Calculate active filter count for badge
  const activeSecondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (activeSize !== 'all') count++;
    if (activeColor !== 'all') count++;
    if (activePriceRange !== 'all') count++;
    if (inStockOnly) count++;
    if (sortBy !== 'featured') count++;
    return count;
  }, [activeSize, activeColor, activePriceRange, inStockOnly, sortBy]);

  const hasAnyFilterActive = useMemo(() => {
    return Boolean(
      searchQuery.trim() ||
        activeCategory !== 'all' ||
        activeSize !== 'all' ||
        activeColor !== 'all' ||
        activePriceRange !== 'all' ||
        inStockOnly ||
        sortBy !== 'featured'
    );
  }, [
    searchQuery,
    activeCategory,
    activeSize,
    activeColor,
    activePriceRange,
    inStockOnly,
    sortBy,
  ]);

  // Reset all filters
  const handleResetAllFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveCategory('all');
    setActiveSize('all');
    setActiveColor('all');
    setActivePriceRange('all');
    setInStockOnly(false);
    setSortBy('featured');
    setCurrentPage(1);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  };

  return (
    <section className="collection-drop-section" id="collection-drop" ref={sectionRef}>
      <div className="collection-container">
        {/* Section Header */}
        <div className="collection-header-row">
          <div className="collection-titles-group">
            <div className="collection-season-badge">
              <span className="live-pulse-dot" />
              <span className="mono-label">NEW SEASON / 2026</span>
            </div>

            <h2 className="collection-main-heading">THE LATEST DROP</h2>
            <p className="collection-supporting-text">
              Built oversized. Made to stand out. Real streetwear engineered for Gen Z.
            </p>
          </div>

          <div className="collection-badge-stamp" aria-hidden="true">
            <span className="stamp-title">DROP 01</span>
            <span className="stamp-sub">LIMITED EDITION</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 1. PRODUCT SEARCH & PRIMARY CATEGORIES TOOLBAR (Requirement 1 & 4)  */}
        {/* =================================================================== */}
        <div className="collection-search-controls-bar">
          {/* Real-time Product Search Input */}
          <div className="collection-search-wrapper">
            <Search size={18} className="collection-search-icon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              id="collection-search-input"
              className="collection-search-field"
              placeholder="Search by product name, graphic, 420 GSM, fit, colorway..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search collection products"
            />
            {searchQuery && (
              <button
                type="button"
                className="collection-search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search input"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Secondary Controls: Expand Filter Panel & Sort Dropdown */}
          <div className="collection-header-actions-right">
            {/* Filter Toggle Button with Badge */}
            <button
              type="button"
              className={`collection-filter-toggle-btn ${isFiltersExpanded ? 'active' : ''}`}
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              aria-expanded={isFiltersExpanded}
              id="toggle-filter-panel-btn"
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {activeSecondaryFiltersCount > 0 && (
                <span className="active-filter-badge">{activeSecondaryFiltersCount}</span>
              )}
              <ChevronDown
                size={14}
                className={`toggle-caret ${isFiltersExpanded ? 'open' : ''}`}
              />
            </button>

            {/* Quick Sorting Dropdown (Requirement 3) */}
            <div className="collection-sort-wrapper">
              <select
                id="collection-sort-select"
                className="collection-sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Sort product collection"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="collection-category-tabs-bar">
          <div className="filter-tabs-list" role="tablist" aria-label="Product Categories">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeCategory === tab.id}
                className={`filter-tab-btn ${activeCategory === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(tab.id);
                  setCurrentPage(1);
                }}
                id={`filter-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="filter-count-label" id="products-count-badge">
            Showing <strong>{totalCount}</strong> {totalCount === 1 ? 'Style' : 'Styles'}
          </span>
        </div>

        {/* =================================================================== */}
        {/* 2. EXPANDABLE MULTI-CRITERIA FILTERS PANEL (Requirement 2 & 4)      */}
        {/* =================================================================== */}
        {isFiltersExpanded && (
          <div className="collection-expanded-filters-panel" id="collection-filter-drawer">
            {/* Sizes Filter */}
            <div className="filter-group-block">
              <span className="filter-group-title">
                <Tag size={13} />
                <span>AVAILABLE SIZE</span>
              </span>
              <div className="filter-chips-grid">
                <button
                  type="button"
                  className={`size-filter-chip ${activeSize === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSize('all');
                    setCurrentPage(1);
                  }}
                >
                  All Sizes
                </button>
                {AVAILABLE_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`size-filter-chip ${activeSize === sz ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSize(activeSize === sz ? 'all' : sz);
                      setCurrentPage(1);
                    }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors Filter */}
            <div className="filter-group-block">
              <span className="filter-group-title">
                <Sparkles size={13} />
                <span>COLORWAY</span>
              </span>
              <div className="filter-swatches-grid">
                {COLOR_OPTIONS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    className={`color-swatch-chip ${activeColor === col.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveColor(activeColor === col.id ? 'all' : col.id);
                      setCurrentPage(1);
                    }}
                    title={col.name}
                  >
                    {col.hex && (
                      <span className="swatch-color-dot" style={{ backgroundColor: col.hex }} />
                    )}
                    <span>{col.name}</span>
                    {activeColor === col.id && <Check size={12} className="swatch-check" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="filter-group-block">
              <span className="filter-group-title">
                <DollarSign size={13} />
                <span>PRICE RANGE</span>
              </span>
              <div className="filter-chips-grid">
                {PRICE_RANGE_OPTIONS.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    className={`price-filter-chip ${activePriceRange === pr.id ? 'active' : ''}`}
                    onClick={() => {
                      setActivePriceRange(pr.id);
                      setCurrentPage(1);
                    }}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Availability Toggle */}
            <div className="filter-group-block stock-filter-block">
              <span className="filter-group-title">
                <TrendingUp size={13} />
                <span>AVAILABILITY</span>
              </span>
              <label className="in-stock-toggle-label">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  id="in-stock-only-checkbox"
                />
                <span className="toggle-text">In Stock Fits Only (Ready to Ship)</span>
              </label>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. ACTIVE FILTER CHIPS & RESET BAR (Requirement 5)                  */}
        {/* =================================================================== */}
        {hasAnyFilterActive && (
          <div className="active-filters-bar" id="active-filters-summary">
            <span className="active-filters-label">ACTIVE FILTERS:</span>

            <div className="active-chips-list">
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setSearchQuery('')}
                  title="Clear search filter"
                >
                  <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                  <X size={12} />
                </button>
              )}

              {activeCategory !== 'all' && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setActiveCategory('all')}
                  title="Clear category filter"
                >
                  <span>
                    Category: {FILTER_TABS.find((t) => t.id === activeCategory)?.label}
                  </span>
                  <X size={12} />
                </button>
              )}

              {activeSize !== 'all' && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setActiveSize('all')}
                  title="Clear size filter"
                >
                  <span>Size: {activeSize}</span>
                  <X size={12} />
                </button>
              )}

              {activeColor !== 'all' && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setActiveColor('all')}
                  title="Clear color filter"
                >
                  <span>Color: {COLOR_OPTIONS.find((c) => c.id === activeColor)?.name}</span>
                  <X size={12} />
                </button>
              )}

              {activePriceRange !== 'all' && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setActivePriceRange('all')}
                  title="Clear price filter"
                >
                  <span>
                    Price: {PRICE_RANGE_OPTIONS.find((p) => p.id === activePriceRange)?.label}
                  </span>
                  <X size={12} />
                </button>
              )}

              {inStockOnly && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setInStockOnly(false)}
                  title="Show all items including pre-orders"
                >
                  <span>In Stock Only</span>
                  <X size={12} />
                </button>
              )}

              {sortBy !== 'featured' && (
                <button
                  type="button"
                  className="active-tag-chip"
                  onClick={() => setSortBy('featured')}
                  title="Reset sorting"
                >
                  <span>Sort: {SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="reset-all-filters-btn"
              onClick={handleResetAllFilters}
              id="clear-all-filters-btn"
            >
              <RotateCcw size={13} />
              <span>Reset All</span>
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* 4. PRODUCTS GRID & EMPTY STATE (Requirement 6 & 10)                 */}
        {/* =================================================================== */}
        {products.length === 0 ? (
          <div className="collection-empty-results-box" id="empty-collection-results">
            <div className="empty-icon-frame">
              <PackageX size={44} className="empty-package-icon" />
            </div>
            <span className="empty-mono-tag">ZERO MATCHES FOUND</span>
            <h3 className="empty-heading">NO STREETWEAR FITS MATCH YOUR SELECTION</h3>
            <p className="empty-message">
              {searchQuery
                ? `No products matched "${searchQuery}" with the current filters. Check for spelling errors or try resetting filters.`
                : 'No products match the selected filters. Broaden your size, color, or price range to explore the collection.'}
            </p>
            <button
              type="button"
              className="empty-reset-cta-btn"
              onClick={handleResetAllFilters}
              id="empty-reset-filters-btn"
            >
              <RotateCcw size={15} />
              <span>EXPLORE ALL STREETWEAR FITS</span>
            </button>
          </div>
        ) : (
          <div className="collection-products-grid" ref={gridRef}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isInWishlist={wishlistIds.has(product.id)}
                onToggleWishlist={onToggleWishlist}
                onQuickView={(p) => {
                  if (onSelectProduct) {
                    onSelectProduct(p);
                  } else {
                    setQuickViewProduct(p);
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination (Requirement 7) */}
        {totalPages > 1 && (
          <div className="collection-pagination-bar" id="collection-pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Previous
            </button>

            <span className="pagination-info">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Next
            </button>
          </div>
        )}

        {/* Collection Editorial Footer Note */}
        <div className="collection-bottom-banner">
          <div className="banner-left">
            <Sparkles size={16} className="banner-icon" />
            <p className="banner-text">
              Crafted in India from custom-milled 260–420 GSM combed cotton. Pre-shrunk, drop-cut, zero compromises.
            </p>
          </div>
          <button
            type="button"
            className="banner-cta"
            onClick={handleResetAllFilters}
          >
            <span>EXPLORE FULL DROP</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Local Quick View Modal fallback */}
      {!onSelectProduct && quickViewProduct && (
        <Suspense fallback={null}>
          <QuickViewModal
            key={`showroom-v2-${quickViewProduct.id}`}
            product={quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
