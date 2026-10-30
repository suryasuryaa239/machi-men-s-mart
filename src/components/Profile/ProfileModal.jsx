import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  User,
  MapPin,
  Package,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Search,
  CheckCircle2,
  ShieldCheck,
  Phone,
  Heart,
} from 'lucide-react';
import {
  fetchCustomerProfile,
  updateCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  validateProfileDetails,
  validateAddressDetails,
} from '../../utils/profileService';
import {
  getCustomerSessionPhone,
  saveCustomerSessionPhone,
} from '../../utils/orderService';
import { lockScroll, unlockScroll } from '../../utils/smoothScroll';
import './ProfileModal.css';

const INDIAN_STATES = [
  'Tamil Nadu',
  'Karnataka',
  'Maharashtra',
  'Delhi',
  'Kerala',
  'Telangana',
  'Andhra Pradesh',
  'Gujarat',
  'West Bengal',
  'Rajasthan',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Punjab',
  'Haryana',
  'Goa',
  'Odisha',
  'Assam',
  'Bihar',
  'Jharkhand',
  'Chhattisgarh',
  'Uttarakhand',
  'Himachal Pradesh',
  'Jammu & Kashmir',
];

export default function ProfileModal({ isOpen, onClose, onOpenOrders, onOpenWishlist }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'addresses'
  const [phone, setPhone] = useState(() => getCustomerSessionPhone());
  const [phoneInput, setPhoneInput] = useState(() => getCustomerSessionPhone());
  const [showPhonePrompt, setShowPhonePrompt] = useState(!getCustomerSessionPhone());

  // Profile data
  const [profile, setProfile] = useState({
    fullName: '',
    mobile: '',
    email: '',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);

  // Address data
  const [addresses, setAddresses] = useState([]);
  const [editingAddressId, setEditingAddressId] = useState(null); // null = not editing, 'new' = creating new, string = editing existing
  const [addressFormData, setAddressFormData] = useState({
    recipientName: '',
    mobile: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    isDefault: false,
    tag: 'Home',
  });
  const [addressErrors, setAddressErrors] = useState({});
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSuccessMsg, setAddressSuccessMsg] = useState(null);

  // Global loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const phoneInputRef = useRef(null);
  const modalRef = useRef(null);

  // Load profile & addresses from server
  const loadProfileData = useCallback(async (targetPhone) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetchCustomerProfile(targetPhone);
      if (res.success) {
        setProfile({
          fullName: res.profile?.fullName || '',
          mobile: res.profile?.mobile || targetPhone,
          email: res.profile?.email || '',
        });
        setAddresses(res.addresses || []);
        saveCustomerSessionPhone(targetPhone);
        setPhone(targetPhone);
        setShowPhonePrompt(false);
      } else {
        setServerError(res.error || 'Failed to retrieve profile details.');
      }
    } catch (err) {
      setServerError(err.message || 'Network error loading profile.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Modal open effect
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const sessionPhone = getCustomerSessionPhone();
    if (sessionPhone) {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        loadProfileData(sessionPhone);
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      const timer = setTimeout(() => {
        if (!isMounted) return;
        setShowPhonePrompt(true);
        phoneInputRef.current?.focus();
      }, 100);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [isOpen, loadProfileData]);

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
        if (editingAddressId !== null) {
          setEditingAddressId(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editingAddressId, onClose]);

  // Handle phone verification form submit
  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    let cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
    else if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);

    if (!cleaned || cleaned.length !== 10 || !/^[6-9]\d{9}$/.test(cleaned)) {
      setServerError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    loadProfileData(cleaned);
  };

  // Handle Profile Save
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileErrors({});
    setProfileSuccessMsg(null);
    setServerError(null);

    const val = validateProfileDetails(profile);
    if (!val.isValid) {
      setProfileErrors(val.errors);
      return;
    }

    setProfileSaving(true);
    try {
      const res = await updateCustomerProfile(phone, profile);
      if (res.success) {
        setProfileSuccessMsg('Profile information updated successfully.');
        if (res.newPhone && res.newPhone !== phone) {
          setPhone(res.newPhone);
          setPhoneInput(res.newPhone);
        }
        setTimeout(() => setProfileSuccessMsg(null), 3500);
      } else {
        setServerError(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setServerError(err.message || 'Error saving profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Open Add Address form
  const handleOpenAddAddress = () => {
    setEditingAddressId('new');
    setAddressFormData({
      recipientName: profile.fullName || '',
      mobile: profile.mobile || phone || '',
      address: '',
      city: '',
      state: 'Tamil Nadu',
      pincode: '',
      isDefault: addresses.length === 0,
      tag: 'Home',
    });
    setAddressErrors({});
    setServerError(null);
  };

  // Open Edit Address form
  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressFormData({
      recipientName: addr.recipientName || '',
      mobile: addr.mobile || '',
      address: addr.address || '',
      city: addr.city || '',
      state: addr.state || 'Tamil Nadu',
      pincode: addr.pincode || '',
      isDefault: Boolean(addr.isDefault),
      tag: addr.tag || 'Home',
    });
    setAddressErrors({});
    setServerError(null);
  };

  // Handle Address Save (Add or Edit)
  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    setAddressErrors({});
    setAddressSuccessMsg(null);
    setServerError(null);

    const val = validateAddressDetails(addressFormData);
    if (!val.isValid) {
      setAddressErrors(val.errors);
      return;
    }

    setAddressSaving(true);
    try {
      if (editingAddressId === 'new') {
        // Create new
        const res = await addCustomerAddress(phone, addressFormData);
        if (res.success) {
          setAddresses(res.addresses || []);
          setEditingAddressId(null);
          setAddressSuccessMsg('Delivery address added successfully.');
          setTimeout(() => setAddressSuccessMsg(null), 3500);
        } else {
          setServerError(res.error || 'Failed to add delivery address.');
        }
      } else {
        // Update existing
        const res = await updateCustomerAddress(phone, editingAddressId, addressFormData);
        if (res.success) {
          setAddresses(res.addresses || []);
          setEditingAddressId(null);
          setAddressSuccessMsg('Delivery address updated successfully.');
          setTimeout(() => setAddressSuccessMsg(null), 3500);
        } else {
          setServerError(res.error || 'Failed to update delivery address.');
        }
      }
    } catch (err) {
      setServerError(err.message || 'Error saving address.');
    } finally {
      setAddressSaving(false);
    }
  };

  // Handle Set Default Address
  const handleSetDefaultAddress = async (addrId) => {
    setServerError(null);
    try {
      const res = await setDefaultCustomerAddress(phone, addrId);
      if (res.success) {
        setAddresses(res.addresses || []);
        setAddressSuccessMsg('Default delivery address updated.');
        setTimeout(() => setAddressSuccessMsg(null), 3000);
      } else {
        setServerError(res.error || 'Failed to set default address.');
      }
    } catch (err) {
      setServerError(err.message || 'Network error setting default address.');
    }
  };

  // Handle Delete Address
  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) {
      return;
    }
    setServerError(null);
    try {
      const res = await deleteCustomerAddress(phone, addrId);
      if (res.success) {
        setAddresses(res.addresses || []);
        setAddressSuccessMsg('Delivery address removed.');
        setTimeout(() => setAddressSuccessMsg(null), 3000);
      } else {
        setServerError(res.error || 'Failed to delete address.');
      }
    } catch (err) {
      setServerError(err.message || 'Network error deleting address.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="profile-modal-backdrop"
      onClick={onClose}
      role="presentation"
      id="profile-modal-overlay"
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        className="profile-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="profile-header">
          <div className="profile-brand-group">
            <span className="profile-brand-label">MACHII MENS MART</span>
            <div className="profile-title-wrap">
              <User size={18} className="profile-header-icon" />
              <h2 id="profile-modal-title" className="profile-title">
                PROFILE & ADDRESSES
              </h2>
            </div>
          </div>

          <div className="profile-header-actions">
            <span className="profile-portal-tag">CUSTOMER ACCESS</span>
            <button
              type="button"
              className="profile-close-btn"
              onClick={onClose}
              aria-label="Close window"
              id="close-profile-modal-btn"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="profile-body" data-lenis-prevent="true">
          {/* Active Customer Mobile Bar */}
          <div className="profile-customer-bar">
            <div className="customer-info-wrap">
              <span className="customer-bar-label">AUTHENTICATED CUSTOMER</span>
              <div className="customer-display">
                <span className="customer-flag">🇮🇳</span>
                <strong className="customer-phone-text" id="profile-active-phone">
                  {phone ? `+91 ${phone}` : 'Verification Required'}
                </strong>
              </div>
            </div>

            <div className="customer-actions-wrap">
              {onOpenWishlist && (
                <button
                  type="button"
                  className="orders-switch-btn"
                  onClick={() => {
                    onClose();
                    onOpenWishlist();
                  }}
                  id="profile-view-wishlist-btn"
                  title="View my saved wishlist"
                >
                  <Heart size={14} fill="#EF4444" color="#EF4444" />
                  <span>My Wishlist</span>
                </button>
              )}

              {onOpenOrders && (
                <button
                  type="button"
                  className="orders-switch-btn"
                  onClick={() => {
                    onClose();
                    onOpenOrders();
                  }}
                  id="profile-view-orders-btn"
                  title="View my order history"
                >
                  <Package size={14} />
                  <span>My Orders</span>
                </button>
              )}

              <button
                type="button"
                className="switch-account-btn"
                onClick={() => setShowPhonePrompt(!showPhonePrompt)}
                id="switch-profile-phone-btn"
              >
                <Search size={14} />
                <span>{showPhonePrompt ? 'Cancel Lookup' : 'Switch Phone'}</span>
              </button>
            </div>
          </div>

          {/* Phone Lookup Form (if prompt open or no session phone) */}
          {showPhonePrompt && (
            <form
              className="profile-phone-form"
              onSubmit={handlePhoneSubmit}
              id="profile-phone-form"
            >
              <label htmlFor="profile-lookup-phone" className="lookup-label">
                Enter your 10-digit Indian mobile number to access your profile and saved addresses:
              </label>
              <div className="lookup-input-group">
                <div className="phone-input-wrap">
                  <span className="phone-prefix">+91</span>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    id="profile-lookup-phone"
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
                  id="profile-lookup-submit"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="spinner-anim" />
                  ) : (
                    <>
                      <Search size={15} />
                      <span>ACCESS PROFILE</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Global Server Error Alert */}
          {serverError && (
            <div className="profile-error-banner" role="alert" id="profile-server-error">
              <AlertCircle size={18} className="banner-icon" />
              <div className="banner-text">
                <strong>Error:</strong> {serverError}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading ? (
            <div className="profile-loading-state" id="profile-loading-state">
              <Loader2 size={32} className="spinner-anim" />
              <p>Retrieving your verified customer details & addresses...</p>
            </div>
          ) : !phone ? (
            /* Prompt to verify */
            <div className="profile-unauth-state">
              <ShieldCheck size={42} className="unauth-icon" />
              <h3>CUSTOMER VERIFICATION REQUIRED</h3>
              <p>Please enter your 10-digit mobile number above to manage your streetwear profile and delivery addresses.</p>
            </div>
          ) : (
            /* Authenticated Content: Tabs */
            <div className="profile-content-wrap">
              {/* Tab Navigation */}
              <div className="profile-tabs-header">
                <button
                  type="button"
                  className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                  id="tab-btn-profile"
                >
                  <User size={15} />
                  <span>Profile Details</span>
                </button>

                <button
                  type="button"
                  className={`profile-tab-btn ${activeTab === 'addresses' ? 'active' : ''}`}
                  onClick={() => setActiveTab('addresses')}
                  id="tab-btn-addresses"
                >
                  <MapPin size={15} />
                  <span>Delivery Addresses</span>
                  <span className="tab-badge-count">{addresses.length}</span>
                </button>
              </div>

              {/* ========================================================= */}
              {/* TAB 1: PROFILE DETAILS (Requirements 1 & 2)               */}
              {/* ========================================================= */}
              {activeTab === 'profile' && (
                <div className="tab-pane profile-pane" id="profile-details-pane">
                  {profileSuccessMsg && (
                    <div className="profile-success-banner" role="status">
                      <CheckCircle2 size={16} />
                      <span>{profileSuccessMsg}</span>
                    </div>
                  )}

                  <form className="profile-form-grid" onSubmit={handleProfileSubmit}>
                    <div className="form-field-group">
                      <label htmlFor="profile-fullName" className="field-label">
                        Full Name <span className="req-star">*</span>
                      </label>
                      <input
                        type="text"
                        id="profile-fullName"
                        className={`profile-input ${profileErrors.fullName ? 'has-error' : ''}`}
                        placeholder="e.g. Arjun Sharma"
                        value={profile.fullName}
                        onChange={(e) => {
                          setProfile({ ...profile, fullName: e.target.value });
                          if (profileErrors.fullName) {
                            setProfileErrors({ ...profileErrors, fullName: null });
                          }
                        }}
                      />
                      {profileErrors.fullName && (
                        <span className="field-error-text">{profileErrors.fullName}</span>
                      )}
                    </div>

                    <div className="form-field-group">
                      <label htmlFor="profile-mobile" className="field-label">
                        Mobile Number <span className="req-star">*</span>
                      </label>
                      <div className="input-prefix-wrap">
                        <span className="field-prefix">+91</span>
                        <input
                          type="tel"
                          id="profile-mobile"
                          maxLength={10}
                          className={`profile-input with-prefix ${
                            profileErrors.mobile ? 'has-error' : ''
                          }`}
                          placeholder="9876543210"
                          value={profile.mobile}
                          onChange={(e) => {
                            setProfile({
                              ...profile,
                              mobile: e.target.value.replace(/\D/g, ''),
                            });
                            if (profileErrors.mobile) {
                              setProfileErrors({ ...profileErrors, mobile: null });
                            }
                          }}
                        />
                      </div>
                      {profileErrors.mobile ? (
                        <span className="field-error-text">{profileErrors.mobile}</span>
                      ) : (
                        <span className="field-hint-text">
                          Changing your mobile number moves your account and order history to the new number.
                        </span>
                      )}
                    </div>

                    <div className="form-field-group">
                      <label htmlFor="profile-email" className="field-label">
                        Email Address (Optional)
                      </label>
                      <div className="input-icon-wrap">
                        <input
                          type="email"
                          id="profile-email"
                          className={`profile-input ${profileErrors.email ? 'has-error' : ''}`}
                          placeholder="e.g. arjun@streetwear.in"
                          value={profile.email}
                          onChange={(e) => {
                            setProfile({ ...profile, email: e.target.value });
                            if (profileErrors.email) {
                              setProfileErrors({ ...profileErrors, email: null });
                            }
                          }}
                        />
                      </div>
                      {profileErrors.email && (
                        <span className="field-error-text">{profileErrors.email}</span>
                      )}
                    </div>

                    <div className="profile-form-actions">
                      <button
                        type="submit"
                        className="save-profile-btn"
                        disabled={profileSaving}
                        id="save-profile-changes-btn"
                      >
                        {profileSaving ? (
                          <>
                            <Loader2 size={16} className="spinner-anim" />
                            <span>SAVING CHANGES...</span>
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            <span>SAVE PROFILE CHANGES</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: DELIVERY ADDRESSES (Requirements 3, 4, 5)          */}
              {/* ========================================================= */}
              {activeTab === 'addresses' && (
                <div className="tab-pane addresses-pane" id="addresses-list-pane">
                  {addressSuccessMsg && (
                    <div className="profile-success-banner" role="status">
                      <CheckCircle2 size={16} />
                      <span>{addressSuccessMsg}</span>
                    </div>
                  )}

                  {/* Header row with Add button */}
                  <div className="addresses-top-row">
                    <div className="addresses-count-info">
                      <strong>{addresses.length}</strong>{' '}
                      {addresses.length === 1 ? 'SAVED ADDRESS' : 'SAVED ADDRESSES'}
                    </div>

                    {editingAddressId === null && (
                      <button
                        type="button"
                        className="add-address-trigger-btn"
                        onClick={handleOpenAddAddress}
                        id="add-new-address-btn"
                      >
                        <Plus size={15} />
                        <span>ADD NEW ADDRESS</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Address Form (Add / Edit) */}
                  {editingAddressId !== null && (
                    <div className="address-form-card" id="address-editor-form-card">
                      <div className="form-card-header">
                        <h4>
                          {editingAddressId === 'new'
                            ? 'ADD NEW DELIVERY ADDRESS'
                            : 'EDIT DELIVERY ADDRESS'}
                        </h4>
                        <button
                          type="button"
                          className="cancel-form-cross"
                          onClick={() => setEditingAddressId(null)}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleAddressSubmit} className="address-input-grid">
                        <div className="form-row-dual">
                          <div className="form-field-group">
                            <label htmlFor="addr-recipient" className="field-label">
                              Recipient Name <span className="req-star">*</span>
                            </label>
                            <input
                              type="text"
                              id="addr-recipient"
                              className={`profile-input ${
                                addressErrors.recipientName ? 'has-error' : ''
                              }`}
                              placeholder="Full name of receiver"
                              value={addressFormData.recipientName}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  recipientName: e.target.value,
                                })
                              }
                            />
                            {addressErrors.recipientName && (
                              <span className="field-error-text">
                                {addressErrors.recipientName}
                              </span>
                            )}
                          </div>

                          <div className="form-field-group">
                            <label htmlFor="addr-mobile" className="field-label">
                              Contact Mobile <span className="req-star">*</span>
                            </label>
                            <div className="input-prefix-wrap">
                              <span className="field-prefix">+91</span>
                              <input
                                type="tel"
                                id="addr-mobile"
                                maxLength={10}
                                className={`profile-input with-prefix ${
                                  addressErrors.mobile ? 'has-error' : ''
                                }`}
                                placeholder="10-digit number"
                                value={addressFormData.mobile}
                                onChange={(e) =>
                                  setAddressFormData({
                                    ...addressFormData,
                                    mobile: e.target.value.replace(/\D/g, ''),
                                  })
                                }
                              />
                            </div>
                            {addressErrors.mobile && (
                              <span className="field-error-text">{addressErrors.mobile}</span>
                            )}
                          </div>
                        </div>

                        <div className="form-field-group">
                          <label htmlFor="addr-address" className="field-label">
                            Address Lines (Door No, Street, Landmark) <span className="req-star">*</span>
                          </label>
                          <textarea
                            id="addr-address"
                            rows={3}
                            className={`profile-textarea ${
                              addressErrors.address ? 'has-error' : ''
                            }`}
                            placeholder="Complete address (minimum 8 characters)"
                            value={addressFormData.address}
                            onChange={(e) =>
                              setAddressFormData({
                                ...addressFormData,
                                address: e.target.value,
                              })
                            }
                          />
                          {addressErrors.address && (
                            <span className="field-error-text">{addressErrors.address}</span>
                          )}
                        </div>

                        <div className="form-row-dual">
                          <div className="form-field-group">
                            <label htmlFor="addr-city" className="field-label">
                              City <span className="req-star">*</span>
                            </label>
                            <input
                              type="text"
                              id="addr-city"
                              className={`profile-input ${addressErrors.city ? 'has-error' : ''}`}
                              placeholder="e.g. Chennai"
                              value={addressFormData.city}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  city: e.target.value,
                                })
                              }
                            />
                            {addressErrors.city && (
                              <span className="field-error-text">{addressErrors.city}</span>
                            )}
                          </div>

                          <div className="form-field-group">
                            <label htmlFor="addr-state" className="field-label">
                              State <span className="req-star">*</span>
                            </label>
                            <select
                              id="addr-state"
                              className="profile-select"
                              value={addressFormData.state}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  state: e.target.value,
                                })
                              }
                            >
                              {INDIAN_STATES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            {addressErrors.state && (
                              <span className="field-error-text">{addressErrors.state}</span>
                            )}
                          </div>
                        </div>

                        <div className="form-row-dual">
                          <div className="form-field-group">
                            <label htmlFor="addr-pincode" className="field-label">
                              PIN Code (6 Digits) <span className="req-star">*</span>
                            </label>
                            <input
                              type="text"
                              id="addr-pincode"
                              maxLength={6}
                              className={`profile-input ${
                                addressErrors.pincode ? 'has-error' : ''
                              }`}
                              placeholder="e.g. 600020"
                              value={addressFormData.pincode}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  pincode: e.target.value.replace(/\D/g, ''),
                                })
                              }
                            />
                            {addressErrors.pincode && (
                              <span className="field-error-text">{addressErrors.pincode}</span>
                            )}
                          </div>

                          <div className="form-field-group">
                            <label htmlFor="addr-tag" className="field-label">
                              Address Label
                            </label>
                            <select
                              id="addr-tag"
                              className="profile-select"
                              value={addressFormData.tag}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  tag: e.target.value,
                                })
                              }
                            >
                              <option value="Home">Home</option>
                              <option value="Work">Work / Office</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Make Default Checkbox */}
                        <div className="form-checkbox-row">
                          <label className="checkbox-label-wrap">
                            <input
                              type="checkbox"
                              checked={addressFormData.isDefault}
                              onChange={(e) =>
                                setAddressFormData({
                                  ...addressFormData,
                                  isDefault: e.target.checked,
                                })
                              }
                            />
                            <span>Set as my default Pan-India delivery address</span>
                          </label>
                        </div>

                        <div className="form-card-actions">
                          <button
                            type="button"
                            className="cancel-btn"
                            onClick={() => setEditingAddressId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="save-address-btn"
                            disabled={addressSaving}
                            id="submit-address-btn"
                          >
                            {addressSaving ? (
                              <>
                                <Loader2 size={15} className="spinner-anim" />
                                <span>SAVING...</span>
                              </>
                            ) : (
                              <>
                                <Check size={15} />
                                <span>
                                  {editingAddressId === 'new'
                                    ? 'SAVE ADDRESS'
                                    : 'UPDATE ADDRESS'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Empty state (Requirement 12) */}
                  {addresses.length === 0 && editingAddressId === null ? (
                    <div className="addresses-empty-card" id="addresses-empty-state">
                      <div className="empty-map-icon">
                        <MapPin size={42} />
                      </div>
                      <h3>NO SAVED ADDRESSES YET</h3>
                      <p>
                        Add your primary delivery address to speed through checkout on future Machii drops.
                      </p>
                      <button
                        type="button"
                        className="empty-add-btn"
                        onClick={handleOpenAddAddress}
                        id="empty-add-address-btn"
                      >
                        <Plus size={16} />
                        <span>ADD YOUR FIRST ADDRESS</span>
                      </button>
                    </div>
                  ) : (
                    /* Populated addresses cards grid */
                    <div className="addresses-cards-grid" id="addresses-cards-grid">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`address-card-item ${addr.isDefault ? 'is-default-card' : ''}`}
                          id={`address-card-${addr.id}`}
                        >
                          <div className="card-top-row">
                            <div className="card-tag-group">
                              <span className="address-tag-pill">{addr.tag || 'Home'}</span>
                              {addr.isDefault && (
                                <span className="default-address-pill">
                                  <Check size={11} />
                                  <span>DEFAULT ADDRESS</span>
                                </span>
                              )}
                            </div>

                            <div className="card-item-actions">
                              <button
                                type="button"
                                className="action-icon-btn edit-action"
                                onClick={() => handleOpenEditAddress(addr)}
                                title="Edit Address"
                                id={`edit-addr-${addr.id}`}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn delete-action"
                                onClick={() => handleDeleteAddress(addr.id)}
                                title="Delete Address"
                                id={`delete-addr-${addr.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="card-body-meta">
                            <h4 className="card-recipient-name">{addr.recipientName}</h4>
                            <p className="card-mobile-line">
                              <Phone size={12} />
                              <span>+91 {addr.mobile}</span>
                            </p>
                            <p className="card-street-address">{addr.address}</p>
                            <p className="card-city-state">
                              {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                            </p>
                          </div>

                          {!addr.isDefault && (
                            <div className="card-footer-action">
                              <button
                                type="button"
                                className="make-default-btn"
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                id={`set-default-btn-${addr.id}`}
                              >
                                <Check size={13} />
                                <span>Set as Default</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
