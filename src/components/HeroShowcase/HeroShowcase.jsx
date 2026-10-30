import React, { useEffect, useRef } from 'react';
import './HeroShowcase.css';

/* =====================================================================
   MACHII MENS MART — REAL PRODUCT CATALOG (EXACTLY 6 PRODUCTS)
   ===================================================================== */
const PRODUCTS = [
  {
    id: "garment-featured-attitude",
    name: "Attitude 01 Oversized Tee",
    subName: "Signature Heavyweight Drop-Cut",
    type: "tee",
    fit: "Signature Boxy Drop-Shoulder",
    tag: "FLAGSHIP",
    isNew: true,
    price: "₹1,499",
    originalPrice: "₹2,499",
    desc: "280 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.",
    description: "280 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut with high-density distressed screenprint.",
    gsm: "280 GSM Heavy Combed Cotton",
    printText: "Cyber Neo-Attitude High-Density Print",
    badge: "FLAGSHIP // BESTSELLER",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
      {
        id: "c-cobalt",
        name: "Electric Cobalt",
        hex: "#1D4ED8",
        image: "/assets/products/machii-cyber-cobalt.png",
        front: "/assets/products/machii-cyber-cobalt.png",
        backImage: "/assets/products/machii-cyber-cobalt-back.png",
        back: "/assets/products/machii-cyber-cobalt-back.png",
      },
      {
        id: "c-bone",
        name: "Bone Off-White",
        hex: "#F0EBE1",
        image: "/assets/products/machii-tokyo-bone.png",
        front: "/assets/products/machii-tokyo-bone.png",
        backImage: "/assets/products/machii-tokyo-bone-back.png",
        back: "/assets/products/machii-tokyo-bone-back.png",
      },
    ],
  },
  {
    id: "garment-cobalt",
    name: "Midnight Cyber Acid Tee",
    subName: "Vibrant Oversized Street Cut",
    type: "tee",
    fit: "Boxy Drop-Cut",
    tag: "NEW DROP",
    isNew: true,
    price: "₹1,499",
    originalPrice: "₹2,299",
    desc: "Electric royal cobalt streetwear tee featuring high-density cyberpunk neon accents.",
    description: "Electric royal cobalt streetwear drop-cut tee with luminescent cyberpunk screenprint accents and heavy-gauge ribbed collar.",
    gsm: "280 GSM Heavy Combed Cotton",
    printText: "Cyber-Glitch Fluorescent Print",
    badge: "NEW ARRIVAL",
    sizes: ["M", "L", "XL", "XXL"],
    colors: [
      {
        id: "c-cobalt",
        name: "Electric Cobalt",
        hex: "#1D4ED8",
        image: "/assets/products/machii-cyber-cobalt.png",
        front: "/assets/products/machii-cyber-cobalt.png",
        backImage: "/assets/products/machii-cyber-cobalt-back.png",
        back: "/assets/products/machii-cyber-cobalt-back.png",
      },
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
    ],
  },
  {
    id: "garment-bone",
    name: "Tokyo Energy Street Tee",
    subName: "Vintage Distressed Box Cut",
    type: "tee",
    fit: "Relaxed Drop Collar",
    tag: "POPULAR",
    price: "₹1,399",
    originalPrice: "₹1,999",
    desc: "Vintage-washed bone off-white combed cotton with distressed Japanese neo-typography.",
    description: "Vintage-washed bone off-white combed cotton tee featuring neo-brutalist distressed Japanese street typography and drop collar.",
    gsm: "260 GSM Combed Cotton",
    printText: "Vintage Matte Typography",
    badge: "POPULAR",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      {
        id: "c-bone",
        name: "Bone Off-White",
        hex: "#F0EBE1",
        image: "/assets/products/machii-tokyo-bone.png",
        front: "/assets/products/machii-tokyo-bone.png",
        backImage: "/assets/products/machii-tokyo-bone-back.png",
        back: "/assets/products/machii-tokyo-bone-back.png",
      },
      {
        id: "c-cream",
        name: "Vintage Cream",
        hex: "#F5EFE3",
        image: "/assets/products/machii-retro-cream.png",
        front: "/assets/products/machii-retro-cream.png",
        backImage: "/assets/products/machii-retro-cream-back.png",
        back: "/assets/products/machii-retro-cream-back.png",
      },
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
    ],
  },
  {
    id: "garment-hoodie",
    name: "Mineral Slate Boxy Hoodie",
    subName: "Heavyweight Boxy Fleece",
    type: "hoodie",
    fit: "Heavy Boxy Fleece",
    tag: "420 GSM",
    price: "₹2,799",
    originalPrice: "₹3,999",
    desc: "Custom 420 GSM mineral-wash fleece with relaxed boxy shoulders and kangaroo pouch.",
    description: "Custom 420 GSM mineral-wash fleece with relaxed boxy drop-shoulders, wide kangaroo pocket, and subtle distressed puff print.",
    gsm: "420 GSM French Terry",
    printText: "Subtle Distressed Puff Print",
    badge: "420 GSM HEAVY",
    sizes: ["M", "L", "XL"],
    colors: [
      {
        id: "c-slate",
        name: "Mineral Slate",
        hex: "#585961",
        image: "/assets/products/machii-attitude-hoodie.png",
        front: "/assets/products/machii-attitude-hoodie.png",
        backImage: "/assets/products/machii-attitude-hoodie-back.png",
        back: "/assets/products/machii-attitude-hoodie-back.png",
      },
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
    ],
  },
  {
    id: "garment-sage",
    name: "Drop 01 Vintage Sage Tee",
    subName: "Washed Earth Tone Tee",
    type: "tee",
    fit: "Regular Heavy Fit",
    tag: "LIMITED RUN",
    price: "₹1,399",
    originalPrice: "₹1,999",
    desc: "260 GSM combed cotton in an earthy washed sage olive tone with distressed print.",
    description: "Earthy washed sage olive cotton tee with matte cream distressed screenprint and tailored drop collar.",
    gsm: "260 GSM Combed Cotton",
    printText: "Distressed Screenprint",
    badge: "LIMITED RUN",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      {
        id: "c-sage",
        name: "Washed Sage",
        hex: "#636954",
        image: "/assets/products/machii-drop01-sage.png",
        front: "/assets/products/machii-drop01-sage.png",
        backImage: "/assets/products/machii-drop01-sage-back.png",
        back: "/assets/products/machii-drop01-sage-back.png",
      },
      {
        id: "c-bone",
        name: "Bone Off-White",
        hex: "#F0EBE1",
        image: "/assets/products/machii-tokyo-bone.png",
        front: "/assets/products/machii-tokyo-bone.png",
        backImage: "/assets/products/machii-tokyo-bone-back.png",
        back: "/assets/products/machii-tokyo-bone-back.png",
      },
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
    ],
  },
  {
    id: "garment-cream",
    name: "Street Culture Retro Tee",
    subName: "Warm Vintage Brutalist Tee",
    type: "tee",
    fit: "Oversized Boxy Fit",
    tag: "-20%",
    price: "₹1,399",
    originalPrice: "₹1,999",
    desc: "Warm vintage cream cotton with brutalist street typography and dropped armholes.",
    description: "Warm vintage cream combed cotton tee with high-density brutalist streetwear screenprint and dropped armholes.",
    gsm: "260 GSM Combed Cotton",
    printText: "Street Culture Screenprint",
    badge: "POPULAR",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      {
        id: "c-cream",
        name: "Vintage Cream",
        hex: "#F5EFE3",
        image: "/assets/products/machii-retro-cream.png",
        front: "/assets/products/machii-retro-cream.png",
        backImage: "/assets/products/machii-retro-cream-back.png",
        back: "/assets/products/machii-retro-cream-back.png",
      },
      {
        id: "c-charcoal",
        name: "Washed Charcoal",
        hex: "#26262A",
        image: "/assets/products/machii-attitude-01-charcoal.png",
        front: "/assets/products/machii-attitude-01-charcoal.png",
        backImage: "/assets/products/machii-attitude-01-back.png",
        back: "/assets/products/machii-attitude-01-back.png",
      },
    ],
  },
];

