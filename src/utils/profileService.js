/* ==========================================================================
   MACHII MENS MART — CUSTOMER PROFILE & ADDRESS MANAGEMENT SERVICE
   STEP 9: View & update profile, delivery address CRUD, default address
   selection, strict input validation, authorization and customer isolation.
   ========================================================================== */

import { getCustomerSessionPhone, saveCustomerSessionPhone } from './orderService.js';

export const PROFILES_STORAGE_KEY = 'machii_demo_profiles';

/**
 * Validate customer profile details
 */
export function validateProfileDetails({ fullName, email, mobile }) {
  const errors = {};

  const cleanName = String(fullName || '').trim();
  if (!cleanName) {
    errors.fullName = 'Full name is required.';
  } else if (cleanName.length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  if (mobile !== undefined) {
    let cleanMobile = String(mobile || '').replace(/\D/g, '');
    if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) cleanMobile = cleanMobile.slice(2);
    else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) cleanMobile = cleanMobile.slice(1);

    if (!cleanMobile) {
      errors.mobile = 'Mobile number is required.';
    } else if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      errors.mobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
    }
  }

  const cleanEmail = String(email || '').trim();
  if (cleanEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate delivery address details
 */
export function validateAddressDetails(data = {}) {
  const errors = {};

  const cleanRecipient = String(data.recipientName || '').trim();
  if (!cleanRecipient) {
    errors.recipientName = 'Recipient name is required.';
  } else if (cleanRecipient.length < 2) {
    errors.recipientName = 'Recipient name must be at least 2 characters.';
  }

  let cleanMobile = String(data.mobile || '').replace(/\D/g, '');
  if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) cleanMobile = cleanMobile.slice(2);
  else if (cleanMobile.length === 11 && cleanMobile.startsWith('0')) cleanMobile = cleanMobile.slice(1);

  if (!cleanMobile) {
    errors.mobile = 'Contact mobile number is required.';
  } else if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
    errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
  }

  const cleanAddress = String(data.address || '').trim();
  if (!cleanAddress) {
    errors.address = 'Street address is required.';
  } else if (cleanAddress.length < 8) {
    errors.address = 'Complete street address must be at least 8 characters.';
  }

  const cleanCity = String(data.city || '').trim();
  if (!cleanCity) {
    errors.city = 'City is required.';
  } else if (cleanCity.length < 2) {
    errors.city = 'City name must be at least 2 characters.';
  }

  const cleanState = String(data.state || '').trim();
  if (!cleanState) {
    errors.state = 'State is required.';
  }

  const cleanPincode = String(data.pincode || '').replace(/\D/g, '');
  if (!cleanPincode) {
    errors.pincode = 'PIN code is required.';
  } else if (cleanPincode.length !== 6 || !/^[1-9]\d{5}$/.test(cleanPincode)) {
    errors.pincode = 'PIN code must be a valid 6-digit Indian postal code.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleaned: {
      recipientName: cleanRecipient,
      mobile: cleanMobile,
      address: cleanAddress,
      city: cleanCity,
      state: cleanState,
      pincode: cleanPincode,
      isDefault: Boolean(data.isDefault),
      tag: data.tag ? String(data.tag).trim() : 'Home',
    },
  };
}

/**
 * Clean phone helper
 */
function cleanPhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.length === 12 && p.startsWith('91')) p = p.slice(2);
  else if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
  return p;
}

/**
 * Fetch Customer Profile & Addresses (Requirement 1 & 8)
 */
export async function fetchCustomerProfile(phone) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.', profile: null, addresses: [] };
  }

  // 1. Attempt backend API call
  try {
    const res = await fetch(`/api/customer/profile?phone=${cleaned}`, {
      headers: { 'X-Customer-Phone': cleaned },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        saveCustomerSessionPhone(cleaned);
        cacheProfileLocally(cleaned, data.profile, data.addresses);
        return { success: true, profile: data.profile, addresses: data.addresses || [] };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to retrieve profile.' };
    }
  } catch {
    // Network fallback
  }

  // 2. Local storage fallback
  const cached = getCachedProfile(cleaned);
  if (cached) {
    saveCustomerSessionPhone(cleaned);
    return { success: true, profile: cached.profile, addresses: cached.addresses || [] };
  }

  return {
    success: true,
    profile: { fullName: '', mobile: cleaned, email: null, createdAt: new Date().toISOString() },
    addresses: [],
  };
}

