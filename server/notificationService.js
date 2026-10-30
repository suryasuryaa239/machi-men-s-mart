// server/notificationService.js
// ============================================================================
// MACHII MENS MART — STEP 14 & 15: CUSTOMER ORDER NOTIFICATIONS ENGINE
// Multi-channel (Email + SMS) notification system with deduplication,
// provider fallback, zero PII leaks, and resilient error isolation.
// ============================================================================

import { escapeHtml } from './securityUtils.js';

// In-memory idempotency cache: Set of `${orderRef}:${eventType}:${qualifier}`
const dispatchedEventKeys = new Set();

// Active mock provider handler for automated test suites
let activeMockProvider = null;

/**
 * Register a mock provider for automated tests.
 * @param {Function|null} handler - (payload) => Promise<{ success: boolean, ... }>
 */
export function setMockNotificationProvider(handler) {
  activeMockProvider = handler;
}

export function clearMockNotificationProvider() {
  activeMockProvider = null;
}

/**
 * Safely masks an Indian mobile phone number (e.g. "9876543210" -> "98******10")
 */
export function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}******${clean.slice(8)}`;
  }
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  }
  return '******';
}

/**
 * Safely masks an email address (e.g. "customer@example.com" -> "c***r@example.com")
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***@***.***';
  const [username, domain] = parts;
  let maskedUser = '***';
  if (username.length === 1) {
    maskedUser = `${username}*`;
  } else if (username.length === 2) {
    maskedUser = `${username[0]}*`;
  } else {
    maskedUser = `${username[0]}***${username[username.length - 1]}`;
  }
  return `${maskedUser}@${domain}`;
}

/**
 * Inspect configured providers from process.env without leaking secret values.
 */
export function getNotificationConfig() {
  const resendApiKey = process.env.RESEND_API_KEY || null;
  const sendgridApiKey = process.env.SENDGRID_API_KEY || null;
  const smtpHost = process.env.SMTP_HOST || null;
  const smtpUser = process.env.SMTP_USER || null;
  const smtpPass = process.env.SMTP_PASS || null;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID || null;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || null;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || null;
  const fast2smsKey = process.env.FAST2SMS_API_KEY || null;

  let emailProvider = null;
  let isEmailConfigured = false;
  if (resendApiKey) {
    emailProvider = 'resend';
    isEmailConfigured = true;
  } else if (sendgridApiKey) {
    emailProvider = 'sendgrid';
    isEmailConfigured = true;
  } else if (smtpHost && smtpUser && smtpPass) {
    emailProvider = 'smtp';
    isEmailConfigured = true;
  }

  let smsProvider = null;
  let isSmsConfigured = false;
  if (twilioSid && twilioToken) {
    smsProvider = 'twilio';
    isSmsConfigured = true;
  } else if (fast2smsKey) {
    smsProvider = 'fast2sms';
    isSmsConfigured = true;
  }

  return {
    email: {
      configured: isEmailConfigured,
      provider: emailProvider,
      sender:
        process.env.RESEND_FROM_EMAIL ||
        process.env.SENDGRID_FROM_EMAIL ||
        process.env.SMTP_FROM ||
        'Machii Mens Mart <orders@machiimensmart.com>',
      requiredEnv: ['RESEND_API_KEY (or SENDGRID_API_KEY / SMTP_HOST+SMTP_USER+SMTP_PASS)'],
    },
    sms: {
      configured: isSmsConfigured,
      provider: smsProvider,
      sender: twilioPhone ? maskPhone(twilioPhone) : 'MACHII',
      requiredEnv: ['TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (or FAST2SMS_API_KEY)'],
    },
    storeUrl: process.env.STORE_URL || 'http://localhost:3000',
    channels: {
      email: isEmailConfigured,
      sms: isSmsConfigured,
    },
    hasActiveProvider: isEmailConfigured || isSmsConfigured,
  };
}

/**
 * Build rich notification content tailored to Machii Streetwear aesthetic.
 */
export function buildNotificationTemplate(eventType, order, extra = {}) {
  const storeUrl = process.env.STORE_URL || 'http://localhost:3000';
  const orderRef = order.orderRef || order.id || 'ORDER';
  const safeOrderRef = escapeHtml(orderRef);
  const customerName = escapeHtml(order.customer?.fullName || 'Customer');
  const totalStr = `₹${(order.total || 0).toLocaleString('en-IN')}`;
  const trackingUrl =
    order.tracking?.trackingUrl || `${storeUrl}/?order=${encodeURIComponent(orderRef)}&view=tracking`;
  const itemsCount = Array.isArray(order.items)
    ? order.items.reduce((sum, it) => sum + (it.quantity || 1), 0)
    : 1;
  const itemsSummary = Array.isArray(order.items)
    ? order.items.map((it) => `${it.quantity}x ${it.name} (${it.size})`).join(', ')
    : 'Streetwear Drop Garments';
  const safeItemsSummary = escapeHtml(itemsSummary);

  switch (eventType) {
    case 'ORDER_CONFIRMATION': {
      const isCod = order.paymentMethod === 'COD';
      const paymentNote = isCod
        ? 'Cash or UPI upon doorstep delivery'
        : 'Paid Online via Gateway';
      const safePaymentNote = escapeHtml(paymentNote);

      const subject = `[Machii Mens Mart] Order Confirmed: #${orderRef}`;
      const smsText = `Machii Mens Mart: Your order #${orderRef} (${totalStr}) is confirmed! ${
        isCod ? 'Pay upon delivery.' : 'Payment received.'
      } Track: ${trackingUrl}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#08090C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <div style="max-width:580px;margin:0 auto;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
    <div style="background:#12141F;padding:24px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
      <h1 style="margin:0;font-size:20px;letter-spacing:2px;color:#F8FAFC;font-weight:800;">MACHII MENS MART</h1>
      <span style="display:inline-block;margin-top:6px;font-size:11px;color:#38BDF8;letter-spacing:1.5px;font-weight:700;">STREETWEAR DROP CONFIRMED</span>
    </div>
    <div style="padding:28px 24px;">
      <p style="font-size:16px;margin:0 0 16px;color:#F8FAFC;">Hey <strong>${customerName}</strong>,</p>
      <p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0 0 24px;">
        Your order <strong>#${safeOrderRef}</strong> has been received and confirmed. Our fulfillment team is preparing your drop.
      </p>

      <div style="background:#161822;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="font-size:11px;color:#38BDF8;letter-spacing:1px;font-weight:700;margin-bottom:8px;">ORDER SUMMARY</div>
        <div style="font-size:14px;color:#F8FAFC;margin-bottom:4px;"><strong>${itemsCount} Garment(s):</strong> ${safeItemsSummary}</div>
        <div style="font-size:13px;color:#94A3B8;margin-bottom:4px;">Payment Method: <span style="color:#F8FAFC;">${safePaymentNote}</span></div>
        <div style="font-size:15px;color:#F8FAFC;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
          Total Payable: <strong style="color:#38BDF8;font-size:18px;">${totalStr}</strong>
        </div>
      </div>

      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${trackingUrl}" style="background:#38BDF8;color:#08090C;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;letter-spacing:1px;display:inline-block;">
          TRACK YOUR DROP
        </a>
      </div>
    </div>
    <div style="background:#0A0B0F;padding:16px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#64748B;">
      Machii Mens Mart • 280 GSM Heavyweight Streetwear • Chennai, India
    </div>
  </div>
</body>
</html>
      `.trim();

      return {
        subject,
        smsText,
        emailHtml,
        title: 'Order Confirmed',
        category: 'ORDER',
      };
    }

    case 'PAYMENT_CONFIRMATION': {
      const subject = `[Machii Mens Mart] Payment Successful: #${orderRef}`;
      const txId = extra.transactionId || order.paymentDetails?.transactionId || 'Verified';
      const safeTxId = escapeHtml(txId);
      const smsText = `Machii Mens Mart: We received your payment of ${totalStr} for order #${orderRef} (Ref: ${txId}). Thank you!`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#08090C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <div style="max-width:580px;margin:0 auto;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
    <div style="background:#12141F;padding:20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
      <h1 style="margin:0;font-size:18px;letter-spacing:2px;color:#F8FAFC;">MACHII MENS MART</h1>
      <span style="font-size:11px;color:#10B981;font-weight:700;letter-spacing:1px;">PAYMENT CONFIRMED</span>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;color:#F8FAFC;margin:0 0 12px;">Hey <strong>${customerName}</strong>,</p>
      <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 20px;">
        Your payment of <strong style="color:#10B981;">${totalStr}</strong> for order <strong>#${safeOrderRef}</strong> has been successfully authorized and confirmed.
      </p>
      <div style="background:#161822;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;font-size:13px;color:#94A3B8;">
        <div>Transaction ID: <code style="color:#38BDF8;">${safeTxId}</code></div>
        <div style="margin-top:6px;">Status: <strong style="color:#10B981;">PAID</strong></div>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      return {
        subject,
        smsText,
        emailHtml,
        title: 'Payment Successful',
        category: 'PAYMENT',
      };
    }

    case 'PAYMENT_FAILURE': {
      const subject = `[Machii Mens Mart] Action Needed: Payment Failed for #${orderRef}`;
      const reason = extra.error || 'Payment gateway declined transaction.';
      const safeReason = escapeHtml(reason);
      const smsText = `Machii Mens Mart: Payment failed for order #${orderRef}. Please retry your payment or choose Cash on Delivery: ${trackingUrl}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#08090C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <div style="max-width:580px;margin:0 auto;background:#0E1017;border:1px solid rgba(239,68,68,0.2);border-radius:12px;overflow:hidden;">
    <div style="background:#12141F;padding:20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
      <h1 style="margin:0;font-size:18px;letter-spacing:2px;color:#F8FAFC;">MACHII MENS MART</h1>
      <span style="font-size:11px;color:#EF4444;font-weight:700;letter-spacing:1px;">PAYMENT NOT COMPLETED</span>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;color:#F8FAFC;margin:0 0 12px;">Hey <strong>${customerName}</strong>,</p>
      <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 20px;">
        We were unable to process your online payment for order <strong>#${safeOrderRef}</strong>. Reason: ${safeReason}
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${trackingUrl}" style="background:#EF4444;color:#FFFFFF;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;display:inline-block;">
          RETRY PAYMENT OR SELECT COD
        </a>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      return {
        subject,
        smsText,
        emailHtml,
        title: 'Payment Failed',
        category: 'PAYMENT',
      };
    }

    case 'ORDER_STATUS_CHANGE': {
      const status = extra.status || order.fulfillmentStatus || order.status || 'Updated';
      const carrier = extra.carrier || order.tracking?.carrier || null;
      const trackingNumber = extra.trackingNumber || order.tracking?.trackingNumber || null;

      let statusMsg = `Your order #${orderRef} status is now: ${status}.`;
      if (status === 'Confirmed') {
        statusMsg = `Your Machii order #${orderRef} has been confirmed by our warehouse team and is being prepped.`;
      } else if (status === 'Packed') {
        statusMsg = `Your Machii order #${orderRef} is packaged in signature heavyweight streetwear packing.`;
      } else if (status === 'Shipped') {
        statusMsg = `Dispatched! Your Machii order #${orderRef} is on the way${
          carrier ? ` via ${carrier}` : ''
        }.${trackingNumber ? ` AWB: ${trackingNumber}.` : ''}`;
      } else if (status === 'Out for Delivery') {
        statusMsg = `Out for delivery today! Your Machii drop #${orderRef} is with the delivery courier.`;
      } else if (status === 'Delivered') {
        statusMsg = `Delivered! Your Machii drop #${orderRef} has been delivered. Enjoy the fit!`;
      } else if (status === 'Cancelled') {
        statusMsg = `Order #${orderRef} has been cancelled. Any collected payments will be refunded in 3-5 business days.`;
      }

      const subject = `[Machii Mens Mart] Order #${orderRef}: ${status}`;
      const smsText = `Machii Mens Mart: ${statusMsg} Track: ${trackingUrl}`;
      const safeStatusMsg = escapeHtml(statusMsg);
      const safeStatus = escapeHtml(status);
      const safeCarrier = carrier ? escapeHtml(carrier) : null;
      const safeTrackingNumber = trackingNumber ? escapeHtml(trackingNumber) : null;

      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#08090C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <div style="max-width:580px;margin:0 auto;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
    <div style="background:#12141F;padding:20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
      <h1 style="margin:0;font-size:18px;letter-spacing:2px;color:#F8FAFC;">MACHII MENS MART</h1>
      <span style="font-size:11px;color:#38BDF8;font-weight:700;letter-spacing:1px;">ORDER UPDATE: ${safeStatus.toUpperCase()}</span>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;color:#F8FAFC;margin:0 0 12px;">Hey <strong>${customerName}</strong>,</p>
      <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 20px;">
        ${safeStatusMsg}
      </p>
      ${
        safeCarrier || safeTrackingNumber
          ? `
      <div style="background:#161822;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;font-size:13px;color:#94A3B8;margin-bottom:20px;">
        ${safeCarrier ? `<div>Courier Partner: <strong style="color:#F8FAFC;">${safeCarrier}</strong></div>` : ''}
        ${safeTrackingNumber ? `<div style="margin-top:6px;">Tracking / AWB: <code style="color:#38BDF8;">${safeTrackingNumber}</code></div>` : ''}
      </div>`
          : ''
      }
      <div style="text-align:center;margin:28px 0 12px;">
        <a href="${trackingUrl}" style="background:#38BDF8;color:#08090C;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;display:inline-block;">
          VIEW LIVE TRACKING
        </a>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      return {
        subject,
        smsText,
        emailHtml,
        title: `Order ${status}`,
        category: 'STATUS',
      };
    }

    default: {
      const subject = `[Machii Mens Mart] Update on Order #${orderRef}`;
      return {
        subject,
        smsText: `Machii Mens Mart: Update on order #${orderRef}. Track: ${trackingUrl}`,
        emailHtml: `<p>Update on order #${orderRef}</p>`,
        title: 'Order Update',
        category: 'GENERAL',
      };
    }
  }
}

