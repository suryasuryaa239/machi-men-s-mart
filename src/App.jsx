import React, { useEffect, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import Header from './components/Header/Header';
import HeroShowcase from './components/HeroShowcase/HeroShowcase';
import CollectionSection from './components/CollectionSection/CollectionSection';
import NextSection from './components/NextSection/NextSection';
import CartDrawer from './components/CartDrawer/CartDrawer';

// Code-split modals for optimal initial load, smaller bundle size & instant First Contentful Paint
const QuickViewModal = lazy(() => import('./components/QuickViewModal/QuickViewModal'));
const CheckoutModal = lazy(() => import('./components/Checkout/CheckoutModal'));
const OrderHistoryModal = lazy(() => import('./components/OrderHistory/OrderHistoryModal'));
const ProfileModal = lazy(() => import('./components/Profile/ProfileModal'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const WishlistModal = lazy(() => import('./components/Wishlist/WishlistModal'));
import {
  loadCartFromStorage,
  saveCartToStorage,
  calculateCartCount,
  getCartItemKey,
} from './utils/cartStorage';
import {
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  mergeGuestWishlist,
} from './utils/wishlistService';
import {
  getStoredCoupon,
  clearStoredCoupon,
} from './utils/couponService';
import { getCustomerSessionPhone } from './utils/orderService';
import { initSmoothScroll } from './utils/smoothScroll';
import {
  resetDefaultSeo,
  setProductSeo,
  setAdminSeo,
  setCheckoutSeo,
} from './utils/seoService';
import { PRODUCTS, COLLECTION_PRODUCTS } from './data/products';
import { ShoppingBag, Check } from 'lucide-react';
import './App.css';

export default function App() {
  const [viewerProduct, setViewerProduct] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('product');
      if (prodId) {
        const catalog = [...PRODUCTS, ...COLLECTION_PRODUCTS];
        return catalog.find((p) => p.id === prodId || p.collectionId === prodId) || null;
      }
    }
    return null;
  });
  const [cartItems, setCartItems] = useState(() => loadCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [viewOrderRef, setViewOrderRef] = useState(null);
  const [cartToast, setCartToast] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(() => getStoredCoupon());

  const cartCount = calculateCartCount(cartItems);

  // Derived set of wishlist product IDs for fast O(1) lookup
  const wishlistIds = useMemo(
    () => new Set(wishlistItems.map((it) => it.productId || it.product?.id).filter(Boolean)),
    [wishlistItems]
  );

  useEffect(() => {
    // Single Lenis smooth physics scrolling instance integrated with GSAP ScrollTrigger
    const scrollController = initSmoothScroll();

    // Idle prefetch customer modal chunks during idle time to ensure instant interaction
    const prefetchModals = () => {
      import('./components/QuickViewModal/QuickViewModal');
      import('./components/Checkout/CheckoutModal');
      import('./components/Wishlist/WishlistModal');
      import('./components/OrderHistory/OrderHistoryModal');
      import('./components/Profile/ProfileModal');
    };

    let idleId = null;
    let timerId = null;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(prefetchModals, { timeout: 3500 });
    } else if (typeof window !== 'undefined') {
      timerId = setTimeout(prefetchModals, 2000);
    }

    return () => {
      scrollController?.destroy();
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // SEO & Deep-Linking: Listen for browser history navigation (back/forward popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('product');
      if (prodId) {
        const catalog = [...PRODUCTS, ...COLLECTION_PRODUCTS];
        const match = catalog.find((p) => p.id === prodId || p.collectionId === prodId);
        if (match) {
          setViewerProduct(match);
        }
      } else {
        setViewerProduct(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dynamic SEO Synchronization for Product Modal View
  useEffect(() => {
    if (viewerProduct) {
      setProductSeo(viewerProduct, viewerProduct.selectedColor);
      if (typeof window !== 'undefined' && window.history?.pushState) {
        const currentParam = new URLSearchParams(window.location.search).get('product');
        if (currentParam !== viewerProduct.id) {
          const newUrl = `${window.location.pathname}?product=${encodeURIComponent(viewerProduct.id)}`;
          window.history.pushState({ productId: viewerProduct.id }, '', newUrl);
        }
      }
    } else {
      if (!isAdminOpen && !isCheckoutOpen) {
        resetDefaultSeo();
      }
      if (typeof window !== 'undefined' && window.history?.pushState && window.location.search.includes('product=')) {
        window.history.pushState({}, '', window.location.pathname);
      }
    }
  }, [viewerProduct, isAdminOpen, isCheckoutOpen]);

  // Dynamic SEO Synchronization for Admin Security (noindex)
  useEffect(() => {
    if (isAdminOpen) {
      setAdminSeo();
    } else if (!viewerProduct && !isCheckoutOpen) {
      resetDefaultSeo();
    }
  }, [isAdminOpen, viewerProduct, isCheckoutOpen]);

  // Dynamic SEO Synchronization for Checkout Flow (noindex)
  useEffect(() => {
    if (isCheckoutOpen) {
      setCheckoutSeo();
    } else if (!viewerProduct && !isAdminOpen) {
      resetDefaultSeo();
    }
  }, [isCheckoutOpen, viewerProduct, isAdminOpen]);

  // Sync cart to localStorage whenever cartItems changes
  useEffect(() => {
    saveCartToStorage(cartItems);
  }, [cartItems]);

  // Listen for global cart update events (from quick view modal, hero rack, or cards)
  useEffect(() => {
    const handleCartEvent = (e) => {
      const { product, color, size, quantity = 1, image, id, name, price, colorHex } =
        e.detail || {};

      if (!product && !id) return;

      const prodId = product?.id || id;
      const prodName = product?.name || name;
      const prodPrice = product?.price || price;
      const colName = typeof color === 'string' ? color : color?.name || 'Standard';
      const colHex = colorHex || color?.hex || '#26262A';
      const prodImg = image || product?.image;
      const itemKey = getCartItemKey(prodId, colName, size);

      setCartItems((prevItems) => {
        const existingIndex = prevItems.findIndex((it) => it.key === itemKey);
        if (existingIndex > -1) {
          return prevItems.map((item, idx) => {
            if (idx === existingIndex) {
              return {
                ...item,
                quantity: Math.min(10, item.quantity + quantity),
              };
            }
            return item;
          });
        }
        const newItem = {
          key: itemKey,
          id: prodId,
          name: prodName,
          price: prodPrice,
          color: colName,
          colorHex: colHex,
          size: size,
          quantity: quantity,
          image: prodImg,
        };
        return [newItem, ...prevItems];
      });

      setCartToast({
        name: prodName,
        color: colName,
        size,
        quantity,
      });

      const timer = setTimeout(() => {
        setCartToast(null);
      }, 3200);

      return () => clearTimeout(timer);
    };

    const handleOpenCart = () => setIsCartOpen(true);
    const handleOpenOrders = (e) => {
      setViewOrderRef(e?.detail?.orderRef || null);
      setIsOrdersOpen(true);
    };
    const handleOpenAdmin = () => setIsAdminOpen(true);
    const handleOpenWishlist = () => setIsWishlistOpen(true);

    const checkUrlHash = () => {
      if (
        window.location.hash === '#admin' ||
        window.location.search.includes('admin=true')
      ) {
        setIsAdminOpen(true);
      } else if (window.location.hash === '#wishlist') {
        setIsWishlistOpen(true);
      }
    };
    checkUrlHash();

    window.addEventListener('machii:cart-update', handleCartEvent);
    window.addEventListener('machii:open-cart', handleOpenCart);
    window.addEventListener('machii:open-orders', handleOpenOrders);
    window.addEventListener('machii:open-admin', handleOpenAdmin);
    window.addEventListener('machii:open-wishlist', handleOpenWishlist);
    window.addEventListener('hashchange', checkUrlHash);
    return () => {
      window.removeEventListener('machii:cart-update', handleCartEvent);
      window.removeEventListener('machii:open-cart', handleOpenCart);
      window.removeEventListener('machii:open-orders', handleOpenOrders);
      window.removeEventListener('machii:open-admin', handleOpenAdmin);
      window.removeEventListener('machii:open-wishlist', handleOpenWishlist);
      window.removeEventListener('hashchange', checkUrlHash);
    };
  }, []);

  // Load & Synchronize Wishlist (Authenticated backend if logged in, else Guest local)
  const loadWishlist = useCallback(async () => {
    const phone = getCustomerSessionPhone();
    if (phone) {
      await mergeGuestWishlist(phone);
      const res = await fetchWishlist(phone);
      if (res.success && Array.isArray(res.items)) {
        setWishlistItems(res.items);
      }
    } else {
      const res = await fetchWishlist();
      if (res.success && Array.isArray(res.items)) {
        setWishlistItems(res.items);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWishlist();
    }, 0);

    const handleWishlistEvent = (e) => {
      if (e.detail?.items && Array.isArray(e.detail.items)) {
        setWishlistItems(e.detail.items);
      } else {
        loadWishlist();
      }
    };

    window.addEventListener('machii:wishlist-update', handleWishlistEvent);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('machii:wishlist-update', handleWishlistEvent);
    };
  }, [loadWishlist]);

  const handleAddToCart = (product, colorObj, size, quantity = 1, activeImg) => {
    const colorName = typeof colorObj === 'string' ? colorObj : colorObj?.name || 'Standard';
    const colorHex = colorObj?.hex || '#26262A';
    const image = activeImg || colorObj?.front || colorObj?.image || product.image;
    const itemKey = getCartItemKey(product.id, colorName, size);

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((it) => it.key === itemKey);
      if (existingIndex > -1) {
        return prevItems.map((item, idx) => {
          if (idx === existingIndex) {
            return {
              ...item,
              quantity: Math.min(10, item.quantity + quantity),
            };
          }
          return item;
        });
      }

      const newItem = {
        key: itemKey,
        id: product.id,
        name: product.name,
        price: product.price,
        color: colorName,
        colorHex: colorHex,
        size: size,
        quantity: quantity,
        image: image,
      };
      return [newItem, ...prevItems];
    });

    setCartToast({
      name: product.name,
      color: colorName,
      size: size,
      quantity: quantity,
    });

    setTimeout(() => {
      setCartToast(null);
    }, 3200);
  };

  const handleUpdateQuantity = (key, delta) => {
    setCartItems((prevItems) => {
      const next = prevItems
        .map((item) => {
          if (item.key === key) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...item, quantity: Math.min(10, nextQty) };
          }
          return item;
        })
        .filter(Boolean);
      if (next.length === 0) {
        setAppliedCoupon(null);
        clearStoredCoupon();
      }
      return next;
    });
  };

  const handleRemoveItem = (key) => {
    setCartItems((prevItems) => {
      const next = prevItems.filter((item) => item.key !== key);
      if (next.length === 0) {
        setAppliedCoupon(null);
        clearStoredCoupon();
      }
      return next;
    });
  };

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    setAppliedCoupon(null);
    clearStoredCoupon();
  }, []);

  const handleCloseCart = useCallback(() => setIsCartOpen(false), []);
  const handleCloseCheckout = useCallback(() => setIsCheckoutOpen(false), []);
  const handleCloseOrders = useCallback(() => {
    setIsOrdersOpen(false);
    setViewOrderRef(null);
  }, []);
  const handleCloseProfile = useCallback(() => setIsProfileOpen(false), []);
  const handleCloseAdmin = useCallback(() => {
    setIsAdminOpen(false);
    if (window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleCloseWishlist = useCallback(() => {
    setIsWishlistOpen(false);
    if (window.location.hash === '#wishlist') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleToggleWishlist = useCallback(
    async (product, colorObj, size) => {
      if (!product || !product.id) return;
      const isAlreadyIn = wishlistIds.has(product.id);

      if (isAlreadyIn) {
        const res = await removeFromWishlist(product.id);
        if (res.success) {
          setWishlistItems(res.items);
          setCartToast({
            productName: product.name,
            details: 'Removed from Saved Wishlist',
          });
          setTimeout(() => setCartToast(null), 3000);
        }
      } else {
        const res = await addToWishlist(product, colorObj, size);
        if (res.success) {
          setWishlistItems(res.items);
          setCartToast({
            productName: product.name,
            details: 'Saved to Streetwear Wishlist',
          });
          setTimeout(() => setCartToast(null), 3000);
        }
      }
    },
    [wishlistIds]
  );

  const handleMoveWishlistItemToCart = useCallback(
    (item, color, size) => {
      const prod = item.product || {};
      handleAddToCart(prod, color || item.selectedColor, size || item.selectedSize, 1, prod.image);
      removeFromWishlist(item.productId).then((res) => {
        if (res.success) setWishlistItems(res.items);
      });
      setCartToast({
        productName: prod.name,
        details: `Moved to Bag (${size || 'L'})`,
      });
      setTimeout(() => setCartToast(null), 3000);
    },
    []
  );

  const handleSaveForLater = useCallback(
    (cartItem) => {
      addToWishlist(
        {
          id: cartItem.id,
          name: cartItem.name,
          price: cartItem.price,
          image: cartItem.image,
        },
        cartItem.color,
        cartItem.size
      ).then((res) => {
        if (res.success) setWishlistItems(res.items);
      });
      handleRemoveItem(cartItem.key);
      setCartToast({
        productName: cartItem.name,
        details: 'Saved for later in Wishlist',
      });
      setTimeout(() => setCartToast(null), 3000);
    },
    []
  );

  const handleClearWishlist = useCallback(() => {
    clearWishlist().then((res) => {
      if (res.success) setWishlistItems([]);
    });
  }, []);

  return (
    <div className="machii-app" id="shop">
      {/* Global Minimalist Header with dynamic cart state and click to open bag */}
      <Header
        cartCount={cartCount}
        wishlistCount={wishlistItems.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenOrders={(ref) => {
          setViewOrderRef(ref || null);
          setIsOrdersOpen(true);
        }}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Main Content Flow */}
      <main id="main-content">
        {/* Master Section 1: The Animated Hero & Garment Scroll Showcase */}
        <HeroShowcase onSelectProduct={setViewerProduct} />

        {/* Master Section 2: Product Collection ("THE LATEST DROP") */}
        <CollectionSection
          onSelectProduct={setViewerProduct}
          wishlistIds={wishlistIds}
          onToggleWishlist={handleToggleWishlist}
        />

        {/* Master Section 3: Brand Manifesto */}
        <NextSection />
      </main>

      {/* Interactive Product Viewer Modal */}
      {viewerProduct && (
        <Suspense fallback={null}>
          <QuickViewModal
            key={`showroom-v2-${viewerProduct.id}-${viewerProduct.selectedColor?.name || 'default'}`}
            product={viewerProduct}
            onClose={() => setViewerProduct(null)}
            onAddToCart={handleAddToCart}
            isInWishlist={wishlistIds.has(viewerProduct.id)}
            onToggleWishlist={handleToggleWishlist}
          />
        </Suspense>
      )}

      {/* Shopping Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={handleCloseCart}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onSaveForLater={handleSaveForLater}
        appliedCoupon={appliedCoupon}
        onCouponChange={setAppliedCoupon}
        onOpenCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Complete Checkout & Order Summary Modal */}
      {isCheckoutOpen && (
        <Suspense fallback={null}>
          <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={handleCloseCheckout}
            items={cartItems}
            onClearCart={handleClearCart}
            appliedCoupon={appliedCoupon}
            onCouponChange={setAppliedCoupon}
            onOpenOrders={(ref) => {
              setViewOrderRef(ref || null);
              setIsOrdersOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Customer Order History & Tracking Modal (Step 7) */}
      {isOrdersOpen && (
        <Suspense fallback={null}>
          <OrderHistoryModal
            isOpen={isOrdersOpen}
            onClose={handleCloseOrders}
            initialOrderRef={viewOrderRef}
            onOpenProfile={() => {
              setIsOrdersOpen(false);
              setIsProfileOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Customer Profile & Address Management Modal (Step 9) */}
      {isProfileOpen && (
        <Suspense fallback={null}>
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={handleCloseProfile}
            onOpenOrders={() => {
              setIsProfileOpen(false);
              setIsOrdersOpen(true);
            }}
            onOpenWishlist={() => {
              setIsProfileOpen(false);
              setIsWishlistOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Admin Operations & Product Management Dashboard (Step 10) */}
      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminDashboard
            isOpen={isAdminOpen}
            onClose={handleCloseAdmin}
          />
        </Suspense>
      )}

      {/* Customer Wishlist & Save-for-Later Modal (Step 12) */}
      {isWishlistOpen && (
        <Suspense fallback={null}>
          <WishlistModal
            isOpen={isWishlistOpen}
            onClose={handleCloseWishlist}
            items={wishlistItems}
            onRemoveItem={(prodId) => {
              removeFromWishlist(prodId).then((res) => {
                if (res.success) setWishlistItems(res.items);
              });
            }}
            onClearWishlist={handleClearWishlist}
            onMoveToCart={handleMoveWishlistItemToCart}
            onQuickView={(p) => {
              setIsWishlistOpen(false);
              setViewerProduct(p);
            }}
            onOpenProfile={() => {
              setIsWishlistOpen(false);
              setIsProfileOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Realtime Cart Notification Toast */}
      {cartToast && (
        <div
          className="cart-toast-notification"
          role="status"
          aria-live="polite"
          onClick={() => setIsCartOpen(true)}
          style={{ cursor: 'pointer' }}
          title="Click to view bag"
        >
          <div className="toast-icon-wrap">
            <Check size={16} />
          </div>
          <div className="toast-text-wrap">
            <span className="toast-title">ADDED TO BAG</span>
            <span className="toast-sub">
              {cartToast.quantity}x {cartToast.name}
              {cartToast.color ? ` • ${cartToast.color}` : ''}
              {cartToast.size ? ` (${cartToast.size})` : ''}
            </span>
          </div>
          <ShoppingBag size={18} className="toast-bag-icon" />
        </div>
      )}

      {/* Editorial Minimalist Footer */}
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <span className="footer-logo">MACHII MENS MART</span>
              <p className="footer-tagline">WEAR YOUR ATTITUDE. GEN Z OVERSIZED STREETWEAR.</p>
            </div>

            <div className="footer-links-group">
              <div className="footer-col">
                <span className="mono-label">EXPLORE</span>
                <ul>
                  <li><a href="#collection-drop">The Latest Drop</a></li>
                  <li><a href="#product-showcase">Featured Rack</a></li>
                  <li><a href="#collections">Brand Manifesto</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <span className="mono-label">HELP</span>
                <ul>
                  <li><a href="#shipping">Shipping & Returns</a></li>
                  <li><a href="#size-chart">Size Guide</a></li>
                  <li><a href="#contact">Contact Support</a></li>
                  <li>
                    <a
                      href="#admin"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsAdminOpen(true);
                      }}
                      id="footer-admin-link"
                    >
                      Admin Portal
                    </a>
                  </li>
                </ul>
              </div>

              <div className="footer-col">
                <span className="mono-label">COMMUNITY</span>
                <ul>
                  <li><a href="#instagram">Instagram</a></li>
                  <li><a href="#discord">Discord</a></li>
                  <li><a href="#lookbook">Lookbook</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">© 2026 MACHII MENS MART. All Rights Reserved. Crafted for Gen Z Streetwear.</p>
            <span className="footer-stage-indicator">MACHII MENS MART • DROP 01 LIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
