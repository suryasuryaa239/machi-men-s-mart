// server/rateLimiter.js
// ============================================================================
// MACHII MENS MART — STEP 15: IN-MEMORY RATE LIMITER & ABUSE PROTECTION
// Sliding-window rate limiter with automatic stale-entry garbage collection,
// standard HTTP 429 response formatting, and testing bypass hooks.
// ============================================================================

class SlidingWindowRateLimiter {
  /**
   * @param {Object} options
   * @param {number} options.windowMs - Window duration in milliseconds (e.g. 60000 for 1 min)
   * @param {number} options.max - Maximum requests allowed within windowMs
   * @param {string} [options.name='default'] - Name identifier for headers and logs
   */
  constructor({ windowMs, max, name = 'default' }) {
    this.windowMs = windowMs;
    this.max = max;
    this.name = name;
    // Map of key -> Array<number (timestamps)>
    this.hits = new Map();

    // Periodic sweep every 5 minutes to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove expired timestamps across all keys
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  /**
   * Reset all counters (useful for automated testing)
   */
  reset() {
    this.hits.clear();
  }

  /**
   * Check if request should be allowed or rate-limited.
   *
   * @param {string} key - Identifier (e.g. client IP or account ID)
   * @returns {{ allowed: boolean, remaining: number, resetTime: number, retryAfterSec: number }}
   */
  consume(key) {
    const now = Date.now();
    const timestamps = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.max) {
      const oldest = timestamps[0];
      const resetTime = oldest + this.windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetTime - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfterSec,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    const remaining = Math.max(0, this.max - timestamps.length);
    const resetTime = timestamps[0] + this.windowMs;
    const retryAfterSec = 0;

    return {
      allowed: true,
      remaining,
      resetTime,
      retryAfterSec,
    };
  }
}

// ----------------------------------------------------------------------------
// PRE-CONFIGURED LIMITERS FOR SENSITIVE ROUTES
// ----------------------------------------------------------------------------

// 1. Admin Login: 5 failed attempts per 15 minutes
export const adminLoginLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  name: 'admin-login',
});

// 2. Coupon Validation: 20 attempts per minute per client
export const couponValidationLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  name: 'coupon-validate',
});

// 3. Order Placement: 10 order creation attempts per 10 minutes per client
export const orderCreationLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  name: 'order-create',
});

// 4. Payment Verification: 10 signature checks per minute
export const paymentVerifyLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  name: 'payment-verify',
});

/**
 * Extract safe client identifier (IP address or fallback).
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = String(forwarded).split(',')[0].trim();
    if (ip) return ip;
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Middleware helper to check rate limit and return 429 response if exceeded.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {SlidingWindowRateLimiter} limiter
 * @param {string} [customKey] - Optional custom identifier
 * @returns {boolean} True if allowed, false if blocked (and 429 response sent)
 */
export function enforceRateLimit(req, res, limiter, customKey = null) {
  const key = customKey || getClientIp(req);
  const result = limiter.consume(key);

  res.setHeader('RateLimit-Limit', limiter.max);
  res.setHeader('RateLimit-Remaining', result.remaining);
  res.setHeader('RateLimit-Reset', Math.ceil(result.resetTime / 1000));

  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfterSec);
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: `Too many requests for ${limiter.name}. Please wait ${result.retryAfterSec} second(s) before retrying.`,
        retryAfter: result.retryAfterSec,
      })
    );
    return false;
  }

  return true;
}

/**
 * Reset all rate limiters (for testing)
 */
export function resetAllRateLimiters() {
  adminLoginLimiter.reset();
  couponValidationLimiter.reset();
  orderCreationLimiter.reset();
  paymentVerifyLimiter.reset();
}

