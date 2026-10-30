import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Menu, X, ArrowUpRight, Package, User, Shield, Heart, Sparkles } from 'lucide-react';
import './Header.css';

export default function Header({
  cartCount = 0,
  wishlistCount = 0,
  onOpenCart,
  onOpenOrders,
  onOpenProfile,
  onOpenAdmin,
  onOpenWishlist,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Active Navigation Section Tracking: 'showcase' | 'drop' | 'manifesto'
  const [activeSection, setActiveSection] = useState('showcase');

  const displayCartCount = cartCount;

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setStoreSettings(data.settings);
        }
      })
      .catch(() => {});

    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        setStoreSettings(e.detail);
        setBannerDismissed(false);
      }
    };

    window.addEventListener('machii:settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('machii:settings-updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    let ticking = false;
    let cachedDropTop = null;
    let cachedManifestoTop = null;

    const updateOffsets = () => {
      const dropEl = document.getElementById('collection-drop');
      const manifestoEl = document.getElementById('collections');
      cachedDropTop = dropEl ? dropEl.offsetTop - 140 : 600;
      cachedManifestoTop = manifestoEl ? manifestoEl.offsetTop - 140 : 1800;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          setIsScrolled((prev) => (scrollY > 40 !== prev ? scrollY > 40 : prev));

          if (cachedDropTop === null) updateOffsets();

          const dropTop = cachedDropTop ?? 600;
          const manifestoTop = cachedManifestoTop ?? 1800;

          if (scrollY >= manifestoTop) {
            setActiveSection('manifesto');
          } else if (scrollY >= dropTop) {
            setActiveSection('drop');
          } else {
            setActiveSection('showcase');
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateOffsets, { passive: true });
    updateOffsets();
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateOffsets);
    };
  }, []);

  const handleCopyPromoCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleNavClick = (e, targetSelector, sectionName) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (sectionName) setActiveSection(sectionName);

    if (targetSelector === '#product-showcase' || targetSelector === '#hero') {
      if (window.lenis) {
        window.lenis.scrollTo(0, { duration: 0.9 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const targetEl = document.querySelector(targetSelector);
    if (targetEl) {
      if (window.lenis) {
        window.lenis.scrollTo(targetEl, { offset: -70, duration: 0.9 });
      } else {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const showBanner = !bannerDismissed && storeSettings?.announcementBanner?.enabled;

  return (
    <header className={`site-header ${isScrolled ? 'is-scrolled' : ''} ${showBanner ? 'has-banner' : ''}`}>
      {/* Storefront Top Announcement Marquee (Admin Controlled) */}
      {showBanner && (
        <div className="storefront-top-banner">
          <div className="top-banner-content">
            <Sparkles size={12} className="banner-sparkle" />
            <span className="banner-text">
              {storeSettings.announcementBanner.text}
            </span>
            {storeSettings.announcementBanner.promoCode && (
              <button
                type="button"
                className="banner-copy-code-btn"
                onClick={() => handleCopyPromoCode(storeSettings.announcementBanner.promoCode)}
                title="Click to copy promo code"
                id="header-copy-promo-btn"
              >
                <span>{copiedCode ? 'COPIED!' : storeSettings.announcementBanner.promoCode}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            className="banner-dismiss-btn"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss banner"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="header-container">
        {/* Brand Wordmark */}
        <div className="header-brand">
          <a
            href="#"
            className="brand-logo"
            aria-label="Machii Mens Mart Home"
            onClick={(e) => handleNavClick(e, '#product-showcase', 'showcase')}
          >
            <span className="brand-main">MACHII</span>
            <span className="brand-sub">MENS MART</span>
          </a>
          <span className="brand-season-tag">SS/26 DROP 01</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="header-nav" aria-label="Main Navigation">
          <ul className="nav-list">
            <li>
              <a
                href="#product-showcase"
                className={`nav-link ${activeSection === 'showcase' ? 'active' : ''}`}
                onClick={(e) => handleNavClick(e, '#product-showcase', 'showcase')}
                id="header-nav-showcase-link"
              >
                Showcase
              </a>
            </li>
            <li>
              <a
                href="#collection-drop"
                className={`nav-link ${activeSection === 'drop' ? 'active' : ''}`}
                onClick={(e) => handleNavClick(e, '#collection-drop', 'drop')}
                id="header-nav-drop-link"
              >
                The Drop
              </a>
            </li>
            <li>
              <a
                href="#collections"
                className={`nav-link ${activeSection === 'manifesto' ? 'active' : ''}`}
                onClick={(e) => handleNavClick(e, '#collections', 'manifesto')}
                id="header-nav-manifesto-link"
              >
                Manifesto
              </a>
            </li>
          </ul>
        </nav>

        {/* Actions / Orders & Cart */}
        <div className="header-actions">
          {/* Product Search Trigger (Step 11) */}
          <button
            type="button"
            className="action-btn search-btn"
            aria-label="Search Collection"
            title="Search Collection"
            id="header-search-btn"
            onClick={(e) => {
              e.preventDefault();
              const input = document.getElementById('collection-search-input');
              if (input) {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => input.focus(), 300);
              }
            }}
          >
            <Search size={18} strokeWidth={2} />
          </button>

          {/* Customer Wishlist Portal (Step 12) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenWishlist) onOpenWishlist();
            }}
            className="action-btn wishlist-btn"
            aria-label={`My Wishlist (${wishlistCount} items)`}
            title="Saved Wishlist"
            id="header-wishlist-btn"
          >
            <Heart size={19} strokeWidth={2} />
            {wishlistCount > 0 && <span className="wishlist-badge">{wishlistCount}</span>}
          </button>

          {/* Customer Orders Portal (Step 7) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenOrders) onOpenOrders();
            }}
            className="action-btn orders-btn"
            aria-label="My Orders"
            title="My Orders"
            id="header-orders-btn"
          >
            <Package size={19} strokeWidth={2} />
          </button>

          {/* Customer Profile & Addresses (Step 9) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenProfile) onOpenProfile();
            }}
            className="action-btn profile-btn"
            aria-label="My Profile & Addresses"
            title="Profile & Addresses"
            id="header-profile-btn"
          >
            <User size={19} strokeWidth={2} />
          </button>

          {/* Admin Operations Portal (Step 10) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenAdmin) onOpenAdmin();
            }}
            className="action-btn admin-portal-btn"
            aria-label="Admin Portal"
            title="Admin Portal"
            id="header-admin-btn"
          >
            <Shield size={18} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenCart) onOpenCart();
            }}
            className="action-btn cart-btn"
            aria-label={`Cart (${displayCartCount} items)`}
            title="Bag"
            id="header-bag-btn"
          >
            <ShoppingBag size={19} strokeWidth={2} />
            <span className="cart-badge">{displayCartCount}</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-list">
          <li>
            <a
              href="#product-showcase"
              onClick={(e) => handleNavClick(e, '#product-showcase', 'showcase')}
            >
              Showcase Rack <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#collection-drop"
              onClick={(e) => handleNavClick(e, '#collection-drop', 'drop')}
            >
              The Latest Drop <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#collections"
              onClick={(e) => handleNavClick(e, '#collections', 'manifesto')}
            >
              Brand Manifesto <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#wishlist"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                if (onOpenWishlist) onOpenWishlist();
              }}
              id="mobile-nav-wishlist-link"
            >
              Saved Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ''} <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#orders"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                if (onOpenOrders) onOpenOrders();
              }}
              id="mobile-nav-orders-link"
            >
              My Orders <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#profile"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                if (onOpenProfile) onOpenProfile();
              }}
              id="mobile-nav-profile-link"
            >
              Profile & Addresses <ArrowUpRight size={16} />
            </a>
          </li>
          <li>
            <a
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                if (onOpenAdmin) onOpenAdmin();
              }}
              id="mobile-nav-admin-link"
            >
              Admin Portal <ArrowUpRight size={16} />
            </a>
          </li>
        </ul>
        <div className="mobile-drawer-footer">
          <p className="mobile-tagline">WEAR YOUR ATTITUDE.</p>
          <p className="mobile-sub">Machii Mens Mart © 2026</p>
        </div>
      </div>
    </header>
  );
}