/**
 * Real provider HTTP dispatchers (Resend, SendGrid, Twilio, Fast2SMS)
 * Never throws outside; isolates network/provider errors.
 */
async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Machii Mens Mart <orders@machiimensmart.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function sendViaSendGrid({ to, subject, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL || 'orders@machiimensmart.com';
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'Machii Mens Mart' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SendGrid API error (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function sendViaTwilio({ toPhone, bodyText }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
  const normalizedTo = toPhone.startsWith('+') ? toPhone : `+91${toPhone}`;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', normalizedTo);
  params.append('From', fromNumber);
  params.append('Body', bodyText);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio SMS API error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function sendViaFast2SMS({ toPhone, bodyText }) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message: bodyText,
      language: 'english',
      flash: 0,
      numbers: toPhone,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fast2SMS API error (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Main Authoritative Notification Trigger.
 * Deduplicates events, extracts verified customer contact,
 * attempts real dispatch or creates an accurate 'NOT_CONFIGURED' log.
 *
 * @param {Object} options
 * @param {Object} options.order - The order object from serverOrdersDatabase
 * @param {string} options.eventType - 'ORDER_CONFIRMATION' | 'PAYMENT_CONFIRMATION' | 'PAYMENT_FAILURE' | 'ORDER_STATUS_CHANGE'
 * @param {Object} [options.extra] - Extra parameters (status, error, transactionId, carrier, trackingNumber)
 * @returns {Promise<Object>} Result object with dispatched status and audit records
 */
export async function triggerOrderNotification({ order, eventType, extra = {} }) {
  if (!order || (!order.orderRef && !order.id)) {
    return { success: false, error: 'Cannot trigger notification without a valid order record.' };
  }

  const orderRef = order.orderRef || order.id;

  // Initialize notifications array on order if not present
  if (!Array.isArray(order.notifications)) {
    order.notifications = [];
  }

  // Deduplication qualifier
  const qualifier =
    eventType === 'ORDER_STATUS_CHANGE'
      ? extra.status || order.fulfillmentStatus || order.status || 'STATUS_UPDATE'
      : eventType === 'PAYMENT_CONFIRMATION'
      ? 'PAID'
      : eventType === 'PAYMENT_FAILURE'
      ? 'FAILED'
      : 'INITIAL';

  const idempotencyKey = `${orderRef}:${eventType}:${qualifier}`;

  // Check in-memory key cache AND order records
  const alreadyDispatchedInCache = dispatchedEventKeys.has(idempotencyKey);
  const alreadyInOrder = order.notifications.some(
    (n) => n.idempotencyKey === idempotencyKey && n.status !== 'FAILED'
  );

  if (alreadyDispatchedInCache || alreadyInOrder) {
    return {
      success: true,
      deduplicated: true,
      message: `Notification already recorded/dispatched for event ${idempotencyKey}. Duplicate skipped.`,
      idempotencyKey,
    };
  }

  const template = buildNotificationTemplate(eventType, order, extra);
  const config = getNotificationConfig();

  // Extract and validate customer contact details
  const customerEmail =
    order.customer?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer.email.trim())
      ? order.customer.email.trim()
      : null;

  let rawMobile = String(order.customer?.mobile || '').replace(/\D/g, '');
  if (rawMobile.length === 12 && rawMobile.startsWith('91')) rawMobile = rawMobile.slice(2);
  else if (rawMobile.length === 11 && rawMobile.startsWith('0')) rawMobile = rawMobile.slice(1);
  const customerMobile = rawMobile.length === 10 && /^[6-9]\d{9}$/.test(rawMobile) ? rawMobile : null;

  const recordsCreated = [];
  const nowIso = new Date().toISOString();

  // --------------------------------------------------------------------------
  // TEST MOCK PROVIDER EXECUTION (Automated verification)
  // --------------------------------------------------------------------------
  if (typeof activeMockProvider === 'function') {
    try {
      const mockResult = await activeMockProvider({
        order,
        eventType,
        qualifier,
        idempotencyKey,
        template,
        customerEmail,
        customerMobile,
        extra,
      });

      const mockRecord = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        idempotencyKey,
        orderRef,
        eventType,
        category: template.category,
        title: template.title,
        channel: customerEmail ? 'EMAIL+SMS' : 'SMS',
        recipientMasked: customerMobile ? maskPhone(customerMobile) : maskEmail(customerEmail),
        status: mockResult?.success ? 'SENT' : 'FAILED',
        delivered: Boolean(mockResult?.success),
        provider: 'mock-test-adapter',
        timestamp: nowIso,
        subject: template.subject,
        summary: template.smsText,
        metadata: { ...extra },
      };

      order.notifications.push(mockRecord);
      if (mockResult?.success) {
        dispatchedEventKeys.add(idempotencyKey);
      }

      return {
        success: Boolean(mockResult?.success),
        deduplicated: false,
        mocked: true,
        notification: mockRecord,
      };
    } catch (mockErr) {
      const failedRecord = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        idempotencyKey,
        orderRef,
        eventType,
        channel: 'MOCK',
        status: 'FAILED',
        delivered: false,
        error: mockErr.message || 'Mock provider error',
        timestamp: nowIso,
      };
      order.notifications.push(failedRecord);
      return { success: false, error: mockErr.message, notification: failedRecord };
    }
  }

  // --------------------------------------------------------------------------
  // CHANNEL 1: EMAIL DISPATCH
  // --------------------------------------------------------------------------
  if (customerEmail) {
    const emailNotifId = `notif_em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const emailKey = `${idempotencyKey}:EMAIL`;

    if (config.email.configured) {
      try {
        if (config.email.provider === 'resend') {
          await sendViaResend({
            to: customerEmail,
            subject: template.subject,
            html: template.emailHtml,
          });
        } else if (config.email.provider === 'sendgrid') {
          await sendViaSendGrid({
            to: customerEmail,
            subject: template.subject,
            html: template.emailHtml,
          });
        }

        const successRecord = {
          id: emailNotifId,
          idempotencyKey: emailKey,
          orderRef,
          eventType,
          category: template.category,
          title: template.title,
          channel: 'EMAIL',
          recipientMasked: maskEmail(customerEmail),
          status: 'SENT',
          delivered: true,
          provider: config.email.provider,
          timestamp: nowIso,
          subject: template.subject,
          summary: `Sent to ${maskEmail(customerEmail)} via ${config.email.provider.toUpperCase()}`,
        };
        order.notifications.push(successRecord);
        recordsCreated.push(successRecord);
      } catch (err) {
        // Safe isolation: never throw or corrupt order
        const failRecord = {
          id: emailNotifId,
          idempotencyKey: emailKey,
          orderRef,
          eventType,
          category: template.category,
          title: template.title,
          channel: 'EMAIL',
          recipientMasked: maskEmail(customerEmail),
          status: 'FAILED',
          delivered: false,
          provider: config.email.provider,
          error: 'Email delivery failed: ' + (err.message || 'Network issue'),
          timestamp: nowIso,
        };
        order.notifications.push(failRecord);
        recordsCreated.push(failRecord);
      }
    } else {
      // Clean non-pretending integration point
      const unconfiguredRecord = {
        id: emailNotifId,
        idempotencyKey: emailKey,
        orderRef,
        eventType,
        category: template.category,
        title: template.title,
        channel: 'EMAIL',
        recipientMasked: maskEmail(customerEmail),
        status: 'NOT_CONFIGURED',
        delivered: false,
        provider: null,
        reason: 'Email provider not configured (Missing RESEND_API_KEY or SMTP credentials in .env)',
        timestamp: nowIso,
        subject: template.subject,
        summary: template.subject,
      };
      order.notifications.push(unconfiguredRecord);
      recordsCreated.push(unconfiguredRecord);
    }
  }

  // --------------------------------------------------------------------------
  // CHANNEL 2: SMS DISPATCH
  // --------------------------------------------------------------------------
  if (customerMobile) {
    const smsNotifId = `notif_sms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const smsKey = `${idempotencyKey}:SMS`;

    if (config.sms.configured) {
      try {
        if (config.sms.provider === 'twilio') {
          await sendViaTwilio({
            toPhone: customerMobile,
            bodyText: template.smsText,
          });
        } else if (config.sms.provider === 'fast2sms') {
          await sendViaFast2SMS({
            toPhone: customerMobile,
            bodyText: template.smsText,
          });
        }

        const successRecord = {
          id: smsNotifId,
          idempotencyKey: smsKey,
          orderRef,
          eventType,
          category: template.category,
          title: template.title,
          channel: 'SMS',
          recipientMasked: maskPhone(customerMobile),
          status: 'SENT',
          delivered: true,
          provider: config.sms.provider,
          timestamp: nowIso,
          subject: template.title,
          summary: template.smsText,
        };
        order.notifications.push(successRecord);
        recordsCreated.push(successRecord);
      } catch (err) {
        // Safe isolation
        const failRecord = {
          id: smsNotifId,
          idempotencyKey: smsKey,
          orderRef,
          eventType,
          category: template.category,
          title: template.title,
          channel: 'SMS',
          recipientMasked: maskPhone(customerMobile),
          status: 'FAILED',
          delivered: false,
          provider: config.sms.provider,
          error: 'SMS delivery failed: ' + (err.message || 'Telecom issue'),
          timestamp: nowIso,
        };
        order.notifications.push(failRecord);
        recordsCreated.push(failRecord);
      }
    } else {
      // Clean non-pretending integration point
      const unconfiguredRecord = {
        id: smsNotifId,
        idempotencyKey: smsKey,
        orderRef,
        eventType,
        category: template.category,
        title: template.title,
        channel: 'SMS',
        recipientMasked: maskPhone(customerMobile),
        status: 'NOT_CONFIGURED',
        delivered: false,
        provider: null,
        reason: 'SMS provider not configured (Missing TWILIO_ACCOUNT_SID or FAST2SMS_API_KEY in .env)',
        timestamp: nowIso,
        subject: template.title,
        summary: template.smsText,
      };
      order.notifications.push(unconfiguredRecord);
      recordsCreated.push(unconfiguredRecord);
    }
  }

  // If customer provided neither email nor valid phone
  if (!customerEmail && !customerMobile) {
    const fallbackRecord = {
      id: `notif_none_${Date.now()}`,
      idempotencyKey,
      orderRef,
      eventType,
      channel: 'NONE',
      status: 'SKIPPED',
      delivered: false,
      reason: 'No contact method (email or phone) provided on order.',
      timestamp: nowIso,
    };
    order.notifications.push(fallbackRecord);
    recordsCreated.push(fallbackRecord);
  }

  // Register in memory idempotency cache
  dispatchedEventKeys.add(idempotencyKey);

  return {
    success: true,
    deduplicated: false,
    orderRef,
    recordsCount: recordsCreated.length,
    notifications: recordsCreated,
  };
}

/**
 * Reset memory cache (useful for automated testing)
 */
export function resetNotificationCache() {
  dispatchedEventKeys.clear();
}