// Initialize selected colorway index
PRODUCTS.forEach((p) => {
  p.ci = 0;
});

function view(p) {
  const v = p.colors[p.ci];
  const src = v.front || v.image;
  return `<img src="${src}" alt="${p.name} – ${v.name}" class="garment-img" draggable="false" loading="eager" decoding="async" />`;
}

/* =====================================================================
   HERO SHOWCASE REACT COMPONENT
   ===================================================================== */
export default function HeroShowcase({ onSelectProduct }) {
  const heroRef = useRef(null);
  const stageRef = useRef(null);
  const metaRef = useRef(null);
  const mNameRef = useRef(null);
  const mDescRef = useRef(null);
  const mPreviewBtnRef = useRef(null);
  const mShopBtnRef = useRef(null);
  const dotsRef = useRef(null);
  const rackPrevRef = useRef(null);
  const rackNextRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    const meta = metaRef.current;
    const mName = mNameRef.current;
    const mDesc = mDescRef.current;
    const mPreviewBtn = mPreviewBtnRef.current;
    const mShopBtn = mShopBtnRef.current;
    const dots = dotsRef.current;
    const rackPrev = rackPrevRef.current;
    const rackNext = rackNextRef.current;

    if (!hero || !stage) return;

    // EXACTLY 6 DISTINCT PRODUCTS
    const P = PRODUCTS.length;
    const N = P;
    const prod = (i) => PRODUCTS[((i % P) + P) % P];

    let active = 0;

    // Helper: Opens interactive product preview modal with exact selected garment data
    const openPreviewForProduct = (prodObj) => {
      if (onSelectProduct) {
        onSelectProduct({
          id: prodObj.id,
          name: prodObj.name,
          subName: prodObj.subName,
          price: prodObj.price,
          originalPrice: prodObj.originalPrice,
          description: prodObj.description,
          image: prodObj.colors[prodObj.ci]?.front || prodObj.colors[0]?.front,
          backImage: prodObj.colors[prodObj.ci]?.back || prodObj.colors[0]?.back || "/assets/products/machii-attitude-01-back.png",
          badge: prodObj.tag || prodObj.badge,
          gsm: prodObj.gsm,
          fit: prodObj.fit,
          print: prodObj.printText,
          sizes: prodObj.sizes,
          selectedColor: {
            name: prodObj.colors[prodObj.ci].name,
            hex: prodObj.colors[prodObj.ci].hex,
            image: prodObj.colors[prodObj.ci].front || prodObj.colors[prodObj.ci].image,
            front: prodObj.colors[prodObj.ci].front || prodObj.colors[prodObj.ci].image,
            backImage: prodObj.colors[prodObj.ci].back || prodObj.colors[prodObj.ci].backImage || "/assets/products/machii-attitude-01-back.png",
            back: prodObj.colors[prodObj.ci].back || prodObj.colors[prodObj.ci].backImage || "/assets/products/machii-attitude-01-back.png",
          },
          colors: prodObj.colors.map((c) => ({
            id: c.id,
            name: c.name,
            hex: c.hex,
            image: c.front || c.image,
            front: c.front || c.image,
            backImage: c.back || c.backImage || "/assets/products/machii-attitude-01-back.png",
            back: c.back || c.backImage || "/assets/products/machii-attitude-01-back.png",
          })),
        });
      }
    };

    // Clear dynamic children
    stage.innerHTML = '';
    dots.innerHTML = '';

    // Build the 6 rack items
    const items = PRODUCTS.map((p, i) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `View ${p.name}`);

      // Stagger drop delays: center drops first (0.12s), then flanking garments
      let o = i - active;
      while (o > N / 2) o -= N;
      while (o < -N / 2) o += N;
      const dist = Math.abs(o);
      const dropDelay = (dist * 0.14 + 0.12).toFixed(2);
      const swingDelay = (parseFloat(dropDelay) + 1.2).toFixed(2);

      el.innerHTML = `
        <div class="item-interactive-sway">
          <div class="hanger-fixture" style="--drop-delay: ${dropDelay}s">
            <svg class="hanger-svg" viewBox="0 0 120 48" aria-hidden="true">
              <path d="M60 2 C53 2 48 7 48 14 C48 20 54 24 60 24 L60 30" fill="none" stroke="#9a9a9a" stroke-width="3" stroke-linecap="round"/>
              <path d="M60 30 L12 46 Q8 48 14 48 L106 48 Q112 48 108 46 Z" fill="#4a3728" stroke="#36281d" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="garment-drop-wrap" style="--drop-delay: ${dropDelay}s">
            <div class="swing" style="--swing-delay: ${swingDelay}s">
              ${view(p)}
              ${p.tag ? `<span class="tag ${p.isNew ? 'new' : ''}">${p.tag}</span>` : ''}
            </div>
          </div>
        </div>
      `;

      // Clicking a garment:
      // If clicking the active (center) garment: open product viewer
      // If clicking any side garment: swipe rack to center it
      const handleClick = () => {
        if (i === active) {
          openPreviewForProduct(p);
        } else {
          go(i);
        }
      };

      el.addEventListener('click', handleClick);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });

      stage.appendChild(el);
      return el;
    });

    // Build 6 navigation dots
    PRODUCTS.forEach((_, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Go to product ' + (i + 1));
      b.onclick = () => go(i);
      dots.appendChild(b);
    });

    const setVars = (el, v) => {
      for (const k in v) {
        el.style.setProperty('--' + k, v[k]);
      }
    };

    function layout() {
      const mobile = window.innerWidth < 720;
      // Broad width so garments look oversized, natural, and never squashed/slim
      const W = mobile ? 200 : Math.min(290, window.innerWidth * 0.23);
      const FIRST = W * 0.88; // gap from center garment to first side garment
      const STEP = W * 0.52; // gap between flanking garments

      items.forEach((el, i) => {
        let o = i - active;
        while (o > N / 2) o -= N;
        while (o < -N / 2) o += N;
        const a = Math.abs(o);
        const sgn = Math.sign(o);

        setVars(el, { w: W + 'px' });

        if (a === 0) {
          // Center active garment: Proud oversized cut facing front
          setVars(el, {
            x: '0px',
            z: '80px',
            ry: '0deg',
            s: 1.15,
            o: 1,
            sat: 1,
            br: 1,
          });
        } else if (a === 1) {
          // Immediate flanking garments (both left & right side FACING LEFT!)
          setVars(el, {
            x: sgn * FIRST + 'px',
            z: '20px',
            ry: '-22deg', // Facing towards the LEFT side, broad uncompressed silhouette!
            s: 0.96,
            o: 0.95,
            sat: 0.95,
            br: 0.98,
          });
        } else if (a === 2) {
          // Outer flanking garments (both left & right side FACING LEFT!)
          setVars(el, {
            x: sgn * (FIRST + STEP) + 'px',
            z: '-35px',
            ry: '-25deg', // Facing towards the LEFT side!
            s: 0.88,
            o: 0.82,
            sat: 0.88,
            br: 0.94,
          });
        } else {
          // 6th garment in opposite background queue
          setVars(el, {
            x: sgn * (FIRST + 2 * STEP) + 'px',
            z: '-100px',
            ry: '-28deg', // Facing towards the LEFT side!
            s: 0.78,
            o: 0,
            sat: 0.75,
            br: 0.85,
          });
        }

        el.classList.toggle('active', a === 0);
        el.setAttribute(
          'title',
          a === 0
            ? `Click to preview ${PRODUCTS[i].name}`
            : `Click to center ${PRODUCTS[i].name}`
        );
        el.style.zIndex = String(20 - a);
      });

      [...dots.children].forEach((b, i) => {
        b.classList.remove('on');
        if (i === (((active % P) + P) % P)) {
          void b.offsetWidth;
          b.classList.add('on');
        }
      });
    }

    function caption() {
      meta.classList.add('out');
      setTimeout(() => {
        const p = prod(active);
        if (mName) mName.textContent = p.name;
        if (mDesc) mDesc.textContent = p.desc;
        meta.classList.remove('out');
      }, 300);
    }

    function go(i) {
      active = (((i % N) + N) % N);
      layout();
      caption();
    }

    const next = () => go(active + 1);
    const prev = () => go(active - 1);

    // Wire rack navigation buttons
    if (rackPrev) rackPrev.onclick = prev;
    if (rackNext) rackNext.onclick = next;

    // Kinetic mouse parallax and scroll physics
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    let currentScrollSway = 0;
    let isHoveringHero = false;
    let physicsRafId = null;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    // Cache hero layout geometry to eliminate forced reflows during 60fps cursor & physics updates
    let cachedHeroRect = null;
    let cachedHeroHeight = window.innerHeight;
    const updateHeroGeometry = () => {
      if (hero) {
        cachedHeroRect = hero.getBoundingClientRect();
        cachedHeroHeight = cachedHeroRect.height || window.innerHeight;
      }
    };
    updateHeroGeometry();

    const handleHeroPointerEnter = () => {
      updateHeroGeometry();
      isHoveringHero = true;
    };

    const handleHeroPointerMove = (e) => {
      if (prefersReduced) return;
      if (!cachedHeroRect) updateHeroGeometry();
      const rect = cachedHeroRect;
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 to 1
      targetMouseX = Math.max(-1, Math.min(1, x));
      targetMouseY = Math.max(-1, Math.min(1, y));
      isHoveringHero = true;
    };

    const handleHeroPointerLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
      isHoveringHero = false;
    };

    const handleScroll = () => {
      if (prefersReduced) return;
      const currentY = window.scrollY;
      const dy = currentY - lastScrollY;
      lastScrollY = currentY;
      scrollVelocity = Math.max(-15, Math.min(15, dy * 0.12));
    };

    const updatePhysics = () => {
      // Damped spring interpolation for organic clothes rail physics
      const mouseDamping = isHoveringHero ? 0.08 : 0.05;
      currentMouseX += (targetMouseX - currentMouseX) * mouseDamping;
      currentMouseY += (targetMouseY - currentMouseY) * mouseDamping;

      // Scroll inertia decay
      currentScrollSway += (scrollVelocity - currentScrollSway) * 0.1;
      scrollVelocity *= 0.88;

      // Pure numeric scroll progression through hero section without expensive DOM queries
      const heroHeight = cachedHeroHeight || window.innerHeight;
      const scrollProgress = Math.max(0, Math.min(1, window.scrollY / (heroHeight * 0.85)));

      if (!prefersReduced && items && items.length > 0) {
        items.forEach((el, i) => {
          const swayWrap = el.querySelector('.item-interactive-sway');
          if (!swayWrap) return;

          let o = i - active;
          while (o > N / 2) o -= N;
          while (o < -N / 2) o += N;
          const a = Math.abs(o);
          const sgn = Math.sign(o);

          // Center garment has strongest reaction; outer garments attenuate by depth
          const depthMultiplier = a === 0 ? 1.0 : Math.max(0.35, 1 - a * 0.22);

          // Multi-layered scroll-driven garment movement matching the reference
          const scrollDispersalX = sgn * (scrollProgress * (a === 1 ? 48 : 95));
          const scrollDropY = scrollProgress * (a === 0 ? -12 : 18);
          const scrollTiltRz = sgn * (scrollProgress * (a === 1 ? 3.5 : 7.0));

          const swayTx = (currentMouseX * 12 * depthMultiplier + scrollDispersalX).toFixed(2);
          const swayTy = (currentMouseY * 5 * depthMultiplier + currentScrollSway * 1.5 + scrollDropY).toFixed(2);
          const swayRy = (currentMouseX * 6 * depthMultiplier).toFixed(2);
          const swayRz = (currentMouseX * 2.5 * depthMultiplier + currentScrollSway * 0.4 + scrollTiltRz).toFixed(2);

          swayWrap.style.setProperty('--sway-tx', `${swayTx}px`);
          swayWrap.style.setProperty('--sway-ty', `${swayTy}px`);
          swayWrap.style.setProperty('--sway-ry', `${swayRy}deg`);
          swayWrap.style.setProperty('--sway-rz', `${swayRz}deg`);
        });
      }

      physicsRafId = requestAnimationFrame(updatePhysics);
    };

    hero.addEventListener('pointerenter', handleHeroPointerEnter);
    hero.addEventListener('pointermove', handleHeroPointerMove, { passive: true });
    hero.addEventListener('pointerleave', handleHeroPointerLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });
    physicsRafId = requestAnimationFrame(updatePhysics);

    // Hover pause behavior
    const handleStageEnter = () => hero.classList.add('paused');
    const handleStageLeave = () => hero.classList.remove('paused');
    stage.addEventListener('mouseenter', handleStageEnter);
    stage.addEventListener('mouseleave', handleStageLeave);

    // Pointer swipe interaction
    let sx = null;
    const handlePointerDown = (e) => {
      sx = e.clientX;
    };
    const handlePointerUp = (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) {
        if (dx < 0) next();
        else prev();
      }
    };
    stage.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // Horizontal trackpad and mouse wheel swipe on rack
    let wheelCooldown = false;
    const handleStageWheel = (e) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : Math.abs(e.deltaY) > 35 && window.scrollY < 60
          ? e.deltaY
          : 0;

      if (Math.abs(delta) > 20 && !wheelCooldown) {
        wheelCooldown = true;
        if (delta > 0) next();
        else prev();
        setTimeout(() => {
          wheelCooldown = false;
        }, 360);
      }
    };
    stage.addEventListener('wheel', handleStageWheel, { passive: true });

    // Live colorway sync: updates rack garment image when customer picks a color variant in viewer
    const handleGarmentColorChange = (e) => {
      const { productId, color } = e.detail || {};
      if (!productId || !color) return;
      const prodIndex = PRODUCTS.findIndex((p) => p.id === productId);
      if (prodIndex > -1) {
        const colorIdx = PRODUCTS[prodIndex].colors.findIndex((c) => c.name === color.name);
        if (colorIdx > -1) {
          PRODUCTS[prodIndex].ci = colorIdx;
          const targetItem = items[prodIndex];
          if (targetItem) {
            const imgEl = targetItem.querySelector('.garment-img');
            if (imgEl) {
              imgEl.src = color.front || color.image;
              imgEl.alt = `${PRODUCTS[prodIndex].name} – ${color.name}`;
            }
          }
        }
      }
    };
    window.addEventListener('machii:garment-color-change', handleGarmentColorChange);

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Enter') openPreviewForProduct(prod(active));
    };
    window.addEventListener('keydown', handleKeyDown);

    // Handle "Preview Style" CTA click
    const handlePreviewClick = () => {
      openPreviewForProduct(prod(active));
    };
    if (mPreviewBtn) mPreviewBtn.addEventListener('click', handlePreviewClick);

    // Handle "Explore The Drop" CTA click
    const handleShopClick = () => {
      const collectionSection =
        document.getElementById('collection-drop') ||
        document.getElementById('collection') ||
        document.querySelector('.collection-section');
      if (collectionSection) {
        if (window.lenis) {
          window.lenis.scrollTo(collectionSection, { offset: -70 });
        } else {
          collectionSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    if (mShopBtn) mShopBtn.addEventListener('click', handleShopClick);

    // Responsive resize handler
    const handleResize = () => {
      updateHeroGeometry();
      layout();
    };
    window.addEventListener('resize', handleResize);

    // Initial entrance setup
    layout();
    active = 0;
    if (mName) mName.textContent = prod(0).name;
    if (mDesc) mDesc.textContent = prod(0).desc;

    // Cleanup listeners on unmount
    return () => {
      hero.removeEventListener('pointerenter', handleHeroPointerEnter);
      hero.removeEventListener('pointermove', handleHeroPointerMove);
      hero.removeEventListener('pointerleave', handleHeroPointerLeave);
      window.removeEventListener('scroll', handleScroll);
      if (physicsRafId) cancelAnimationFrame(physicsRafId);

      stage.removeEventListener('mouseenter', handleStageEnter);
      stage.removeEventListener('mouseleave', handleStageLeave);
      stage.removeEventListener('pointerdown', handlePointerDown);
      stage.removeEventListener('wheel', handleStageWheel);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('machii:garment-color-change', handleGarmentColorChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (mPreviewBtn) mPreviewBtn.removeEventListener('click', handlePreviewClick);
      if (mShopBtn) mShopBtn.removeEventListener('click', handleShopClick);
    };
  }, [onSelectProduct]);

  return (
    <section className="hero" id="product-showcase" data-id="hero" ref={heroRef}>
      <span id="hero" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      {/* Top Editorial Eyebrow */}
      <div className="eyebrow">
        <b>WEAR YOUR ATTITUDE</b>
        <i />
        <span>MACHII SS26 OVERSIZED STREETWEAR</span>
      </div>

      {/* 3D Hanging Clothes Rack */}
      <div className="rack" id="rack">
        <div className="rail" />
        <div className="stage" id="stage" ref={stageRef} />

        {/* Floating Rack Swipe Navigation Arrows */}
        <button className="rack-nav prev" id="rackPrev" ref={rackPrevRef} aria-label="Previous Garment">
          ←
        </button>
        <button className="rack-nav next" id="rackNext" ref={rackNextRef} aria-label="Next Garment">
          →
        </button>

        <div className="meta" id="meta" ref={metaRef}>
          <h2 id="mName" ref={mNameRef} />
          <p id="mDesc" ref={mDescRef} />
          <div className="meta-btn-row">
            <button className="btn preview-style-btn" type="button" ref={mPreviewBtnRef}>
              Preview T-Shirt
            </button>
            <button className="btn explore-drop-btn" type="button" ref={mShopBtnRef}>
              Explore The Drop
            </button>
          </div>
          <div className="dots" id="dots" ref={dotsRef} />
        </div>
      </div>
    </section>
  );
}
