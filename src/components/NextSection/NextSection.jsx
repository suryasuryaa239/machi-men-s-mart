import React from 'react';
import { ArrowUpRight, Flame, Sparkles } from 'lucide-react';
import './NextSection.css';

export default function NextSection() {
  return (
    <section className="next-drop-section" id="collections">
      <div className="next-drop-container">
        {/* Section Header */}
        <div className="section-meta-bar">
          <div className="badge-row">
            <span className="mono-label">CHAPTER 02 // MANIFESTO</span>
            <span className="edition-tag">DROP 01 ACTIVE</span>
          </div>
          <span className="drop-status">
            <Flame size={14} className="flame-icon" /> ALL SIZES IN STOCK
          </span>
        </div>

        {/* Brand Editorial Statement */}
        <div className="editorial-statement-block">
          <h2 className="statement-heading">
            REDEFINING STREETWEAR FOR THE NEW GENERATION.
          </h2>
          <p className="statement-description">
            Machii Mens Mart is built on raw attitude, heavyweight custom-milled cotton, and oversized silhouettes crafted specifically for Indian street culture. Every drop is produced in limited quantities with zero compromise on fabric weight, collar structure, and print longevity.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="manifesto-grid">
          <div className="manifesto-card">
            <span className="card-number">01</span>
            <h3 className="card-title">280+ GSM HEAVYWEIGHT</h3>
            <p className="card-desc">
              Custom bio-washed combed cotton that retains its boxy shape after countless washes. No cling, pure drape.
            </p>
          </div>

          <div className="manifesto-card">
            <span className="card-number">02</span>
            <h3 className="card-title">GEN Z OVERSIZED FIT</h3>
            <p className="card-desc">
              Extended drop shoulders, widened chest dimensions, and tuned sleeve length for authentic street aesthetics.
            </p>
          </div>

          <div className="manifesto-card">
            <span className="card-number">03</span>
            <h3 className="card-title">HIGH-DENSITY PUFF PRINTS</h3>
            <p className="card-desc">
              Ultra-durable, textured multi-layer screenprints that will never crack, peel, or fade under high temperature.
            </p>
          </div>
        </div>

        {/* Step 2 Bridge Teaser */}
        <div className="step2-bridge-banner">
          <div className="bridge-content">
            <div className="bridge-pill">
              <Sparkles size={14} />
              <span>STEP 1 FOUNDATION COMPLETE</span>
            </div>
            <h4 className="bridge-title">Ready for Step 2 Product Catalog & Detail Zoom Sequences</h4>
            <p className="bridge-subtitle">
              The scroll-pinned hero and GSAP transition foundation is primed. Step 2 will expand into interactive garment color switching, multi-view 3D rotations, and dynamic checkout integration.
            </p>
          </div>
          <a href="#shop" className="bridge-action-btn">
            BACK TO HERO <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
