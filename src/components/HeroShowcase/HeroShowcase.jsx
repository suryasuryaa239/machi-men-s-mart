import React, { useEffect, useRef } from 'react';
import './HeroShowcase.css';

const TICKER = ['GEN Z DROP-SHOULDER CUT', 'NEW DROP', '240 GSM HEAVYWEIGHT COTTON', 'LIMITED PIECES'];

const PRODUCTS = [
  {
    id: 'garment-sage',
    collectionId: 'prod-everyday-heavyweight',
    name: 'Drop 01 Oversized Tee',
    label: 'LIMITED RUN',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 0.688,
    ar: 2.034,
    colors: [
      { name: 'Washed Olive', hex: '#5d5c4a', front: '/hero/img/machii-olive.png', back: '/hero/img/machii-olive.png' },
      { name: 'Rust Earth', hex: '#5d4540', front: '/hero/img/machii-olive-alt.png', back: '/hero/img/machii-olive-alt.png' },
    ],
  },
  {
    id: 'prod-street-culture',
    collectionId: 'prod-street-culture',
    name: 'Street Culture Oversized Tee',
    label: '-20%',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 0.972,
    ar: 1.617,
    colors: [
      { name: 'Vintage Cream', hex: '#aca190', front: '/hero/img/machii-cream.png', back: '/hero/img/machii-cream.png' },
      { name: 'Mint Green', hex: '#8eac82', front: '/hero/img/machii-cream-alt.png', back: '/hero/img/machii-cream-alt.png' },
    ],
  },
  {
    id: 'garment-featured-attitude',
    collectionId: 'prod-essential-oversized',
    name: 'Attitude 01 Oversized Tee',
    label: 'FLAGSHIP',
    price: '₹1,499',
    originalPrice: '₹2,499',
    desc: '280 GSM heavyweight cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.377,
    ar: 0.983,
    colors: [
      { name: 'Washed Black', hex: '#222221', front: '/hero/img/machii-black.png', back: '/hero/img/machii-black.png' },
      { name: 'Charcoal Grey', hex: '#484846', front: '/hero/img/machii-black-alt.png', back: '/hero/img/machii-black-alt.png' },
    ],
  },
  {
    id: 'garment-cobalt',
    collectionId: 'prod-midnight-graphic',
    name: 'Mens Mart Oversized Tee',
    label: 'NEW DROP',
    price: '₹1,499',
    originalPrice: '₹2,299',
    desc: '280 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 1.019,
    ar: 1.53,
    colors: [
      { name: 'Royal Blue', hex: '#06377f', front: '/hero/img/machii-blue.png', back: '/hero/img/machii-blue.png' },
      { name: 'Cyber Lime', hex: '#807c06', front: '/hero/img/machii-blue-alt.png', back: '/hero/img/machii-blue-alt.png' },
    ],
  },
  {
    id: 'garment-bone',
    collectionId: 'prod-retro-print',
    name: 'Tokyo Energy Oversized Tee',
    label: 'POPULAR',
    price: '₹1,399',
    originalPrice: '₹1,999',
    desc: '260 GSM heavyweight combed cotton in our signature Gen Z drop-shoulder cut.',
    rel: 0.963,
    ar: 1.459,
    colors: [
      { name: 'Bone Stone', hex: '#a6a5a0', front: '/hero/img/machii-grey.png', back: '/hero/img/machii-grey.png' },
      { name: 'Blush Warm', hex: '#a68f88', front: '/hero/img/machii-grey-alt.png', back: '/hero/img/machii-grey-alt.png' },
    ],
  },
];

// Initialize variant index on all products
PRODUCTS.forEach((p) => {
  p.ci = 0;
});

function view(p, back = false, ci = p.ci) {
  const v = p.colors[ci];
  const src = back ? v.back : v.front;
  return `<img src="${src}" alt="${p.name} - ${v.name}" draggable="false" />`;
}

