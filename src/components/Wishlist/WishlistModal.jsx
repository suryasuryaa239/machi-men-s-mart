import React, { useEffect, useState, useRef } from 'react';
import {
  Heart,
  X,
  ShoppingBag,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  User,
} from 'lucide-react';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import { getCustomerSessionPhone } from '../../utils/orderService';
import './WishlistModal.css';

export default function WishlistModal({
  isOpen,
  onClose,
  items = [],
  onRemoveItem,
  onClearWishlist,
  onMoveToCart,
  onQuickView,
  onOpenProfile,
}) {
  const [movingItemId, setMovingItemId] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [selectedColors, setSelectedColors] = useState({});
  const modalRef = useRef(null);
  const bodyRef = useRef(null);

  const phone = getCustomerSessionPhone();
  const isGuest = !phone;

  // Dedicated body scroll lock strictly tied to modal open/close lifecycle
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle Move to Bag
  const handleMove = (item) => {
    const prod = item.product || {};
    const size = selectedSizes[item.id] || item.selectedSize || prod.sizes?.[0] || 'L';
    const color =
      selectedColors[item.id] ||
      item.selectedColor ||
      prod.colors?.[0]?.name ||
      'Standard';

    setMovingItemId(item.id);
    if (onMoveToCart) {
      onMoveToCart(item, color, size);
    }

    setTimeout(() => {
      setMovingItemId(null);
    }, 1200);
  };

  const handleSizeSelect = (itemId, size) => {
    setSelectedSizes((prev) => ({ ...prev, [itemId]: size }));
  };

  const handleColorSelect = (itemId, color) => {
    setSelectedColors((prev) => ({ ...prev, [itemId]: color }));
  };

  return (
    <div
      className="wishlist-modal-backdrop"
      onClick={onClose}
      role="presentation"
      id="wishlist-modal-overlay"
      data-lenis-prevent="true"
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        ref={modalRef}
        className="wishlist-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-main-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => {
          e.stopPropagation();
          if (bodyRef.current && !bodyRef.current.contains(e.target)) {
            bodyRef.current.scrollTop += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        {/* Header Bar */}
        <header className="wishlist-header">
          <div className="wishlist-header-left">
            <span className="wishlist-brand-tag">MACHII MENS MART</span>
            <div className="wishlist-title-wrap">
              <Heart size={20} className="wishlist-title-icon" fill="#EF4444" color="#EF4444" />
              <h2 id="wishlist-main-title" className="wishlist-title">
                SAVED STREETWEAR
              </h2>
              <span className="wishlist-count-badge" id="wishlist-items-count">
                {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>
          </div>

          <div className="wishlist-header-actions">
            {items.length > 0 && onClearWishlist && (
              <button
                type="button"
                className="wishlist-clear-all-btn"
                onClick={onClearWishlist}
                title="Clear all saved items"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              className="wishlist-close-btn"
              onClick={onClose}
              aria-label="Close wishlist"
              id="close-wishlist-btn"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Guest Synchronization Notice Banner (Requirement 7) */}
        {isGuest && (
          <div className="wishlist-guest-banner" role="status">
            <div className="guest-banner-text">
              <Sparkles size={15} className="guest-banner-icon" />
              <span>
                <strong>GUEST WISHLIST:</strong> Saved locally on this browser. Sign in with your mobile number to sync across your devices.
              </span>
            </div>
            {onOpenProfile && (
              <button
                type="button"
                className="guest-signin-cta"
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
              >
                <User size={13} />
                <span>SIGN IN TO SYNC</span>
              </button>
            )}
          </div>
        )}

        {/* Scrollable Modal Body */}
        <div className="wishlist-body" ref={bodyRef} data-lenis-prevent="true">
          {items.length === 0 ? (
            /* Empty Wishlist State */
            <div className="wishlist-empty-state" id="wishlist-empty-view">
              <div className="empty-heart-ring">
                <Heart size={44} strokeWidth={1.5} className="empty-heart-icon" />
              </div>
              <h3 className="empty-title">YOUR WISHLIST IS EMPTY</h3>
              <p className="empty-desc">
                Don’t let your favorite streetwear slips away. Hit the heart icon on any drop or oversized fit to save it here for later.
              </p>
              <button
                type="button"
                className="empty-explore-cta"
                onClick={() => {
                  onClose();
                  const target = document.getElementById('collection-drop');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                id="wishlist-explore-drop-btn"
              >
                <span>EXPLORE THE DROP</span>
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            /* Wishlist Products Grid */
            <div className="wishlist-items-grid" id="wishlist-items-list">
              {items.map((item) => {
                const prod = item.product || {};
                const isOutOfStock = prod.stock === 0 || prod.isAvailable === false;
                const isDeleted = Boolean(prod.isDeleted);
                const isMoving = movingItemId === item.id;

                const availableSizes = prod.sizes && prod.sizes.length > 0 ? prod.sizes : ['S', 'M', 'L', 'XL', 'XXL'];
                const activeSize = selectedSizes[item.id] || item.selectedSize || availableSizes[0];

                const availableColors = prod.colors && prod.colors.length > 0 ? prod.colors : [];
                const activeColor =
                  selectedColors[item.id] ||
                  item.selectedColor ||
                  availableColors[0]?.name ||
                  'Standard';

                // Find color image if matched
                const matchedColorObj = availableColors.find(
                  (c) => c.name.toLowerCase() === activeColor.toLowerCase()
                );
                const displayImage = matchedColorObj?.image || prod.image || '/assets/products/machii-attitude-01-charcoal.png';

                return (
                  <article
                    key={item.id || item.productId}
                    className={`wishlist-card ${isOutOfStock ? 'is-out-of-stock' : ''} ${isDeleted ? 'is-deleted' : ''}`}
                    data-product-id={prod.id}
                  >
                    {/* Thumbnail & Quick View Trigger */}
                    <div className="wishlist-thumb-wrap">
                      <img
                        src={displayImage}
                        alt={prod.name || 'Machii Product'}
                        className="wishlist-thumb-img"
                        loading="lazy"
                      />

                      {/* Stock Status Badge (Requirement 9) */}
                      {isDeleted ? (
                        <span className="stock-badge badge-deleted">
                          <AlertCircle size={11} />
                          UNAVAILABLE
                        </span>
                      ) : isOutOfStock ? (
                        <span className="stock-badge badge-soldout">
                          OUT OF STOCK
                        </span>
                      ) : (prod.stock || 10) < 5 ? (
                        <span className="stock-badge badge-lowstock">
                          ONLY {prod.stock} LEFT
                        </span>
                      ) : (
                        <span className="stock-badge badge-instock">
                          IN STOCK
                        </span>
                      )}

                      {/* Quick View Button */}
                      {onQuickView && !isDeleted && (
                        <button
                          type="button"
                          className="wishlist-quick-view-btn"
                          title="Quick View Details"
                          onClick={() => {
                            onQuickView({
                              ...prod,
                              selectedColor: matchedColorObj || availableColors[0] || null,
                              selectedSize: activeSize,
                            });
                          }}
                        >
                          <Eye size={15} />
                        </button>
                      )}
                    </div>

                    {/* Details Column */}
                    <div className="wishlist-card-details">
                      <div className="wishlist-card-header">
                        <span className="wishlist-gsm-tag">{prod.gsm || '240 GSM'}</span>
                        <button
                          type="button"
                          className="wishlist-remove-btn"
                          title="Remove from wishlist"
                          aria-label={`Remove ${prod.name} from wishlist`}
                          onClick={() => onRemoveItem && onRemoveItem(item.productId || prod.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h4 className="wishlist-prod-title">{prod.name}</h4>
                      <p className="wishlist-prod-sub">{prod.subName || prod.fit || 'Heavyweight Drop'}</p>

                      {/* Pricing Row */}
                      <div className="wishlist-price-row">
                        <span className="wishlist-price">{prod.price}</span>
                        {prod.originalPrice && (
                          <span className="wishlist-original-price">{prod.originalPrice}</span>
                        )}
                      </div>

                      {/* Color Options */}
                      {availableColors.length > 0 && !isDeleted && (
                        <div className="wishlist-option-group">
                          <span className="option-label">COLOR: <strong>{activeColor}</strong></span>
                          <div className="color-swatch-list">
                            {availableColors.map((c) => (
                              <button
                                key={c.name}
                                type="button"
                                className={`color-pill ${activeColor === c.name ? 'is-selected' : ''}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                                onClick={() => handleColorSelect(item.id, c.name)}
                                aria-label={`Select ${c.name} color`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Size Selector Chips */}
                      {availableSizes.length > 0 && !isDeleted && (
                        <div className="wishlist-option-group">
                          <span className="option-label">SIZE:</span>
                          <div className="size-chip-list">
                            {availableSizes.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                className={`size-chip ${activeSize === sz ? 'is-selected' : ''}`}
                                onClick={() => handleSizeSelect(item.id, sz)}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Move to Bag Action (Requirement 4) */}
                      <div className="wishlist-card-actions">
                        {isDeleted ? (
                          <button
                            type="button"
                            className="wishlist-move-btn is-disabled"
                            disabled
                          >
                            <span>ITEM REMOVED FROM CATALOG</span>
                          </button>
                        ) : isOutOfStock ? (
                          <button
                            type="button"
                            className="wishlist-move-btn is-disabled"
                            disabled
                          >
                            <span>OUT OF STOCK</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`wishlist-move-btn ${isMoving ? 'is-added' : ''}`}
                            onClick={() => handleMove(item)}
                            id={`move-to-bag-${item.productId || prod.id}`}
                          >
                            {isMoving ? (
                              <>
                                <Check size={16} />
                                <span>ADDED TO BAG!</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag size={16} />
                                <span>MOVE TO BAG</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

