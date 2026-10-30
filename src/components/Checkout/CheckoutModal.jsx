import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Truck,
  Lock,
  Edit3,
  Loader2,
  Sparkles,
  Banknote,
  CreditCard,
  AlertTriangle,
  Package,
  Tag,
  Bell,
} from 'lucide-react';
import {
  formatPrice,
  parsePrice,
  calculateCartSubtotal,
} from '../../utils/cartStorage';
import {
  createOrder,
  getPaymentGatewayConfig,
  getCustomerSessionPhone,
} from '../../utils/orderService';
import { fetchCustomerAddresses } from '../../utils/profileService';
import {
  validateCouponApi,
  fetchAvailableCoupons,
  setStoredCoupon,
  clearStoredCoupon,
} from '../../utils/couponService';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import './CheckoutModal.css';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi NCR',
  'Chandigarh',
];

export default function CheckoutModal({
  isOpen,
  onClose,
  items = [],
  onClearCart,
  onOpenOrders,
  appliedCoupon: propAppliedCoupon,
  onCouponChange,
}) {
  // Steps: 'form' | 'review' | 'confirmation'
  const [step, setStep] = useState('form');

  // Form Fields
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Selected Payment Method: 'COD' | 'ONLINE'
  const [paymentMethod, setPaymentMethod] = useState('COD');

  // Online Payment Gateway Status
  const [gatewayConfig, setGatewayConfig] = useState({
    configured: false,
    loading: true,
  });

  // Validation Errors
  const [errors, setErrors] = useState({});

  // Server-side / Order creation Error
  const [serverError, setServerError] = useState(null);

  // Submission State to prevent duplicate orders
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Successfully Created Order State
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Saved Delivery Addresses (Step 9)
  const [savedAddresses, setSavedAddresses] = useState([]);

  // STEP 13: Coupon Codes & Promotional Discounts State
  const [internalCoupon, setInternalCoupon] = useState(null);
  const appliedCoupon = propAppliedCoupon !== undefined ? propAppliedCoupon : internalCoupon;
  const setAppliedCoupon = (val) => {
    setInternalCoupon(val);
    if (onCouponChange) onCouponChange(val);
  };

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);

  const modalRef = useRef(null);
  const initialFocusRef = useRef(null);
  const bodyRef = useRef(null);

  const subtotal = calculateCartSubtotal(items);
  const isBelowMin = Boolean(
    appliedCoupon &&
      appliedCoupon.minOrderAmount &&
      subtotal < appliedCoupon.minOrderAmount
  );
  // Authoritative dynamic discount capped at subtotal (never negative)
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

  // Reset or close modal
  const handleModalClose = React.useCallback(() => {
    if (step === 'confirmation') {
      // If closing after successful confirmation, clear cart
      if (onClearCart) onClearCart();
      setStep('form');
      setConfirmedOrder(null);
    }
    setServerError(null);
    onClose();
  }, [step, onClearCart, onClose]);

  // Load available promotional codes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    fetchAvailableCoupons().then((list) => {
      if (isMounted && Array.isArray(list)) {
        setAvailableCoupons(list);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle coupon apply action
  const handleApplyCoupon = async (codeToApply) => {
    const rawCode = String(codeToApply || couponInput || '').trim();
    if (!rawCode) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);

    const phone = formData.mobile || getCustomerSessionPhone() || '';
    const res = await validateCouponApi(rawCode, subtotal, phone);

    setIsApplyingCoupon(false);
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

  // Handle coupon remove action
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    clearStoredCoupon();
    setCouponError(null);
  };

  // Load gateway availability status
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    getPaymentGatewayConfig().then((cfg) => {
      if (isMounted) {
        setGatewayConfig(cfg);
      }
    });

    const sessionPhone = getCustomerSessionPhone();
    if (sessionPhone) {
      fetchCustomerAddresses(sessionPhone).then((res) => {
        if (isMounted && res.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
          setSavedAddresses(res.addresses);
          setFormData((prev) => {
            if (!prev.address) {
              const def = res.addresses.find((a) => a.isDefault) || res.addresses[0];
              return {
                ...prev,
                fullName: prev.fullName || def.recipientName || '',
                mobile: prev.mobile || def.mobile || sessionPhone,
                address: def.address || '',
                city: def.city || '',
                state: def.state || '',
                pincode: def.pincode || '',
              };
            }
            return prev;
          });
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Dedicated body scroll lock strictly tied to modal open/close lifecycle
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  // Focus management and Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    // Focus first input on open if on form step
    const timer = setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 100);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleModalClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isSubmitting, handleModalClose]);

  // Handle Form Change with real-time error clearance
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (serverError) {
      setServerError(null);
    }
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Validate all customer details (Requirement 4)
  const validateForm = () => {
    const newErrors = {};

    // Full Name: required, minimum 2 characters
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Mobile Number: required, valid Indian 10 digits starting with 6-9
    let cleanedMobile = formData.mobile.replace(/\D/g, '');
    if (cleanedMobile.length === 12 && cleanedMobile.startsWith('91')) {
      cleanedMobile = cleanedMobile.slice(2);
    } else if (cleanedMobile.length === 11 && cleanedMobile.startsWith('0')) {
      cleanedMobile = cleanedMobile.slice(1);
    }

    if (!cleanedMobile) {
      newErrors.mobile = 'Mobile number is required';
    } else if (cleanedMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedMobile)) {
      newErrors.mobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
    }

    // Email Address: optional, but validate format if entered
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    // Delivery Address: required, minimum 8 characters
    if (!formData.address.trim()) {
      newErrors.address = 'Full delivery address is required';
    } else if (formData.address.trim().length < 8) {
      newErrors.address = 'Please provide a complete street address (minimum 8 characters)';
    }

    // City: required, minimum 2 characters
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    } else if (formData.city.trim().length < 2) {
      newErrors.city = 'Please enter a valid city name';
    }

    // State: required
    if (!formData.state.trim()) {
      newErrors.state = 'Please select your delivery state';
    }

    // PIN Code: required, valid Indian 6 digits starting with 1-9
    const cleanedPin = formData.pincode.replace(/\D/g, '');
    if (!cleanedPin) {
      newErrors.pincode = 'PIN code is required';
    } else if (cleanedPin.length !== 6 || !/^[1-9]\d{5}$/.test(cleanedPin)) {
      newErrors.pincode = 'PIN code must be a valid 6-digit Indian PIN code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 1 -> Step 2: Proceed to Review
  const handleProceedToReview = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setServerError(null);
      setStep('review');
    }
  };

  // Step 2 -> Step 3: Place Order with duplicate submission guard and server recheck
  const handlePlaceOrder = async () => {
    // Guard against accidental duplicate submission (Requirement 7)
    if (isSubmitting) return;

    if (!validateForm()) {
      setStep('form');
      return;
    }

    // Enforce Requirement 4: If ONLINE is selected but gateway not configured, do not simulate payment
    if (paymentMethod === 'ONLINE' && !gatewayConfig.configured) {
      setServerError(
        'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env. Please choose Cash on Delivery (COD) to place your order.'
      );
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      // Recheck availability, authentic prices, and process payment method
      const result = await createOrder({
        items,
        customer: formData,
        paymentMethod,
        couponCode: appliedCoupon?.code || null,
      });

      if (result.success && result.order) {
        // Clear stored session coupon
        clearStoredCoupon();
        // Requirement 10: Clear cart only after successful order creation
        if (onClearCart) {
          onClearCart();
        }
        setConfirmedOrder(result.order);
        setStep('confirmation');
      } else {
        // Requirement 10: Handle errors gracefully without losing customer's cart or entered details
        setServerError(
          result.error || 'Unable to place order at this time. Please check your items and try again.'
        );
      }
    } catch (err) {
      setServerError(err.message || 'An unexpected error occurred while placing your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="checkout-backdrop"
      onClick={handleModalClose}
      role="presentation"
      id="checkout-modal-overlay"
      data-lenis-prevent="true"
      onWheel={(e) => {
        // Prevent backdrop wheel event from bleeding to the window
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        ref={modalRef}
        className="checkout-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-main-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => {
          e.stopPropagation();
          // If cursor is over header, banner or container chrome, forward scroll into checkout-body
          if (bodyRef.current && !bodyRef.current.contains(e.target)) {
            bodyRef.current.scrollTop += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        {/* Header Bar */}
        <header className="checkout-header">
          <div className="checkout-brand-area">
            <span className="checkout-brand-tag">MACHII MENS MART</span>
            <div className="checkout-title-wrap">
              <Lock size={15} className="checkout-lock-icon" />
              <h2 id="checkout-main-title" className="checkout-title">
                {step === 'confirmation'
                  ? 'ORDER CONFIRMED'
                  : step === 'review'
                  ? 'REVIEW YOUR ORDER'
                  : 'EXPRESS CHECKOUT'}
              </h2>
            </div>
          </div>

          <div className="checkout-header-actions">
            {/* Clear Demo Badge */}
            <span className="demo-mode-badge" title="Prototype mode - No payment charged">
              DEMO CHECKOUT
            </span>

            <button
              type="button"
              className="checkout-close-btn"
              onClick={handleModalClose}
              disabled={isSubmitting}
              aria-label="Close checkout"
              id="close-checkout-btn"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Demo Notice Banner (Requirement 10) */}
        <div className="checkout-demo-banner" role="alert">
          <Sparkles size={14} className="banner-icon" />
          <span>
            <strong>DEMO CHECKOUT MODE:</strong> Drop 01 Prototype. No real payment or bank charge is collected.
          </span>
        </div>

        {/* Checkout Content Container */}
        <div className="checkout-body" ref={bodyRef} data-lenis-prevent="true">
          {/* ================================================================= */}
          {/* STEP 3: ORDER CONFIRMATION SCREEN (Requirement 9 & 10)            */}
          {/* ================================================================= */}
          {step === 'confirmation' && confirmedOrder ? (
            <div className="order-confirmation-view" id="order-confirmation-screen">
              {/* Success Hero */}
              <div className="confirmation-hero">
                <div className="confirmation-icon-wrap" aria-hidden="true">
                  <CheckCircle2 size={54} className="confirmation-success-icon" />
                </div>
                <span className="confirmation-label">SUCCESSFUL DEMO ORDER</span>
                <h3 className="confirmation-heading">THANK YOU FOR YOUR ORDER!</h3>
                <p className="confirmation-subtext">
                  Your signature Machii streetwear order has been registered in demo mode.
                </p>

                {/* Unique Order Reference (Requirement 8) */}
                <div className="order-ref-card" id="order-reference-box">
                  <span className="ref-card-title">ORDER REFERENCE NUMBER</span>
                  <strong className="ref-card-number" id="confirmed-order-ref">
                    {confirmedOrder.orderRef}
                  </strong>
                  <span className="ref-card-timestamp">
                    Created on {new Date(confirmedOrder.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              {/* Two Column Confirmation Grid */}
              <div className="confirmation-details-grid">
                {/* Left: Customer & Delivery Details */}
                <div className="confirmation-card delivery-details-card">
                  <div className="card-section-title">
                    <Truck size={17} />
                    <h4>DELIVERY INFORMATION</h4>
                  </div>
                  <div className="delivery-info-content">
                    <p className="recipient-name" id="confirm-recipient-name">
                      {confirmedOrder.customer.fullName}
                    </p>
                    <p className="recipient-phone" id="confirm-recipient-phone">
                      +91 {confirmedOrder.customer.mobile}
                    </p>
                    {confirmedOrder.customer.email && (
                      <p className="recipient-email" id="confirm-recipient-email">
                        {confirmedOrder.customer.email}
                      </p>
                    )}
                    <address className="recipient-address" id="confirm-recipient-address">
                      {confirmedOrder.customer.address}
                      <br />
                      {confirmedOrder.customer.city}, {confirmedOrder.customer.state} -{' '}
                      <strong>{confirmedOrder.customer.pincode}</strong>
                    </address>
                    <div className="shipping-method-badge">
                      <Truck size={13} />
                      <span>Pan-India Express (Estimated 3-5 Business Days)</span>
                    </div>
                  </div>
                </div>

                {/* Right: Payment & Summary Breakdown */}
                <div className="confirmation-card payment-summary-card">
                  <div className="card-section-title">
                    <ShieldCheck size={17} />
                    <h4>PAYMENT & AMOUNT</h4>
                  </div>
                  <div className="payment-summary-content">
                    <div className="summary-line">
                      <span>Order Status</span>
                      <strong className="order-status-badge status-confirmed" id="confirm-order-status">
                        {confirmedOrder.status || 'Order Placed'}
                      </strong>
                    </div>
                    <div className="summary-line">
                      <span>Payment Method</span>
                      <strong className="payment-method-tag" id="confirm-payment-method">
                        {confirmedOrder.paymentMethod === 'COD'
                          ? 'Cash on Delivery (COD)'
                          : confirmedOrder.paymentMethod || 'Cash on Delivery (COD)'}
                      </strong>
                    </div>
                    {/* Requirement 5 & 10: Explicit Payment Status separate from Fulfillment Status */}
                    <div className="summary-line">
                      <span>Payment Status</span>
                      <strong
                        className={`payment-status-badge ${
                          confirmedOrder.paymentStatus === 'PAID'
                            ? 'status-paid'
                            : 'status-pending'
                        }`}
                        id="confirm-payment-status"
                      >
                        {confirmedOrder.paymentStatus === 'PAID'
                          ? 'PAID ONLINE'
                          : 'PENDING (Due on Delivery)'}
                      </strong>
                    </div>
                    <div className="summary-line">
                      <span>Order Fulfillment</span>
                      <strong
                        className="fulfillment-status-badge"
                        id="confirm-fulfillment-status"
                      >
                        {confirmedOrder.fulfillmentStatus || 'UNFULFILLED'}
                      </strong>
                    </div>
                    <div className="summary-line">
                      <span>Subtotal</span>
                      <span>{formatPrice(confirmedOrder.subtotal)}</span>
                    </div>
                    {confirmedOrder.couponCode &&
                      (confirmedOrder.discountAmount > 0 ||
                        (confirmedOrder.pricing && confirmedOrder.pricing.discount > 0)) && (
                        <div className="summary-line discount-line">
                          <span className="discount-label">
                            <span>Coupon ({confirmedOrder.couponCode})</span>
                          </span>
                          <span className="discount-amount">
                            -
                            {formatPrice(
                              confirmedOrder.discountAmount ||
                                confirmedOrder.pricing?.discount ||
                                0
                            )}
                          </span>
                        </div>
                      )}
                    <div className="summary-line">
                      <span>Pan-India Shipping</span>
                      <span className="free-shipping-tag">FREE</span>
                    </div>
                    <div className="summary-line total-line">
                      <span className="total-label">TOTAL PAYABLE</span>
                      <strong className="total-amount" id="confirm-final-total">
                        {formatPrice(confirmedOrder.total)}
                      </strong>
                    </div>

                    {confirmedOrder.paymentMethod === 'COD' && (
                      <div className="cod-doorstep-instructions" id="confirm-cod-instructions">
                        <Banknote size={15} className="note-icon" />
                        <span>
                          Please keep exact cash of{' '}
                          <strong>{formatPrice(confirmedOrder.total)}</strong> ready or use your
                          UPI app (GPay / PhonePe / Paytm) at the time of doorstep delivery.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 14: Order Confirmation Notification Notice */}
              <div className="confirm-notification-notice" id="confirm-notification-notice">
                <Bell size={16} className="notice-bell-icon" />
                <div className="notice-notification-text">
                  <strong>Notification Dispatched</strong>
                  <span>
                    Order confirmation dispatched to{' '}
                    <code>+91 {confirmedOrder.customer?.mobile}</code>
                    {confirmedOrder.customer?.email ? (
                      <> and <code>{confirmedOrder.customer?.email}</code></>
                    ) : null}
                    . You can track this drop in real-time.
                  </span>
                </div>
              </div>

              {/* Items Ordered List in Confirmation */}
              <div className="confirmation-items-card">
                <div className="card-section-title">
                  <ShoppingBag size={17} />
                  <h4>ITEMS ORDERED ({confirmedOrder.items.length})</h4>
                </div>
                <div className="confirmation-items-list" id="confirm-items-list">
                  {confirmedOrder.items.map((item) => {
                    const lineTotal = parsePrice(item.price) * item.quantity;
                    return (
                      <div key={item.key} className="confirm-item-row">
                        <div className="confirm-item-thumb">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={`${item.name} in ${item.color}`}
                              className="confirm-item-img"
                            />
                          ) : (
                            <div className="confirm-item-placeholder" />
                          )}
                        </div>
                        <div className="confirm-item-info">
                          <h5 className="confirm-item-name">{item.name}</h5>
                          <div className="confirm-item-tags">
                            <span className="confirm-tag color-tag">
                              {item.colorHex && (
                                <span
                                  className="color-dot"
                                  style={{ backgroundColor: item.colorHex }}
                                />
                              )}
                              {item.color}
                            </span>
                            <span className="confirm-tag size-tag">SIZE: {item.size}</span>
                            <span className="confirm-tag qty-tag">QTY: {item.quantity}</span>
                          </div>
                        </div>
                        <div className="confirm-item-pricing">
                          <span className="confirm-unit-price">{item.price} each</span>
                          <strong className="confirm-line-total">{formatPrice(lineTotal)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirmation Action Footer */}
              <div className="confirmation-footer">
                <button
                  type="button"
                  className="view-orders-cta"
                  onClick={() => {
                    const ref = confirmedOrder.orderRef;
                    handleModalClose();
                    if (onOpenOrders) onOpenOrders(ref);
                  }}
                  id="confirmation-view-order-history-btn"
                >
                  <Package size={17} />
                  <span>VIEW IN MY ORDERS</span>
                </button>
                <button
                  type="button"
                  className="continue-shopping-cta"
                  onClick={handleModalClose}
                  id="confirmation-continue-btn"
                >
                  <span>CONTINUE SHOPPING</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* STEP 1 & 2: FORM / REVIEW + ORDER SUMMARY (2-COLUMN LAYOUT)      */
            /* ================================================================= */
            <div className="checkout-main-grid">
              {/* Left Column: Form or Review */}
              <div className="checkout-left-column">
                {/* Stepper Header */}
                <div className="checkout-step-indicator" role="navigation" aria-label="Checkout Progress">
                  <button
                    type="button"
                    className={`step-btn ${step === 'form' ? 'active' : 'completed'}`}
                    onClick={() => setStep('form')}
                    id="step-details-btn"
                  >
                    <span className="step-number">1</span>
                    <span className="step-text">Delivery Details</span>
                  </button>
                  <span className="step-arrow">→</span>
                  <button
                    type="button"
                    className={`step-btn ${step === 'review' ? 'active' : ''}`}
                    onClick={() => {
                      if (validateForm()) setStep('review');
                    }}
                    id="step-review-btn"
                  >
                    <span className="step-number">2</span>
                    <span className="step-text">Review & Place</span>
                  </button>
                </div>

                {step === 'form' ? (
                  /* ======================================================= */
                  /* STEP 1: CUSTOMER DETAILS FORM (Requirements 4 & 5)      */
                  /* ======================================================= */
                  <form
                    className="customer-details-form"
                    onSubmit={handleProceedToReview}
                    noValidate
                    id="customer-details-form"
                  >
                    <div className="form-section-header">
                      <h3 className="section-title">SHIPPING & CONTACT</h3>
                      <p className="section-sub">
                        Enter your delivery address for Pan-India express dispatch.
                      </p>
                    </div>

                    {/* Saved Addresses Quick Selector (Step 9) */}
                    {savedAddresses.length > 0 && (
                      <div className="saved-addresses-quick-select" style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#F4F4F5', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#71717A', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                          DELIVER TO SAVED ADDRESS:
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {savedAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  fullName: addr.recipientName || prev.fullName,
                                  mobile: addr.mobile || prev.mobile,
                                  address: addr.address || prev.address,
                                  city: addr.city || prev.city,
                                  state: addr.state || prev.state,
                                  pincode: addr.pincode || prev.pincode,
                                }));
                                setErrors({});
                              }}
                              style={{
                                padding: '5px 12px',
                                fontSize: '0.76rem',
                                borderRadius: '6px',
                                border: '1px solid #D4D4D8',
                                backgroundColor: '#FFFFFF',
                                color: '#111113',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>{addr.tag || 'Address'} ({addr.city})</span>
                              {addr.isDefault && (
                                <span style={{ fontSize: '0.62rem', background: '#111113', color: '#FFF', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>
                                  DEFAULT
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Name */}
                    <div className="form-group">
                      <label htmlFor="checkout-fullName" className="form-label">
                        Full Name <span className="req-star">*</span>
                      </label>
                      <input
                        ref={initialFocusRef}
                        type="text"
                        id="checkout-fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="e.g. Arjun Sharma"
                        className={`form-input ${errors.fullName ? 'has-error' : ''}`}
                        aria-invalid={errors.fullName ? 'true' : 'false'}
                        aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                      />
                      {errors.fullName && (
                        <span className="form-error-msg" id="fullName-error">
                          <AlertCircle size={13} /> {errors.fullName}
                        </span>
                      )}
                    </div>

                    {/* Mobile & Email Row */}
                    <div className="form-row-2">
                      {/* Mobile Number */}
                      <div className="form-group">
                        <label htmlFor="checkout-mobile" className="form-label">
                          Mobile Number <span className="req-star">*</span>
                        </label>
                        <div className="input-prefix-wrap">
                          <span className="input-prefix">+91</span>
                          <input
                            type="tel"
                            id="checkout-mobile"
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            placeholder="10-digit number"
                            maxLength={10}
                            className={`form-input input-with-prefix ${
                              errors.mobile ? 'has-error' : ''
                            }`}
                            aria-invalid={errors.mobile ? 'true' : 'false'}
                            aria-describedby={errors.mobile ? 'mobile-error' : undefined}
                          />
                        </div>
                        {errors.mobile && (
                          <span className="form-error-msg" id="mobile-error">
                            <AlertCircle size={13} /> {errors.mobile}
                          </span>
                        )}
                      </div>

                      {/* Email Address (Optional) */}
                      <div className="form-group">
                        <label htmlFor="checkout-email" className="form-label">
                          Email Address <span className="optional-tag">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          id="checkout-email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="for order updates"
                          className={`form-input ${errors.email ? 'has-error' : ''}`}
                          aria-invalid={errors.email ? 'true' : 'false'}
                          aria-describedby={errors.email ? 'email-error' : undefined}
                        />
                        {errors.email && (
                          <span className="form-error-msg" id="email-error">
                            <AlertCircle size={13} /> {errors.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="form-group">
                      <label htmlFor="checkout-address" className="form-label">
                        Full Delivery Address <span className="req-star">*</span>
                      </label>
                      <textarea
                        id="checkout-address"
                        name="address"
                        rows={3}
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Flat / House No., Street, Landmark, Area"
                        className={`form-input form-textarea ${
                          errors.address ? 'has-error' : ''
                        }`}
                        aria-invalid={errors.address ? 'true' : 'false'}
                        aria-describedby={errors.address ? 'address-error' : undefined}
                      />
                      {errors.address && (
                        <span className="form-error-msg" id="address-error">
                          <AlertCircle size={13} /> {errors.address}
                        </span>
                      )}
                    </div>

                    {/* City, State & PIN Code Row */}
                    <div className="form-row-3">
                      {/* City */}
                      <div className="form-group">
                        <label htmlFor="checkout-city" className="form-label">
                          City <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          id="checkout-city"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder="City"
                          className={`form-input ${errors.city ? 'has-error' : ''}`}
                          aria-invalid={errors.city ? 'true' : 'false'}
                          aria-describedby={errors.city ? 'city-error' : undefined}
                        />
                        {errors.city && (
                          <span className="form-error-msg" id="city-error">
                            <AlertCircle size={13} /> {errors.city}
                          </span>
                        )}
                      </div>

                      {/* State */}
                      <div className="form-group">
                        <label htmlFor="checkout-state" className="form-label">
                          State <span className="req-star">*</span>
                        </label>
                        <select
                          id="checkout-state"
                          name="state"
                          value={formData.state}
                          onChange={handleChange}
                          className={`form-input form-select ${
                            errors.state ? 'has-error' : ''
                          }`}
                          aria-invalid={errors.state ? 'true' : 'false'}
                          aria-describedby={errors.state ? 'state-error' : undefined}
                        >
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        {errors.state && (
                          <span className="form-error-msg" id="state-error">
                            <AlertCircle size={13} /> {errors.state}
                          </span>
                        )}
                      </div>

                      {/* PIN Code */}
                      <div className="form-group">
                        <label htmlFor="checkout-pincode" className="form-label">
                          PIN Code <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          id="checkout-pincode"
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleChange}
                          placeholder="6 digits"
                          maxLength={6}
                          className={`form-input ${errors.pincode ? 'has-error' : ''}`}
                          aria-invalid={errors.pincode ? 'true' : 'false'}
                          aria-describedby={errors.pincode ? 'pincode-error' : undefined}
                        />
                        {errors.pincode && (
                          <span className="form-error-msg" id="pincode-error">
                            <AlertCircle size={13} /> {errors.pincode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="form-actions-wrap">
                      <button
                        type="submit"
                        className="checkout-next-btn"
                        id="proceed-to-review-btn"
                      >
                        <span>CONTINUE TO REVIEW ORDER</span>
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ======================================================= */
                  /* STEP 2: REVIEW ORDER BEFORE PLACING (Requirement 6)     */
                  /* ======================================================= */
                  <div className="order-review-section" id="order-review-section">
                    <div className="form-section-header">
                      <h3 className="section-title">CONFIRM DELIVERY & ORDER</h3>
                      <p className="section-sub">
                        Review your details before finalizing your Machii order.
                      </p>
                    </div>

                    {/* Server Error Alert Banner (Requirement 10) */}
                    {serverError && (
                      <div className="checkout-error-banner" role="alert" id="checkout-server-error">
                        <AlertCircle size={18} className="banner-error-icon" />
                        <div className="banner-error-text">
                          <strong>Order Notice:</strong> {serverError}
                        </div>
                      </div>
                    )}

                    {/* Delivery Summary Review Box */}
                    <div className="review-box delivery-review-box">
                      <div className="review-box-header">
                        <div className="box-title-group">
                          <Truck size={17} />
                          <h4>SHIPPING ADDRESS</h4>
                        </div>
                        <button
                          type="button"
                          className="review-edit-btn"
                          onClick={() => {
                            setServerError(null);
                            setStep('form');
                          }}
                          id="edit-shipping-btn"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="review-box-content" id="review-shipping-details">
                        <p className="review-customer-name">
                          <strong>{formData.fullName}</strong>
                        </p>
                        <p className="review-contact">
                          Phone: +91 {formData.mobile}
                          {formData.email ? ` • Email: ${formData.email}` : ''}
                        </p>
                        <p className="review-address-text">
                          {formData.address}, {formData.city}, {formData.state} -{' '}
                          <strong>{formData.pincode}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Payment Mode Selection Box (Requirements 1, 2, 4, 5) */}
                    <div className="review-box payment-review-box">
                      <div className="review-box-header">
                        <div className="box-title-group">
                          <ShieldCheck size={17} />
                          <h4>SELECT PAYMENT METHOD</h4>
                        </div>
                        <span className="review-badge-demo">
                          {paymentMethod === 'COD' ? 'COD SELECTED' : 'ONLINE PAYMENT'}
                        </span>
                      </div>

                      <div className="payment-options-list" role="radiogroup" aria-label="Payment Method Selection">
                        {/* Option 1: Cash on Delivery (COD) */}
                        <div
                          className={`payment-option-card ${
                            paymentMethod === 'COD' ? 'selected' : ''
                          }`}
                          onClick={() => {
                            setPaymentMethod('COD');
                            if (serverError) setServerError(null);
                          }}
                          role="radio"
                          aria-checked={paymentMethod === 'COD'}
                          tabIndex={0}
                          id="payment-method-cod-card"
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              setPaymentMethod('COD');
                              if (serverError) setServerError(null);
                            }
                          }}
                        >
                          <div className="option-radio-wrap">
                            <input
                              type="radio"
                              id="payment-method-cod"
                              name="paymentMethod"
                              value="COD"
                              checked={paymentMethod === 'COD'}
                              onChange={() => {
                                setPaymentMethod('COD');
                                if (serverError) setServerError(null);
                              }}
                            />
                          </div>

                          <div className="option-icon-wrap cod-icon-wrap">
                            <Banknote size={22} className="payment-type-icon" />
                          </div>

                          <div className="option-text-wrap">
                            <div className="option-headline">
                              <span className="option-title">Cash on Delivery (COD)</span>
                              <span className="option-badge badge-active">ACTIVE & READY</span>
                            </div>
                            <p className="option-subtext">
                              Pay securely upon doorstep delivery using Cash or your UPI app (GPay/PhonePe). No advance card payment needed.
                            </p>
                            <span className="payment-timing-note">
                              Payment status: <strong>Pending (Due upon delivery)</strong>
                            </span>
                          </div>
                        </div>

                        {/* Option 2: Online Payment Gateway */}
                        <div
                          className={`payment-option-card ${
                            paymentMethod === 'ONLINE' ? 'selected' : ''
                          } ${!gatewayConfig.configured ? 'gateway-unconfigured' : ''}`}
                          onClick={() => {
                            setPaymentMethod('ONLINE');
                            if (!gatewayConfig.configured) {
                              setServerError(
                                'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env. Please select Cash on Delivery (COD) to place your order.'
                              );
                            } else {
                              if (serverError) setServerError(null);
                            }
                          }}
                          role="radio"
                          aria-checked={paymentMethod === 'ONLINE'}
                          tabIndex={0}
                          id="payment-method-online-card"
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              setPaymentMethod('ONLINE');
                              if (!gatewayConfig.configured) {
                                setServerError(
                                  'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env. Please select Cash on Delivery (COD) to place your order.'
                                );
                              } else {
                                if (serverError) setServerError(null);
                              }
                            }
                          }}
                        >
                          <div className="option-radio-wrap">
                            <input
                              type="radio"
                              id="payment-method-online"
                              name="paymentMethod"
                              value="ONLINE"
                              checked={paymentMethod === 'ONLINE'}
                              onChange={() => {
                                setPaymentMethod('ONLINE');
                                if (!gatewayConfig.configured) {
                                  setServerError(
                                    'Online payment gateway is not configured on this server. Missing credentials: RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env. Please select Cash on Delivery (COD) to place your order.'
                                  );
                                } else {
                                  if (serverError) setServerError(null);
                                }
                              }}
                            />
                          </div>

                          <div className="option-icon-wrap online-icon-wrap">
                            <CreditCard size={22} className="payment-type-icon" />
                          </div>

                          <div className="option-text-wrap">
                            <div className="option-headline">
                              <span className="option-title">Online Payment (UPI, Cards, Netbanking)</span>
                              <span
                                className={`option-badge ${
                                  gatewayConfig.configured ? 'badge-available' : 'badge-setup'
                                }`}
                              >
                                {gatewayConfig.configured ? 'INSTANT' : 'GATEWAY SETUP REQUIRED'}
                              </span>
                            </div>
                            <p className="option-subtext">
                              Direct online checkout via Razorpay, Cards, or UPI.
                            </p>

                            {!gatewayConfig.configured && (
                              <div className="gateway-setup-hint-box" role="note">
                                <AlertTriangle size={13} className="hint-icon" />
                                <span>
                                  <strong>Gateway Setup Required:</strong> Merchant keys (<code>RAZORPAY_KEY_ID</code> &amp; <code>RAZORPAY_KEY_SECRET</code>) must be configured in <code>.env</code> before online payments can be processed. Please use <strong>Cash on Delivery (COD)</strong> to place orders immediately.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Duplicate Submission Protected Place Order CTA (Requirement 7) */}
                    <div className="review-actions-wrap">
                      <button
                        type="button"
                        className="review-back-btn"
                        onClick={() => {
                          setServerError(null);
                          setStep('form');
                        }}
                        disabled={isSubmitting}
                        id="back-to-form-btn"
                      >
                        <ArrowLeft size={16} />
                        <span>BACK TO DETAILS</span>
                      </button>

                      <button
                        type="button"
                        className={`place-order-cta-btn ${
                          paymentMethod === 'ONLINE' && !gatewayConfig.configured ? 'cta-disabled-state' : ''
                        }`}
                        onClick={handlePlaceOrder}
                        disabled={isSubmitting || items.length === 0}
                        id="place-order-btn"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={18} className="spinner-anim" />
                            <span>PROCESSING ORDER...</span>
                          </>
                        ) : paymentMethod === 'ONLINE' && !gatewayConfig.configured ? (
                          <>
                            <AlertTriangle size={18} />
                            <span>SELECT COD TO PLACE ORDER</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={18} />
                            <span>
                              {paymentMethod === 'COD' ? 'PLACE COD ORDER' : 'PAY ONLINE'} (
                              {formatPrice(total)})
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {isSubmitting && (
                      <p className="submitting-note" role="status" aria-live="polite">
                        Creating your order reference... Please do not close this window.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary (Requirement 3) */}
              <aside className="checkout-right-column" aria-label="Order Summary">
                <div className="order-summary-panel">
                  <div className="summary-header">
                    <h3 className="summary-title">ORDER SUMMARY</h3>
                    <span className="summary-count">
                      {items.reduce((acc, i) => acc + i.quantity, 0)} ITEMS
                    </span>
                  </div>

                  {/* Complete List of Products (Requirement 3) */}
                  <div className="summary-items-list" id="checkout-summary-items">
                    {items.length === 0 ? (
                      <p className="no-items-warning">Your bag is currently empty.</p>
                    ) : (
                      items.map((item) => {
                        const lineTotal = parsePrice(item.price) * item.quantity;
                        return (
                          <div key={item.key} className="summary-item-card">
                            <div className="summary-thumb-box">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={`${item.name} in ${item.color}`}
                                  className="summary-item-img"
                                />
                              ) : (
                                <div className="summary-placeholder" />
                              )}
                            </div>

                            <div className="summary-item-details">
                              <h4 className="summary-item-name">{item.name}</h4>

                              <div className="summary-item-meta">
                                <span className="meta-pill color-meta">
                                  {item.colorHex && (
                                    <span
                                      className="meta-dot"
                                      style={{ backgroundColor: item.colorHex }}
                                    />
                                  )}
                                  {item.color}
                                </span>
                                <span className="meta-pill size-meta">SIZE: {item.size}</span>
                                <span className="meta-pill qty-meta">QTY: {item.quantity}</span>
                              </div>

                              <div className="summary-item-prices">
                                <span className="unit-price">{item.price} each</span>
                                <strong className="line-total">{formatPrice(lineTotal)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* STEP 13: Coupons & Promotional Code Section */}
                  <div className="checkout-coupon-panel" id="checkout-coupon-panel">
                    <div className="coupon-panel-header">
                      <Tag size={13} className="coupon-panel-icon" />
                      <span>OFFERS & PROMO CODES</span>
                    </div>

                    {!appliedCoupon ? (
                      <div className="coupon-input-wrapper">
                        <div className="coupon-input-group">
                          <input
                            type="text"
                            className="coupon-text-input"
                            placeholder="PROMO CODE (e.g. MACHII10)"
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
                            disabled={isApplyingCoupon}
                            aria-label="Enter promotional coupon code"
                            id="checkout-coupon-input"
                          />
                          <button
                            type="button"
                            className="coupon-submit-btn"
                            onClick={() => handleApplyCoupon(couponInput)}
                            disabled={isApplyingCoupon || !couponInput.trim()}
                            id="checkout-coupon-apply-btn"
                          >
                            {isApplyingCoupon ? (
                              <Loader2 size={13} className="spinner-anim" />
                            ) : (
                              'APPLY'
                            )}
                          </button>
                        </div>

                        {couponError && (
                          <div className="coupon-feedback-msg error" role="alert" id="checkout-coupon-error">
                            <AlertCircle size={13} />
                            <span>{couponError}</span>
                          </div>
                        )}

                        {/* Suggested Promo Chips */}
                        {availableCoupons.length > 0 && (
                          <div className="coupon-available-hints">
                            <span className="hints-title">Available Drop Offers:</span>
                            <div className="hints-chips-list">
                              {availableCoupons.map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  className="promo-chip-btn"
                                  onClick={() => handleApplyCoupon(c.code)}
                                  title={c.description}
                                >
                                  <strong className="chip-code">{c.code}</strong>
                                  <span className="chip-discount">
                                    {c.discountType === 'PERCENTAGE'
                                      ? `${c.discountValue}% OFF`
                                      : `₹${c.discountValue} OFF`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="coupon-active-card" id="checkout-coupon-active">
                        <div className="active-card-details">
                          <div className="active-code-badge">
                            <CheckCircle2 size={14} className="active-badge-icon" />
                            <strong className="active-code-text">{appliedCoupon.code}</strong>
                            {isBelowMin ? (
                              <span className="active-saved-pill" style={{ background: '#CA8A04' }}>
                                ADD {formatPrice(appliedCoupon.minOrderAmount - subtotal)} MORE
                              </span>
                            ) : (
                              <span className="active-saved-pill">
                                SAVE {formatPrice(effectiveDiscount)}
                              </span>
                            )}
                          </div>
                          <p className="active-coupon-desc">{appliedCoupon.description}</p>
                          {isBelowMin && (
                            <p className="active-coupon-desc" style={{ color: '#CA8A04', fontWeight: 600 }}>
                              Minimum order of ₹{Number(appliedCoupon.minOrderAmount).toLocaleString('en-IN')} required to activate.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="coupon-discard-btn"
                          onClick={handleRemoveCoupon}
                          aria-label="Remove applied coupon"
                          title="Remove coupon"
                          id="checkout-coupon-remove-btn"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Calculations Breakdown */}
                  <div className="summary-calculations">
                    <div className="calc-row">
                      <span className="calc-label">Subtotal</span>
                      <span className="calc-value" id="checkout-subtotal-val">
                        {formatPrice(subtotal)}
                      </span>
                    </div>

                    {appliedCoupon && effectiveDiscount > 0 && (
                      <div className="calc-row discount-calc-row">
                        <span className="calc-label discount-label-wrap">
                          <span>Coupon Discount</span>
                          <span className="calc-code-tag">{appliedCoupon.code}</span>
                        </span>
                        <span className="calc-value discount-calc-val" id="checkout-discount-val">
                          -{formatPrice(effectiveDiscount)}
                        </span>
                      </div>
                    )}

                    <div className="calc-row">
                      <span className="calc-label">Pan-India Express Shipping</span>
                      <span className="calc-value shipping-free-badge">FREE</span>
                    </div>

                    <div className="calc-row">
                      <span className="calc-label">Estimated GST / Taxes</span>
                      <span className="calc-value">INCLUDED</span>
                    </div>

                    <div className="calc-row final-calc-row">
                      <span className="total-title">TOTAL AMOUNT</span>
                      <strong className="total-amount-val" id="checkout-total-val">
                        {formatPrice(total)}
                      </strong>
                    </div>
                  </div>

                  {/* Streetwear Guarantee Tag */}
                  <div className="checkout-trust-box">
                    <ShieldCheck size={16} className="trust-icon" />
                    <span>Free Pan-India Delivery • 7-Day Fit Guarantee</span>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
