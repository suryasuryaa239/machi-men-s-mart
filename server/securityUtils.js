// server/securityUtils.js
// ============================================================================
// MACHII MENS MART — STEP 15: SECURITY UTILITIES & INPUT SANITIZATION
// Constant-time comparisons, HTML escaping, strict type validation,
// and safe URL inspection.
// ============================================================================

import crypto from 'node:crypto';

/**
 * Perform a constant-time comparison of two strings to prevent timing side-channel attacks.
 * Uses SHA-256 hashing to guarantee fixed-length buffers before calling timingSafeEqual.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean} True if strings match exactly
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Escapes HTML control characters to prevent HTML/XSS injection in rendered templates.
 *
 * @param {string} str
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes generic user text input: strips null bytes, control characters,
 * trims leading/trailing whitespace, escapes HTML entities, and enforces length bounds.
 *
 * @param {*} val
 * @param {number} [maxLen=255]
 * @returns {string}
 */
export function sanitizeText(val, maxLen = 255) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Strip control characters (except common whitespace like spaces)
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return escapeHtml(cleaned).slice(0, maxLen);
}

/**
 * Strict validation for Indian 10-digit mobile numbers.
 *
 * @param {*} phone
 * @returns {string|null} Clean 10-digit phone or null if invalid
 */
export function sanitizeAndValidatePhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);
  else if (clean.length === 11 && clean.startsWith('0')) clean = clean.slice(1);

  if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Strict validation for standard email addresses.
 *
 * @param {*} email
 * @returns {string|null} Clean email or null if invalid
 */
export function sanitizeAndValidateEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  if (clean.length > 120) return null;
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return emailRegex.test(clean) ? clean : null;
}

/**
 * Validates 6-digit Indian PIN codes.
 *
 * @param {*} pincode
 * @returns {string|null} Clean 6-digit pin or null if invalid
 */
export function sanitizeAndValidatePincode(pincode) {
  if (!pincode) return null;
  const clean = String(pincode).replace(/\D/g, '');
  if (clean.length === 6 && /^[1-9]\d{5}$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Validates image URLs and data URIs against unsafe protocols (e.g. javascript:, data:text/html).
 *
 * @param {*} url
 * @returns {boolean} True if URL uses an approved safe scheme
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();

  // Relative asset path in project
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return true;
  }

  // Safe HTTP/HTTPS image URL
  if (/^https?:\/\//i.test(clean)) {
    // Disallow javascript: or vbscript: anywhere in query or path
    if (/javascript:|vbscript:|data:/i.test(clean)) return false;
    return true;
  }

  // Safe base64 image data URI
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
    return true;
  }

  return false;
}
