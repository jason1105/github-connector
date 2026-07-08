// ===== Hero animation sequence =====
// Timeline (per spec docs/superpowers/specs/2026-07-08-marketing-landing-page-design.md):
// 0.0-0.4s: cursor blinks alone
// 0.4-1.6s: cursor types the demo instruction (language-specific, read from data-typed-text)
// 1.6-2.0s: pause
// 2.0-3.0s: result card fades up (language-specific, read from data-result-text)
// 3.0-4.0s: headline + subhead reveal
// 4.0-5.0s: cursor migrates into the nav CTA button
//
// The typed/result copy is read from data-* attributes on #hero-demo rather
// than hardcoded here, so this one shared script.js file produces correct
// language-matched hero text on both index.html (Chinese) and index.en.html
// (English) without needing a second script file or client-side i18n.

function runHeroSequence() {
  const heroDemo = document.getElementById('hero-demo');
  const typedText = heroDemo.dataset.typedText;
  const resultText = heroDemo.dataset.resultText;
  const typedLine = document.getElementById('hero-typed-line');
  const heroCursor = document.getElementById('hero-cursor');
  const resultCard = document.getElementById('hero-result-card');
  const resultTextSpan = document.getElementById('hero-result-text');
  const headline = document.getElementById('hero-headline');
  const subhead = document.getElementById('hero-subhead');
  const navCta = document.getElementById('nav-cta');
  const navCtaCursor = document.getElementById('nav-cta-cursor');

  let charIndex = 0;

  function typeChar() {
    if (charIndex < typedText.length) {
      typedLine.textContent += typedText[charIndex];
      charIndex++;
      const jitter = 40 + Math.random() * 50;
      setTimeout(typeChar, jitter);
    } else {
      setTimeout(showResult, 400);
    }
  }

  function showResult() {
    resultTextSpan.textContent = resultText;
    resultCard.classList.add('visible');
    setTimeout(revealHeadline, 400);
  }

  function revealHeadline() {
    headline.classList.add('visible');
    subhead.classList.add('visible');
    setTimeout(migrateCursor, 600);
  }

  // Real FLIP-style position migration, not a hide/show swap: clone the
  // hero cursor as a `position: fixed` element, measure both the hero
  // cursor's and the nav CTA cursor slot's actual screen positions via
  // getBoundingClientRect(), then transition the clone's transform from
  // the start position to the end position. This is the spec's core
  // differentiating mechanic (docs/superpowers/specs/2026-07-08-marketing-landing-page-design.md:157-161)
  // — "one continuous indigo object the eye follows for the full 5
  // seconds, resolving into the thing to click" — a hide/show swap does
  // not satisfy this; the cursor must visibly travel.
  function migrateCursor() {
    const startRect = heroCursor.getBoundingClientRect();

    // Reveal the nav cursor slot in its final (landed) state first, but
    // invisible, purely so we can measure where the clone needs to land.
    navCta.classList.add('cursor-landed');
    navCtaCursor.style.display = 'inline';
    navCtaCursor.style.opacity = '0';
    const endRect = navCtaCursor.getBoundingClientRect();

    const clone = heroCursor.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.position = 'fixed';
    clone.style.left = startRect.left + 'px';
    clone.style.top = startRect.top + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = '100';
    clone.style.transition = 'transform 0.4s var(--ease-out-expo)';
    document.body.appendChild(clone);

    heroCursor.style.visibility = 'hidden';

    const dx = endRect.left - startRect.left;
    const dy = endRect.top - startRect.top;

    // Force layout so the browser registers the clone's start position
    // before we set the transform that triggers the transition.
    void clone.getBoundingClientRect();
    clone.style.transform = `translate(${dx}px, ${dy}px)`;

    clone.addEventListener('transitionend', () => {
      clone.remove();
      navCtaCursor.style.opacity = '1';
      document.querySelector('.hero').classList.add('divider-drawn');
    }, { once: true });
  }

  setTimeout(typeChar, 400);
}

// Reduced-motion / degradation: if prefers-reduced-motion, skip straight to final state.
function heroFinalStateImmediate() {
  const heroDemo = document.getElementById('hero-demo');
  document.getElementById('hero-typed-line').textContent = heroDemo.dataset.typedText;
  document.getElementById('hero-result-text').textContent = heroDemo.dataset.resultText;
  document.getElementById('hero-result-card').classList.add('visible');
  document.getElementById('hero-headline').classList.add('visible');
  document.getElementById('hero-subhead').classList.add('visible');
  document.getElementById('hero-cursor').style.display = 'none';
  document.getElementById('nav-cta').classList.add('cursor-landed');
  document.getElementById('nav-cta-cursor').style.display = 'inline';
  document.querySelector('.hero').classList.add('divider-drawn');
}

// The hero sequence is wrapped in try/catch so that an unexpected runtime
// error here (e.g. a DOM id typo introduced in a future edit) cannot abort
// this entire top-level script and silently prevent the nav-scroll listener
// and revealOnScroll() below from registering — those must keep working
// even if the hero animation itself breaks. On any error, fall back to
// showing the hero's final composed state immediately rather than leaving
// it stuck at opacity:0.
try {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    heroFinalStateImmediate();
  } else {
    runHeroSequence();
    // Degradation rule: if hero hasn't started within 800ms (e.g. very slow
    // device blocking the main thread), snap directly to final state instead
    // of letting a stuttering partial animation play.
    setTimeout(() => {
      const typedLine = document.getElementById('hero-typed-line');
      if (typedLine.textContent.length === 0) {
        heroFinalStateImmediate();
      }
    }, 800);
  }
} catch (err) {
  console.error('Hero sequence failed, falling back to final state:', err);
  try {
    heroFinalStateImmediate();
  } catch (fallbackErr) {
    console.error('Hero fallback also failed:', fallbackErr);
  }
}

// ===== Nav surfacing =====
// Per spec, the nav's blur/hairline border must materialize "as the page
// loads, not instantly" — it must NOT wait for the user to scroll (a
// visitor who never scrolls should still see it appear shortly after
// load). It also stays surfaced permanently once scrolled past the top,
// so it doesn't flicker back to transparent if the user scrolls back up.
const nav = document.querySelector('.site-nav');

setTimeout(() => {
  nav.classList.add('surfaced');
}, 250);

window.addEventListener('scroll', () => {
  if (window.scrollY > 10) {
    nav.classList.add('surfaced');
  }
}, { passive: true });

// ===== Shared scroll-reveal helper (used by later sections) =====
// Adds `visible` class to each element matching `selector` the first time
// it enters the viewport. Plays once — does not remove the class on
// scroll-back-up (per spec: "one-shot reveal").
function revealOnScroll(selector, options = {}) {
  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: options.threshold || 0.3 });

  elements.forEach(el => observer.observe(el));
}
