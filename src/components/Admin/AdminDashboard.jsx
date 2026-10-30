import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Key,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  X,
  ChevronRight,
  LogOut,
  Save,
  DollarSign,
  Layers,
  Tag,
  Users,
  Settings,
  Download,
  Printer,
  Sparkles,
  Store,
  Phone,
  Mail,
} from 'lucide-react';
import {
  adminLogin,
  adminLogout,
  isAdminAuthenticated,
  fetchAdminSummary,
  fetchAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStock,
  deleteAdminProduct,
  fetchAdminOrders,
  updateAdminOrderStatus,
  updateAdminOrderPayment,
  fetchAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCustomers,
  fetchAdminStoreSettings,
  updateAdminStoreSettings,
  fetchAdminAnalytics,
  exportOrdersToCSV,
} from '../../utils/adminService';
import { formatPrice, parsePrice } from '../../utils/cartStorage';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import './AdminDashboard.css';

const PRESET_PRODUCT_IMAGES = [
  { label: 'Attitude 01 Charcoal Tee', url: '/assets/products/machii-attitude-01-charcoal.png' },
  { label: 'Cyber Cobalt Acid Tee', url: '/assets/products/machii-cyber-cobalt.png' },
  { label: 'Tokyo Energy Bone Tee', url: '/assets/products/machii-tokyo-bone.png' },
  { label: 'Drop 01 Sage Olive Tee', url: '/assets/products/machii-drop01-sage.png' },
  { label: 'Vintage Cream Box Cut', url: '/assets/products/machii-retro-cream.png' },
  { label: 'Mineral Slate Hoodie', url: '/assets/products/machii-attitude-hoodie.png' },
];

