import React from 'react';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { BRAND_CONFIG } from '../../data/products';
import './Hero.css';

export default function Hero() {
  const scrollToProductShowcase = () => {
    const showcaseSection = document.getElementById('product-showcase');
    if (showcaseSection) {
      showcaseSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <section className="site-hero-section" id="hero">
      {/* Subtle Studio Glow */}
      <div className="hero-studio-glow" aria-hidden="true"></div>

      <div className="hero-inner-container">
        {/* Drop Tag Badge */}
        <div className="hero-season-badge">
          <Sparkles size={14} className="sparkle-icon" />
          <span className="mono-label">{BRAND_CONFIG.badge} // SS26</span>
        </div>

        {/* Editorial Headline */}
        <h1 className="hero-title" aria-label={BRAND_CONFIG.headline}>
          <span className="hero-word">WEAR</span>{' '}
          <span className="hero-word">YOUR</span>{' '}
          <span className="hero-word outline-text">ATTITUDE.</span>
        </h1>

        {/* Brand Tagline */}
        <p className="hero-subtitle">{BRAND_CONFIG.tagline}</p>

        {/* Action Button */}
        <div className="hero-action-group">
          <button
            className="hero-primary-cta"
            id="explore-drop-cta"
            onClick={scrollToProductShowcase}
            type="button"
          >
            <span>{BRAND_CONFIG.cta}</span>
            <ArrowRight size={18} className="cta-arrow" />
          </button>
        </div>

        {/* Subtle Preview Teaser Bar at bottom */}
        <div className="hero-rack-teaser" aria-hidden="true">
          <div className="teaser-rail-bar"></div>
          <span className="teaser-label">DROP 01 CLOTHES RACK SHOWCASE BELOW</span>
        </div>

        {/* Scroll Indicator */}
        <div className="hero-scroll-indicator" onClick={scrollToProductShowcase}>
          <span className="indicator-pill">
            <span className="indicator-dot"></span>
          </span>
          <span className="indicator-text">SCROLL TO UNLOCK SHOWCASE</span>
          <ChevronDown size={14} className="indicator-arrow" />
        </div>
      </div>
    </section>
  );
}
