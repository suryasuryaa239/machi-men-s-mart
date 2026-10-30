import React, { useRef, useLayoutEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Check, Sparkles, ShieldCheck } from 'lucide-react';
import ProductGarment from '../ProductGarment/ProductGarment';
import { PRODUCTS } from '../../data/products';
import './PinnedShowcase.css';

gsap.registerPlugin(ScrollTrigger);

export default function PinnedShowcase() {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const railRef = useRef(null);
  const stageRef = useRef(null);

  // Garment refs
  const left2Ref = useRef(null);
  const left1Ref = useRef(null);
  const centerRef = useRef(null);
  const right1Ref = useRef(null);
  const right2Ref = useRef(null);

  // Phase C Reveal Elements
  const watermarkRef = useRef(null);
  const revealCardRef = useRef(null);
  const revealTitleRef = useRef(null);
  const revealPriceRef = useRef(null);
  const revealDescRef = useRef(null);
  const revealBtnRef = useRef(null);
  const revealMetaRef = useRef(null);

  // State
  const [selectedSize, setSelectedSize] = useState('L');
  const [isAdded, setIsAdded] = useState(false);

  // Garment catalog data
  const garmentLeft2 = PRODUCTS[0]; // Mineral Slate Hoodie
  const garmentLeft1 = PRODUCTS[1]; // Tokyo Energy Bone Tee
  const featuredGarment = PRODUCTS[2]; // Attitude 01 Charcoal Tee (Center)
  const garmentRight1 = PRODUCTS[3]; // Cyber Acid Cobalt Tee
  const garmentRight2 = PRODUCTS[4]; // Drop 01 Sage Tee

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        // Fallback for reduced motion preference: Static accessible presentation
        gsap.set(revealCardRef.current, { opacity: 1, y: 0, pointerEvents: 'auto' });
        return;
      }

      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

      // Coordinate distances based on viewport
      const outwardLeftDist = isMobile ? -300 : isTablet ? -480 : -620;
      const outwardRightDist = isMobile ? 300 : isTablet ? 480 : 620;
      const targetCenterScale = isMobile ? 1.25 : 1.42;
      const targetCenterY = isMobile ? 8 : 18;

      /* ====================================================================
         COORDINATED SCROLLTRIGGER TIMELINE
         PHASE A: Enters trigger -> Horizontal rack lineup visible
         PHASE B: Featured garment zooms & centers; surrounding garments glide out & fade
         PHASE C: Product details reveal with subtle opacity & vertical movement
         PHASE D: Smooth settle & seamless unpinning release
         ==================================================================== */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=220%',
          pin: viewportRef.current,
          scrub: 1.1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Initial state setup inside timeline context
      gsap.set(revealCardRef.current, { opacity: 0, y: 35, pointerEvents: 'none' });
      gsap.set(watermarkRef.current, { opacity: 0, scale: 0.94 });

      // PHASE B: Featured Garment Focus & Surrounding Garments Dispersal (0% -> 55%)
      tl.to(
        [left1Ref.current, left2Ref.current],
        {
          x: outwardLeftDist,
          opacity: 0,
          scale: 0.65,
          ease: 'power2.out',
          duration: 0.5,
          stagger: 0.04,
        },
        0.05
      );

      tl.to(
        [right1Ref.current, right2Ref.current],
        {
          x: outwardRightDist,
          opacity: 0,
          scale: 0.65,
          ease: 'power2.out',
          duration: 0.5,
          stagger: 0.04,
        },
        0.05
      );

      // Featured Center Garment Scale Up & Eye-Level Centering
      tl.to(
        centerRef.current,
        {
          scale: targetCenterScale,
          y: targetCenterY,
          ease: 'power2.inOut',
          duration: 0.6,
        },
        0.05
      );

      // Clothing rail subtly fades to keep focus on garment
      tl.to(
        railRef.current,
        {
          opacity: 0.2,
          ease: 'power1.out',
          duration: 0.4,
        },
        0.1
      );

      // Giant watermark "MACHII" faintly emerges behind the garment
      tl.to(
        watermarkRef.current,
        {
          opacity: 0.05,
          scale: 1.05,
          ease: 'power1.out',
          duration: 0.45,
        },
        0.2
      );

      // PHASE C: Product Detail Reveal (45% -> 85%)
      tl.to(
        revealCardRef.current,
        {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          ease: 'power2.out',
          duration: 0.4,
        },
        0.42
      );

      // PHASE D: Transition Settle (85% -> 100%)
      // Maintains solid locked state before releasing smoothly into the next section
      tl.to({}, { duration: 0.25 });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleShopStyle = () => {
    setIsAdded(true);
    window.dispatchEvent(
      new CustomEvent('machii:cart-update', {
        detail: {
          product: featuredGarment,
          color: featuredGarment.colors?.[0]?.name || 'Washed Charcoal',
          colorHex: featuredGarment.colors?.[0]?.hex || '#26262A',
          size: selectedSize,
          quantity: 1,
          image: featuredGarment.image,
        },
      })
    );
    setTimeout(() => setIsAdded(false), 2200);
  };

  return (
    <section ref={sectionRef} className="pinned-showcase-section" id="product-showcase">
      {/* Pinned Viewport Container */}
      <div ref={viewportRef} className="showcase-viewport">
        {/* Giant Subtle Background Watermark */}
        <div ref={watermarkRef} className="showcase-watermark" aria-hidden="true">
          <span>MACHII</span>
        </div>

        {/* Studio Overhead Spotlight */}
        <div className="showcase-ambient-light" aria-hidden="true"></div>

        {/* Top Metallic Clothing Rail */}
        <div ref={railRef} className="showcase-clothes-rail" aria-hidden="true">
          <div className="rail-rod-line"></div>
          <div className="rail-support-bracket bracket-left"></div>
          <div className="rail-support-bracket bracket-right"></div>
        </div>

        {/* Showcase Header Label (Phase A context) */}
        <div className="showcase-subtle-badge">
          <Sparkles size={13} className="badge-sparkle" />
          <span className="mono-label">CURATED DROP 01 // OVERSIZED FIT SERIES</span>
        </div>

        {/* PHASE A & B: Horizontal Garment Stage */}
        <div ref={stageRef} className="showcase-garment-stage" aria-label="Garment Showcase Rack">
          {/* Garment 1: Left-2 (Mineral Slate Hoodie) */}
          <ProductGarment
            ref={left2Ref}
            product={garmentLeft2}
            isFeatured={false}
            className="showcase-garment garment-pos-l2"
          />

          {/* Garment 2: Left-1 (Tokyo Energy Bone Tee) */}
          <ProductGarment
            ref={left1Ref}
            product={garmentLeft1}
            isFeatured={false}
            className="showcase-garment garment-pos-l1"
          />

          {/* Garment 3: Center (ATTITUDE 01 Charcoal Tee - FEATURED) */}
          <ProductGarment
            ref={centerRef}
            product={featuredGarment}
            isFeatured={true}
            className="showcase-garment garment-pos-center"
          />

          {/* Garment 4: Right-1 (Cyber Acid Cobalt Tee) */}
          <ProductGarment
            ref={right1Ref}
            product={garmentRight1}
            isFeatured={false}
            className="showcase-garment garment-pos-r1"
          />

          {/* Garment 5: Right-2 (Drop 01 Sage Tee) */}
          <ProductGarment
            ref={right2Ref}
            product={garmentRight2}
            isFeatured={false}
            className="showcase-garment garment-pos-r2"
          />
        </div>

        {/* PHASE C: Product Detail Reveal Block */}
        <div ref={revealCardRef} className="showcase-product-reveal" id="product-detail-card">
          <div className="reveal-content-container">
            {/* Top metadata tag */}
            <div ref={revealMetaRef} className="reveal-meta-row">
              <span className="mono-label">SIGNATURE DROP // 01</span>
              <span className="reveal-pill">280 GSM HEAVYWEIGHT</span>
            </div>

            {/* Product Title */}
            <h2 ref={revealTitleRef} className="reveal-product-title">
              {featuredGarment.name}
            </h2>

            {/* Price Placeholder */}
            <div ref={revealPriceRef} className="reveal-price-row">
              <span className="reveal-current-price">{featuredGarment.price}</span>
              <span className="reveal-original-price">{featuredGarment.originalPrice}</span>
              <span className="reveal-savings-tag">LIMITED LAUNCH DROP</span>
            </div>

            {/* Short Description */}
            <p ref={revealDescRef} className="reveal-product-desc">
              {featuredGarment.description}
            </p>

            {/* Size Selector */}
            <div className="reveal-size-selector" role="radiogroup" aria-label="Available Sizes">
              <span className="size-selector-label">SIZE:</span>
              <div className="size-chips-wrap">
                {['S', 'M', 'L', 'XL', 'XXL'].map((size) => (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={selectedSize === size}
                    className={`size-chip ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Shop This Style CTA Button */}
            <div className="reveal-cta-wrap">
              <button
                ref={revealBtnRef}
                className={`shop-style-btn ${isAdded ? 'success' : ''}`}
                onClick={handleShopStyle}
                type="button"
                id="shop-this-style-btn"
              >
                {isAdded ? (
                  <>
                    <Check size={18} />
                    <span>STYLE SELECTED</span>
                  </>
                ) : (
                  <>
                    <span>SHOP THIS STYLE</span>
                    <ArrowRight size={18} className="shop-arrow" />
                  </>
                )}
              </button>
            </div>

            {/* Guarantee footnote */}
            <div className="reveal-footnote">
              <ShieldCheck size={14} className="shield-icon" />
              <span>Free Pan-India Delivery • Easy 7-Day Fit Exchange</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
