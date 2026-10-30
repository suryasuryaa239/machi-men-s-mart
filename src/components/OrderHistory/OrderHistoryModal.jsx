import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Package,
  ShoppingBag,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Loader2,
  Search,
  ExternalLink,
  Banknote,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  MapPin,
  User,
  Bell,
} from 'lucide-react';
import {
  fetchCustomerOrders,
  fetchOrderDetail,
  fetchOrderTracking,
  getCustomerSessionPhone,
  saveCustomerSessionPhone,
} from '../../utils/orderService';
import { formatPrice } from '../../utils/cartStorage';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import './OrderHistoryModal.css';

const FULFILLMENT_STAGES = [
  { key: 'Order Placed', label: 'Order Placed', icon: ShoppingBag },
  { key: 'Confirmed', label: 'Confirmed', icon: ShieldCheck },
  { key: 'Packed', label: 'Packed', icon: Package },
  { key: 'Shipped', label: 'Shipped', icon: Truck },
  { key: 'Out for Delivery', label: 'Out for Delivery', icon: MapPin },
  { key: 'Delivered', label: 'Delivered', icon: CheckCircle2 },
];

function getFulfillmentStageIndex(order) {
  if (!order) return 0;
  const status = String(order.status || '').trim().toLowerCase();
  const fulfillment = String(order.fulfillmentStatus || '').trim().toLowerCase();
  const trackingStatus = String(order.tracking?.status || '').trim().toLowerCase();

  // Requirement 4: Cancellation only when existing business rules & backend record it
  if (
    order.isCancelled ||
    status === 'cancelled' ||
    fulfillment === 'cancelled' ||
    trackingStatus === 'cancelled'
  ) {
    return -1;
  }

  const combined = `${trackingStatus} ${fulfillment} ${status}`;
  if (combined.includes('deliver')) return 5;
  if (combined.includes('out for delivery') || combined.includes('out_for_delivery')) return 4;
  if (combined.includes('ship') || combined.includes('dispatched')) return 3;
  if (combined.includes('pack')) return 2;
  if (combined.includes('confirm')) return 1;
  return 0; // Order Placed / UNFULFILLED
}

// Requirement 13: Strictly return real events without inventing fake events
function getStageEvent(order, stageIndex) {
  if (!order?.tracking?.events || !Array.isArray(order.tracking.events)) return null;
  const targetStage = FULFILLMENT_STAGES[stageIndex];
  if (!targetStage) return null;

  return (
    order.tracking.events.find((ev) => {
      const evStatus = String(ev.status || ev.title || '').trim().toLowerCase();
      const stageKey = targetStage.key.toLowerCase();
      if (stageKey === 'order placed') {
        return evStatus.includes('placed') || evStatus.includes('received');
      }
      return evStatus.includes(stageKey);
    }) || null
  );
}

