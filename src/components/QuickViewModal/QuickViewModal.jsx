import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Plus,
  Minus,
  CheckCircle2,
  RotateCw,
  Heart,
  Play,
  Pause,
} from 'lucide-react';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import { setProductSeo } from '../../utils/seoService';
import './QuickViewModal.css';

// Helper to guarantee back view image strictly matches the selected garment colorway
function getMatchingBackImage(colorObj, product) {
  const target = colorObj || product;
  if (!target) return '/assets/products/machii-attitude-01-back.png';

  const path = typeof target === 'string'
    ? target
    : target.front || target.image || target.name || '';

  const name = typeof target === 'string'
    ? target
    : (target.name || target.color || '');

  const combined = `${path} ${name}`.toLowerCase();

  if (combined.includes('cobalt') || combined.includes('cyber-cobalt') || combined.includes('blue')) {
    return '/assets/products/machii-cyber-cobalt-back.png';
  }
  if (combined.includes('bone') || combined.includes('tokyo-bone') || combined.includes('white')) {
    return '/assets/products/machii-tokyo-bone-back.png';
  }
  if (combined.includes('sage') || combined.includes('drop01-sage') || combined.includes('olive') || combined.includes('green')) {
    return '/assets/products/machii-drop01-sage-back.png';
  }
  if (combined.includes('cream') || combined.includes('retro-cream') || combined.includes('beige')) {
    return '/assets/products/machii-retro-cream-back.png';
  }
  if (combined.includes('hoodie') || combined.includes('slate') || combined.includes('fleece')) {
    return '/assets/products/machii-attitude-hoodie-back.png';
  }
  return '/assets/products/machii-attitude-01-back.png';
}

// Helper to determine if a swatch color is light (for checkmark contrast)
function isLightColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
}

