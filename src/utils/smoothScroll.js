import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;

export function initSmoothScroll() {
  // Respect user preference for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return null;
  }

  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }

  lenisInstance = new Lenis({
    duration: 0.9,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.2,
    syncTouch: false,
    autoRaf: false,
  });

  // Expose for debugging and inspection
  window.lenis = lenisInstance;
  window.ScrollTrigger = ScrollTrigger;

  // Synchronize Lenis scroll with GSAP ScrollTrigger
  lenisInstance.on('scroll', ScrollTrigger.update);

  const tickerCallback = (time) => {
    lenisInstance?.raf(time * 1000);
  };

  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  // Defer a refresh to ensure all DOM elements are measured accurately
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });

  return {
    lenis: lenisInstance,
    destroy: () => {
      gsap.ticker.remove(tickerCallback);
      lenisInstance?.destroy();
      lenisInstance = null;
      window.lenis = null;
    },
  };
}

let openModalsCount = 0;
let savedScrollY = 0;

export function stopLenisScroll() {
  lenisInstance?.stop();
  window.lenis?.stop();
}

export function startLenisScroll() {
  lenisInstance?.start();
  window.lenis?.start();
}

export function lockScroll() {
  openModalsCount++;
  if (openModalsCount === 1) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // 1. Capture current scroll position with highest accuracy
      savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

      // 2. Prevent page width shift when scrollbar is hidden
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      // 3. Fix body to viewport at negative scroll offset so background cannot scroll under any gesture
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('modal-scroll-locked');
      document.documentElement.classList.add('modal-scroll-locked');
    }
    stopLenisScroll();
  }
}

export function unlockScroll() {
  openModalsCount = Math.max(0, openModalsCount - 1);
  if (openModalsCount === 0) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const topOffset = document.body.style.top;
      const targetScroll = topOffset ? Math.abs(parseInt(topOffset, 10)) : savedScrollY;

      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('modal-scroll-locked');
      document.documentElement.classList.remove('modal-scroll-locked');

      window.scrollTo(0, targetScroll);
      if (lenisInstance) {
        lenisInstance.scrollTo(targetScroll, { immediate: true });
      }
    }
    startLenisScroll();
  }
}