const capHTML = (i) => `<b>${PRODUCTS[i].name}</b><span>${PRODUCTS[i].desc || ''}</span>`;

export default function HeroShowcase({ onSelectProduct }) {
  const heroRef = useRef(null);
  const rackRef = useRef(null);
  const stageRef = useRef(null);
  const railRef = useRef(null);
  const tagsRef = useRef(null);
  const capRef = useRef(null);
  const ttlRef = useRef(null);
  const segRef = useRef(null);
  const tickerTrackRef = useRef(null);
  const selRef = useRef(-1);
  const zoomRef = useRef(false);

  useEffect(() => {
    const hero = heroRef.current;
    const rack = rackRef.current;
    const stage = stageRef.current;
    const railEl = railRef.current;
    const tagsEl = tagsRef.current;
    const capEl = capRef.current;
    const ttlEl = ttlRef.current;
    const segEl = segRef.current;
    const tickerTrack = tickerTrackRef.current;

    if (!hero || !rack || !stage || !railEl || !tagsEl) return;

    if (tickerTrack) {
      tickerTrack.innerHTML = TICKER.map((t) => `<span>${t}</span><span>•</span>`).join('').repeat(6);
    }

    const P = PRODUCTS.length;
    let cursor = null;
    let introRun = false;
    let moved = false;
    let M = null;
    let rafIntroId = null;

    stage.innerHTML = '';
    const items = PRODUCTS.map((p, i) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.style.setProperty('--d', 0.15 + i * 0.07 + 's');
      el.innerHTML = `<div class="in"><div class="hang"><div class="flip">
          <div class="face f"><div class="l-base"></div><div class="l-over"></div></div>
          <div class="face b"><div class="l-base"></div><div class="l-over"></div></div>
        </div></div>${p.label ? `<span class="label">${p.label}</span>` : ''}</div>`;

      el.addEventListener('click', () => {
        if (!zoomRef.current) {
          openZoom(i);
        } else if (i !== selRef.current) {
          choose(i);
        }
      });

      el.addEventListener('mouseenter', () => {
        if (!zoomRef.current && capEl) {
          capEl.innerHTML = capHTML(i);
        }
      });

      stage.appendChild(el);
      paint(i);
      return el;
    });

    function paint(i) {
      const el = stage.children[i];
      const p = PRODUCTS[i];
      if (!el) return;
      const baseF = el.querySelector('.face.f .l-base');
      const baseB = el.querySelector('.face.b .l-base');
      if (baseF) baseF.innerHTML = view(p, false);
      if (baseB) baseB.innerHTML = view(p, true);
    }

    if (capEl) capEl.innerHTML = capHTML(0);

    function metrics() {
      const vw = rack.clientWidth;
      const H = rack.clientHeight;
      let gap = Math.min(vw * 0.2, 260);
      let W = gap / 0.98;
      const maxGap = (vw * 0.96) / P;
      if (gap > maxGap) {
        gap = maxGap;
        W = gap / 0.98;
      }
      const railY = H * 0.17;
      const hookY = H * 0.05;
      return { vw, H, W, gap, railY, hookY };
    }

    const iw = (m, i) => m.W * (PRODUCTS[i].rel || 1);
    const ih = (m, i) => iw(m, i) * (PRODUCTS[i].ar || 1.29);
    const zoomOf = (m, i) => Math.max(1.1, Math.min((m.H * 0.57) / ih(m, i), (m.vw * 0.8) / iw(m, i), 3.4));
    const ROT = 72; // resting angle of garments on rail

    const setV = (el, v) => {
      for (const k in v) el.style.setProperty('--' + k, v[k]);
    };

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
      if (near >= 0 && nd < 0.6 && capEl) {
        capEl.innerHTML = capHTML(near);
      }
    }

    function layout() {
      const m = (M = metrics());
      if (railEl) railEl.style.top = m.railY + 'px';
      items.forEach((el, i) => {
        el.style.width = iw(m, i) + 'px';
        el.style.marginLeft = -iw(m, i) / 2 + 'px';
        el.style.top = m.railY - 4 + 'px';
        el.classList.toggle('sel', zoomRef.current && i === selRef.current);
      });

      if (!zoomRef.current) {
        applyRack();
        return;
      }

      const sel = selRef.current;
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

      if (tagsEl) {
        tagsEl.style.top = m.hookY + wz * 0.55 * (PRODUCTS[sel].ar || 1.29) * 0.18 + 'px';
        [...tagsEl.children].forEach((t, k) => {
          t.style.left = wz * 0.5 + 20 + k * 38 + 'px';
          t.style.marginTop = 30 + k * 12 + 'px';
        });
      }
    }

    function intro() {
      if (moved) return;
      const m = metrics();
      const D = 3200;
      const t0 = performance.now();
      introRun = true;
      const from = -(P / 2 + 0.5) * m.gap;
      const to = (P / 2 + 0.5) * m.gap;

      function tick(now) {
        if (!introRun || zoomRef.current) return;
        const p = Math.min((now - t0) / D, 1);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        cursor = from + (to - from) * e;
        applyRack();
        if (p < 1) {
          rafIntroId = requestAnimationFrame(tick);
        } else {
          cursor = null;
          introRun = false;
          applyRack();
        }
      }

      rafIntroId = requestAnimationFrame(tick);
    }

    const handlePointerMove = (e) => {
      if (zoomRef.current || e.pointerType === 'touch') return;
      introRun = false;
      moved = true;
      cursor = e.clientX - rack.getBoundingClientRect().left - rack.clientWidth / 2;
      applyRack();
    };

    const handlePointerLeave = () => {
      if (zoomRef.current) return;
      cursor = null;
      applyRack();
    };

    rack.addEventListener('pointermove', handlePointerMove);
    rack.addEventListener('pointerleave', handlePointerLeave);

    function renderTags() {
      if (!tagsEl) return;
      const sel = selRef.current;
      const p = PRODUCTS[sel];
      tagsEl.innerHTML = '';
      p.colors.forEach((c, k) => {
        const b = document.createElement('button');
        b.className = 'tag' + (k === p.ci ? ' on' : '');
        b.style.setProperty('--k', k);
        b.style.background = c.hex;
        b.style.color = (parseInt(c.hex.slice(1), 16) >> 16) > 150 ? '#111' : '#fff';
        b.textContent = c.name;
        b.title = c.name;
        b.setAttribute('aria-label', 'Colour: ' + c.name);
        b.onclick = () => setColor(k);
        tagsEl.appendChild(b);
      });
    }

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
          pts.push((k + 1) / N * 100 + '% ' + y[k] + '%');
          pts.push((k / N) * 100 + '% ' + y[k] + '%');
        }
        return 'polygon(' + pts.join(',') + ')';
      };
      const D = 950;
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
      const sel = selRef.current;
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
      if (tagsEl) {
        [...tagsEl.children].forEach((t, j) => t.classList.toggle('on', j === k));
      }
      if (ttlEl) ttlEl.textContent = p.name;
      if (capEl) capEl.innerHTML = capHTML(sel);
    }

    function setSide(side) {
      const sel = selRef.current;
      if (items[sel]) {
        items[sel].classList.toggle('back', side === 'back');
      }
      if (segEl) {
        segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
      }
    }

    function choose(i) {
      const current = selRef.current;
      if (current >= 0 && items[current]) {
        items[current].classList.remove('back');
      }
      selRef.current = ((i % P) + P) % P;
      const sel = selRef.current;
      if (ttlEl) ttlEl.textContent = PRODUCTS[sel].name;
      if (capEl) capEl.innerHTML = capHTML(sel);
      setSide('front');
      renderTags();
      layout();
    }

    function openZoom(i) {
      selRef.current = i;
      zoomRef.current = true;
      hero.classList.add('zoom');
      if (ttlEl) ttlEl.textContent = PRODUCTS[i].name;
      setSide('front');
      renderTags();
      layout();
    }

    function closeZoom() {
      if (!zoomRef.current) return;
      const sel = selRef.current;
      if (items[sel]) items[sel].classList.remove('back');
      zoomRef.current = false;
      hero.classList.remove('zoom');
      layout();
    }

    const segButtons = segEl?.querySelectorAll('button') || [];
    segButtons.forEach((b) => {
      b.onclick = () => setSide(b.dataset.side);
    });

    const closeBtn = document.getElementById('hero-close');
    const nextBtn = document.getElementById('hero-next');
    const prevBtn = document.getElementById('hero-prev');

    if (closeBtn) closeBtn.onclick = closeZoom;
    if (nextBtn) nextBtn.onclick = () => zoomRef.current && choose(selRef.current + 1);
    if (prevBtn) prevBtn.onclick = () => zoomRef.current && choose(selRef.current - 1);

    const handleRackClick = (e) => {
      if (zoomRef.current && (e.target === rack || e.target === stage || e.target === railEl)) {
        closeZoom();
      }
    };
    rack.addEventListener('click', handleRackClick);

    const handleKeyDown = (e) => {
      if (!zoomRef.current) return;
      if (e.key === 'Escape') closeZoom();
      if (e.key === 'ArrowRight') choose(selRef.current + 1);
      if (e.key === 'ArrowLeft') choose(selRef.current - 1);
    };
    window.addEventListener('keydown', handleKeyDown);

    // Availability CTA triggers modal / cart
    const triggerAvailability = () => {
      const idx = selRef.current >= 0 ? selRef.current : 0;
      const p = PRODUCTS[idx];
      const c = p.colors[p.ci || 0];

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
            image: c.front,
            front: c.front,
            backImage: c.back,
            back: c.back,
          },
          colors: p.colors.map((col) => ({
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

    const availBtn = document.getElementById('hero-avail');
    const rackCtaBtn = document.getElementById('hero-rack-cta');
    if (availBtn) availBtn.addEventListener('click', triggerAvailability);
    if (rackCtaBtn) rackCtaBtn.addEventListener('click', triggerAvailability);

    const handleResize = () => layout();
    window.addEventListener('resize', handleResize);

    layout();
    const introTimer = setTimeout(intro, 1200);

    return () => {
      clearTimeout(introTimer);
      if (rafIntroId) cancelAnimationFrame(rafIntroId);
      rack.removeEventListener('pointermove', handlePointerMove);
      rack.removeEventListener('pointerleave', handlePointerLeave);
      rack.removeEventListener('click', handleRackClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (availBtn) availBtn.removeEventListener('click', triggerAvailability);
      if (rackCtaBtn) rackCtaBtn.removeEventListener('click', triggerAvailability);
    };
  }, [onSelectProduct]);

  return (
    <section className="hero" id="product-showcase" ref={heroRef}>
      {/* Top Logo / Brand Eyebrow */}
      <div className="top">
        <div className="logo">MACHII</div>
      </div>

      {/* Interactive Clothes Rack */}
      <div className="rack" id="rack" ref={rackRef}>
        <div className="rail" id="rail" ref={railRef} />
        <div className="stage" id="stage" ref={stageRef} />
        <div className="tags" id="tags" ref={tagsRef} />

        <button className="close" id="hero-close" aria-label="Back to rack view">
          ← BACK
        </button>
        <button className="arrow l" id="hero-prev" aria-label="Previous Garment">
          ←
        </button>
        <button className="arrow r" id="hero-next" aria-label="Next Garment">
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
            <button className="cta preview-style-btn" type="button" id="hero-avail">
              See availability
            </button>
          </div>
        </div>
      </div>

      {/* Signature Machii Green Marquee Ticker */}
      <div className="ticker">
        <div ref={tickerTrackRef} id="tickerTrack" />
      </div>
    </section>
  );
}