export default function QuickViewModal({
  product,
  onClose,
  onAddToCart,
  isInWishlist = false,
  onToggleWishlist,
}) {
  // Selected Color variant
  const [selectedColor, setSelectedColor] = useState(() => {
    if (product?.selectedColor) {
      return product.selectedColor;
    }
    if (product?.colors && product.colors.length > 0) {
      return product.colors[0];
    }
    return {
      name: product?.color || 'Standard',
      hex: '#26262A',
      image: product?.image,
      front: product?.image,
      backImage: product?.backImage || null,
      back: product?.backImage || null,
    };
  });

  // Color transition crossfade state for fluid studio switching
  const [isColorTransitioning, setIsColorTransitioning] = useState(false);

  // Precise colorway back image resolution: guarantees back view matches the EXACT garment colorway
  const resolvedBackImage = getMatchingBackImage(selectedColor, product);

  const hasBackView = Boolean(resolvedBackImage);
  const backImage = resolvedBackImage;

  // 360 Rotation Angle state in degrees (0 = front, 180 = back, 360 = front)
  const [rotationAngle, setRotationAngle] = useState(0);
  const normalizedAngle = ((Math.round(rotationAngle) % 360) + 360) % 360;
  const isFacingBack = normalizedAngle > 90 && normalizedAngle < 270;
  const viewMode = isFacingBack ? 'back' : 'front';

  const [isDragging, setIsDragging] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState('0.9s');
  const [isAutoOrbit, setIsAutoOrbit] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartAngleRef = useRef(0);
  const activePointerIdRef = useRef(null);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  });

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  // Continuous majestic 360° showroom auto-orbit loop
  useEffect(() => {
    if (!isAutoOrbit || prefersReducedMotion) return;
    let rafId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      // Majestic showroom turntable orbit speed (24 deg/sec = ~15s full turn)
      setRotationAngle((prev) => prev - dt * 24);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoOrbit, prefersReducedMotion]);

  // Front and Back genuine images — strictly isolated to active color variant
  const frontImage = selectedColor
    ? (selectedColor.front || selectedColor.image || null)
    : (product?.image || null);

  // Selected Size
  const availableSizes = product?.sizes || ['S', 'M', 'L', 'XL', 'XXL'];
  const [selectedSize, setSelectedSize] = useState(() => availableSizes[0] || 'L');

  // Quantity Stepper
  const [quantity, setQuantity] = useState(1);

  // Add to Bag feedback animation
  const [added, setAdded] = useState(false);

  const closeBtnRef = useRef(null);
  const modalDialogRef = useRef(null);

  // Focus trap and body scroll lock
  useEffect(() => {
    if (!product) return;
    closeBtnRef.current?.focus();
    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [product]);

  // Keyboard accessibility: Escape key to dismiss
  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  // Drag rotation pointer event handlers on the garment frame
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (isAutoOrbit) setIsAutoOrbit(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
    } catch {
      // Fallback if browser doesn't support capture
    }
    dragStartXRef.current = e.clientX;
    dragStartAngleRef.current = rotationAngle;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaX = e.clientX - dragStartXRef.current;

    // Smooth, controlled tactile drag
    const newAngle = dragStartAngleRef.current - deltaX * 0.55;
    setRotationAngle(newAngle);
  };

  const endDrag = (e) => {
    if (!isDragging) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (activePointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(activePointerIdRef.current);
        } catch {
          // ignore
        }
        activePointerIdRef.current = null;
      }
    }
    setIsDragging(false);
    setTransitionDuration('0.65s');

    // Snap cleanly to nearest front (0° / 360°*k) or back (180° + 360°*k)
    const norm = ((rotationAngle % 360) + 360) % 360;
    const baseCycle = Math.floor(rotationAngle / 360) * 360;
    if (norm > 90 && norm < 270) {
      setRotationAngle(baseCycle + 180);
    } else {
      const snap = norm >= 270 ? baseCycle + 360 : baseCycle;
      setRotationAngle(snap);
    }
  };

  const handlePointerUp = (e) => endDrag(e);
  const handlePointerCancel = (e) => endDrag(e);

  // Quick angle buttons with luxurious, slow-motion studio timing
  const handleFrontView = (e) => {
    e?.stopPropagation();
    setIsAutoOrbit(false);
    setTransitionDuration('0.9s');
    const baseCycle = Math.round(rotationAngle / 360) * 360;
    setRotationAngle(baseCycle);
  };

  const handleBackView = (e) => {
    e?.stopPropagation();
    setIsAutoOrbit(false);
    setTransitionDuration('0.9s');
    const baseCycle = Math.floor(rotationAngle / 360) * 360;
    setRotationAngle(baseCycle + 180);
  };

  const handleSpin360 = (e) => {
    e?.stopPropagation();
    setIsAutoOrbit(false);
    // Luxurious, slow-motion 360° turntable spin (1.65s duration for full visual detail)
    setTransitionDuration('1.65s');
    setRotationAngle((prev) => prev - 360);
  };

  const handleToggleAutoOrbit = (e) => {
    e?.stopPropagation();
    setIsAutoOrbit((prev) => !prev);
  };

  const handleViewerKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIsAutoOrbit(false);
      setTransitionDuration('0.9s');
      setRotationAngle((prev) => prev - 180);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIsAutoOrbit(false);
      setTransitionDuration('0.9s');
      setRotationAngle((prev) => prev + 180);
    }
  };

  const handleColorChange = (colorObj) => {
    if (!colorObj || selectedColor?.name === colorObj.name) return;

    // Verify variant has genuine image asset
    const hasFrontAsset = Boolean(colorObj.front || colorObj.image);
    if (!hasFrontAsset) return;

    setIsColorTransitioning(true);
    setSelectedColor(colorObj);
    setIsDragging(false);
    setProductSeo(product, colorObj);

    // Notify global subscribers (like hero rack) of live garment colorway selection
    window.dispatchEvent(
      new CustomEvent('machii:garment-color-change', {
        detail: {
          productId: product.id,
          color: colorObj,
        },
      })
    );

    setTimeout(() => {
      setIsColorTransitioning(false);
    }, 240);
  };

  const handleColorKeyDown = (e, index) => {
    if (!product?.colors || product.colors.length === 0) return;
    const len = product.colors.length;
    let targetIndex = index;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetIndex = (index + 1) % len;
      handleColorChange(product.colors[targetIndex]);
      const nextId = `swatch-${product.colors[targetIndex].name.toLowerCase().replace(/\s+/g, '-')}`;
      document.getElementById(nextId)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      targetIndex = (index - 1 + len) % len;
      handleColorChange(product.colors[targetIndex]);
      const prevId = `swatch-${product.colors[targetIndex].name.toLowerCase().replace(/\s+/g, '-')}`;
      document.getElementById(prevId)?.focus();
    }
  };

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => Math.max(1, Math.min(10, prev + delta)));
  };

  const handleAddToCart = () => {
    setAdded(true);

    const activeImg = isFacingBack ? backImage : frontImage;
    const cartPayload = {
      id: product.id,
      name: product.name,
      price: product.price,
      color: selectedColor.name,
      colorHex: selectedColor.hex,
      size: selectedSize,
      quantity,
      image: activeImg,
    };

    if (onAddToCart) {
      onAddToCart(product, selectedColor, selectedSize, quantity, activeImg);
    } else {
      window.dispatchEvent(
        new CustomEvent('machii:cart-update', {
          detail: { quantity, ...cartPayload },
        })
      );
    }

    setTimeout(() => {
      setAdded(false);
    }, 2200);
  };

  return (
    <div
      className="quick-view-backdrop"
      onClick={onClose}
      role="presentation"
      id="product-viewer-modal"
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        ref={modalDialogRef}
        className="quick-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-product-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#0D0E13', color: '#F8FAFC' }}
      >
        {/* Close Button */}
        <button
          ref={closeBtnRef}
          type="button"
          className="quick-view-close-btn"
          onClick={onClose}
          aria-label="Close product preview"
          id="close-viewer-btn"
        >
          <X size={20} />
        </button>

        <div className="quick-view-grid">
          {/* ========================================================
              LEFT COLUMN: TRANSPARENT GARMENT VIEWER & ANGLE SWITCHER
              ======================================================== */}
          <div className="quick-view-media-col" style={{ backgroundColor: '#10121A' }}>
            {/* View angle indicator / Futuristic HUD Badge */}
            <div className="viewer-angle-status">
              <div className="hud-status-badge">
                <span className={`hud-beacon ${isAutoOrbit ? 'is-orbiting' : ''}`} aria-hidden="true" />
                <span className="mono-label">
                  {isFacingBack ? 'STUDIO REAR VIEW' : 'STUDIO FRONT VIEW'}
                </span>
              </div>
              <span className="isolated-badge">
                HUD {Math.round(normalizedAngle)}° {isAutoOrbit ? '• ORBITING' : ''}
              </span>
            </div>

            {/* 3D Garment Rotation Viewport */}
            <div
              className={`quick-view-img-frame ${isDragging ? 'is-dragging' : ''}`}
              id="viewer-garment-frame"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              tabIndex={0}
              role="region"
              aria-label={`Interactive 360 garment rotation. Currently viewing ${viewMode}. Drag horizontally or use buttons to rotate.`}
              onKeyDown={handleViewerKeyDown}
            >
              <div
                className={`garment-rotator-3d ${isColorTransitioning ? 'color-transitioning' : ''}`}
                style={{
                  transform: prefersReducedMotion
                    ? 'none'
                    : `rotateY(${rotationAngle}deg)`,
                  transition: (isDragging || isAutoOrbit)
                    ? 'none'
                    : `transform ${transitionDuration} cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              >
                {/* Genuine Front Face */}
                <div className="garment-face garment-face-front">
                  {frontImage && (
                    <img
                      src={frontImage}
                      alt={`${product.name} - ${selectedColor.name} (Front)`}
                      className="quick-view-main-img"
                      draggable="false"
                      loading="eager"
                    />
                  )}
                </div>

                {/* Genuine Back Face */}
                {backImage && (
                  <div className="garment-face garment-face-back">
                    <img
                      src={backImage}
                      alt={`${product.name} - ${selectedColor.name} (Back)`}
                      className="quick-view-main-img"
                      draggable="false"
                      loading="eager"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Floor Shadow tracking 3D rotation */}
              <div
                className="viewer-floor-shadow"
                style={{
                  transform: prefersReducedMotion
                    ? 'none'
                    : `scale(${
                        1 - Math.abs(Math.sin((rotationAngle * Math.PI) / 180)) * 0.22
                      }) skewX(${
                        -Math.sin((rotationAngle * Math.PI) / 180) * 16
                      }deg)`,
                  transition: (isDragging || isAutoOrbit)
                    ? 'none'
                    : `transform ${transitionDuration} cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
                aria-hidden="true"
              ></div>
            </div>

            {/* Unobtrusive Drag to Rotate Instruction with live variant details */}
            <div
              className={`viewer-drag-hint ${!hasBackView ? 'is-limited' : ''}`}
              aria-hidden="true"
            >
              <RotateCw size={13} className="drag-hint-icon" />
              <span>
                {hasBackView
                  ? `360° Drag to inspect • ${Math.round(normalizedAngle)}° ${isFacingBack ? 'BACK' : 'FRONT'} (${selectedColor.name})`
                  : `${selectedColor.name} • Drag to tilt`}
              </span>
            </div>

            {/* Futuristic 3D Controls Dock */}
            <div className="viewer-angle-controls" role="tablist" aria-label="Garment View Angles">
              {/* Front View Button */}
              <button
                type="button"
                role="tab"
                aria-selected={!isFacingBack && !isAutoOrbit}
                className={`angle-tab-btn ${!isFacingBack && !isAutoOrbit ? 'active' : ''}`}
                onClick={handleFrontView}
                id="view-front-btn"
                title="Switch to studio front view"
              >
                <span>FRONT</span>
              </button>

              {/* Back View Button */}
              <button
                type="button"
                role="tab"
                aria-selected={isFacingBack && !isAutoOrbit}
                className={`angle-tab-btn ${isFacingBack && !isAutoOrbit ? 'active' : ''}`}
                onClick={handleBackView}
                id="view-back-btn"
                title={`Switch to studio back view for ${selectedColor.name}`}
                aria-label={`Switch to back view (${selectedColor.name})`}
              >
                <span>BACK</span>
              </button>

              {/* 360 Spin Single Turn Button */}
              <button
                type="button"
                className="angle-tab-btn spin-btn"
                onClick={handleSpin360}
                id="view-spin-btn"
                title="Slow-motion 360° spin"
                aria-label="Slow-motion 360° spin"
              >
                <RotateCw size={11} />
                <span>360° SPIN</span>
              </button>

              {/* Continuous Auto-Orbit Showroom Mode */}
              <button
                type="button"
                className={`angle-tab-btn orbit-btn ${isAutoOrbit ? 'is-orbiting' : ''}`}
                onClick={handleToggleAutoOrbit}
                id="view-orbit-btn"
                title={isAutoOrbit ? 'Pause 3D auto orbit' : 'Start showroom 360° auto-orbit'}
                aria-label={isAutoOrbit ? 'Pause 3D auto orbit' : 'Start showroom 360° auto-orbit'}
              >
                {isAutoOrbit ? <Pause size={10} /> : <Play size={10} />}
                <span>{isAutoOrbit ? 'PAUSE' : 'AUTO ORBIT'}</span>
              </button>
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN: PRODUCT DETAILS, COLORWAYS, SIZES, PURCHASE
              ======================================================== */}
          <div className="quick-view-info-col" style={{ backgroundColor: '#0D0E13', color: '#F8FAFC' }}>
            <div className="quick-view-meta-bar">
              <span className="mono-label">MACHII // SS26 DROP 01</span>
              {product.badge && <span className="modal-badge">{product.badge}</span>}
            </div>

            <h2 id="viewer-product-title" className="modal-product-title">
              {product.name}
            </h2>

            {product.subName && (
              <p className="modal-product-subtitle">{product.subName}</p>
            )}

            {/* Price Row */}
            <div className="modal-price-row">
              <span className="modal-current-price">{product.price}</span>
              {product.originalPrice && (
                <span className="modal-original-price">{product.originalPrice}</span>
              )}
              <span className="modal-tax-chip">INCL. ALL TAXES</span>
            </div>

            {/* Editorial Description */}
            <p className="modal-description">{product.description}</p>

            {/* Specs Quick Checklist */}
            <div className="modal-spec-chips">
              <span className="spec-pill">
                <Sparkles size={13} /> {product.gsm || '280 GSM Heavy Combed Cotton'}
              </span>
              <span className="spec-pill">{product.fit || 'Signature Boxy Drop-Shoulder'}</span>
            </div>

            {/* ========================================================
                SECTION: LIVE COLOUR SELECTION
                ======================================================== */}
            {product.colors && product.colors.length > 0 && (
              <div className="modal-colors-group">
                <div className="colors-header">
                  <div className="color-label-wrap">
                    <span className="group-label">
                      COLOR: <strong>{selectedColor?.name}</strong>
                    </span>
                    <span className="variant-photo-chip has-back">
                      Front & Back 360° View
                    </span>
                  </div>
                  <span className="color-count-tag">{product.colors.length} Variants</span>
                </div>

                <div
                  className="modal-color-options"
                  role="radiogroup"
                  aria-label="Available Garment Colours"
                >
                  {product.colors.map((colorObj, idx) => {
                    const isSelected = selectedColor?.name === colorObj.name;
                    const hasAsset = Boolean(colorObj.front || colorObj.image);
                    const colorHasBack = Boolean(colorObj.backImage || colorObj.back);
                    const swatchId = `swatch-${colorObj.name.toLowerCase().replace(/\s+/g, '-')}`;

                    return (
                      <button
                        key={colorObj.name || idx}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={!hasAsset}
                        tabIndex={isSelected ? 0 : -1}
                        className={`modal-color-btn ${isSelected ? 'selected' : ''} ${
                          !hasAsset ? 'is-disabled' : ''
                        }`}
                        style={{ backgroundColor: colorObj.hex }}
                        onClick={() => handleColorChange(colorObj)}
                        onKeyDown={(e) => handleColorKeyDown(e, idx)}
                        title={`${colorObj.name}${
                          colorHasBack ? ' (Front & Back Available)' : ' (Front View Only)'
                        }`}
                        aria-label={`Select colour ${colorObj.name}${
                          colorHasBack
                            ? ', front and back photography available'
                            : ', front view verified'
                        }`}
                        id={swatchId}
                      >
                        {isSelected && (
                          <span
                            className={`swatch-check-dot ${
                              isLightColor(colorObj.hex) ? 'dark-dot' : 'light-dot'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        {!hasAsset && (
                          <span className="swatch-unavailable-line" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                SECTION: SIZES & SHOPPING INTERACTIONS
                ======================================================== */}
            <div className="modal-sizes-group">
              <div className="sizes-header">
                <span className="group-label">
                  SELECT SIZE: <strong>{selectedSize} (OVERSIZED FIT)</strong>
                </span>
                <span className="fit-guide-hint">True to Streetwear Boxy Fit</span>
              </div>

              <div className="modal-size-chips" role="radiogroup" aria-label="Available Sizes">
                {availableSizes.map((sz) => {
                  const isSelected = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`modal-size-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSize(sz)}
                      id={`size-btn-${sz}`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Stepper & Add to Bag Row */}
            <div className="modal-purchase-row">
              {/* Quantity Stepper */}
              <div className="quantity-stepper" role="group" aria-label="Quantity selector">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  id="qty-decrease-btn"
                >
                  <Minus size={14} />
                </button>
                <span className="qty-value" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= 10}
                  aria-label="Increase quantity"
                  id="qty-increase-btn"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Add to Bag CTA Button */}
              <button
                type="button"
                className={`modal-add-btn ${added ? 'added' : ''}`}
                onClick={handleAddToCart}
                id="modal-add-to-bag-btn"
              >
                {added ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>ADDED TO BAG</span>
                  </>
                ) : (
                  <>
                    <span>ADD TO BAG</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Wishlist Button (Step 12) */}
              {onToggleWishlist && (
                <button
                  type="button"
                  className={`modal-wishlist-toggle-btn ${isInWishlist ? 'is-active' : ''}`}
                  onClick={() => onToggleWishlist(product, selectedColor, selectedSize)}
                  title={isInWishlist ? 'Saved in Wishlist' : 'Save to Wishlist'}
                  aria-label={isInWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                  id="modal-wishlist-btn"
                >
                  <Heart
                    size={18}
                    fill={isInWishlist ? '#EF4444' : 'none'}
                    color={isInWishlist ? '#EF4444' : 'currentColor'}
                  />
                  <span>{isInWishlist ? 'SAVED' : 'WISHLIST'}</span>
                </button>
              )}
            </div>

            {/* Guarantee footer */}
            <div className="modal-guarantee-note">
              <ShieldCheck size={16} className="guarantee-icon" />
              <span>Free Pan-India Express Delivery • Hassle-Free 7-Day Fit Exchange</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
