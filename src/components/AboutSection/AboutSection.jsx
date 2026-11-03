import React from 'react';
import { Sparkles, Shield, Award, Scissors } from 'lucide-react';
import './AboutSection.css';

export default function AboutSection() {
  return (
    <section className="about-section" id="about" aria-label="About Machii Mens Mart">
      <div className="about-container">
        {/* Section Header */}
        <div className="about-header">
          <div className="about-badge-row">
            <span className="mono-label">CHAPTER 03 // ORIGIN & STORY</span>
            <span className="about-craft-pill">
              <Sparkles size={11} /> 100% COMBED COTTON
            </span>
          </div>
          <h2 className="about-heading">
            REDEFINING INDIAN STREETWEAR WITH HEAVYWEIGHT SILHOUETTES
          </h2>
          <p className="about-intro">
            Born out of frustration with flimsy, paper-thin fast fashion tees, Machii Mens Mart is built for those who demand substance. We craft bold, boxy, unapologetic streetwear engineered specifically for Indian bodies and climate.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="about-pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-wrap">
              <Award size={22} />
            </div>
            <h3 className="pillar-title">260–420 GSM FABRIC</h3>
            <p className="pillar-desc">
              Custom-milled heavyweight luxury combed cotton. Breathable yet substantial, ensuring an effortless drape that never clings or loses its shape after washing.
            </p>
            <div className="pillar-tag">CUSTOM-MILLED</div>
          </div>

          <div className="pillar-card highlight-card">
            <div className="pillar-icon-wrap">
              <Scissors size={22} />
            </div>
            <h3 className="pillar-title">GEN Z BOXY CUT</h3>
            <p className="pillar-desc">
              Drop-shoulder silhouette with extended sleeve proportions and reinforced dense-ribbed collars that stay crisp wear after wear.
            </p>
            <div className="pillar-tag">SIGNATURE FIT</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-wrap">
              <Shield size={22} />
            </div>
            <h3 className="pillar-title">TIRUPUR CRAFTSMANSHIP</h3>
            <p className="pillar-desc">
              Proudly designed and tailored in the knitwear capital of India. Ethically produced with precision double-needle hems and bio-washed softness.
            </p>
            <div className="pillar-tag">PROUDLY INDIAN</div>
          </div>
        </div>

        {/* Editorial Quote Banner */}
        <div className="about-editorial-banner">
          <div className="editorial-banner-content">
            <span className="quote-mark">“</span>
            <p className="quote-text">
              We don't do basic t-shirts. Every piece is an attitude statement engineered with weight, density, and attitude.
            </p>
            <span className="quote-author">— MACHII DESIGN LAB, TIRUPUR</span>
          </div>
        </div>
      </div>
    </section>
  );
}