const ORDER_STATUS_OPTIONS = [
  'Order Placed',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const COUPON_PRESETS = [
  {
    name: '10% Welcome Drop',
    code: 'MACHII10',
    description: '10% OFF on first order above ₹1,400',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 1400,
    maxDiscountAmount: 500,
    maxUses: 100,
  },
  {
    name: 'Flat ₹300 Streetwear',
    code: 'FLAT300',
    description: 'Flat ₹300 OFF on orders above ₹1,999',
    discountType: 'FLAT',
    discountValue: 300,
    minOrderAmount: 1999,
    maxDiscountAmount: null,
    maxUses: 50,
  },
  {
    name: '15% Weekend Vibe',
    code: 'WEEKEND15',
    description: '15% OFF flash discount on orders above ₹2,000',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderAmount: 2000,
    maxDiscountAmount: 750,
    maxUses: 75,
  },
  {
    name: 'Flat ₹500 VIP Drop',
    code: 'VIP500',
    description: 'Flat ₹500 OFF on premium boxy orders above ₹3,000',
    discountType: 'FLAT',
    discountValue: 500,
    minOrderAmount: 3000,
    maxDiscountAmount: null,
    maxUses: 30,
  },
];

export default function AdminDashboard({ isOpen, onClose }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => isAdminAuthenticated());
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Tab: 'overview' | 'products' | 'orders' | 'coupons' | 'customers' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  // Dashboard Data
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Customers Directory State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerForAddresses, setSelectedCustomerForAddresses] = useState(null);

  // Store Settings & Live Announcement Banner State
  const [storeSettings, setStoreSettings] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Financial & Operational Analytics
  const [analytics, setAnalytics] = useState(null);

  // Printable Packing Slip / Tax Invoice Modal State
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Products Tab State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productFormData, setProductFormData] = useState({
    name: '',
    subName: '',
    price: '',
    originalPrice: '',
    stock: 50,
    category: 'oversized',
    gsm: '260 GSM Combed Cotton',
    fit: 'Signature Boxy Fit',
    description: '',
    image: '/assets/products/machii-attitude-01-charcoal.png',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    badge: 'NEW DROP',
    colorName: 'Standard Dark',
    colorHex: '#111113',
  });
  const [productFormErrors, setProductFormErrors] = useState({});
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Orders Tab State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdatePayload, setStatusUpdatePayload] = useState({
    status: '',
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
    description: '',
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const modalRef = useRef(null);

  // STEP 13: Coupons & Promotional Discounts Tab State
  const [coupons, setCoupons] = useState([]);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponTypeFilter, setCouponTypeFilter] = useState('all');
  const [couponStatusFilter, setCouponStatusFilter] = useState('all');
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponFormData, setCouponFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 1400,
    maxDiscountAmount: 500,
    maxUses: 100,
    maxUsesPerCustomer: 1,
    expiresAt: '',
    isActive: true,
  });
  const [couponFormErrors, setCouponFormErrors] = useState({});
  const [isSavingCoupon, setIsSavingCoupon] = useState(false);

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
        if (isInvoiceModalOpen) setIsInvoiceModalOpen(false);
        else if (selectedCustomerForAddresses) setSelectedCustomerForAddresses(null);
        else if (selectedOrder) setSelectedOrder(null);
        else if (isProductModalOpen) setIsProductModalOpen(false);
        else if (isCouponModalOpen) setIsCouponModalOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    isInvoiceModalOpen,
    selectedCustomerForAddresses,
    selectedOrder,
    isProductModalOpen,
    isCouponModalOpen,
    onClose,
  ]);

  const showToast = useCallback((msg) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  }, []);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!isAdminAuthenticated()) {
      setIsAuthenticated(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const [sumRes, prodRes, ordRes, coupRes, custRes, settRes, anaRes] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminProducts(),
        fetchAdminOrders(),
        fetchAdminCoupons(),
        fetchAdminCustomers(),
        fetchAdminStoreSettings(),
        fetchAdminAnalytics(),
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (prodRes.success) setProducts(prodRes.products);
      if (ordRes.success) setOrders(ordRes.orders);
      if (coupRes.success) setCoupons(coupRes.coupons);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (settRes.success) setStoreSettings(settRes.settings || null);
      if (anaRes.success) setAnalytics(anaRes.analytics || null);

      if (!sumRes.success && sumRes.error?.includes('Unauthorized')) {
        setIsAuthenticated(false);
        adminLogout();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error connecting to backend services.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Coupon Management Handlers (Step 13 Requirement 10)
  const handleToggleCouponStatus = async (coupon) => {
    const newStatus = !coupon.isActive;
    const res = await updateAdminCoupon(coupon.id, { isActive: newStatus });
    if (res.success) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, isActive: newStatus } : c))
      );
      showToast(`Coupon "${coupon.code}" ${newStatus ? 'activated' : 'deactivated'}.`);
    } else {
      setErrorMsg(res.error || 'Failed to toggle coupon status.');
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) {
      return;
    }
    const res = await deleteAdminCoupon(coupon.id);
    if (res.success) {
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      showToast(`Coupon "${coupon.code}" deleted successfully.`);
    } else {
      setErrorMsg(res.error || 'Failed to delete coupon.');
    }
  };

  const handleOpenCreateCouponModal = () => {
    setEditingCoupon(null);
    setCouponFormData({
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 1400,
      maxDiscountAmount: 500,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      expiresAt: '',
      isActive: true,
    });
    setCouponFormErrors({});
    setIsCouponModalOpen(true);
  };

  const handleOpenEditCouponModal = (coupon) => {
    setEditingCoupon(coupon);
    setCouponFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType || 'PERCENTAGE',
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount || 0,
      maxDiscountAmount: coupon.maxDiscountAmount || '',
      maxUses: coupon.maxUses || 100,
      maxUsesPerCustomer: coupon.maxUsesPerCustomer || 1,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
      isActive: coupon.isActive !== false,
    });
    setCouponFormErrors({});
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const errors = {};

    const rawCode = String(couponFormData.code || '').trim().toUpperCase();
    if (!rawCode || rawCode.length < 3) {
      errors.code = 'Coupon code must be at least 3 characters.';
    }

    const val = Number(couponFormData.discountValue);
    if (isNaN(val) || val <= 0) {
      errors.discountValue = 'Discount value must be greater than 0.';
    } else if (couponFormData.discountType === 'PERCENTAGE' && val > 100) {
      errors.discountValue = 'Percentage discount cannot exceed 100%.';
    }

    if (Object.keys(errors).length > 0) {
      setCouponFormErrors(errors);
      return;
    }

    setIsSavingCoupon(true);
    setCouponFormErrors({});

    try {
      if (editingCoupon) {
        const updates = {
          description: couponFormData.description,
          discountType: couponFormData.discountType,
          discountValue: val,
          minOrderAmount: Number(couponFormData.minOrderAmount) || 0,
          maxDiscountAmount: couponFormData.maxDiscountAmount
            ? Number(couponFormData.maxDiscountAmount)
            : null,
          maxUses: Number(couponFormData.maxUses) || 100,
          maxUsesPerCustomer: Number(couponFormData.maxUsesPerCustomer) || 1,
          expiresAt: couponFormData.expiresAt ? new Date(couponFormData.expiresAt).toISOString() : null,
          isActive: couponFormData.isActive,
        };
        const res = await updateAdminCoupon(editingCoupon.id, updates);
        if (res.success && res.coupon) {
          setCoupons((prev) => prev.map((c) => (c.id === editingCoupon.id ? res.coupon : c)));
          setIsCouponModalOpen(false);
          showToast(`Coupon "${res.coupon.code}" updated successfully.`);
        } else {
          setCouponFormErrors({ form: res.error || 'Failed to update coupon.' });
        }
      } else {
        const payload = {
          code: rawCode,
          description: couponFormData.description,
          discountType: couponFormData.discountType,
          discountValue: val,
          minOrderAmount: Number(couponFormData.minOrderAmount) || 0,
          maxDiscountAmount: couponFormData.maxDiscountAmount
            ? Number(couponFormData.maxDiscountAmount)
            : null,
          maxUses: Number(couponFormData.maxUses) || 100,
          maxUsesPerCustomer: Number(couponFormData.maxUsesPerCustomer) || 1,
          expiresAt: couponFormData.expiresAt ? new Date(couponFormData.expiresAt).toISOString() : null,
          isActive: couponFormData.isActive,
        };
        const res = await createAdminCoupon(payload);
        if (res.success && res.coupon) {
          setCoupons((prev) => [res.coupon, ...prev]);
          setIsCouponModalOpen(false);
          showToast(`Coupon "${res.coupon.code}" created successfully.`);
        } else {
          setCouponFormErrors({ form: res.error || 'Failed to create coupon.' });
        }
      }
    } catch (err) {
      setCouponFormErrors({ form: err.message || 'Error saving coupon.' });
    } finally {
      setIsSavingCoupon(false);
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    if (couponSearch) {
      const q = couponSearch.toLowerCase().trim();
      const codeMatch = coupon.code.toLowerCase().includes(q);
      const descMatch = (coupon.description || '').toLowerCase().includes(q);
      if (!codeMatch && !descMatch) return false;
    }
    if (couponTypeFilter !== 'all' && coupon.discountType !== couponTypeFilter) {
      return false;
    }
    if (couponStatusFilter === 'active' && !coupon.isActive) {
      return false;
    }
    if (couponStatusFilter === 'inactive' && coupon.isActive) {
      return false;
    }
    return true;
  });

  const filteredCustomers = customers.filter((cust) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase().trim();
    const nameMatch = (cust.name || cust.fullName || '').toLowerCase().includes(q);
    const phoneMatch = (cust.mobile || cust.phone || '').toLowerCase().includes(q);
    const emailMatch = (cust.email || '').toLowerCase().includes(q);
    return nameMatch || phoneMatch || emailMatch;
  });

  const handleApplyPresetCoupon = (preset) => {
    setEditingCoupon(null);
    setCouponFormData({
      code: preset.code,
      description: preset.description,
      discountType: preset.discountType,
      discountValue: preset.discountValue,
      minOrderAmount: preset.minOrderAmount,
      maxDiscountAmount: preset.maxDiscountAmount || '',
      maxUses: preset.maxUses,
      maxUsesPerCustomer: 1,
      expiresAt: '',
      isActive: true,
    });
    setCouponFormErrors({});
    setIsCouponModalOpen(true);
  };

  const handlePromoteCouponToBanner = async (coupon) => {
    const bannerText = `STREETWEAR DROP • ${
      coupon.discountType === 'PERCENTAGE'
        ? `${coupon.discountValue}% OFF`
        : `FLAT ₹${coupon.discountValue} OFF`
    } • USE CODE: ${coupon.code}`;
    const payload = {
      announcementBanner: {
        enabled: true,
        text: bannerText,
        promoCode: coupon.code,
      },
    };
    const res = await updateAdminStoreSettings(payload);
    if (res.success && res.settings) {
      setStoreSettings(res.settings);
      window.dispatchEvent(
        new CustomEvent('machii:settings-updated', { detail: res.settings })
      );
      showToast(`Coupon "${coupon.code}" promoted to storefront announcement banner!`);
    } else {
      setErrorMsg(res.error || 'Failed to promote coupon to banner.');
    }
  };

  const handleSaveStoreSettings = async (e) => {
    e.preventDefault();
    if (!storeSettings) return;
    setIsSavingSettings(true);
    try {
      const res = await updateAdminStoreSettings(storeSettings);
      if (res.success && res.settings) {
        setStoreSettings(res.settings);
        window.dispatchEvent(
          new CustomEvent('machii:settings-updated', { detail: res.settings })
        );
        showToast('Store settings updated and synced to storefront.');
      } else {
        setErrorMsg(res.error || 'Failed to update store settings.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleExportCSV = () => {
    const targetOrders = filteredOrders.length > 0 ? filteredOrders : orders;
    if (targetOrders.length === 0) {
      setErrorMsg('No orders available to export.');
      return;
    }
    const success = exportOrdersToCSV(targetOrders);
    if (success) {
      showToast(`Exported ${targetOrders.length} orders to CSV successfully.`);
    } else {
      setErrorMsg('Failed to export orders to CSV.');
    }
  };

  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      const timer = setTimeout(() => {
        loadDashboardData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isAuthenticated, loadDashboardData]);

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginKey.trim()) {
      setLoginError('Please enter admin authorization key.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    const res = await adminLogin(loginKey.trim());
    setIsLoggingIn(false);

    if (res.success) {
      setIsAuthenticated(true);
      setLoginKey('');
      loadDashboardData();
      showToast('Admin session authenticated successfully.');
    } else {
      setLoginError(res.error || 'Invalid credentials or unauthorized key.');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    adminLogout();
    setIsAuthenticated(false);
    setSummary(null);
    setProducts([]);
    setOrders([]);
    setCoupons([]);
    setCustomers([]);
    setStoreSettings(null);
    setAnalytics(null);
    showToast('Admin session logged out.');
  };

  // Quick Stock Adjustments (+1 / -1 / direct)
  const handleQuickStockChange = async (product, delta) => {
    const currentStock = product.stock || 0;
    const newStock = Math.max(0, currentStock + delta);
    if (newStock === currentStock) return;

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p))
    );

    const res = await updateAdminProductStock(product.id, { delta });
    if (!res.success) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock: currentStock } : p))
      );
      setErrorMsg(res.error || 'Failed to update stock on backend.');
    } else {
      loadDashboardData();
      showToast(`Stock updated for ${product.name}: ${newStock} units available.`);
    }
  };

  // Toggle Product Active / Deactivate
  const handleToggleProductStatus = async (product) => {
    const nextStatus = !product.isActive;
    const res = await updateAdminProduct(product.id, { isActive: nextStatus });
    if (res.success) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: nextStatus } : p))
      );
      loadDashboardData();
      showToast(`Product "${product.name}" is now ${nextStatus ? 'ACTIVE' : 'DEACTIVATED'}.`);
    } else {
      setErrorMsg(res.error || 'Failed to update product status.');
    }
  };

  // Open Product Modal (New or Edit)
  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name || '',
        subName: product.subName || product.subTitle || '',
        price: String(parsePrice(product.price) || ''),
        originalPrice: String(parsePrice(product.originalPrice) || ''),
        stock: product.stock !== undefined ? product.stock : 50,
        category: product.categories?.[1] || product.categories?.[0] || 'oversized',
        gsm: product.gsm || '260 GSM Combed Cotton',
        fit: product.fit || 'Signature Boxy Fit',
        description: product.description || '',
        image: product.image || '/assets/products/machii-attitude-01-charcoal.png',
        sizes: product.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
        badge: product.badge || 'NEW DROP',
        colorName: product.colors?.[0]?.name || 'Standard Dark',
        colorHex: product.colors?.[0]?.hex || '#111113',
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: '',
        subName: '',
        price: '',
        originalPrice: '',
        stock: 50,
        category: 'oversized',
        gsm: '260 GSM Combed Cotton',
        fit: 'Signature Boxy Fit',
        description: '',
        image: '/assets/products/machii-attitude-01-charcoal.png',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        badge: 'NEW DROP',
        colorName: 'Standard Dark',
        colorHex: '#111113',
      });
    }
    setProductFormErrors({});
    setIsProductModalOpen(true);
  };

  // Validate & Submit Product Form
  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!productFormData.name.trim() || productFormData.name.trim().length < 3) {
      errors.name = 'Product name must be at least 3 characters.';
    }

    const priceNum = parsePrice(productFormData.price);
    if (priceNum <= 0) {
      errors.price = 'Please enter a valid positive price in INR (e.g. 1499).';
    }

    if (parseInt(productFormData.stock, 10) < 0 || isNaN(productFormData.stock)) {
      errors.stock = 'Stock must be 0 or a positive integer.';
    }

    if (!productFormData.sizes || productFormData.sizes.length === 0) {
      errors.sizes = 'Select at least one available size.';
    }

    if (Object.keys(errors).length > 0) {
      setProductFormErrors(errors);
      return;
    }

    setIsSavingProduct(true);
    setProductFormErrors({});

    const payload = {
      name: productFormData.name.trim(),
      subName: productFormData.subName.trim(),
      subTitle: productFormData.subName.trim(),
      price: formatPrice(priceNum),
      originalPrice: productFormData.originalPrice
        ? formatPrice(parsePrice(productFormData.originalPrice))
        : formatPrice(Math.round(priceNum * 1.35)),
      stock: parseInt(productFormData.stock, 10) || 0,
      categories: ['all', productFormData.category],
      gsm: productFormData.gsm,
      fit: productFormData.fit,
      description: productFormData.description.trim(),
      image: productFormData.image,
      sizes: productFormData.sizes,
      badge: productFormData.badge || 'NEW ARRIVAL',
      colors: [
        {
          id: `c_${Date.now()}`,
          name: productFormData.colorName || 'Standard',
          hex: productFormData.colorHex || '#111113',
          image: productFormData.image,
          backImage: null,
        },
      ],
    };

    let res;
    if (editingProduct) {
      res = await updateAdminProduct(editingProduct.id, payload);
    } else {
      res = await createAdminProduct(payload);
    }

    setIsSavingProduct(false);

    if (res.success) {
      setIsProductModalOpen(false);
      setEditingProduct(null);
      loadDashboardData();
      showToast(
        editingProduct
          ? `Product "${payload.name}" updated successfully.`
          : `Product "${payload.name}" added to catalogue.`
      );
    } else {
      setProductFormErrors({ general: res.error || 'Failed to save product.' });
    }
  };

  // Delete / Remove Product
  const handleDeleteProduct = async (product) => {
    if (
      !window.confirm(
        `Are you sure you want to deactivate "${product.name}"? It will no longer be visible on the storefront.`
      )
    ) {
      return;
    }

    const res = await deleteAdminProduct(product.id);
    if (res.success) {
      loadDashboardData();
      showToast(`Product "${product.name}" deactivated.`);
    } else {
      setErrorMsg(res.error || 'Failed to delete product.');
    }
  };

  // Select Order for Detailed Management
  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setStatusUpdatePayload({
      status: order.fulfillmentStatus || order.status || 'Order Placed',
      carrier: order.tracking?.carrier || '',
      trackingNumber: order.tracking?.trackingNumber || '',
      trackingUrl: order.tracking?.trackingUrl || '',
      description: '',
    });
  };

  // Submit Order Fulfillment Status Update (Requirement 7)
  const handleUpdateOrderStatus = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsUpdatingStatus(true);
    const res = await updateAdminOrderStatus(selectedOrder.orderRef, {
      status: statusUpdatePayload.status,
      carrier: statusUpdatePayload.carrier.trim() || undefined,
      trackingNumber: statusUpdatePayload.trackingNumber.trim() || undefined,
      trackingUrl: statusUpdatePayload.trackingUrl.trim() || undefined,
      description: statusUpdatePayload.description.trim() || undefined,
    });
    setIsUpdatingStatus(false);

    if (res.success && res.order) {
      setSelectedOrder(res.order);
      setOrders((prev) =>
        prev.map((o) => (o.orderRef === res.order.orderRef ? res.order : o))
      );
      loadDashboardData();
      showToast(
        `Order ${res.order.orderRef} fulfillment updated to "${res.order.fulfillmentStatus}". Customer tracking timeline updated.`
      );
    } else {
      setErrorMsg(res.error || 'Failed to update fulfillment status.');
    }
  };

  // Toggle Payment Status (Requirement 8)
  const handleTogglePaymentStatus = async (order, targetStatus) => {
    const res = await updateAdminOrderPayment(order.orderRef, targetStatus);
    if (res.success && res.order) {
      setSelectedOrder(res.order);
      setOrders((prev) =>
        prev.map((o) => (o.orderRef === res.order.orderRef ? res.order : o))
      );
      loadDashboardData();
      showToast(`Payment status for order ${order.orderRef} marked as ${targetStatus}.`);
    } else {
      setErrorMsg(res.error || 'Failed to update payment status.');
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      !productSearch ||
      p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.id?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.subName?.toLowerCase().includes(productSearch.toLowerCase());

    const matchesCategory =
      productCategoryFilter === 'all' ||
      p.categories?.includes(productCategoryFilter);

    const matchesStock =
      productStockFilter === 'all'
        ? true
        : productStockFilter === 'low'
        ? (p.stock || 0) < 10 && (p.stock || 0) > 0
        : productStockFilter === 'out'
        ? (p.stock || 0) === 0
        : productStockFilter === 'inactive'
        ? !p.isActive
        : true;

    return matchesQuery && matchesCategory && matchesStock;
  });

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.toLowerCase();
    const matchesQuery =
      !orderSearch ||
      o.orderRef?.toLowerCase().includes(q) ||
      o.customer?.fullName?.toLowerCase().includes(q) ||
      o.customer?.mobile?.includes(q);

    const matchesStatus =
      orderStatusFilter === 'all' ||
      o.status?.toLowerCase() === orderStatusFilter.toLowerCase() ||
      o.fulfillmentStatus?.toLowerCase() === orderStatusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  });

  if (!isOpen) return null;

  return (
    <div
      className="admin-modal-backdrop"
      onClick={onClose}
      role="presentation"
      id="admin-modal-overlay"
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        className="admin-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-panel-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {successToast && (
          <div className="admin-toast-banner" role="status">
            <CheckCircle2 size={16} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="admin-error-banner" role="alert">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
            <button
              type="button"
              className="banner-close-btn"
              onClick={() => setErrorMsg(null)}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header Bar */}
        <header className="admin-header">
          <div className="admin-brand-group">
            <div className="admin-title-badge-row">
              <span className="admin-brand-tag">MACHII MENS MART</span>
              <span className="admin-portal-pill">ADMIN OPERATIONS</span>
            </div>
            <div className="admin-title-wrap">
              <Shield size={19} className="admin-header-icon" />
              <h2 id="admin-panel-title" className="admin-title">
                MANAGEMENT DASHBOARD
              </h2>
            </div>
          </div>

          <div className="admin-header-actions">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="admin-action-btn refresh-btn"
                  onClick={loadDashboardData}
                  disabled={isLoading}
                  title="Reload all real-time stats"
                  id="admin-refresh-btn"
                >
                  <RefreshCw size={15} className={isLoading ? 'spinning' : ''} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  className="admin-action-btn logout-btn"
                  onClick={handleLogout}
                  title="Logout from admin session"
                  id="admin-logout-btn"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </>
            ) : null}

            <button
              type="button"
              className="admin-close-btn"
              onClick={onClose}
              aria-label="Close admin dashboard"
              id="close-admin-modal-btn"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* VIEW 1: AUTHENTICATION LOGIN FORM (Requirement 9 & 10)              */}
        {/* =================================================================== */}
        {!isAuthenticated ? (
          <div className="admin-login-view" id="admin-login-screen">
            <div className="login-card">
              <div className="login-icon-wrap">
                <Lock size={36} className="login-lock-icon" />
              </div>
              <span className="mono-label">AUTHORIZED PERSONNEL ONLY</span>
              <h3 className="login-heading">ADMINISTRATIVE ACCESS</h3>
              <p className="login-desc">
                Protected by server-side authorization. Please enter your secret admin authorization key to access dashboard metrics, product management, and order fulfillment.
              </p>

              {loginError && (
                <div className="login-error-msg" role="alert">
                  <AlertTriangle size={15} />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="login-form">
                <div className="form-field">
                  <label htmlFor="admin-key-input">Admin Authorization Key *</label>
                  <div className="key-input-wrapper">
                    <Key size={16} className="field-icon" />
                    <input
                      type="password"
                      id="admin-key-input"
                      value={loginKey}
                      onChange={(e) => setLoginKey(e.target.value)}
                      placeholder="Enter secret authorization key"
                      autoFocus
                      required
                    />
                  </div>
                  <span className="field-hint">
                    Default developer/deployment key: <code>machii-admin-secure-key</code>
                  </span>
                </div>

                <button
                  type="submit"
                  className="admin-primary-btn login-btn"
                  disabled={isLoggingIn}
                  id="admin-login-submit-btn"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw size={16} className="spinning" />
                      <span>Verifying Authorization...</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={16} />
                      <span>AUTHENTICATE & ENTER DASHBOARD</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* VIEW 2: FULL ADMIN DASHBOARD PORTAL (Requirements 1-8, 11-14)       */
          /* =================================================================== */
          <div className="admin-body">
            {/* Tab Navigation */}
            <nav className="admin-nav-tabs" aria-label="Admin Navigation Tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                id="admin-tab-overview"
              >
                <TrendingUp size={16} />
                <span>SUMMARY & KPIS</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                onClick={() => setActiveTab('products')}
                id="admin-tab-products"
              >
                <Layers size={16} />
                <span>PRODUCTS & INVENTORY</span>
                <span className="tab-counter-badge">{products.length}</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
                id="admin-tab-orders"
              >
                <ShoppingBag size={16} />
                <span>ORDERS & FULFILLMENT</span>
                <span className="tab-counter-badge">{orders.length}</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'coupons' ? 'active' : ''}`}
                onClick={() => setActiveTab('coupons')}
                id="admin-tab-coupons"
              >
                <Tag size={16} />
                <span>COUPONS & OFFERS</span>
                <span className="tab-counter-badge">{coupons.length}</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
                onClick={() => setActiveTab('customers')}
                id="admin-tab-customers"
              >
                <Users size={16} />
                <span>CUSTOMERS DIRECTORY</span>
                <span className="tab-counter-badge">{customers.length}</span>
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
                id="admin-tab-settings"
              >
                <Settings size={16} />
                <span>STORE SETTINGS & BANNER</span>
              </button>
            </nav>

            {/* TAB CONTENT: 1. OVERVIEW (Requirement 2 & 14) */}
            {activeTab === 'overview' && (
              <div className="tab-content overview-tab" id="admin-overview-panel">
                <div className="overview-kpi-grid">
                  {/* Total Products KPI */}
                  <div className="kpi-card" id="kpi-total-products">
                    <div className="kpi-icon-wrap icon-blue">
                      <Layers size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">TOTAL PRODUCTS</span>
                      <strong className="kpi-value">{summary?.totalProducts ?? products.length}</strong>
                      <span className="kpi-subtext">
                        {summary?.activeProducts ?? products.filter((p) => p.isActive).length} active on storefront
                      </span>
                    </div>
                  </div>

                  {/* Registered Customers KPI */}
                  <div className="kpi-card" id="kpi-total-customers">
                    <div className="kpi-icon-wrap icon-blue">
                      <Users size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">REGISTERED CUSTOMERS</span>
                      <strong className="kpi-value">
                        {summary?.totalCustomers ?? customers.length}
                      </strong>
                      <span className="kpi-subtext">
                        {customers.filter((c) => c.orderCount > 1).length} repeat shoppers
                      </span>
                    </div>
                  </div>

                  {/* Active Coupons KPI */}
                  <div className="kpi-card" id="kpi-total-coupons">
                    <div className="kpi-icon-wrap icon-purple">
                      <Tag size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">ACTIVE PROMO CODES</span>
                      <strong className="kpi-value">
                        {summary?.activeCoupons ?? coupons.filter((c) => c.isActive).length}
                      </strong>
                      <span className="kpi-subtext">
                        {coupons.length} total codes configured
                      </span>
                    </div>
                  </div>

                  {/* Average Order Value (AOV) KPI */}
                  <div className="kpi-card" id="kpi-aov">
                    <div className="kpi-icon-wrap icon-green">
                      <TrendingUp size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">AVERAGE ORDER VALUE</span>
                      <strong className="kpi-value">
                        {summary?.averageOrderValue
                          ? formatPrice(summary.averageOrderValue)
                          : analytics?.averageOrderValue
                            ? formatPrice(analytics.averageOrderValue)
                            : '₹0'}
                      </strong>
                      <span className="kpi-subtext">Real basket average</span>
                    </div>
                  </div>

                  {/* Available Stock KPI */}
                  <div className="kpi-card" id="kpi-available-stock">
                    <div className="kpi-icon-wrap icon-green">
                      <Package size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">AVAILABLE STOCK UNITS</span>
                      <strong className="kpi-value">
                        {summary?.totalStock ?? products.reduce((acc, p) => acc + (p.stock || 0), 0)}
                      </strong>
                      <span className="kpi-subtext">
                        {summary?.lowStockCount ?? 0} low stock items (&lt;10 units)
                      </span>
                    </div>
                  </div>

                  {/* Total Orders KPI */}
                  <div className="kpi-card" id="kpi-total-orders">
                    <div className="kpi-icon-wrap icon-purple">
                      <ShoppingBag size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">TOTAL ORDERS PLACED</span>
                      <strong className="kpi-value">{summary?.totalOrders ?? orders.length}</strong>
                      <span className="kpi-subtext">
                        Revenue: {summary?.formattedRevenue ?? '₹0'}
                      </span>
                    </div>
                  </div>

                  {/* Pending Orders KPI */}
                  <div className="kpi-card" id="kpi-pending-orders">
                    <div className="kpi-icon-wrap icon-orange">
                      <Clock size={22} />
                    </div>
                    <div className="kpi-text-block">
                      <span className="kpi-label">PENDING FULFILLMENT</span>
                      <strong className="kpi-value">{summary?.pendingOrders ?? 0}</strong>
                      <span className="kpi-subtext">
                        {summary?.shippedOrders ?? 0} in transit • {summary?.deliveredOrders ?? 0} delivered
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Announcement Marquee Status on Overview */}
                {storeSettings?.announcementBanner?.enabled && (
                  <div className="overview-banner-status-card">
                    <div className="banner-status-left">
                      <span className="live-pulse-dot" />
                      <div>
                        <span className="banner-status-title">LIVE STOREFRONT MARQUEE ACTIVE:</span>
                        <p className="banner-status-text">
                          "{storeSettings.announcementBanner.text}"
                          {storeSettings.announcementBanner.promoCode && (
                            <strong className="banner-status-code">
                              {' '}• CODE: {storeSettings.announcementBanner.promoCode}
                            </strong>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="edit-banner-quick-link"
                      onClick={() => setActiveTab('settings')}
                    >
                      <span>Configure Banner</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Secondary Stats Row */}
                <div className="overview-split-row">
                  {/* Fulfillment Breakdown */}
                  <div className="overview-card fulfillment-summary-card">
                    <div className="card-top-header">
                      <Truck size={17} />
                      <h4>REAL FULFILLMENT STATUS BREAKDOWN</h4>
                    </div>
                    <div className="status-bars-list">
                      <div className="status-bar-row">
                        <span className="status-name">Pending / Placed:</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill fill-orange"
                            style={{
                              width: `${
                                orders.length > 0
                                  ? ((summary?.pendingOrders || 0) / orders.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="status-num">{summary?.pendingOrders || 0}</span>
                      </div>

                      <div className="status-bar-row">
                        <span className="status-name">Confirmed & Packed:</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill fill-blue"
                            style={{
                              width: `${
                                orders.length > 0
                                  ? (((summary?.confirmedOrders || 0) + (summary?.packedOrders || 0)) /
                                      orders.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="status-num">
                          {(summary?.confirmedOrders || 0) + (summary?.packedOrders || 0)}
                        </span>
                      </div>

                      <div className="status-bar-row">
                        <span className="status-name">Shipped & Out for Delivery:</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill fill-purple"
                            style={{
                              width: `${
                                orders.length > 0
                                  ? ((summary?.shippedOrders || 0) / orders.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="status-num">{summary?.shippedOrders || 0}</span>
                      </div>

                      <div className="status-bar-row">
                        <span className="status-name">Delivered:</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill fill-green"
                            style={{
                              width: `${
                                orders.length > 0
                                  ? ((summary?.deliveredOrders || 0) / orders.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="status-num">{summary?.deliveredOrders || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown (Requirement 8) */}
                  <div className="overview-card payment-summary-card">
                    <div className="card-top-header">
                      <DollarSign size={17} />
                      <h4>PAYMENT METHOD & COLLECTION STATUS</h4>
                    </div>
                    <div className="payment-stats-grid">
                      <div className="payment-metric-box">
                        <span className="metric-tag">CASH ON DELIVERY (COD)</span>
                        <strong className="metric-val">{summary?.paymentStats?.codCount ?? 0} Orders</strong>
                        <span className="metric-note">Collected upon doorstep delivery</span>
                      </div>

                      <div className="payment-metric-box">
                        <span className="metric-tag">ONLINE PAYMENTS</span>
                        <strong className="metric-val">{summary?.paymentStats?.onlineCount ?? 0} Orders</strong>
                        <span className="metric-note">Processed via payment gateway</span>
                      </div>

                      <div className="payment-metric-box box-highlight">
                        <span className="metric-tag">PAYMENTS RECEIVED (PAID)</span>
                        <strong className="metric-val text-green">{summary?.paymentStats?.paidCount ?? 0} Orders</strong>
                        <span className="metric-note">Payment confirmed by store</span>
                      </div>

                      <div className="payment-metric-box box-highlight">
                        <span className="metric-tag">PAYMENT PENDING</span>
                        <strong className="metric-val text-orange">{summary?.paymentStats?.pendingCount ?? 0} Orders</strong>
                        <span className="metric-note">Awaiting doorstep or gateway settlement</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Orders Table Widget */}
                <div className="recent-orders-widget">
                  <div className="widget-header">
                    <h4>RECENT ORDERS FROM DATABASE</h4>
                    <button
                      type="button"
                      className="view-all-link"
                      onClick={() => setActiveTab('orders')}
                    >
                      <span>View All Orders ({orders.length})</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="empty-widget-state">
                      <ShoppingBag size={24} />
                      <p>No customer orders placed in the database yet.</p>
                    </div>
                  ) : (
                    <div className="widget-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>ORDER REF</th>
                            <th>CUSTOMER</th>
                            <th>ITEMS</th>
                            <th>TOTAL</th>
                            <th>PAYMENT</th>
                            <th>FULFILLMENT</th>
                            <th>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 5).map((order) => (
                            <tr key={order.orderRef}>
                              <td>
                                <strong className="order-ref-code">{order.orderRef}</strong>
                              </td>
                              <td>
                                <div className="customer-cell">
                                  <span>{order.customer?.fullName || 'Anonymous'}</span>
                                  <small className="cell-sub">{order.customer?.mobile}</small>
                                </div>
                              </td>
                              <td>{order.items?.length || 0} item(s)</td>
                              <td>{formatPrice(order.total)}</td>
                              <td>
                                <span className={`status-pill pill-${order.paymentStatus?.toLowerCase()}`}>
                                  {order.paymentStatus} ({order.paymentMethod})
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill pill-${order.fulfillmentStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
                                  {order.fulfillmentStatus}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="table-action-btn"
                                  onClick={() => {
                                    setActiveTab('orders');
                                    handleSelectOrder(order);
                                  }}
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. PRODUCTS & INVENTORY (Requirements 3, 4, 5) */}
            {activeTab === 'products' && (
              <div className="tab-content products-tab" id="admin-products-panel">
                {/* Product Management Toolbar */}
                <div className="admin-toolbar">
                  <div className="search-input-wrap">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search products by title, subtitle, or ID..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="admin-search-input"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setProductSearch('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="toolbar-filters">
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="admin-select"
                    >
                      <option value="all">All Categories</option>
                      <option value="oversized">Oversized</option>
                      <option value="printed">Printed</option>
                      <option value="new-arrivals">New Arrivals</option>
                    </select>

                    <select
                      value={productStockFilter}
                      onChange={(e) => setProductStockFilter(e.target.value)}
                      className="admin-select"
                    >
                      <option value="all">All Stock Statuses</option>
                      <option value="low">Low Stock (&lt;10)</option>
                      <option value="out">Out of Stock (0)</option>
                      <option value="inactive">Deactivated</option>
                    </select>

                    <button
                      type="button"
                      className="admin-primary-btn add-product-btn"
                      onClick={() => handleOpenProductModal()}
                      id="admin-add-product-btn"
                    >
                      <Plus size={16} />
                      <span>ADD NEW PRODUCT</span>
                    </button>
                  </div>
                </div>

                {/* Products Table */}
                <div className="admin-table-container">
                  <table className="admin-table products-table">
                    <thead>
                      <tr>
                        <th>THUMBNAIL</th>
                        <th>PRODUCT SPECS</th>
                        <th>PRICE</th>
                        <th>AVAILABLE STOCK</th>
                        <th>STORE STATUS</th>
                        <th>SIZES</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        const stock = product.stock !== undefined ? product.stock : 0;
                        const isLow = stock > 0 && stock < 10;
                        const isOut = stock === 0;

                        return (
                          <tr key={product.id} className={!product.isActive ? 'row-inactive' : ''}>
                            <td className="product-thumb-cell">
                              <div className="product-thumb-frame">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="thumb-img"
                                  />
                                ) : (
                                  <div className="thumb-placeholder" />
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="product-info-cell">
                                <strong className="product-name">{product.name}</strong>
                                <span className="product-sub">{product.subName || product.subTitle}</span>
                                <span className="product-id-tag">ID: {product.id}</span>
                              </div>
                            </td>

                            <td>
                              <div className="product-price-cell">
                                <strong className="price-curr">{product.price}</strong>
                                {product.originalPrice && (
                                  <span className="price-orig">{product.originalPrice}</span>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="stock-control-cell">
                                <div className="stock-stepper">
                                  <button
                                    type="button"
                                    className="stock-step-btn"
                                    onClick={() => handleQuickStockChange(product, -1)}
                                    disabled={stock <= 0}
                                    title="Decrease stock by 1"
                                  >
                                    -
                                  </button>
                                  <strong className="stock-number">{stock}</strong>
                                  <button
                                    type="button"
                                    className="stock-step-btn"
                                    onClick={() => handleQuickStockChange(product, 1)}
                                    title="Increase stock by 1"
                                  >
                                    +
                                  </button>
                                </div>
                                <span
                                  className={`stock-pill ${
                                    isOut
                                      ? 'pill-out'
                                      : isLow
                                      ? 'pill-low'
                                      : 'pill-good'
                                  }`}
                                >
                                  {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                                </span>
                              </div>
                            </td>

                            <td>
                              <button
                                type="button"
                                className={`status-toggle-btn ${product.isActive ? 'active' : 'inactive'}`}
                                onClick={() => handleToggleProductStatus(product)}
                                title="Click to toggle visibility on storefront"
                              >
                                {product.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                              </button>
                            </td>

                            <td>
                              <div className="sizes-chips-wrap">
                                {product.sizes?.map((sz) => (
                                  <span key={sz} className="sz-chip">
                                    {sz}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className="action-buttons-cell">
                                <button
                                  type="button"
                                  className="icon-action-btn edit"
                                  onClick={() => handleOpenProductModal(product)}
                                  title="Edit product specs"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  className="icon-action-btn delete"
                                  onClick={() => handleDeleteProduct(product)}
                                  title="Deactivate product"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredProducts.length === 0 && (
                    <div className="empty-results-box">
                      <Package size={32} />
                      <h4>No Products Matching Filters</h4>
                      <p>Try adjusting your search criteria or add a new product.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. ORDERS & FULFILLMENT (Requirements 6, 7, 8) */}
            {activeTab === 'orders' && (
              <div className="tab-content orders-tab" id="admin-orders-panel">
                {/* Orders Toolbar */}
                <div className="admin-toolbar">
                  <div className="search-input-wrap">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search orders by Order #, customer name, or phone..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="admin-search-input"
                    />
                    {orderSearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setOrderSearch('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="toolbar-filters">
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="admin-select"
                    >
                      <option value="all">All Fulfillment Stages</option>
                      {ORDER_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="admin-secondary-btn export-btn"
                      onClick={handleExportCSV}
                      title="Export all orders to CSV spreadsheet"
                      id="admin-export-orders-csv-btn"
                    >
                      <Download size={14} />
                      <span>EXPORT CSV</span>
                    </button>
                  </div>
                </div>

                {/* Orders Master/Detail Layout */}
                <div className="orders-split-view">
                  {/* Left: Orders Table */}
                  <div className="orders-table-wrapper">
                    <table className="admin-table orders-table">
                      <thead>
                        <tr>
                          <th>ORDER REF</th>
                          <th>CUSTOMER</th>
                          <th>TOTAL</th>
                          <th>PAYMENT</th>
                          <th>FULFILLMENT</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => {
                          const isSelected = selectedOrder?.orderRef === order.orderRef;
                          return (
                            <tr
                              key={order.orderRef}
                              className={isSelected ? 'row-selected' : ''}
                              onClick={() => handleSelectOrder(order)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <strong className="order-ref-code">{order.orderRef}</strong>
                                <span className="order-date-text">
                                  {order.createdAt
                                    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : 'Recent'}
                                </span>
                              </td>

                              <td>
                                <div className="customer-cell">
                                  <span className="customer-name">
                                    {order.customer?.fullName || 'Customer'}
                                  </span>
                                  <span className="customer-phone">{order.customer?.mobile}</span>
                                </div>
                              </td>

                              <td>
                                <strong className="order-total-price">
                                  {formatPrice(order.total)}
                                </strong>
                              </td>

                              <td>
                                <span
                                  className={`status-pill pill-${order.paymentStatus?.toLowerCase()}`}
                                >
                                  {order.paymentStatus}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`status-pill pill-${order.fulfillmentStatus
                                    ?.toLowerCase()
                                    .replace(/\s+/g, '-')}`}
                                >
                                  {order.fulfillmentStatus}
                                </span>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="table-action-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOrder(order);
                                  }}
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {filteredOrders.length === 0 && (
                      <div className="empty-results-box">
                        <ShoppingBag size={32} />
                        <h4>No Orders Found</h4>
                        <p>No customer orders match the current search or status filter.</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Order Detail & Fulfillment Management Panel */}
                  <div className="order-detail-panel">
                    {selectedOrder ? (
                      <div className="order-detail-card" id="selected-order-detail">
                        <div className="panel-header">
                          <div className="panel-title-wrap">
                            <span className="mono-label">ORDER MANAGEMENT</span>
                            <h3 className="panel-order-ref">{selectedOrder.orderRef}</h3>
                          </div>
                          <div className="panel-header-actions-group">
                            <button
                              type="button"
                              className="panel-invoice-btn"
                              onClick={() => {
                                setInvoiceOrder(selectedOrder);
                                setIsInvoiceModalOpen(true);
                              }}
                              title="Print Packing Slip & Invoice"
                              id="admin-print-invoice-btn"
                            >
                              <Printer size={14} />
                              <span>Print Invoice / Slip</span>
                            </button>
                            <button
                              type="button"
                              className="panel-close-btn"
                              onClick={() => setSelectedOrder(null)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Customer Information */}
                        <div className="order-customer-box">
                          <span className="box-title">CUSTOMER & DELIVERY ADDRESS</span>
                          <p className="cust-line">
                            <strong>{selectedOrder.customer?.fullName}</strong> ({selectedOrder.customer?.mobile})
                          </p>
                          <p className="addr-line">{selectedOrder.customer?.address}</p>
                          <p className="city-line">
                            {selectedOrder.customer?.city}, {selectedOrder.customer?.state} - {selectedOrder.customer?.pincode}
                          </p>
                        </div>

                        {/* Items Breakdown */}
                        <div className="order-items-box">
                          <span className="box-title">ORDERED ITEMS ({selectedOrder.items?.length || 0})</span>
                          <div className="items-scroll-list">
                            {selectedOrder.items?.map((item, idx) => (
                              <div key={idx} className="ordered-item-row">
                                <div className="item-thumb-box">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="item-img" />
                                  ) : (
                                    <div className="item-placeholder" />
                                  )}
                                </div>
                                <div className="item-details">
                                  <span className="item-name">{item.name}</span>
                                  <span className="item-sub">
                                    Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                                  </span>
                                </div>
                                <strong className="item-price">
                                  {formatPrice(item.priceNum ? item.priceNum * item.quantity : item.price)}
                                </strong>
                              </div>
                            ))}
                          </div>
                          <div className="total-payable-bar">
                            <span>TOTAL AMOUNT:</span>
                            <strong>{formatPrice(selectedOrder.total)}</strong>
                          </div>
                        </div>

                        {/* Payment Status Control (Requirement 8) */}
                        <div className="payment-control-box">
                          <span className="box-title">PAYMENT STATUS (SEPARATE FROM FULFILLMENT)</span>
                          <div className="payment-status-row">
                            <div className="payment-info">
                              <span>Method: <strong>{selectedOrder.paymentMethod}</strong></span>
                              <span>Status: <strong className={`text-${selectedOrder.paymentStatus === 'PAID' ? 'green' : 'orange'}`}>{selectedOrder.paymentStatus}</strong></span>
                            </div>
                            <div className="payment-actions">
                              {selectedOrder.paymentStatus !== 'PAID' ? (
                                <button
                                  type="button"
                                  className="mark-paid-btn"
                                  onClick={() => handleTogglePaymentStatus(selectedOrder, 'PAID')}
                                >
                                  Mark as PAID
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="mark-pending-btn"
                                  onClick={() => handleTogglePaymentStatus(selectedOrder, 'PENDING')}
                                >
                                  Revert to PENDING
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Fulfillment Status & Tracking Form (Requirement 7) */}
                        <form onSubmit={handleUpdateOrderStatus} className="fulfillment-update-form">
                          <span className="box-title">UPDATE FULFILLMENT & COURIER TRACKING</span>

                          <div className="form-field">
                            <label htmlFor="update-stage-select">Fulfillment Status *</label>
                            <select
                              id="update-stage-select"
                              value={statusUpdatePayload.status}
                              onChange={(e) =>
                                setStatusUpdatePayload((prev) => ({
                                  ...prev,
                                  status: e.target.value,
                                }))
                              }
                              className="admin-select full-width"
                              required
                            >
                              {ORDER_STATUS_OPTIONS.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-row-2col">
                            <div className="form-field">
                              <label htmlFor="update-carrier-input">Courier / Carrier</label>
                              <input
                                type="text"
                                id="update-carrier-input"
                                placeholder="e.g. Blue Dart, Delhivery, DTDC"
                                value={statusUpdatePayload.carrier}
                                onChange={(e) =>
                                  setStatusUpdatePayload((prev) => ({
                                    ...prev,
                                    carrier: e.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div className="form-field">
                              <label htmlFor="update-awb-input">Tracking / AWB Number</label>
                              <input
                                type="text"
                                id="update-awb-input"
                                placeholder="e.g. BLUEDART-849201"
                                value={statusUpdatePayload.trackingNumber}
                                onChange={(e) =>
                                  setStatusUpdatePayload((prev) => ({
                                    ...prev,
                                    trackingNumber: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <div className="form-field">
                            <label htmlFor="update-trackurl-input">Tracking URL</label>
                            <input
                              type="url"
                              id="update-trackurl-input"
                              placeholder="https://track.bluedart.com/..."
                              value={statusUpdatePayload.trackingUrl}
                              onChange={(e) =>
                                setStatusUpdatePayload((prev) => ({
                                  ...prev,
                                  trackingUrl: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="form-field">
                            <label htmlFor="update-desc-input">Tracking Note / Event Description</label>
                            <input
                              type="text"
                              id="update-desc-input"
                              placeholder="e.g. Package dispatched from Chennai hub."
                              value={statusUpdatePayload.description}
                              onChange={(e) =>
                                setStatusUpdatePayload((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <button
                            type="submit"
                            className="admin-primary-btn full-width"
                            disabled={isUpdatingStatus}
                            id="admin-update-fulfillment-btn"
                          >
                            {isUpdatingStatus ? (
                              <>
                                <RefreshCw size={15} className="spinning" />
                                <span>Updating Backend & Timeline...</span>
                              </>
                            ) : (
                              <>
                                <Save size={15} />
                                <span>RECORD LEGITIMATE STATUS UPDATE</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="select-order-placeholder">
                        <ShoppingBag size={36} />
                        <h4>Select an Order</h4>
                        <p>Click on any order from the left list to inspect details and update fulfillment status.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TAB CONTENT: 4. COUPONS & DISCOUNTS (STEP 13 Requirement 10)       */}
            {/* =================================================================== */}
            {activeTab === 'coupons' && (
              <div className="tab-content coupons-tab" id="admin-coupons-panel">
                <div className="tab-header-row">
                  <div className="tab-title-wrap">
                    <h3>DISCOUNT CODES & PROMOTIONS</h3>
                    <p>
                      Configure percentage and flat rate promotional codes with real database
                      enforcement, min order limits, and expiry.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-primary-btn"
                    onClick={handleOpenCreateCouponModal}
                    id="admin-create-coupon-btn"
                  >
                    <Plus size={16} />
                    <span>CREATE NEW COUPON</span>
                  </button>
                </div>

                {/* Quick Offer Drop Presets */}
                <div className="coupon-presets-banner">
                  <div className="presets-title-row">
                    <div className="presets-label">
                      <Sparkles size={15} />
                      <span>QUICK OFFER DROP TEMPLATES</span>
                    </div>
                    <span className="presets-sub">
                      Click any preset to prefill or launch a new campaign
                    </span>
                  </div>
                  <div className="presets-grid">
                    {COUPON_PRESETS.map((preset) => {
                      const alreadyExists = coupons.some(
                        (c) => c.code.toUpperCase() === preset.code.toUpperCase()
                      );
                      return (
                        <div key={preset.code} className="preset-card">
                          <div className="preset-card-head">
                            <span className="preset-tag">
                              {preset.discountType === 'PERCENTAGE'
                                ? `${preset.discountValue}% OFF`
                                : `₹${preset.discountValue} OFF`}
                            </span>
                            <code className="preset-code">{preset.code}</code>
                          </div>
                          <p className="preset-desc">{preset.description}</p>
                          <div className="preset-actions">
                            <button
                              type="button"
                              className="preset-use-btn"
                              onClick={() => handleApplyPresetCoupon(preset)}
                            >
                              <span>{alreadyExists ? 'Edit Preset' : 'Use Template'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filters Row */}
                <div className="admin-filters-bar">
                  <div className="search-input-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search coupon code or description..."
                      value={couponSearch}
                      onChange={(e) => setCouponSearch(e.target.value)}
                      id="admin-coupon-search-input"
                    />
                    {couponSearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setCouponSearch('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="filter-select-wrap">
                    <label htmlFor="coupon-type-filter">Type:</label>
                    <select
                      id="coupon-type-filter"
                      value={couponTypeFilter}
                      onChange={(e) => setCouponTypeFilter(e.target.value)}
                    >
                      <option value="all">All Discount Types</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FLAT">Flat Rate (₹)</option>
                    </select>
                  </div>

                  <div className="filter-select-wrap">
                    <label htmlFor="coupon-status-filter">Status:</label>
                    <select
                      id="coupon-status-filter"
                      value={couponStatusFilter}
                      onChange={(e) => setCouponStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                </div>

                {/* Coupons Table */}
                <div className="admin-table-container">
                  <table className="admin-table coupons-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type & Value</th>
                        <th>Description</th>
                        <th>Min Order</th>
                        <th>Uses / Limit</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoupons.map((coupon) => {
                        const isExpired =
                          coupon.expiresAt &&
                          new Date(coupon.expiresAt).getTime() < currentTime;
                        const isMaxed =
                          typeof coupon.maxUses === 'number' &&
                          coupon.usedCount >= coupon.maxUses;

                        return (
                          <tr
                            key={coupon.id}
                            className={!coupon.isActive ? 'row-inactive' : ''}
                          >
                            <td className="code-cell">
                              <div className="code-pill">
                                <Tag size={13} />
                                <strong>{coupon.code}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="discount-value-tag">
                                {coupon.discountType === 'PERCENTAGE'
                                  ? `${coupon.discountValue}% OFF`
                                  : `₹${Number(coupon.discountValue).toLocaleString('en-IN')} OFF`}
                              </span>
                            </td>
                            <td className="desc-cell">{coupon.description}</td>
                            <td className="mono-cell">
                              ₹{Number(coupon.minOrderAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="mono-cell">
                              <span className={isMaxed ? 'text-danger' : ''}>
                                {coupon.usedCount || 0} / {coupon.maxUses || '∞'}
                              </span>
                            </td>
                            <td className="expiry-cell">
                              {coupon.expiresAt ? (
                                <span
                                  className={
                                    isExpired ? 'badge-expired' : 'badge-valid'
                                  }
                                >
                                  {new Date(coupon.expiresAt).toLocaleDateString(
                                    'en-IN'
                                  )}
                                </span>
                              ) : (
                                <span className="badge-no-expiry">No Expiry</span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`status-toggle-pill ${
                                  coupon.isActive ? 'active' : 'inactive'
                                }`}
                                onClick={() => handleToggleCouponStatus(coupon)}
                                title="Click to toggle status"
                              >
                                {coupon.isActive ? (
                                  <>
                                    <CheckCircle2 size={12} />
                                    <span>ACTIVE</span>
                                  </>
                                ) : (
                                  <>
                                    <X size={12} />
                                    <span>INACTIVE</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td>
                              <div className="row-actions">
                                {coupon.isActive && (
                                  <button
                                    type="button"
                                    className="action-icon-btn promote"
                                    onClick={() => handlePromoteCouponToBanner(coupon)}
                                    title="Promote this offer to Storefront Announcement Marquee"
                                    id={`promote-coupon-${coupon.code}`}
                                  >
                                    <Sparkles size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="action-icon-btn edit"
                                  onClick={() => handleOpenEditCouponModal(coupon)}
                                  title="Edit Coupon"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn delete"
                                  onClick={() => handleDeleteCoupon(coupon)}
                                  title="Delete Coupon"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredCoupons.length === 0 && (
                    <div className="empty-results-box">
                      <Tag size={32} />
                      <h4>No Coupons Found</h4>
                      <p>No promotional coupons match the current search or filters.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TAB CONTENT: 5. CUSTOMERS DIRECTORY                                 */}
            {/* =================================================================== */}
            {activeTab === 'customers' && (
              <div className="tab-content customers-tab" id="admin-customers-panel">
                <div className="tab-header-row">
                  <div className="tab-title-wrap">
                    <h3>REGISTERED CUSTOMERS DIRECTORY</h3>
                    <p>
                      Real authenticated customer profiles, lifetime spending (LTV), order frequency, and saved delivery addresses.
                    </p>
                  </div>
                  <div className="cust-summary-pills">
                    <span className="summary-pill">
                      <Users size={14} /> {customers.length} Registered
                    </span>
                    <span className="summary-pill">
                      <ShoppingBag size={14} /> {customers.filter((c) => c.orderCount > 1).length} Repeat Buyers
                    </span>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="admin-filters-bar">
                  <div className="search-input-wrap">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search by customer name, mobile, or email..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      id="admin-customer-search-input"
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setCustomerSearch('')}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Customers Table */}
                <div className="admin-table-container">
                  <table className="admin-table customers-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Contact Details</th>
                        <th>Orders Placed</th>
                        <th>Lifetime Spend (LTV)</th>
                        <th>Saved Addresses</th>
                        <th>Joined / Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((cust) => {
                        const initials = (cust.name || cust.fullName || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <tr key={cust.mobile}>
                            <td>
                              <div className="customer-profile-cell">
                                <div className="customer-avatar-initials">{initials}</div>
                                <div className="customer-name-block">
                                  <strong>{cust.name || cust.fullName || 'Valued Customer'}</strong>
                                  {cust.orderCount > 1 && (
                                    <span className="vip-badge">REPEAT BUYER</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="contact-details-cell">
                                <span className="contact-phone">
                                  <Phone size={12} /> {cust.mobile}
                                </span>
                                {cust.email && (
                                  <span className="contact-email">
                                    <Mail size={12} /> {cust.email}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="mono-cell">
                              <strong>{cust.orderCount || 0}</strong> {cust.orderCount === 1 ? 'order' : 'orders'}
                            </td>
                            <td className="mono-cell highlight-ltv">
                              {formatPrice(cust.totalSpent || 0)}
                            </td>
                            <td>
                              {cust.addresses && cust.addresses.length > 0 ? (
                                <button
                                  type="button"
                                  className="view-addresses-btn"
                                  onClick={() => setSelectedCustomerForAddresses(cust)}
                                  title="View customer saved addresses"
                                >
                                  <Store size={13} />
                                  <span>{cust.addresses.length} {cust.addresses.length === 1 ? 'Address' : 'Addresses'}</span>
                                </button>
                              ) : (
                                <span className="no-address-text">No saved addresses</span>
                              )}
                            </td>
                            <td className="date-cell">
                              {cust.createdAt
                                ? new Date(cust.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Recent'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredCustomers.length === 0 && (
                    <div className="empty-results-box">
                      <Users size={32} />
                      <h4>No Customers Found</h4>
                      <p>No customer profiles match the current search query.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TAB CONTENT: 6. STORE SETTINGS & ANNOUNCEMENT BANNER                */}
            {/* =================================================================== */}
            {activeTab === 'settings' && (
              <div className="tab-content settings-tab" id="admin-settings-panel">
                <div className="tab-header-row">
                  <div className="tab-title-wrap">
                    <h3>STORE CONFIGURATION & ANNOUNCEMENT BANNER</h3>
                    <p>
                      Control the live storefront top marquee, promotional codes, master Cash on Delivery switch, and customer support.
                    </p>
                  </div>
                </div>

                {storeSettings && (
                  <form onSubmit={handleSaveStoreSettings} className="settings-form">
                    {/* Card 1: Storefront Announcement Marquee */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="card-header-icon"><Sparkles size={18} /></div>
                        <div>
                          <h4>STOREFRONT PROMO BANNER (TOP MARQUEE)</h4>
                          <p>Broadcast sales, drop alerts, and promo codes at the very top of the customer storefront.</p>
                        </div>
                      </div>

                      <div className="settings-card-body">
                        <div className="form-toggle-row">
                          <label className="switch-label">
                            <input
                              type="checkbox"
                              checked={storeSettings.announcementBanner?.enabled ?? true}
                              onChange={(e) =>
                                setStoreSettings((prev) => ({
                                  ...prev,
                                  announcementBanner: {
                                    ...(prev.announcementBanner || {}),
                                    enabled: e.target.checked,
                                  },
                                }))
                              }
                              id="settings-banner-toggle"
                            />
                            <span className="switch-text">Enable Storefront Announcement Bar</span>
                          </label>
                        </div>

                        <div className="form-field full-width">
                          <label htmlFor="settings-banner-text">Announcement Headline Text</label>
                          <input
                            type="text"
                            id="settings-banner-text"
                            value={storeSettings.announcementBanner?.text || ''}
                            onChange={(e) =>
                              setStoreSettings((prev) => ({
                                ...prev,
                                announcementBanner: {
                                  ...(prev.announcementBanner || {}),
                                  text: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g. FLASH SALE: 15% OFF STREETWEAR DROPS • USE CODE:"
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="settings-banner-code">Featured Promo Code (Clickable to Copy)</label>
                          <input
                            type="text"
                            id="settings-banner-code"
                            value={storeSettings.announcementBanner?.promoCode || ''}
                            onChange={(e) =>
                              setStoreSettings((prev) => ({
                                ...prev,
                                announcementBanner: {
                                  ...(prev.announcementBanner || {}),
                                  promoCode: e.target.value.toUpperCase(),
                                },
                              }))
                            }
                            placeholder="e.g. MACHII10"
                          />
                        </div>

                        {/* Live Banner Preview Box */}
                        <div className="banner-preview-box">
                          <span className="preview-label">LIVE STOREFRONT PREVIEW:</span>
                          <div className="banner-preview-strip">
                            <Sparkles size={13} className="sparkle-icon" />
                            <span className="strip-text">
                              {storeSettings.announcementBanner?.text || 'STREETWEAR DROP LIVE • USE CODE:'}
                            </span>
                            {storeSettings.announcementBanner?.promoCode && (
                              <span className="strip-code-badge">
                                {storeSettings.announcementBanner.promoCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Commerce Rules & Payment Controls */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="card-header-icon"><Store size={18} /></div>
                        <div>
                          <h4>PAYMENT & FULFILLMENT RULES</h4>
                          <p>Configure store-wide payment acceptance and shipping thresholds.</p>
                        </div>
                      </div>

                      <div className="settings-card-body">
                        <div className="form-toggle-row">
                          <label className="switch-label">
                            <input
                              type="checkbox"
                              checked={storeSettings.codEnabled ?? true}
                              onChange={(e) =>
                                setStoreSettings((prev) => ({
                                  ...prev,
                                  codEnabled: e.target.checked,
                                }))
                              }
                              id="settings-cod-toggle"
                            />
                            <span className="switch-text">Allow Cash on Delivery (COD) Checkout</span>
                          </label>
                          <span className="field-hint">
                            When unchecked, customers are restricted to online prepaid checkout only.
                          </span>
                        </div>

                        <div className="form-field">
                          <label htmlFor="settings-free-shipping">Free Shipping Threshold (INR)</label>
                          <input
                            type="number"
                            id="settings-free-shipping"
                            value={storeSettings.freeShippingThreshold ?? 1499}
                            onChange={(e) =>
                              setStoreSettings((prev) => ({
                                ...prev,
                                freeShippingThreshold: Number(e.target.value) || 0,
                              }))
                            }
                            min="0"
                            step="100"
                          />
                          <span className="field-hint">Orders above this amount receive free doorstep delivery.</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Support Contacts */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="card-header-icon"><Phone size={18} /></div>
                        <div>
                          <h4>CUSTOMER SUPPORT & STORE CONTACT</h4>
                          <p>Shown on customer order receipts and order tracking screens.</p>
                        </div>
                      </div>

                      <div className="settings-card-body form-row-2col">
                        <div className="form-field">
                          <label htmlFor="settings-support-phone">Support Helpline Phone</label>
                          <input
                            type="text"
                            id="settings-support-phone"
                            value={storeSettings.supportPhone || ''}
                            onChange={(e) =>
                              setStoreSettings((prev) => ({
                                ...prev,
                                supportPhone: e.target.value,
                              }))
                            }
                            placeholder="+91 98765 43210"
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="settings-support-email">Support Email Address</label>
                          <input
                            type="email"
                            id="settings-support-email"
                            value={storeSettings.supportEmail || ''}
                            onChange={(e) =>
                              setStoreSettings((prev) => ({
                                ...prev,
                                supportEmail: e.target.value,
                              }))
                            }
                            placeholder="support@machiimensmart.com"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="settings-actions-bar">
                      <button
                        type="submit"
                        className="admin-primary-btn save-settings-btn"
                        disabled={isSavingSettings}
                        id="admin-save-settings-btn"
                      >
                        {isSavingSettings ? (
                          <>
                            <RefreshCw size={16} className="spinning" />
                            <span>Saving Settings...</span>
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            <span>SAVE SETTINGS & SYNC STOREFRONT</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* ADD / EDIT PRODUCT MODAL (Requirements 3, 4, 11)                    */}
        {/* =================================================================== */}
        {isProductModalOpen && (
          <div
            className="product-form-modal-overlay"
            onClick={() => setIsProductModalOpen(false)}
            role="presentation"
            data-lenis-prevent="true"
          >
            <div
              className="product-form-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              data-lenis-prevent="true"
            >
              <div className="modal-top-bar">
                <div className="modal-title-group">
                  <span className="mono-label">PRODUCT CATALOGUE</span>
                  <h3>{editingProduct ? 'EDIT PRODUCT DETAILS' : 'ADD NEW STREETWEAR FIT'}</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setIsProductModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {productFormErrors.general && (
                <div className="form-error-alert" role="alert">
                  <AlertTriangle size={15} />
                  <span>{productFormErrors.general}</span>
                </div>
              )}

              <form onSubmit={handleProductFormSubmit} className="product-form-body">
                <div className="form-row-2col">
                  <div className="form-field">
                    <label htmlFor="prod-name-input">Product Name *</label>
                    <input
                      type="text"
                      id="prod-name-input"
                      placeholder="e.g. TOKYO NEON OVERSIZED TEE"
                      value={productFormData.name}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                    {productFormErrors.name && (
                      <span className="field-err">{productFormErrors.name}</span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="prod-subname-input">Sub-Title / Fit Descriptor</label>
                    <input
                      type="text"
                      id="prod-subname-input"
                      placeholder="e.g. Heavyweight Boxy Cut"
                      value={productFormData.subName}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, subName: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="form-row-3col">
                  <div className="form-field">
                    <label htmlFor="prod-price-input">Selling Price (INR) *</label>
                    <input
                      type="number"
                      id="prod-price-input"
                      placeholder="1499"
                      value={productFormData.price}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, price: e.target.value }))
                      }
                      required
                    />
                    {productFormErrors.price && (
                      <span className="field-err">{productFormErrors.price}</span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="prod-origprice-input">Original / MRP Price</label>
                    <input
                      type="number"
                      id="prod-origprice-input"
                      placeholder="1999"
                      value={productFormData.originalPrice}
                      onChange={(e) =>
                        setProductFormData((prev) => ({
                          ...prev,
                          originalPrice: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="prod-stock-input">Initial Available Stock *</label>
                    <input
                      type="number"
                      id="prod-stock-input"
                      placeholder="50"
                      value={productFormData.stock}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, stock: e.target.value }))
                      }
                      min="0"
                      required
                    />
                    {productFormErrors.stock && (
                      <span className="field-err">{productFormErrors.stock}</span>
                    )}
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field">
                    <label htmlFor="prod-category-select">Category</label>
                    <select
                      id="prod-category-select"
                      value={productFormData.category}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, category: e.target.value }))
                      }
                      className="admin-select"
                    >
                      <option value="oversized">Oversized T-Shirts</option>
                      <option value="printed">Printed Streetwear</option>
                      <option value="new-arrivals">New Arrivals</option>
                      <option value="hoodies">Heavyweight Hoodies</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="prod-badge-input">Badge / Tag</label>
                    <input
                      type="text"
                      id="prod-badge-input"
                      placeholder="e.g. POPULAR, 260 GSM, LIMITED"
                      value={productFormData.badge}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, badge: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field">
                    <label htmlFor="prod-gsm-input">Fabric GSM</label>
                    <input
                      type="text"
                      id="prod-gsm-input"
                      placeholder="e.g. 260 GSM Combed Cotton"
                      value={productFormData.gsm}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, gsm: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="prod-fit-input">Fit Silhouette</label>
                    <input
                      type="text"
                      id="prod-fit-input"
                      placeholder="e.g. Signature Boxy Fit"
                      value={productFormData.fit}
                      onChange={(e) =>
                        setProductFormData((prev) => ({ ...prev, fit: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Sizes Checkboxes */}
                <div className="form-field">
                  <label>Available Sizes *</label>
                  <div className="size-checkboxes-grid">
                    {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => {
                      const isChecked = productFormData.sizes?.includes(sz);
                      return (
                        <label key={sz} className={`size-check-pill ${isChecked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setProductFormData((prev) => ({
                                ...prev,
                                sizes: checked
                                  ? [...(prev.sizes || []), sz]
                                  : (prev.sizes || []).filter((s) => s !== sz),
                              }));
                            }}
                          />
                          <span>{sz}</span>
                        </label>
                      );
                    })}
                  </div>
                  {productFormErrors.sizes && (
                    <span className="field-err">{productFormErrors.sizes}</span>
                  )}
                </div>

                {/* Preset Garment Image Chooser */}
                <div className="form-field">
                  <label htmlFor="prod-image-select">Garment Image Asset *</label>
                  <select
                    id="prod-image-select"
                    value={productFormData.image}
                    onChange={(e) =>
                      setProductFormData((prev) => ({ ...prev, image: e.target.value }))
                    }
                    className="admin-select"
                  >
                    {PRESET_PRODUCT_IMAGES.map((img) => (
                      <option key={img.url} value={img.url}>
                        {img.label} ({img.url})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="form-field">
                  <label htmlFor="prod-desc-input">Product Description</label>
                  <textarea
                    id="prod-desc-input"
                    rows="3"
                    placeholder="Enter editorial product description..."
                    value={productFormData.description}
                    onChange={(e) =>
                      setProductFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

                <div className="modal-actions-bar">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setIsProductModalOpen(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="admin-primary-btn save-btn"
                    disabled={isSavingProduct}
                    id="admin-save-product-btn"
                  >
                    {isSavingProduct ? (
                      <>
                        <RefreshCw size={15} className="spinning" />
                        <span>Saving Product...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>{editingProduct ? 'UPDATE PRODUCT' : 'CREATE PRODUCT'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* ADD / EDIT COUPON MODAL (STEP 13 Requirement 10)                    */}
        {/* =================================================================== */}
        {isCouponModalOpen && (
          <div
            className="product-form-modal-overlay"
            onClick={() => setIsCouponModalOpen(false)}
            role="presentation"
            data-lenis-prevent="true"
          >
            <div
              className="product-form-modal coupon-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              data-lenis-prevent="true"
            >
              <div className="modal-top-bar">
                <div className="modal-title-group">
                  <span className="mono-label">PROMOTION MANAGEMENT</span>
                  <h3>
                    {editingCoupon
                      ? `EDIT COUPON: ${editingCoupon.code}`
                      : 'CREATE NEW COUPON CODE'}
                  </h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setIsCouponModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={handleSaveCoupon}
                className="product-form"
                id="admin-coupon-form"
              >
                {couponFormErrors.form && (
                  <div className="form-error-banner" role="alert">
                    <AlertTriangle size={15} />
                    <span>{couponFormErrors.form}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="coupon-code-input">
                      Coupon Code <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      id="coupon-code-input"
                      placeholder="e.g. SUMMER25"
                      value={couponFormData.code}
                      disabled={Boolean(editingCoupon)}
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      style={{
                        textTransform: 'uppercase',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                      }}
                    />
                    {couponFormErrors.code && (
                      <span className="field-err">{couponFormErrors.code}</span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="coupon-type-select">Discount Type</label>
                    <select
                      id="coupon-type-select"
                      value={couponFormData.discountType}
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          discountType: e.target.value,
                        }))
                      }
                    >
                      <option value="PERCENTAGE">Percentage (%) Off</option>
                      <option value="FLAT">Flat Amount (₹) Off</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="coupon-value-input">
                      {couponFormData.discountType === 'PERCENTAGE'
                        ? 'Discount Percentage (%) *'
                        : 'Flat Discount Amount (₹) *'}
                    </label>
                    <input
                      type="number"
                      id="coupon-value-input"
                      placeholder={
                        couponFormData.discountType === 'PERCENTAGE'
                          ? '15'
                          : '300'
                      }
                      value={couponFormData.discountValue}
                      min="1"
                      max={
                        couponFormData.discountType === 'PERCENTAGE'
                          ? '100'
                          : '50000'
                      }
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          discountValue: e.target.value,
                        }))
                      }
                    />
                    {couponFormErrors.discountValue && (
                      <span className="field-err">
                        {couponFormErrors.discountValue}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="coupon-min-order-input">
                      Minimum Order Amount (₹)
                    </label>
                    <input
                      type="number"
                      id="coupon-min-order-input"
                      placeholder="e.g. 1500"
                      value={couponFormData.minOrderAmount}
                      min="0"
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          minOrderAmount: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {couponFormData.discountType === 'PERCENTAGE' && (
                    <div className="form-field">
                      <label htmlFor="coupon-max-discount-input">
                        Max Discount Cap (₹ Optional)
                      </label>
                      <input
                        type="number"
                        id="coupon-max-discount-input"
                        placeholder="e.g. 500"
                        value={couponFormData.maxDiscountAmount || ''}
                        min="1"
                        onChange={(e) =>
                          setCouponFormData((prev) => ({
                            ...prev,
                            maxDiscountAmount: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  <div className="form-field">
                    <label htmlFor="coupon-max-uses-input">
                      Total Redemption Limit
                    </label>
                    <input
                      type="number"
                      id="coupon-max-uses-input"
                      placeholder="e.g. 100"
                      value={couponFormData.maxUses}
                      min="1"
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          maxUses: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="coupon-expiry-input">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="coupon-expiry-input"
                      value={couponFormData.expiresAt}
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          expiresAt: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field full-width">
                    <label htmlFor="coupon-desc-input">
                      Offer Description / Note
                    </label>
                    <input
                      type="text"
                      id="coupon-desc-input"
                      placeholder="e.g. 15% OFF on streetwear orders above ₹1,400"
                      value={couponFormData.description}
                      onChange={(e) =>
                        setCouponFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field full-width">
                    <label
                      className="checkbox-label"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={couponFormData.isActive}
                        onChange={(e) =>
                          setCouponFormData((prev) => ({
                            ...prev,
                            isActive: e.target.checked,
                          }))
                        }
                      />
                      <span>Active (Available for customer redemption)</span>
                    </label>
                  </div>
                </div>

                <div className="modal-actions-bar">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setIsCouponModalOpen(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="admin-primary-btn save-btn"
                    disabled={isSavingCoupon}
                    id="admin-save-coupon-submit-btn"
                  >
                    {isSavingCoupon ? (
                      <>
                        <RefreshCw size={15} className="spinning" />
                        <span>Saving Coupon...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>
                          {editingCoupon ? 'UPDATE COUPON' : 'CREATE COUPON'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* CUSTOMER ADDRESSES POPUP MODAL                                      */}
        {/* =================================================================== */}
        {selectedCustomerForAddresses && (
          <div
            className="product-form-modal-overlay"
            onClick={() => setSelectedCustomerForAddresses(null)}
            role="presentation"
            data-lenis-prevent="true"
          >
            <div
              className="addresses-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              data-lenis-prevent="true"
            >
              <div className="modal-top-bar">
                <div className="modal-title-group">
                  <span className="mono-label">SAVED DESTINATIONS</span>
                  <h3>
                    {selectedCustomerForAddresses.name ||
                      selectedCustomerForAddresses.fullName ||
                      'Customer'}
                    's Saved Delivery Addresses
                  </h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setSelectedCustomerForAddresses(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="addresses-modal-body">
                {selectedCustomerForAddresses.addresses &&
                selectedCustomerForAddresses.addresses.length > 0 ? (
                  <div className="customer-addresses-grid">
                    {selectedCustomerForAddresses.addresses.map((addr, idx) => (
                      <div key={idx} className="customer-address-card">
                        <div className="addr-card-header">
                          <strong className="addr-name">
                            {addr.fullName || selectedCustomerForAddresses.name}
                          </strong>
                          {addr.isDefault && <span className="default-pill">DEFAULT</span>}
                        </div>
                        <p className="addr-phone">
                          Phone: {addr.phone || selectedCustomerForAddresses.mobile}
                        </p>
                        <p className="addr-street">{addr.street || addr.address}</p>
                        {addr.landmark && (
                          <p className="addr-landmark">Landmark: {addr.landmark}</p>
                        )}
                        <p className="addr-city">
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-address-state">
                    <Store size={32} />
                    <p>No saved delivery addresses found for this customer profile.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PRINTABLE PACKING SLIP & TAX INVOICE MODAL                          */}
        {/* =================================================================== */}
        {isInvoiceModalOpen && invoiceOrder && (
          <div
            className="product-form-modal-overlay invoice-modal-overlay"
            onClick={() => setIsInvoiceModalOpen(false)}
            role="presentation"
            data-lenis-prevent="true"
          >
            <div
              className="invoice-slip-container"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              data-lenis-prevent="true"
            >
              {/* Screen controls (hidden in print) */}
              <div className="invoice-screen-actions no-print">
                <button
                  type="button"
                  className="admin-primary-btn print-now-btn"
                  onClick={() => window.print()}
                  id="invoice-print-btn"
                >
                  <Printer size={16} />
                  <span>PRINT PACKING SLIP / INVOICE</span>
                </button>
                <button
                  type="button"
                  className="invoice-close-btn"
                  onClick={() => setIsInvoiceModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* The Actual Printable Slip Document */}
              <div className="printable-slip-document" id="printable-invoice">
                <div className="slip-header">
                  <div className="slip-brand">
                    <h1>MACHII</h1>
                    <span>MENS MART • URBAN STREETWEAR</span>
                    <small>GSTIN: 33AAACM0000A1Z5 • machiimensmart.com</small>
                  </div>
                  <div className="slip-meta">
                    <span className="slip-doc-type">PACKING SLIP & TAX INVOICE</span>
                    <strong className="slip-order-ref">{invoiceOrder.orderRef}</strong>
                    <span className="slip-date">
                      Date:{' '}
                      {new Date(invoiceOrder.createdAt || currentTime).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="slip-addresses-grid">
                  <div className="slip-addr-col">
                    <span className="slip-col-label">DELIVER TO:</span>
                    <strong>{invoiceOrder.customer?.fullName}</strong>
                    <p>{invoiceOrder.customer?.address}</p>
                    <p>
                      {invoiceOrder.customer?.city}, {invoiceOrder.customer?.state} -{' '}
                      {invoiceOrder.customer?.pincode}
                    </p>
                    <p>Phone: {invoiceOrder.customer?.mobile}</p>
                  </div>

                  <div className="slip-logistics-col">
                    <span className="slip-col-label">LOGISTICS & DISPATCH:</span>
                    <p>
                      Fulfillment Status: <strong>{invoiceOrder.fulfillmentStatus || 'UNFULFILLED'}</strong>
                    </p>
                    <p>
                      Courier Partner:{' '}
                      <strong>{invoiceOrder.tracking?.carrier || 'Standard Express'}</strong>
                    </p>
                    <p>
                      Tracking / AWB:{' '}
                      <strong>{invoiceOrder.tracking?.trackingNumber || 'Pending Assignment'}</strong>
                    </p>
                    <p>
                      Payment Method: <strong>{invoiceOrder.paymentMethod}</strong> (
                      {invoiceOrder.paymentStatus})
                    </p>
                  </div>
                </div>

                {/* Slip Items Table */}
                <table className="slip-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Description</th>
                      <th>Fit / Spec</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceOrder.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>
                          Size: {item.size} • Color: {item.color}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatPrice(item.priceNum || item.price)}</td>
                        <td>
                          {formatPrice(
                            (item.priceNum || parsePrice(item.price) || 0) * (item.quantity || 1)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Financials Breakdown */}
                <div className="slip-totals-wrapper">
                  <div className="slip-notes">
                    <strong>MACHII RETURN POLICY:</strong>
                    <p>
                      7 days easy exchange on unworn garments with tags intact. Contact customer care at{' '}
                      {storeSettings?.supportPhone || '+91 98765 43210'}.
                    </p>
                  </div>

                  <div className="slip-calc-table">
                    <div className="slip-calc-row">
                      <span>Subtotal:</span>
                      <strong>
                        {formatPrice(
                          invoiceOrder.subtotal ||
                            invoiceOrder.total + (invoiceOrder.discountAmount || 0)
                        )}
                      </strong>
                    </div>

                    {invoiceOrder.discountAmount > 0 && (
                      <div className="slip-calc-row discount-row">
                        <span>Discount ({invoiceOrder.couponCode}):</span>
                        <strong>-₹{invoiceOrder.discountAmount}</strong>
                      </div>
                    )}

                    <div className="slip-calc-row">
                      <span>Delivery Fee:</span>
                      <strong>FREE</strong>
                    </div>

                    <div className="slip-calc-row grand-total">
                      <span>FINAL PAYABLE:</span>
                      <strong>{formatPrice(invoiceOrder.total)}</strong>
                    </div>
                  </div>
                </div>

                <div className="slip-footer">
                  <p>This is a computer generated invoice and does not require physical signature.</p>
                  <span>MACHII MENS MART • BRED FOR THE STREETS</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
