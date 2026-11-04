import React, { useState } from 'react';
import { MessageCircle, Mail, MapPin, Truck, ChevronDown, Package, Sparkles } from 'lucide-react';
import './ContactSection.css';

const FAQS = [
  {
    q: 'How long does express shipping take across India?',
    a: 'All orders are dispatched from our Tirupur fulfillment hub within 24 hours. Typical transit time is 3–5 business days via premium air express couriers (Delhivery, BlueDart, DTDC).',
  },
  {
    q: 'What is your exchange and return policy?',
    a: 'We offer a hassle-free 7-day exchange window for sizing and fit adjustments. Simply message us on WhatsApp with your Order Ref, and our team will arrange a reverse pickup.',
  },
  {
    q: 'How should I choose my size for oversized fits?',
    a: 'Our silhouettes are designed with an intentional drop-shoulder boxy cut. If you prefer a relaxed modern streetwear look, order your true standard size. If you want a more regular fitted look, size down one size.',
  },
  {
    q: 'How do I care for my 100% combed cotton heavy tee?',
    a: 'Machine wash cold inside-out with mild detergent. Tumble dry on low or hang dry in the shade to preserve garment shape, rib collar tension, and print vibrance.',
  },
];

export default function ContactSection({ onOpenOrders }) {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  return (
    <section className="contact-section" id="contact" aria-label="Contact and Support">
      <div className="contact-container">
        {/* Section Header */}
        <div className="contact-header">
          <div className="contact-badge-row">
            <span className="mono-label">CHAPTER 05 // CONNECT & HELP</span>
            <span className="contact-status-pill">
              <Sparkles size={11} /> 24/7 SUPPORT READY
            </span>
          </div>
          <h2 className="contact-heading">DIRECT STORE SUPPORT & ASSISTANCE</h2>
          <p className="contact-intro">
            Have questions about your order, tracking, bulk queries, or sizing? Our support crew is available via WhatsApp and email.
          </p>
        </div>

        {/* 3 Contact Method Cards */}
        <div className="contact-grid">
          {/* Card 1: WhatsApp */}
          <div className="contact-card card-whatsapp">
            <div className="contact-icon-circle whatsapp-circle">
              <MessageCircle size={22} />
            </div>
            <span className="contact-card-label">INSTANT CHAT</span>
            <h3 className="contact-card-title">WhatsApp Support</h3>
            <p className="contact-card-desc">
              Connect directly with our support team for order inquiries, exchanges, and payment assistance.
            </p>
            <a
              href="https://wa.me/919876543210?text=Hi%20Machii%20Support%2C%20I%20have%20an%20inquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-action-btn btn-whatsapp"
              id="contact-whatsapp-btn"
            >
              <MessageCircle size={15} />
              <span>CHAT ON WHATSAPP</span>
            </a>
          </div>

          {/* Card 2: Email */}
          <div className="contact-card card-email">
            <div className="contact-icon-circle email-circle">
              <Mail size={22} />
            </div>
            <span className="contact-card-label">OFFICIAL INQUIRIES</span>
            <h3 className="contact-card-title">Email Desk</h3>
            <p className="contact-card-desc">
              Drop an email for formal queries, partnerships, and order status updates.
            </p>
            <a
              href="mailto:machimensmartsupport@gmail.com"
              className="contact-action-btn btn-email"
              id="contact-email-btn"
            >
              <Mail size={15} />
              <span>machimensmartsupport@gmail.com</span>
            </a>
          </div>

          {/* Card 3: Fulfillment Hub & Tracking */}
          <div className="contact-card card-tracking">
            <div className="contact-icon-circle tracking-circle">
              <Truck size={22} />
            </div>
            <span className="contact-card-label">PAN-INDIA DISPATCH</span>
            <h3 className="contact-card-title">Order Tracking</h3>
            <p className="contact-card-desc">
              Track your package live or look up your order history using your registered mobile number.
            </p>
            <button
              type="button"
              className="contact-action-btn btn-orders"
              onClick={() => {
                if (onOpenOrders) onOpenOrders();
                else {
                  window.dispatchEvent(new CustomEvent('machii:open-orders'));
                }
              }}
              id="contact-track-orders-btn"
            >
              <Package size={15} />
              <span>LOOK UP MY ORDER</span>
            </button>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="faq-wrapper">
          <div className="faq-header">
            <span className="mono-label">FREQUENTLY ASKED QUESTIONS</span>
            <h3 className="faq-title">EVERYTHING YOU NEED TO KNOW</h3>
          </div>

          <div className="faq-list">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={faq.q} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className={`chevron-icon ${isOpen ? 'rotate' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