function getCancellationEvent(order) {
  if (!order?.tracking?.events || !Array.isArray(order.tracking.events)) return null;
  return (
    order.tracking.events.find((ev) => {
      const evStatus = String(ev.status || ev.title || '').trim().toLowerCase();
      return evStatus.includes('cancel');
    }) || null
  );
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  initialOrderRef = null,
  onOpenProfile,
}) {
  const [phone, setPhone] = useState(() => getCustomerSessionPhone());
  const [phoneInput, setPhoneInput] = useState(() => getCustomerSessionPhone());
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [error, setError] = useState(null);
  const [showPhonePrompt, setShowPhonePrompt] = useState(!getCustomerSessionPhone());

  const modalRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Load customer order history
  const loadOrders = useCallback(async (targetPhone) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchCustomerOrders(targetPhone);
      if (res.success) {
        setOrders(res.orders || []);
        saveCustomerSessionPhone(targetPhone);
        setPhone(targetPhone);
        setShowPhonePrompt(false);
      } else {
        setError(res.error || 'Failed to retrieve order history.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while loading your orders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load single order detail
  const loadSingleOrderDetail = useCallback(async (orderRef, targetPhone) => {
    setIsDetailLoading(true);
    setError(null);

    try {
      const res = await fetchOrderDetail(orderRef, targetPhone);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      } else {
        setError(res.error || `Unable to load details for order "${orderRef}".`);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while loading order details.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  // Load orders or initial order on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const sessionPhone = getCustomerSessionPhone();
    if (sessionPhone) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        if (initialOrderRef) {
          loadSingleOrderDetail(initialOrderRef, sessionPhone);
        } else {
          loadOrders(sessionPhone);
        }
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        phoneInputRef.current?.focus();
      }, 100);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [isOpen, initialOrderRef, loadOrders, loadSingleOrderDetail]);

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
        if (selectedOrder && !initialOrderRef) {
          setSelectedOrder(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, selectedOrder, initialOrderRef, onClose]);

  // Submit phone verification form
  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    let cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
    else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);

    if (!cleaned || cleaned.length !== 10 || !/^[6-9]\d{9}$/.test(cleaned)) {
      setError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    loadOrders(cleaned);
  };

  // Refresh live order tracking from backend (Requirement 1, 5, 6)
  const handleRefreshTracking = async () => {
    if (!selectedOrder?.orderRef) return;
    setIsRefreshingTracking(true);
    setTrackingError(null);

    try {
      const res = await fetchOrderTracking(selectedOrder.orderRef, phone);
      if (res.success && res.tracking) {
        setSelectedOrder((prev) => ({
          ...prev,
          status: res.order?.status || res.tracking.status || prev.status,
          fulfillmentStatus:
            res.order?.fulfillmentStatus || res.tracking.status || prev.fulfillmentStatus,
          paymentStatus: res.order?.paymentStatus || prev.paymentStatus,
          tracking: res.tracking,
        }));
      } else {
        setTrackingError(res.error || 'Live tracking details are currently unavailable.');
      }
    } catch (err) {
      setTrackingError(err.message || 'Unable to connect to live tracking service.');
    } finally {
      setIsRefreshingTracking(false);
    }
  };

  const handleCopyAwb = (awb) => {
    if (!awb) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(awb)
        .then(() => {
          setCopiedAwb(true);
          setTimeout(() => setCopiedAwb(false), 2000);
        })
        .catch(() => {});
    }
  };

  const handleStartShopping = () => {
    onClose();
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
      className="orders-modal-backdrop"
      onClick={onClose}
      role="presentation"
      id="orders-modal-overlay"
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        className="orders-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-modal-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="orders-header">
          <div className="orders-brand-group">
            <span className="orders-brand-label">MACHII MENS MART</span>
            <div className="orders-title-wrap">
              <Package size={17} className="orders-header-icon" />
              <h2 id="orders-modal-title" className="orders-title">
                {selectedOrder ? 'ORDER DETAILS' : 'MY ORDERS'}
              </h2>
            </div>
          </div>

          <div className="orders-header-actions">
            <span className="orders-portal-tag">CUSTOMER ACCESS</span>
            <button
              type="button"
              className="orders-close-btn"
              onClick={onClose}
              aria-label="Close orders window"
              id="close-orders-modal-btn"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="orders-body" data-lenis-prevent="true">
          {/* ================================================================= */}
          {/* VIEW A: SINGLE ORDER DETAIL VIEW (Requirement 5)                  */}
          {/* ================================================================= */}
          {selectedOrder ? (
            <div className="order-detail-view" id="single-order-detail-view">
              {/* Top Navigation Bar */}
              <div className="detail-top-bar">
                <button
                  type="button"
                  className="detail-back-btn"
                  onClick={() => {
                    setSelectedOrder(null);
                    if (phone) loadOrders(phone);
                  }}
                  id="back-to-orders-list-btn"
                >
                  <ArrowLeft size={16} />
                  <span>Back to All Orders</span>
                </button>

                <div className="detail-created-date">
                  <Calendar size={14} />
                  <span>
                    Placed on{' '}
                    {new Date(selectedOrder.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              {/* Order Reference Hero Card */}
              <div className="detail-ref-hero">
                <div className="ref-hero-meta">
                  <span className="ref-hero-label">ORDER REFERENCE</span>
                  <h3 className="ref-hero-id" id="detail-order-ref">
                    {selectedOrder.orderRef}
                  </h3>
                </div>

                {/* Status Badges Row (Requirement 4 & 10) */}
                <div className="ref-hero-badges">
                  <div className="status-badge-group">
                    <span className="status-label-small">PAYMENT</span>
                    <span
                      className={`order-pill-badge ${
                        selectedOrder.paymentStatus === 'PAID'
                          ? 'pill-paid'
                          : 'pill-pending'
                      }`}
                      id="detail-payment-status"
                    >
                      {selectedOrder.paymentStatus === 'PAID'
                        ? 'PAID ONLINE'
                        : 'PENDING (COD)'}
                    </span>
                  </div>

                  <div className="status-badge-group">
                    <span className="status-label-small">FULFILLMENT</span>
                    <span
                      className="order-pill-badge pill-fulfillment"
                      id="detail-fulfillment-status"
                    >
                      {selectedOrder.fulfillmentStatus || 'UNFULFILLED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ============================================================= */}
              {/* SECTION: VISUAL ORDER TRACKING & FULFILLMENT TIMELINE         */}
              {/* Requirements 1, 2, 3, 4, 7, 8, 10, 13                        */}
              {/* ============================================================= */}
              {(() => {
                const currentStageIndex = getFulfillmentStageIndex(selectedOrder);
                const isCancelled = currentStageIndex === -1;
                const cancellationEvent = isCancelled ? getCancellationEvent(selectedOrder) : null;

                return (
                  <div className="detail-tracking-section" id="detail-tracking-section">
                    <div className="tracking-section-header">
                      <div className="tracking-header-left">
                        <Truck size={17} className="tracking-header-icon" />
                        <div className="tracking-header-titles">
                          <h4 className="tracking-section-title">ORDER FULFILLMENT TRACKING</h4>
                          <span className="tracking-section-subtitle">
                            {isCancelled
                              ? 'Order Cancelled'
                              : currentStageIndex === 5
                              ? 'Order Successfully Delivered'
                              : `Current Status: ${
                                  FULFILLMENT_STAGES[currentStageIndex]?.label ||
                                  selectedOrder.status ||
                                  'Order Placed'
                                }`}
                          </span>
                        </div>
                      </div>

                      <div className="tracking-header-right">
                        <button
                          type="button"
                          className="tracking-refresh-btn"
                          onClick={handleRefreshTracking}
                          disabled={isRefreshingTracking}
                          id="refresh-tracking-btn"
                          title="Refresh live tracking updates"
                        >
                          <RefreshCw
                            size={13}
                            className={isRefreshingTracking ? 'spinner-anim' : ''}
                          />
                          <span>{isRefreshingTracking ? 'Checking...' : 'Live Refresh'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Tracking error / unavailable state (Requirement 10) */}
                    {trackingError && (
                      <div
                        className="tracking-unavailable-banner"
                        role="alert"
                        id="tracking-unavailable-banner"
                      >
                        <AlertCircle size={15} className="unavailable-icon" />
                        <span>{trackingError}</span>
                      </div>
                    )}

                    {/* Cancelled State (Requirement 4) */}
                    {isCancelled ? (
                      <div className="tracking-cancelled-card" id="tracking-cancelled-card">
                        <div className="cancelled-card-top">
                          <AlertTriangle size={20} className="cancelled-icon" />
                          <div className="cancelled-titles">
                            <strong>ORDER CANCELLED</strong>
                            <p>This order has been cancelled by store operations.</p>
                          </div>
                        </div>
                        {cancellationEvent && (
                          <div className="cancelled-event-meta">
                            <span className="cancelled-time">
                              Recorded on{' '}
                              {new Date(cancellationEvent.timestamp).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                            {cancellationEvent.description && (
                              <p className="cancelled-reason">{cancellationEvent.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Visual Timeline Stepper (Requirements 2, 3, 11, 13) */
                      <div className="tracking-timeline-card">
                        <div className="tracking-stepper-grid" id="tracking-stepper-grid">
                          {FULFILLMENT_STAGES.map((stage, idx) => {
                            const isCompleted = idx < currentStageIndex;
                            const isCurrent = idx === currentStageIndex;
                            const isUpcoming = idx > currentStageIndex;
                            const IconComp = stage.icon;
                            const stageEvent = getStageEvent(selectedOrder, idx);

                            return (
                              <div
                                key={stage.key}
                                className={`stepper-node ${
                                  isCompleted
                                    ? 'is-completed'
                                    : isCurrent
                                    ? 'is-current'
                                    : 'is-upcoming'
                                }`}
                                id={`tracking-stage-${stage.key
                                  .toLowerCase()
                                  .replace(/\s+/g, '-')}`}
                              >
                                {/* Connector line between steps */}
                                {idx < FULFILLMENT_STAGES.length - 1 && (
                                  <div
                                    className={`stepper-line ${
                                      idx < currentStageIndex
                                        ? 'line-completed'
                                        : 'line-pending'
                                    }`}
                                  />
                                )}

                                {/* Node Icon Circle */}
                                <div className="stepper-circle-wrap">
                                  <div className="stepper-circle">
                                    {isCompleted ? (
                                      <Check size={14} className="node-check" />
                                    ) : (
                                      <IconComp size={14} className="node-icon" />
                                    )}
                                  </div>
                                  {isCurrent && <span className="current-pulse-ring" />}
                                </div>

                                {/* Node Information */}
                                <div className="stepper-meta">
                                  <strong className="stage-title">{stage.label}</strong>
                                  {isCurrent && (
                                    <span className="stage-current-pill">CURRENT STATUS</span>
                                  )}
                                  {stageEvent?.timestamp ? (
                                    <span className="stage-time">
                                      {new Date(stageEvent.timestamp).toLocaleDateString(
                                        'en-IN',
                                        {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        }
                                      )}
                                    </span>
                                  ) : (
                                    <span className="stage-pending-text">
                                      {isUpcoming ? 'Pending' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Courier & Dispatch Box (Requirement 7) */}
                        {selectedOrder.tracking?.carrier ||
                        selectedOrder.tracking?.trackingNumber ? (
                          <div className="tracking-courier-box" id="tracking-courier-box">
                            <div className="courier-box-left">
                              <span className="courier-badge-label">COURIER DISPATCH</span>
                              <strong className="courier-name" id="tracking-courier-carrier">
                                {selectedOrder.tracking.carrier || 'Express Courier'}
                              </strong>

                              {selectedOrder.tracking.trackingNumber && (
                                <div className="courier-awb-row">
                                  <span className="awb-title">AWB / TRACKING NO:</span>
                                  <code className="awb-code" id="tracking-courier-awb">
                                    {selectedOrder.tracking.trackingNumber}
                                  </code>
                                  <button
                                    type="button"
                                    className="copy-awb-btn"
                                    onClick={() =>
                                      handleCopyAwb(selectedOrder.tracking.trackingNumber)
                                    }
                                    id="copy-tracking-number-btn"
                                    title="Copy AWB Tracking Number"
                                  >
                                    {copiedAwb ? (
                                      <>
                                        <Check size={12} />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="courier-box-right">
                              {selectedOrder.tracking.trackingUrl && (
                                <a
                                  href={selectedOrder.tracking.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="courier-track-link"
                                  id="courier-external-portal-link"
                                >
                                  <span>Track on Courier Site</span>
                                  <ExternalLink size={13} />
                                </a>
                              )}

                              {selectedOrder.tracking.estimatedDelivery && (
                                <div className="courier-estimate-badge">
                                  <Clock size={13} />
                                  <span>
                                    Est. Delivery:{' '}
                                    <strong>
                                      {selectedOrder.tracking.estimatedDelivery}
                                    </strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="tracking-courier-pending-notice"
                            id="tracking-courier-pending"
                          >
                            <Truck size={15} className="notice-icon" />
                            <div className="notice-text">
                              <strong>Carrier & Tracking ID Pending</strong>
                              <p>
                                Courier details and tracking number will appear here as soon
                                as your order is dispatched.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2-Column Info Grid */}
              <div className="detail-info-grid">
                {/* Shipping & Delivery Info */}
                <div className="detail-card delivery-card">
                  <div className="card-header-row">
                    <Truck size={16} />
                    <h4>DELIVERY ADDRESS</h4>
                  </div>
                  <div className="card-content-wrap">
                    <p className="card-person-name">
                      <strong>{selectedOrder.customer.fullName}</strong>
                    </p>
                    <p className="card-person-contact">
                      Phone: +91 {selectedOrder.customer.mobile}
                      {selectedOrder.customer.email ? ` • ${selectedOrder.customer.email}` : ''}
                    </p>
                    <p className="card-person-address">
                      {selectedOrder.customer.address}
                      <br />
                      {selectedOrder.customer.city}, {selectedOrder.customer.state} -{' '}
                      <strong>{selectedOrder.customer.pincode}</strong>
                    </p>
                    <div className="delivery-method-pill">
                      <Truck size={13} />
                      <span>Pan-India Express Dispatch (3-5 Business Days)</span>
                    </div>
                  </div>
                </div>

                {/* Payment Summary Info */}
                <div className="detail-card payment-card">
                  <div className="card-header-row">
                    <ShieldCheck size={16} />
                    <h4>PAYMENT SUMMARY</h4>
                  </div>
                  <div className="card-content-wrap">
                    <div className="card-summary-line">
                      <span>Payment Method</span>
                      <strong className="summary-val-highlight">
                        {selectedOrder.paymentMethod === 'COD'
                          ? 'Cash on Delivery (COD)'
                          : selectedOrder.paymentMethod}
                      </strong>
                    </div>
                    <div className="card-summary-line">
                      <span>Subtotal</span>
                      <span>{formatPrice(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="card-summary-line">
                      <span>Pan-India Shipping</span>
                      <span className="free-shipping-tag">FREE</span>
                    </div>
                    <div className="card-summary-line card-total-line">
                      <span>TOTAL PAYABLE</span>
                      <strong className="card-total-val" id="detail-total-amount">
                        {formatPrice(selectedOrder.total)}
                      </strong>
                    </div>

                    {selectedOrder.paymentMethod === 'COD' && (
                      <div className="cod-doorstep-box">
                        <Banknote size={15} className="cod-icon" />
                        <span>
                          Please keep exact cash of{' '}
                          <strong>{formatPrice(selectedOrder.total)}</strong> ready or use your
                          UPI app at the time of delivery.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Ordered List */}
              <div className="detail-items-section">
                <div className="items-section-header">
                  <ShoppingBag size={17} />
                  <h4>ITEMS IN THIS ORDER ({selectedOrder.items?.length || 0})</h4>
                </div>

                <div className="detail-items-list" id="detail-items-list">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.key || item.id} className="detail-item-row">
                      <div className="detail-item-thumb">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={`${item.name} in ${item.color}`}
                            className="detail-item-img"
                          />
                        ) : (
                          <div className="detail-thumb-placeholder" />
                        )}
                      </div>

                      <div className="detail-item-meta">
                        <h5 className="detail-item-title">{item.name}</h5>
                        {item.subName && (
                          <span className="detail-item-sub">{item.subName}</span>
                        )}
                        <div className="detail-item-tags">
                          <span className="item-tag tag-color">
                            {item.colorHex && (
                              <span
                                className="tag-color-dot"
                                style={{ backgroundColor: item.colorHex }}
                              />
                            )}
                            {item.color}
                          </span>
                          <span className="item-tag tag-size">SIZE: {item.size}</span>
                          <span className="item-tag tag-qty">QTY: {item.quantity}</span>
                        </div>
                      </div>

                      <div className="detail-item-pricing">
                        <span className="unit-price-label">{item.price} each</span>
                        <strong className="line-total-label">
                          {formatPrice(item.lineTotal || (item.priceNum || 0) * item.quantity)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notifications & Status Dispatches (Step 14) */}
              {Array.isArray(selectedOrder.notifications) && selectedOrder.notifications.length > 0 && (
                <div className="detail-notifications-section" id="detail-notifications-section">
                  <div className="notifications-section-header">
                    <div className="notifications-header-left">
                      <Bell size={16} className="notifications-header-icon" />
                      <h4>ORDER NOTIFICATIONS & ALERTS</h4>
                    </div>
                    <span className="notifications-count-pill">
                      {selectedOrder.notifications.length} Event{selectedOrder.notifications.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="notifications-timeline-list" id="detail-notifications-list">
                    {selectedOrder.notifications.map((notif) => {
                      const isSent = notif.status === 'SENT';
                      const isFailed = notif.status === 'FAILED';
                      return (
                        <div key={notif.id || notif.idempotencyKey} className="notification-row">
                          <div className="notif-badge-col">
                            <span
                              className={`notif-status-badge ${
                                isSent
                                  ? 'badge-sent'
                                  : isFailed
                                  ? 'badge-failed'
                                  : 'badge-unconfigured'
                              }`}
                            >
                              {isSent ? 'DISPATCHED' : isFailed ? 'FAILED' : 'QUEUED / LOGGED'}
                            </span>
                            <span className="notif-channel-tag">{notif.channel || 'ALERT'}</span>
                          </div>

                          <div className="notif-body-col">
                            <strong className="notif-subject">
                              {notif.title || notif.subject || 'Order Status Update'}
                            </strong>
                            <p className="notif-summary">{notif.summary || notif.subject}</p>
                            {notif.recipientMasked && (
                              <span className="notif-recipient-meta">
                                Recipient: <code>{notif.recipientMasked}</code>
                              </span>
                            )}
                          </div>

                          <div className="notif-time-col">
                            <span className="notif-time-text">
                              {notif.timestamp
                                ? new Date(notif.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================================================================= */
            /* VIEW B: ORDER HISTORY LIST & PHONE SEARCH (Requirements 2, 4, 8)  */
            /* ================================================================= */
            <div className="order-history-view" id="customer-order-history-view">
              {/* Customer Phone Bar */}
              <div className="customer-phone-bar">
                <div className="phone-info-wrap">
                  <span className="phone-label">CUSTOMER ORDERS FOR</span>
                  <div className="phone-active-display">
                    <span className="phone-flag">🇮🇳</span>
                    <strong className="phone-number-text" id="active-customer-phone">
                      {phone ? `+91 ${phone}` : 'Verification Required'}
                    </strong>
                  </div>
                </div>

                <div className="phone-actions-wrap">
                  {onOpenProfile && (
                    <button
                      type="button"
                      className="switch-phone-btn"
                      onClick={() => {
                        onClose();
                        onOpenProfile();
                      }}
                      id="orders-to-profile-btn"
                      title="Manage Profile & Delivery Addresses"
                    >
                      <User size={14} />
                      <span>Profile & Addresses</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="switch-phone-btn"
                    onClick={() => setShowPhonePrompt(!showPhonePrompt)}
                    id="switch-customer-phone-btn"
                  >
                    <Search size={14} />
                    <span>{showPhonePrompt ? 'Cancel Lookup' : 'Search by Phone'}</span>
                  </button>
                </div>
              </div>

              {/* Phone Verification / Search Bar (Requirement 6 & 7) */}
              {showPhonePrompt && (
                <form
                  className="phone-lookup-form"
                  onSubmit={handlePhoneSubmit}
                  id="phone-lookup-form"
                >
                  <div className="lookup-form-content">
                    <label htmlFor="lookup-phone-input" className="lookup-label">
                      Enter your 10-digit Indian mobile number to access your verified order history:
                    </label>
                    <div className="lookup-input-group">
                      <div className="phone-input-wrap">
                        <span className="phone-prefix">+91</span>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          id="lookup-phone-input"
                          maxLength={10}
                          placeholder="e.g. 9876543210"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                          className="lookup-input"
                        />
                      </div>
                      <button
                        type="submit"
                        className="lookup-submit-btn"
                        disabled={isLoading}
                        id="lookup-submit-btn"
                      >
                        {isLoading ? (
                          <Loader2 size={16} className="spinner-anim" />
                        ) : (
                          <>
                            <Search size={15} />
                            <span>FIND MY ORDERS</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Server or Validation Error Alert */}
              {error && (
                <div className="orders-error-banner" role="alert" id="orders-error-banner">
                  <AlertCircle size={18} className="banner-icon" />
                  <div className="banner-text">
                    <strong>Notice:</strong> {error}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading || isDetailLoading ? (
                <div className="orders-loading-state" id="orders-loading-state">
                  <Loader2 size={32} className="spinner-anim" />
                  <p>Retrieving your verified Machii order history...</p>
                </div>
              ) : orders.length === 0 ? (
                /* Empty History State (Requirement 8) */
                <div className="orders-empty-state" id="orders-empty-state">
                  <div className="empty-icon-wrap">
                    <Package size={48} className="empty-icon" />
                  </div>
                  <h3 className="empty-title">NO ORDERS FOUND</h3>
                  <p className="empty-desc">
                    {phone
                      ? `We couldn't find any orders placed with +91 ${phone}. Placed an order with a different mobile number? Try searching with that number above.`
                      : 'Please verify your mobile number above to view your previous Machii streetwear orders.'}
                  </p>
                  <button
                    type="button"
                    className="empty-cta-btn"
                    onClick={handleStartShopping}
                    id="empty-start-shopping-btn"
                  >
                    <span>EXPLORE THE DROP</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                /* Populated Orders List (Requirement 4) */
                <div className="orders-list-wrap">
                  <div className="orders-list-header">
                    <span className="orders-count-label">
                      <strong>{orders.length}</strong> {orders.length === 1 ? 'ORDER' : 'ORDERS'}{' '}
                      FOUND
                    </span>
                    <span className="orders-help-text">
                      Click any order card to view complete itemized breakdown.
                    </span>
                  </div>

                  <div className="orders-cards-grid" id="orders-cards-list">
                    {orders.map((ord) => (
                      <div
                        key={ord.orderRef}
                        className="order-card-row"
                        onClick={() => setSelectedOrder(ord)}
                        role="button"
                        tabIndex={0}
                        id={`order-card-${ord.orderRef}`}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            setSelectedOrder(ord);
                          }
                        }}
                      >
                        {/* Left: Ref & Date */}
                        <div className="card-col-meta">
                          <span className="order-ref-code">{ord.orderRef}</span>
                          <span className="order-date-text">
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Center: Garment Thumbnails Row */}
                        <div className="card-col-items">
                          <div className="card-thumbs-group">
                            {ord.items?.slice(0, 3).map((it, idx) => (
                              <div
                                key={it.key || idx}
                                className="thumb-item-box"
                                title={`${it.name} (${it.size})`}
                              >
                                {it.image ? (
                                  <img
                                    src={it.image}
                                    alt={it.name}
                                    className="thumb-mini-img"
                                  />
                                ) : (
                                  <div className="thumb-empty-placeholder" />
                                )}
                              </div>
                            ))}
                            {(ord.items?.length || 0) > 3 && (
                              <div className="thumb-more-badge">
                                +{ord.items.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="card-items-summary">
                            {ord.items?.length || 0}{' '}
                            {(ord.items?.length || 0) === 1 ? 'garment' : 'garments'}
                          </span>
                        </div>

                        {/* Center-Right: Payment & Fulfillment Badges (Requirement 4 & 10) */}
                        <div className="card-col-status">
                          <span
                            className={`status-pill ${
                              ord.paymentStatus === 'PAID' ? 'pill-paid' : 'pill-pending'
                            }`}
                          >
                            {ord.paymentStatus === 'PAID' ? 'PAID' : 'COD PENDING'}
                          </span>
                          <span className="status-pill pill-fulfillment">
                            {ord.fulfillmentStatus || 'UNFULFILLED'}
                          </span>
                        </div>

                        {/* Right: Amount & Action */}
                        <div className="card-col-action">
                          <strong className="card-amount-total">
                            {formatPrice(ord.total)}
                          </strong>
                          <div className="card-action-btns">
                            <button
                              type="button"
                              className="card-track-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                              }}
                              id={`track-order-btn-${ord.orderRef}`}
                              title="Track Order Fulfillment"
                            >
                              <Truck size={12} />
                              <span>Track</span>
                            </button>
                            <span className="view-details-cta">
                              <span>Details</span>
                              <ExternalLink size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
