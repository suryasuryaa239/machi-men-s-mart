import React, { useEffect, useRef, useState } from 'react';
import { getStoredHeroProducts, fetchHeroProducts } from '../../utils/heroService';
import './HeroShowcase.css';

const TICKER = ['GEN Z DROP-SHOULDER CUT', 'NEW DROP', '240 GSM HEAVYWEIGHT COTTON', 'LIMITED PIECES'];

function view(p, back = false, ci = p.ci || 0) {
  const v = p.colors && p.colors[ci] ? p.colors[ci] : null;
  let src = '';
  if (back) {
    src = v?.back || p.back || p.backImage || v?.front || p.front || p.image;
  } else {
    src = v?.front || p.front || p.image || v?.back || p.back;
  }
  return `<img src="${src}" alt="${p.name} - ${v?.name || 'view'}" draggable="false" />`;
}

const capHTML = (p) => `<b>${p.name}</b><span>${p.desc || p.description || ''}</span>`;

export default function HeroShowcase({ onSelectProduct }) {
  const [heroProducts, setHeroProducts] = useState(() => getStoredHeroProducts());

  const heroRef = useRef(null);
  const rackRef = useRef(null);
  const stageRef = useRef(null);
  const railRef = useRef(null);
  const tagsRef = useRef(null);
  const capRef = useRef(null);
  const ttlRef = useRef(null);
  const segRef = useRef(null);
  const tickerTrackRef = useRef(null);

  // Sync with server API and listen for dynamic admin changes
  useEffect(() => {
    fetchHeroProducts().then((res) => {
      if (res && res.success && Array.isArray(res.products) && res.products.length > 0) {
        setHeroProducts(res.products);
      }
    });

    const handleUpdate = (e) => {
      if (e.detail?.products && Array.isArray(e.detail.products) && e.detail.products.length > 0) {
        setHeroProducts(e.detail.products);
      }
    };
    window.addEventListener('machii:hero-products-updated', handleUpdate);
    return () => {
      window.removeEventListener('machii:hero-products-updated', handleUpdate);
    };
  }, []);

  // Main 3D clothes rail interaction loop
  useEffect(() => {
    const hero = heroRef.current;
    const rack = rackRef.current;
    const stage = stageRef.current;
    const railEl = railRef.current;
    const tagsEl = tagsRef.current;
    const capEl = capRef.current;
    const ttlEl = ttlRef.current;
    const segEl = segRef.current;

    if (!hero || !rack || !stage || !railEl || !tagsEl) return;

    // Use current dynamic heroProducts
    const PRODUCTS = heroProducts.map((p) => ({ ...p, ci: 0 }));
    const P = PRODUCTS.length;
    if (P === 0) return;

    let sel = -1;
    let zoom = false;
    let cursor = null;
    let M = null;
    let pointerRafId = null;
    let cachedRackRect = null;
    let nearItemIndex = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalGesture = null;
    let isTouchDrag = false;

    // Build signature green ticker track
    if (tickerTrackRef.current) {
      tickerTrackRef.current.innerHTML = TICKER.map((t) => `<span>${t}</span><span>•</span>`).join('').repeat(6);
    }

    const setV = (el, v) => {
      for (const k in v) {
        el.style.setProperty('--' + k, v[k]);
      }
    };

    const paint = (i) => {
      const el = stage.children[i];
      const p = PRODUCTS[i];
      if (!el || !p) return;
      const faceF = el.querySelector('.face.f .l-base');
      const faceB = el.querySelector('.face.b .l-base');
      if (faceF) faceF.innerHTML = view(p, false);
      if (faceB) faceB.innerHTML = view(p, true);
    };

    // Mount all dynamic items on the 3D rail (supports any item count)
    stage.innerHTML = '';
    const items = PRODUCTS.map((p, i) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.style.setProperty('--d', (0.08 + i * 0.04) + 's');
      el.innerHTML = `
        <div class="in">
          <div class="hang">
            <div class="flip">
              <div class="face f"><div class="l-base"></div><div class="l-over"></div></div>
              <div class="face b"><div class="l-base"></div><div class="l-over"></div></div>
            </div>
          </div>
          ${p.label ? `<span class="label">${p.label}</span>` : ''}
        </div>
      `;

      el.addEventListener('click', () => {
        if (isTouchDrag) return;
        if (!zoom) openZoom(i);
        else if (i !== sel) choose(i);
      });

      el.addEventListener('mouseenter', () => {
        if (!zoom && capEl) capEl.innerHTML = capHTML(p);
      });

      stage.appendChild(el);
      paint(i);
      return el;
    });

    if (capEl && PRODUCTS[0]) capEl.innerHTML = capHTML(PRODUCTS[0]);

    const updateCachedRect = () => {
      if (rack) {
        cachedRackRect = rack.getBoundingClientRect();
      }
    };
    updateCachedRect();

    // Dynamically computes gap and widths based on screen size so garments look prominent and bold
    function metrics() {
      const vw = rack.clientWidth || window.innerWidth;
      const H = rack.clientHeight || 560;
      const isMobile = vw < 640;
      const isTablet = vw >= 640 && vw < 1024;

      let gap, W;
      if (isMobile) {
        // High-fashion streetwear proportions on mobile (bold, prominent, premium size)
        W = Math.max(185, Math.min(vw * 0.48, 220));
        gap = Math.max(64, Math.min(vw * 0.19, 78));
      } else if (isTablet) {
        W = Math.max(215, Math.min(vw * 0.32, 255));
        gap = Math.min(vw * 0.20, 160);
      } else {
        gap = Math.min(vw * 0.20, 260);
        W = Math.max(240, gap / 0.98);
        const maxGap = (vw * 0.94) / P;
        if (gap > maxGap) {
          gap = maxGap;
        }
      }

      const railY = isMobile ? Math.max(105, Math.min(H * 0.20, 135)) : H * 0.17;
      const hookY = isMobile ? railY - 55 : H * 0.05;
      return { vw, H, W, gap, railY, hookY };
    }

    const iw = (m, i) => m.W * (PRODUCTS[i]?.rel || 1.0);
    const ih = (m, i) => iw(m, i) * (PRODUCTS[i]?.ar || 1.34);
    const zoomOf = (m, i) => Math.max(1.15, Math.min((m.H * 0.58) / ih(m, i), (m.vw * 0.82) / iw(m, i), 3.6));
    const ROT = 72;

    function applyRack() {
      const m = M || metrics();
      let near = -1;
      let nd = 9;

      items.forEach((el, i) => {
        const base = (i - (P - 1) / 2) * m.gap;
        let e = 1;
        if (cursor !== null) {
          const d = Math.abs(cursor - base) / m.gap;
          if (d < nd) {
            nd = d;
            near = i;
          }
          const t = Math.min(d / 1.7, 1);
          e = t * t * (3 - 2 * t);
        }
        setV(el, {
          x: base + 'px',
          y: '0px',
          s: (1 + 0.15 * (1 - e)).toFixed(3),
          ry: (ROT * e).toFixed(1) + 'deg',
          blur: '0px',
          o: 1,
        });
        el.style.zIndex = Math.round(10 * (1 - e));
      });

      if (near >= 0) {
        nearItemIndex = near;
        if (nd < 0.6 && capEl && PRODUCTS[near]) {
          capEl.innerHTML = capHTML(PRODUCTS[near]);
        }
      }
    }

    function layout() {
      const m = (M = metrics());
      railEl.style.top = m.railY + 'px';

      items.forEach((el, i) => {
        el.style.width = iw(m, i) + 'px';
        el.style.marginLeft = -iw(m, i) / 2 + 'px';
        el.style.top = m.railY - 4 + 'px';
        el.classList.toggle('sel', zoom && i === sel);
      });

      if (!zoom) {
        applyRack();
        return;
      }

      if (sel < 0 || !PRODUCTS[sel]) return;
      const Z = zoomOf(m, sel);
      const wz = iw(m, sel) * Z;

      items.forEach((el, i) => {
        const o = i - sel;
        if (o === 0) {
          setV(el, {
            x: '0px',
            y: m.hookY - (m.railY - 4) + 'px',
            s: Z,
            ry: '0deg',
            blur: '0px',
            o: 1,
          });
          el.style.zIndex = 8;
        } else {
          const sg = Math.sign(o);
          setV(el, {
            x: sg * wz * 0.62 + o * wz * 0.42 + 'px',
            y: (m.hookY - m.railY) * 0.45 + 'px',
            s: Z * 0.8,
            ry: '0deg',
            blur: '14px',
            o: 0.38,
          });
          el.style.zIndex = 2;
        }
      });

      const isMobile = m.vw < 640;
      const tagSpacing = isMobile ? 26 : 38;
      const maxRightOffset = isMobile ? m.vw * 0.5 - 32 : wz * 0.5 + 140;
      tagsEl.style.top = m.hookY + wz * 0.55 * (PRODUCTS[sel]?.ar || 1.29) * 0.18 + 'px';

      [...tagsEl.children].forEach((t, k) => {
        const calculatedLeft = isMobile
          ? Math.min(wz * 0.44 + 8 + k * tagSpacing, maxRightOffset - (tagsEl.children.length - 1 - k) * tagSpacing)
          : wz * 0.5 + 20 + k * tagSpacing;
        t.style.left = calculatedLeft + 'px';
        t.style.marginTop = (isMobile ? 18 : 30) + k * (isMobile ? 10 : 12) + 'px';
      });
    }

    // High-performance pointer tracking: directly driven by user mouse / touch
    const updateCursorFromClientX = (clientX) => {
      if (zoom) return;
      if (!cachedRackRect) updateCachedRect();

      if (!pointerRafId) {
        pointerRafId = requestAnimationFrame(() => {
          cursor = clientX - cachedRackRect.left - cachedRackRect.width / 2;
          applyRack();
          pointerRafId = null;
        });
      }
    };

    const handlePointerEnter = () => {
      updateCachedRect();
    };

    const handlePointerMove = (e) => {
      if (zoom) return;
      updateCursorFromClientX(e.clientX);
    };

    const handlePointerDown = (e) => {
      if (zoom) return;
      updateCursorFromClientX(e.clientX);
    };

    const handlePointerLeave = () => {
      if (zoom) return;
      cursor = null;
      applyRack();
    };

    // Touch event handlers for mobile: fluid 1-to-1 scrubbing with finger
    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isHorizontalGesture = null;
      isTouchDrag = false;
      updateCachedRect();
      if (!zoom) {
        updateCursorFromClientX(touchStartX);
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const dx = clientX - touchStartX;
      const dy = clientY - touchStartY;

      if (isHorizontalGesture === null) {
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            isHorizontalGesture = true;
            isTouchDrag = true;
          } else {
            isHorizontalGesture = false;
          }
        }
      }

      if (isHorizontalGesture === true) {
        if (e.cancelable) e.preventDefault();
        if (!zoom) {
          updateCursorFromClientX(clientX);
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (zoom) {
        const t = e.changedTouches ? e.changedTouches[0] : null;
        if (t) {
          const dx = t.clientX - touchStartX;
          const dy = t.clientY - touchStartY;
          if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) choose(sel + 1);
            else choose(sel - 1);
          } else if (dy > 50 && Math.abs(dy) > Math.abs(dx)) {
            closeZoom();
          }
        }
        isHorizontalGesture = null;
        return;
      }
      isHorizontalGesture = null;
      setTimeout(() => {
        isTouchDrag = false;
      }, 50);

      // Snap to nearest garment so it remains facing front on mobile
      const m = M || metrics();
      if (nearItemIndex >= 0 && nearItemIndex < P) {
        cursor = (nearItemIndex - (P - 1) / 2) * m.gap;
        applyRack();
      }
    };

    rack.addEventListener('pointerenter', handlePointerEnter);
    rack.addEventListener('pointermove', handlePointerMove, { passive: true });
    rack.addEventListener('pointerdown', handlePointerDown, { passive: true });
    rack.addEventListener('pointerleave', handlePointerLeave);
    rack.addEventListener('touchstart', handleTouchStart, { passive: true });
    rack.addEventListener('touchmove', handleTouchMove, { passive: false });
    rack.addEventListener('touchend', handleTouchEnd, { passive: true });
    rack.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    function renderTags() {
      if (sel < 0 || !PRODUCTS[sel]) return;
      const p = PRODUCTS[sel];
      tagsEl.innerHTML = '';
      if (!Array.isArray(p.colors) || p.colors.length === 0) return;

      p.colors.forEach((c, k) => {
        const b = document.createElement('button');
        b.className = 'tag' + (k === p.ci ? ' on' : '');
        b.style.setProperty('--k', k);
        b.style.background = c.hex || '#222';
        b.style.color = (parseInt((c.hex || '#222').slice(1), 16) >> 16) > 150 ? '#111' : '#fff';
        b.textContent = c.name || 'Color';
        b.title = c.name || 'Color';
        b.setAttribute('aria-label', 'Colour: ' + (c.name || 'Color'));
        b.onclick = () => setColor(k);
        tagsEl.appendChild(b);
      });
    }

    // Fast 380ms jagged skyline colorway wipe
    const wipeState = new WeakMap();
    function wipe(layer, html) {
      const base = layer.querySelector('.l-base');
      const over = layer.querySelector('.l-over');
      if (!base || !over) return;
      const prev = wipeState.get(layer);
      if (prev) {
        cancelAnimationFrame(prev);
        if (over.innerHTML) base.innerHTML = over.innerHTML;
      }
      const N = 18;
      const jag = Array.from({ length: N }, () => Math.random());
      over.innerHTML = html;
      const poly = (p) => {
        const y = jag.map((j) => Math.max(0, Math.min(100, (p * 1.45 - j * 0.45) * 100)));
        const pts = ['0 0', '100% 0'];
        for (let k = N - 1; k >= 0; k--) {
          pts.push((((k + 1) / N) * 100) + '% ' + y[k] + '%');
          pts.push(((k / N) * 100) + '% ' + y[k] + '%');
        }
        return 'polygon(' + pts.join(',') + ')';
      };
      const D = 380;
      const t0 = performance.now();
      function tick(now) {
        const t = Math.min((now - t0) / D, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        over.style.clipPath = poly(e);
        if (t < 1) {
          wipeState.set(layer, requestAnimationFrame(tick));
        } else {
          base.innerHTML = html;
          over.innerHTML = '';
          over.style.clipPath = 'polygon(0 0,0 0,0 0)';
          wipeState.delete(layer);
        }
      }
      wipeState.set(layer, requestAnimationFrame(tick));
    }

    function setColor(k) {
      if (sel < 0 || !PRODUCTS[sel]) return;
      const p = PRODUCTS[sel];
      if (k === p.ci) return;
      p.ci = k;
      const el = items[sel];
      if (el) {
        const faceF = el.querySelector('.face.f');
        const faceB = el.querySelector('.face.b');
        if (faceF) wipe(faceF, view(p, false));
        if (faceB) wipe(faceB, view(p, true));
      }
      [...tagsEl.children].forEach((t, j) => t.classList.toggle('on', j === k));
      if (ttlEl) ttlEl.textContent = p.name;
      if (capEl) capEl.innerHTML = capHTML(p);
    }

    function setSide(side) {
      if (sel >= 0 && items[sel]) {
        items[sel].classList.toggle('back', side === 'back');
      }
      if (segEl) {
        segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
      }
    }

    function choose(i) {
      if (sel >= 0 && items[sel]) items[sel].classList.remove('back');
      sel = ((i % P) + P) % P;
      if (ttlEl && PRODUCTS[sel]) ttlEl.textContent = PRODUCTS[sel].name;
      if (capEl && PRODUCTS[sel]) capEl.innerHTML = capHTML(PRODUCTS[sel]);
      setSide('front');
      renderTags();
      layout();
    }

    function openZoom(i) {
      sel = i;
      zoom = true;
      hero.classList.add('zoom');
      if (ttlEl && PRODUCTS[sel]) ttlEl.textContent = PRODUCTS[sel].name;
      setSide('front');
      renderTags();
      layout();
    }

    function closeZoom() {
      if (!zoom) return;
      if (sel >= 0 && items[sel]) items[sel].classList.remove('back');
      zoom = false;
      hero.classList.remove('zoom');
      const m = M || metrics();
      if (sel >= 0) {
        cursor = (sel - (P - 1) / 2) * m.gap;
      }
      layout();
    }

    const closeBtn = document.getElementById('close');
    const nextBtn = document.getElementById('next');
    const prevBtn = document.getElementById('prev');

    if (closeBtn) closeBtn.onclick = closeZoom;
    if (nextBtn) nextBtn.onclick = () => zoom && choose(sel + 1);
    if (prevBtn) prevBtn.onclick = () => zoom && choose(sel - 1);

    if (segEl) {
      segEl.querySelectorAll('button').forEach((b) => {
        b.onclick = () => setSide(b.dataset.side);
      });
    }

    const handleRackClick = (e) => {
      if (zoom && (e.target === rack || e.target === stage || e.target === railEl)) {
        closeZoom();
      }
    };
    rack.addEventListener('click', handleRackClick);

    const handleKeyDown = (e) => {
      if (!zoom) return;
      if (e.key === 'Escape') closeZoom();
      if (e.key === 'ArrowRight') choose(sel + 1);
      if (e.key === 'ArrowLeft') choose(sel - 1);
    };
    window.addEventListener('keydown', handleKeyDown);

    // Availability CTA hooked into store modal & cart
    const triggerAvailability = () => {
      const idx = sel >= 0 ? sel : 0;
      const p = PRODUCTS[idx];
      if (!p) return;
      const c = Array.isArray(p.colors) && p.colors[p.ci || 0] ? p.colors[p.ci || 0] : { name: 'Standard', hex: '#222', front: p.front, back: p.back };

      if (onSelectProduct) {
        onSelectProduct({
          id: p.id,
          name: p.name,
          price: p.price,
          originalPrice: p.originalPrice,
          desc: p.desc,
          description: p.desc,
          badge: p.label || 'DROP 01',
          sizes: ['S', 'M', 'L', 'XL', 'XXL'],
          selectedColor: {
            name: c.name,
            hex: c.hex,
            image: c.front || p.front,
            front: c.front || p.front,
            backImage: c.back || p.back,
            back: c.back || p.back,
          },
          colors: (p.colors || []).map((col) => ({
            name: col.name,
            hex: col.hex,
            image: col.front,
            front: col.front,
            backImage: col.back,
            back: col.back,
          })),
        });
      }

      window.dispatchEvent(
        new CustomEvent('availability', {
          detail: { product: p.name, color: c.name },
        })
      );
    };

    const availBtn = document.getElementById('avail');
    const rackCtaBtn = document.getElementById('hero-rack-cta');
    if (availBtn) availBtn.addEventListener('click', triggerAvailability);
    if (rackCtaBtn) rackCtaBtn.addEventListener('click', triggerAvailability);

    const handleResize = () => {
      updateCachedRect();
      layout();
    };
    window.addEventListener('resize', handleResize);

    layout();

    return () => {
      if (pointerRafId) cancelAnimationFrame(pointerRafId);
      rack.removeEventListener('pointerenter', handlePointerEnter);
      rack.removeEventListener('pointermove', handlePointerMove);
      rack.removeEventListener('pointerdown', handlePointerDown);
      rack.removeEventListener('pointerleave', handlePointerLeave);
      rack.removeEventListener('touchstart', handleTouchStart);
      rack.removeEventListener('touchmove', handleTouchMove);
      rack.removeEventListener('touchend', handleTouchEnd);
      rack.removeEventListener('touchcancel', handleTouchEnd);
      rack.removeEventListener('click', handleRackClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (availBtn) availBtn.removeEventListener('click', triggerAvailability);
      if (rackCtaBtn) rackCtaBtn.removeEventListener('click', triggerAvailability);
    };
  }, [heroProducts, onSelectProduct]);

  return (
    <section className="hero" id="hero" ref={heroRef}>
      {/* Top Brand Logo */}
      <div className="top">
        <div className="logo">MACHII</div>
      </div>

      {/* 3D Clothes Rack */}
      <div className="rack" id="rack" ref={rackRef}>
        <div className="rail" id="rail" ref={railRef} />
        <div className="stage" id="stage" ref={stageRef} />
        <div className="tags" id="tags" ref={tagsRef} />

        <button className="close" id="close" aria-label="Back to rack view">
          ← BACK
        </button>
        <button className="arrow l" id="prev" aria-label="Previous Garment">
          ←
        </button>
        <button className="arrow r" id="next" aria-label="Next Garment">
          →
        </button>

        <div className="meta" id="meta">
          <div className="r-only">
            <div className="cap" id="cap" ref={capRef} />
            <button className="cta preview-style-btn" type="button" id="hero-rack-cta">
              See availability
            </button>
          </div>
          <div className="z-only">
            <div className="ttl" id="ttl" ref={ttlRef} />
            <div className="seg" id="seg" ref={segRef}>
              <button className="on" data-side="front" type="button">
                Front
              </button>
              <button data-side="back" type="button">
                Back
              </button>
            </div>
            <button className="cta preview-style-btn" type="button" id="avail">
              See availability
            </button>
          </div>
        </div>
      </div>

      {/* Signature Green Marquee Ticker */}
      <div className="ticker">
        <div ref={tickerTrackRef} id="tickerTrack" />
      </div>
    </section>
  );
}
