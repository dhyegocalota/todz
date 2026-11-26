import { STARS_COUNT_UP_MS, STARS_FORMAT_LOCALE, STARS_FORMAT_OPTIONS, scriptJson } from './site-constants';

export const STAR_COUNT_SCRIPT = `{
  const format = new Intl.NumberFormat('${STARS_FORMAT_LOCALE}', ${scriptJson(STARS_FORMAT_OPTIONS)});
  const isStill = matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
  const ease = (progress) => 1 - Math.pow(1 - progress, 3);
  const countUp = (count) => {
    const live = count.querySelector('.star-count-live');
    const total = Number(count.dataset.stars);
    const started = performance.now();
    count.setAttribute('data-counting', '');
    const frame = (now) => {
      const progress = Math.min((now - started) / ${STARS_COUNT_UP_MS}, 1);
      live.textContent = format.format(Math.round(total * ease(progress))).toLowerCase();
      if (progress < 1) return requestAnimationFrame(frame);
      count.removeAttribute('data-counting');
    };
    requestAnimationFrame(frame);
  };
  if (!isStill) {
    const observer = new IntersectionObserver((entries) => entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      observer.unobserve(entry.target);
      countUp(entry.target);
    }));
    document.querySelectorAll('.star-count').forEach((count) => observer.observe(count));
  }
}`;