/**
 * Update Customer Profile (Requirement 2 & 7)
 */
export async function updateCustomerProfile(phone, profileData) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.' };
  }

  const val = validateProfileDetails(profileData);
  if (!val.isValid) {
    const firstErr = Object.values(val.errors)[0];
    return { success: false, error: firstErr, errors: val.errors };
  }

  try {
    const res = await fetch(`/api/customer/profile?phone=${cleaned}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Phone': cleaned,
      },
      body: JSON.stringify(profileData),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.newPhone) {
        saveCustomerSessionPhone(data.newPhone);
      }
      return { success: true, message: data.message, profile: data.profile, newPhone: data.newPhone };
    }
    return { success: false, error: data.error || 'Failed to update profile.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating profile.' };
  }
}

/**
 * Fetch Customer Delivery Addresses (Requirement 3 & 4)
 */
export async function fetchCustomerAddresses(phone) {
  const profileRes = await fetchCustomerProfile(phone);
  if (profileRes.success) {
    return { success: true, addresses: profileRes.addresses || [] };
  }
  return { success: false, error: profileRes.error, addresses: [] };
}

/**
 * Add New Delivery Address (Requirement 3, 4, 5, 7)
 */
export async function addCustomerAddress(phone, addressData) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.' };
  }

  const val = validateAddressDetails(addressData);
  if (!val.isValid) {
    const firstErr = Object.values(val.errors)[0];
    return { success: false, error: firstErr, errors: val.errors };
  }

  try {
    const res = await fetch(`/api/customer/addresses?phone=${cleaned}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Phone': cleaned,
      },
      body: JSON.stringify(val.cleaned),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message, address: data.address, addresses: data.addresses };
    }
    return { success: false, error: data.error || 'Failed to add delivery address.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error adding delivery address.' };
  }
}

/**
 * Update Delivery Address (Requirement 3, 4, 7, 8)
 */
export async function updateCustomerAddress(phone, addressId, addressData) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.' };
  }
  if (!addressId) {
    return { success: false, error: 'Address ID is required.' };
  }

  const val = validateAddressDetails(addressData);
  if (!val.isValid) {
    const firstErr = Object.values(val.errors)[0];
    return { success: false, error: firstErr, errors: val.errors };
  }

  try {
    const res = await fetch(`/api/customer/addresses/${encodeURIComponent(addressId)}?phone=${cleaned}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Phone': cleaned,
      },
      body: JSON.stringify(val.cleaned),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message, address: data.address, addresses: data.addresses };
    }
    return { success: false, error: data.error || 'Failed to update delivery address.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating delivery address.' };
  }
}

/**
 * Delete Delivery Address (Requirement 3 & 8)
 */
export async function deleteCustomerAddress(phone, addressId) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.' };
  }
  if (!addressId) {
    return { success: false, error: 'Address ID is required.' };
  }

  try {
    const res = await fetch(`/api/customer/addresses/${encodeURIComponent(addressId)}?phone=${cleaned}`, {
      method: 'DELETE',
      headers: { 'X-Customer-Phone': cleaned },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message, addresses: data.addresses };
    }
    return { success: false, error: data.error || 'Failed to delete delivery address.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error deleting delivery address.' };
  }
}

/**
 * Set Default Delivery Address (Requirement 5)
 */
export async function setDefaultCustomerAddress(phone, addressId) {
  const cleaned = cleanPhone(phone || getCustomerSessionPhone());
  if (!cleaned || cleaned.length !== 10) {
    return { success: false, error: 'Mobile number verification required.' };
  }
  if (!addressId) {
    return { success: false, error: 'Address ID is required.' };
  }

  try {
    const res = await fetch(`/api/customer/addresses/${encodeURIComponent(addressId)}/default?phone=${cleaned}`, {
      method: 'PATCH',
      headers: { 'X-Customer-Phone': cleaned },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message, addresses: data.addresses };
    }
    return { success: false, error: data.error || 'Failed to set default address.' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error setting default address.' };
  }
}

// Helper: Cache profile in local storage
function cacheProfileLocally(phone, profile, addresses) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[phone] = { profile, addresses, cachedAt: new Date().toISOString() };
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage issues
  }
}

function getCachedProfile(phone) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    return store[phone] || null;
  } catch {
    return null;
  }
}

