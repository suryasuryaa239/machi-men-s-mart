import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Heart,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  formatPrice,
  parsePrice,
  calculateCartSubtotal,
  calculateCartCount,
} from '../../utils/cartStorage';
import {
  validateCouponApi,
  setStoredCoupon,
  clearStoredCoupon,
} from '../../utils/couponService';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import './CartDrawer.css';

export default function CartDrawer({
  isOpen,
  onClose,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOpenCheckout,
  onSaveForLater,
  appliedCoupon: propAppliedCoupon,
  onCouponChange,
}) {
  const drawerRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [orderId, setOrderId] = useState('');

  // STEP 13: Coupons & Promotional Discounts State
  const [internalCoupon, setInternalCoupon] = useState(null);
  const appliedCoupon = propAppliedCoupon !== undefined ? propAppliedCoupon : internalCoupon;
  const setAppliedCoupon = (val) => {
    setInternalCoupon(val);
    if (onCouponChange) onCouponChange(val);
  };

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isCouponExpanded, setIsCouponExpanded] = useState(false);

  const subtotal = calculateCartSubtotal(items);
  const totalCount = calculateCartCount(items);
  const isBelowMin = Boolean(
    appliedCoupon &&
      appliedCoupon.minOrderAmount &&
      subtotal < appliedCoupon.minOrderAmount
  );
  const effectiveDiscount =
    appliedCoupon && !isBelowMin
      ? Math.min(
          subtotal,
          appliedCoupon.discountType === 'PERCENTAGE'
            ? Math.round((subtotal * appliedCoupon.discountValue) / 100)
            : Number(appliedCoupon.discountValue) || 0
        )
      : 0;
  const total = Math.max(0, subtotal - effectiveDiscount);

  // Body scroll lock and focus management
  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();
    lockScroll();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCheckoutComplete(false);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleClose = () => {
    setCheckoutComplete(false);
    onClose();
  };

  const handleApplyCoupon = async (codeToApply) => {
    const rawCode = String(codeToApply || couponInput || '').trim();
    if (!rawCode) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setIsApplying(true);
    setCouponError(null);

    const res = await validateCouponApi(rawCode, subtotal);
    setIsApplying(false);

    if (res.valid && res.coupon) {
      const couponObj = {
        ...res.coupon,
        discountAmount: res.discountAmount,
      };
      setAppliedCoupon(couponObj);
      setStoredCoupon(couponObj);
      setCouponInput('');
      setCouponError(null);
    } else {
      setCouponError(res.error || `Coupon "${rawCode}" is invalid.`);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    clearStoredCoupon();
    setCouponError(null);
  };

  const handleCheckout = () => {
    if (onOpenCheckout) {
      onOpenCheckout();
    } else {
      const generatedId = String(Math.floor(100000 + Math.random() * 900000));
      setOrderId(generatedId);
      setCheckoutComplete(true);
      setTimeout(() => {
        if (onClearCart) onClearCart();
        setTimeout(() => {
          handleClose();
        }, 1800);
      }, 1500);
    }
  };

  const handleExploreDrop = () => {
    handleClose();
    const collectionSec =
      document.getElementById('collection-drop') ||
      document.getElementById('collection') ||
      document.querySelector('.collection-section');
    if (collectionSec) {
      collectionSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="cart-drawer-backdrop"
      onClick={onClose}
      role="presentation"
      id="cart-drawer-modal"
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        ref={drawerRef}
        className="cart-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-header-title-wrap">
            <ShoppingBag size={20} className="cart-header-icon" />
            <h2 id="cart-drawer-title" className="cart-drawer-heading">
              YOUR BAG
            </h2>
            <span className="cart-item-count-badge" aria-label={`${totalCount} items in bag`}>
              {totalCount} {totalCount === 1 ? 'ITEM' : 'ITEMS'}
            </span>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="cart-close-btn"
            onClick={onClose}
            aria-label="Close shopping bag"
            id="close-cart-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Shipping Banner */}
        <div className="cart-shipping-banner">
          <Sparkles size={13} className="banner-sparkle" />
          <span>
            <strong>PAN-INDIA EXPRESS DELIVERY:</strong> FREE ON ALL ORDERS
          </span>
        </div>

        {/* Drawer Body */}
        <div className="cart-drawer-body" data-lenis-prevent="true">
          {checkoutComplete ? (
            /* Checkout Success State */
            <div className="cart-checkout-success" role="status" aria-live="polite">
              <div className="success-icon-wrap">
                <CheckCircle2 size={48} className="success-icon" />
              </div>
              <h3 className="success-title">ORDER CONFIRMED</h3>
              <p className="success-msg">
                Thank you for your order! Your signature Machii streetwear fits are being prepared.
              </p>
              <div className="success-order-id">
                ORDER #MC-{orderId || '849201'}
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty Cart State */
            <div className="cart-empty-state">
              <div className="empty-icon-wrap" aria-hidden="true">
                <ShoppingBag size={46} strokeWidth={1.5} />
              </div>
              <h3 className="empty-title">YOUR BAG IS EMPTY</h3>
              <p className="empty-desc">
                Looks like you haven't added any oversized fits yet. Explore our signature SS26 cuts
                and claim your style.
              </p>
              <button
                type="button"
                className="empty-cta-btn"
                onClick={handleExploreDrop}
                id="empty-cart-explore-btn"
              >
                <span>EXPLORE THE DROP</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Populated Cart Items List */
            <ul className="cart-items-list" aria-label="Items in your shopping bag">
              {items.map((item) => {
                const itemTotal = parsePrice(item.price) * item.quantity;

                return (
                  <li key={item.key} className="cart-item-card" data-key={item.key}>
                    {/* Item Thumbnail */}
                    <div className="cart-item-thumb-box">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={`${item.name} in ${item.color}`}
                          className="cart-item-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="cart-item-placeholder" />
                      )}
                    </div>

                    {/* Item Info */}
                    <div className="cart-item-details">
                      <div className="cart-item-top-row">
                        <h4 className="cart-item-name">{item.name}</h4>
                        <div className="cart-item-actions-group">
                          {onSaveForLater && (
                            <button
                              type="button"
                              className="cart-item-save-btn"
                              onClick={() => onSaveForLater(item)}
                              aria-label={`Save ${item.name} for later`}
                              title="Save for Later"
                              id={`save-later-${item.key}`}
                            >
                              <Heart size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="cart-item-remove-btn"
                            onClick={() => onRemoveItem(item.key)}
                            aria-label={`Remove ${item.name} (${item.color}, ${item.size}) from bag`}
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Variant Chips */}
                      <div className="cart-item-variants">
                        <span className="cart-variant-pill color-pill">
                          {item.colorHex && (
                            <span
                              className="variant-swatch-dot"
                              style={{ backgroundColor: item.colorHex }}
                              aria-hidden="true"
                            />
                          )}
                          <span>{item.color}</span>
                        </span>
                        <span className="cart-variant-pill size-pill">SIZE: {item.size}</span>
                      </div>

                      {/* Price and Quantity Stepper */}
                      <div className="cart-item-bottom-row">
                        <div className="cart-item-stepper" role="group" aria-label={`Quantity for ${item.name}`}>
                          <button
                            type="button"
                            className="cart-stepper-btn"
                            onClick={() => onUpdateQuantity(item.key, -1)}
                            disabled={item.quantity <= 1}
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            <Minus size={13} />
                          </button>
                          <span className="cart-stepper-value" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="cart-stepper-btn"
                            onClick={() => onUpdateQuantity(item.key, 1)}
                            disabled={item.quantity >= 10}
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Calculated Line Total */}
                        <div className="cart-item-price-wrap">
                          <span className="cart-item-unit-price">{item.price} each</span>
                          <span className="cart-item-total-price">{formatPrice(itemTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Drawer Footer (Only shown when items exist and checkout not complete) */}
        {items.length > 0 && !checkoutComplete && (
          <div className="cart-drawer-footer">
            {/* Guarantee Note */}
            <div className="cart-guarantee-note">
              <ShieldCheck size={14} className="guarantee-icon" />
              <span>Free Pan-India Delivery • 7-Day Hassle-Free Fit Exchange</span>
            </div>

            {/* STEP 13: Cart Coupon Input / Active Applied Chip */}
            <div className="cart-coupon-wrap" id="cart-coupon-section">
              {!appliedCoupon ? (
                <div className="cart-coupon-box">
                  {!isCouponExpanded ? (
                    <button
                      type="button"
                      className="cart-have-coupon-btn"
                      onClick={() => setIsCouponExpanded(true)}
                      id="cart-toggle-coupon-btn"
                    >
                      <Tag size={13} />
                      <span>Have a promo code or drop coupon?</span>
                    </button>
                  ) : (
                    <div className="cart-coupon-inline-form">
                      <div className="cart-coupon-input-row">
                        <input
                          type="text"
                          className="cart-coupon-field"
                          placeholder="CODE (e.g. MACHII10)"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            if (couponError) setCouponError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon(couponInput);
                            }
                          }}
                          maxLength={20}
                          disabled={isApplying}
                          aria-label="Enter promo code"
                          id="cart-coupon-input"
                        />
                        <button
                          type="button"
                          className="cart-coupon-apply-btn"
                          onClick={() => handleApplyCoupon(couponInput)}
                          disabled={isApplying || !couponInput.trim()}
                          id="cart-coupon-apply-btn"
                        >
                          {isApplying ? (
                            <Loader2 size={12} className="spin-icon" />
                          ) : (
                            'APPLY'
                          )}
                        </button>
                      </div>

                      {couponError && (
                        <div className="cart-coupon-error" role="alert" id="cart-coupon-error">
                          <AlertCircle size={12} />
                          <span>{couponError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="cart-coupon-applied-chip" id="cart-coupon-applied">
                  <div className="chip-left">
                    <CheckCircle2 size={13} className="chip-check" />
                    <strong className="chip-code">{appliedCoupon.code}</strong>
                    {isBelowMin ? (
                      <span className="chip-save" style={{ color: '#CA8A04' }}>
                        (Add {formatPrice(appliedCoupon.minOrderAmount - subtotal)} more)
                      </span>
                    ) : (
                      <span className="chip-save">
                        (-{formatPrice(effectiveDiscount)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="chip-remove-btn"
                    onClick={handleRemoveCoupon}
                    aria-label="Remove coupon"
                    title="Remove coupon"
                    id="cart-coupon-remove-btn"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="cart-totals-breakdown">
              <div className="totals-row">
                <span className="totals-label">Subtotal</span>
                <span className="totals-value subtotal-val">{formatPrice(subtotal)}</span>
              </div>

              {appliedCoupon && effectiveDiscount > 0 && (
                <div className="totals-row cart-discount-row">
                  <span className="totals-label cart-discount-label">
                    <span>Coupon Discount</span>
                    <span className="cart-code-badge">{appliedCoupon.code}</span>
                  </span>
                  <span className="totals-value cart-discount-val" id="cart-discount-val">
                    -{formatPrice(effectiveDiscount)}
                  </span>
                </div>
              )}

              <div className="totals-row">
                <span className="totals-label">Pan-India Express Shipping</span>
                <span className="totals-value free-shipping-badge">FREE</span>
              </div>
              <div className="totals-row">
                <span className="totals-label">Estimated Taxes</span>
                <span className="totals-value">INCLUDED</span>
              </div>
              <div className="totals-row final-total-row">
                <span className="total-label-bold">TOTAL</span>
                <span className="total-value-bold" id="cart-final-total">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className="cart-checkout-btn"
              onClick={handleCheckout}
              id="cart-checkout-cta"
            >
              <span>PROCEED TO CHECKOUT • {formatPrice(total)}</span>
              <ArrowRight size={17} />
            </button>

            {/* Secondary Continue Action */}
            <button
              type="button"
              className="cart-continue-btn"
              onClick={onClose}
              id="cart-continue-shopping-btn"
            >
              CONTINUE SHOPPING
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
