# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, bilingual, static marketing landing page (`site/`) that teaches ChatGPT users how to connect the already-deployed `github-connector` MCP server, hooking visitor interest within 5 seconds via a restrained "editorial calm" visual design.

**Architecture:** Two static HTML files (`index.html` Chinese, `index.en.html` English) sharing one `style.css` and one `script.js`. No build step, no framework — plain CSS custom properties for the design system, plain JS with `IntersectionObserver` for scroll reveals and a hand-written keyframe sequence for the hero animation. Deployed as its own, independent Vercel project (separate from the existing MCP server's Vercel project) on subdomain `www.github-connector.jason1105.uk`.

**Tech Stack:** HTML5, CSS3 (custom properties, `@keyframes`, `IntersectionObserver`), vanilla JavaScript (ES2020+, no dependencies), Vercel static hosting.

## Global Constraints

- Color palette (exact, from spec): `--bg: #FAFAF8`, `--bg-subtle: #F3F2EE`, `--text: #1A1A1A`, `--text-muted: #6B6B6B`, `--accent: #1E4FD8`, `--accent-hover: #1A45BE`, `--border: #E8E7E3`, `--success: #1F9D57` (used exactly once, on the hero result card's ✓ — nowhere else).
- No gradients anywhere. No dark mode in this iteration.
- Typography: Chinese via Source Han Sans / Noto Sans SC, Latin UI text via Inter, code/monospace via JetBrains Mono. Modular scale `1rem = 16px`, ratio 1.333, 8px baseline grid.
- Motion law: all transitions/animations use easing `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo). No bounce, no overshoot, no color-flash. Must honor `prefers-reduced-motion: reduce` (skip straight to final state). Scroll reveals use `IntersectionObserver`, play once (do not replay on scroll back up).
- No analytics/tracking, no forms, no CMS, no additional pages beyond the single landing page (2 language variants of the same page).
- Chinese is the primary/default language; `index.html` is Chinese, `index.en.html` is English.
- The real, current production MCP endpoint is `https://github-connector.jason1105.uk/mcp` — this exact URL must appear in the tutorial section and the closing CTA.
- This work must not modify anything under `api/`, `src/`, `test/`, or the existing `vercel.json` at the repo root — those belong to the live, already-reviewed MCP server and are out of scope for this feature entirely.

---

## File Structure

```
site/
  index.html       # Chinese landing page (primary)
  index.en.html    # English landing page
  style.css        # shared design system + all section styles
  script.js        # hero animation sequence + scroll-reveal observers
  vercel.json      # static-site config for the new, independent Vercel project
```

## Order of implementation

1. Task 1: Design system foundation (`style.css` tokens/typography/motion, minimal `index.html` skeleton proving fonts and colors load) — everything else depends on this.
2. Task 2: Hero section + animation sequence (`script.js`'s core logic) — the highest-risk, most-specified piece; built and verified in isolation before other sections.
3. Task 3: Value-prop diff + 11-tools checklist sections — first scroll-reveal content, depends on Task 1's design tokens and Task 2's `IntersectionObserver` reveal helper.
4. Task 4: Security section + 3-step tutorial + closing CTA — completes the Chinese page.
5. Task 5: English translation (`index.en.html`) — depends on the finished Chinese page's full structure.
6. Task 6: Vercel deployment config + local verification — depends on all page content being final.

---

### Task 1: Design system foundation

**Files:**
- Create: `site/style.css`
- Create: `site/index.html`

**Interfaces:**
- Produces: CSS custom properties on `:root` — `--bg`, `--bg-subtle`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--border`, `--success`, `--font-sans` (Chinese+Latin stack), `--font-mono` (JetBrains Mono stack), `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`. Produces a base typographic scale as CSS classes: `.eyebrow`, `.h1`, `.h2`, `.body-text`, `.mono`.
- Consumes: nothing (this is the foundation).

- [ ] **Step 1: Create the directory and the CSS custom properties**

Create `site/style.css`:

```css
/* ===== Design tokens ===== */
:root {
  --bg: #FAFAF8;
  --bg-subtle: #F3F2EE;
  --text: #1A1A1A;
  --text-muted: #6B6B6B;
  --accent: #1E4FD8;
  --accent-hover: #1A45BE;
  --border: #E8E7E3;
  --success: #1F9D57;

  --font-sans: "Inter", "Noto Sans SC", "Source Han Sans SC", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-6: 48px;
  --space-8: 64px;
  --space-12: 96px;
  --space-16: 128px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ===== Typography scale (modular, ratio 1.333) ===== */
.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: none;
}

.h1 {
  font-size: 3.157rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.15;
}

.h2 {
  font-size: 2.369rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.body-text {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.7;
}

.mono {
  font-family: var(--font-mono);
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Create the minimal HTML skeleton**

Create `site/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>github-connector — 在对话里，操作你的仓库</title>
  <meta name="description" content="github-connector 让 ChatGPT 直接读写文件、管理 Issue 与 PR——用你自己的 GitHub 账号登录，权限始终在你手中。">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="site-nav">
    <span class="mono nav-logo">github-connector</span>
    <div class="nav-links">
      <a href="#tutorial" class="nav-link">文档</a>
      <a href="#cta" class="nav-cta">开始使用</a>
    </div>
  </nav>

  <main>
    <!-- Sections added in later tasks -->
  </main>

  <script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 3: Add nav styling to `style.css`**

Append to `site/style.css`:

```css
/* ===== Nav ===== */
.site-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid transparent;
  background: transparent;
  transition: background-color 0.3s var(--ease-out-expo), border-color 0.3s var(--ease-out-expo);
}

/* .surfaced is applied once, shortly after page load (per spec: the nav
   materializes "as the page loads, not instantly") — see the
   `nav.classList.add('surfaced')` call in script.js Task 2 Step 4's nav
   block. It stays applied afterward regardless of scroll position; this
   class name (not `.scrolled`) reflects that its trigger is load-timing,
   not scroll position. */
.site-nav.surfaced {
  background: rgba(250, 250, 248, 0.8);
  backdrop-filter: blur(8px);
  border-bottom-color: var(--border);
}

.nav-logo {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9375rem;
}

.nav-link:hover {
  color: var(--text);
}

.nav-cta {
  background: var(--accent);
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: background-color 0.2s var(--ease-out-expo);
}

.nav-cta:hover {
  background: var(--accent-hover);
}
```

- [ ] **Step 4: Verify visually with a local static server**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html` in a browser (or use the Playwright browser tool). Verify:
- Background is warm ivory (`#FAFAF8`), not pure white
- Nav bar shows `github-connector` wordmark in monospace on the left, `文档` link and a solid indigo `开始使用` button on the right
- No console errors

Stop the server (`Ctrl+C` or kill the background process) once verified.

- [ ] **Step 5: Commit**

```bash
git add site/style.css site/index.html
git commit -m "feat: add design system foundation and page skeleton for landing page"
```

---

### Task 2: Hero section + animation sequence

**Files:**
- Create: `site/script.js`
- Modify: `site/index.html` (add hero section inside `<main>`)
- Modify: `site/style.css` (add hero-specific styles)

**Interfaces:**
- Consumes: CSS tokens from Task 1 (`--bg`, `--accent`, `--success`, `--font-mono`, `--ease-out-expo`, `.eyebrow`, `.h1`, `.body-text` classes).
- Produces: a `revealOnScroll(selector, options)` helper function in `script.js` (top-level function, no ES modules — plain script, so later tasks' additions to the same `script.js` file can call it directly; `options` is an object with an optional `threshold` number, default `0.3`). Produces DOM structure `#hero-demo` (carrying `data-typed-text`/`data-result-text` attributes), `#hero-cursor`, `#hero-typed-line`, `#hero-result-card`, `#hero-result-text`, `#hero-headline`, `#hero-subhead` that later tasks do not touch except Task 5, which sets the `data-typed-text`/`data-result-text` attribute values on its own `index.en.html` copy of `#hero-demo`. Also modifies Task 1's nav markup to add `#nav-cta` and `#nav-cta-cursor` ids (the CTA button and its landed-cursor span) — Task 5 consumes these two ids when inserting the language-switch link into the nav.

- [ ] **Step 1: Add the hero HTML structure**

Modify `site/index.html`, replacing `<!-- Sections added in later tasks -->` with:

```html
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow">// github-connector</p>
        <div class="hero-demo mono" id="hero-demo" data-typed-text="把这个 issue 转成 PR" data-result-text="已创建 PR #128">
          <span id="hero-cursor" class="hero-cursor">▍</span><span id="hero-typed-line" class="hero-typed"></span>
          <div id="hero-result-card" class="hero-result">
            <span class="hero-result-check">✓</span> <span id="hero-result-text"></span>
          </div>
        </div>
        <h1 id="hero-headline" class="h1 hero-headline">在对话里，操作你的仓库。</h1>
        <p id="hero-subhead" class="body-text hero-subhead">github-connector 让 ChatGPT 直接读写文件、管理 Issue 与 PR——用你自己的 GitHub 账号登录，权限始终在你手中。</p>
      </div>
    </section>
```

Note the `data-typed-text` and `data-result-text` attributes on `#hero-demo`, and the new `#hero-result-text` span (previously the result text was hardcoded inline). This lets `script.js` read the hero's copy from the DOM instead of hardcoding it — Task 5's English page will set different values for these two `data-*` attributes, and the shared `script.js` reads them at runtime, so both language pages get correct, language-matched hero animation text from one shared script.

- [ ] **Step 2: Add hero styles**

Append to `site/style.css`:

```css
/* ===== Hero ===== */
.hero {
  position: relative;
  padding: var(--space-16) var(--space-4) var(--space-12);
}

/* Hairline divider that draws in left-to-right (per spec) once the hero
   sequence completes, instead of being a static border from page load. */
.hero::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--border);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.6s var(--ease-out-expo);
}

.hero.divider-drawn::after {
  transform: scaleX(1);
}

.hero-inner {
  max-width: 720px;
  margin: 0 auto;
}

.hero-demo {
  margin-top: var(--space-6);
  margin-bottom: var(--space-4);
  min-height: 80px;
}

.hero-cursor {
  color: var(--accent);
  font-size: 1.25rem;
  animation: blink 1.06s steps(1) infinite;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.hero-typed {
  color: var(--text-muted);
  font-size: 1.125rem;
}

.hero-result {
  display: none;
  align-items: center;
  gap: 8px;
  margin-top: var(--space-2);
  padding: 10px 16px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9375rem;
  color: var(--text);
  width: fit-content;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s var(--ease-out-expo), transform 0.4s var(--ease-out-expo);
}

.hero-result.visible {
  display: flex;
  opacity: 1;
  transform: translateY(0);
}

.hero-result-check {
  color: var(--success);
  font-weight: 700;
}

.hero-headline {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.5s var(--ease-out-expo), transform 0.5s var(--ease-out-expo);
}

.hero-headline.visible {
  opacity: 1;
  transform: translateY(0);
}

.hero-subhead {
  margin-top: var(--space-2);
  max-width: 560px;
  opacity: 0;
  transition: opacity 0.5s var(--ease-out-expo);
}

.hero-subhead.visible {
  opacity: 1;
}

.nav-cta.cursor-landed .nav-cta-cursor {
  animation: blink 1.06s steps(1) infinite;
}
```

- [ ] **Step 3: Update the nav CTA button to hold a cursor span**

Modify `site/index.html`'s nav (from Task 1), changing:

```html
      <a href="#cta" class="nav-cta">开始使用</a>
```

to:

```html
      <a href="#cta" class="nav-cta" id="nav-cta">开始使用 <span class="nav-cta-cursor mono" id="nav-cta-cursor" style="display:none;">▍</span></a>
```

- [ ] **Step 4: Write the hero animation sequence in `script.js`**

Create `site/script.js`:

```javascript
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
```

- [ ] **Step 5: Verify the hero animation manually**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html` in a browser. Verify, by watching the page load:
- A blinking indigo cursor appears alone first, in the hero area
- It types `把这个 issue 转成 PR` character by character
- After a pause, a small card with `✓ 已创建 PR #128` fades up
- The headline and subhead then fade/rise in
- The hero cursor visibly **travels** from its hero position to the nav CTA button — a smooth position slide, not an instant disappear/reappear — and a blinking cursor is left behind inside the nav's `开始使用` button once it lands
- Once the cursor lands, the hairline divider beneath the hero draws in from left to right (it should be invisible/zero-width before this point, not present from page load)
- Without scrolling at all, the nav bar's translucent/blurred background and bottom hairline appear on their own shortly (~250ms) after page load — do not scroll to trigger this; it must materialize even if the visitor never scrolls

Also test the reduced-motion path: in Chrome DevTools, open the Rendering tab, set "Emulate CSS media feature prefers-reduced-motion" to `reduce`, reload the page, and confirm the hero shows its final state immediately (typed text, result card, headline, landed nav cursor, and the drawn-in divider all present at once) with no animation played.

Stop the server once verified.

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/style.css site/script.js
git commit -m "feat: add hero section with 5-second cursor animation sequence"
```

---

### Task 3: Value-prop diff + 11-tools checklist sections

**Files:**
- Modify: `site/index.html` (add two sections inside `<main>`, after `.hero`)
- Modify: `site/style.css` (add styles for both sections)
- Modify: `site/script.js` (call `revealOnScroll` for the new sections' animated elements)

**Interfaces:**
- Consumes: `revealOnScroll(selector, options)` from Task 2's `script.js`; `.eyebrow`, `.mono` classes and color tokens from Task 1.
- Produces: DOM structure `.diff-section`, `.tools-section` that Task 4 does not touch (Task 4 adds its own sections after these).

- [ ] **Step 1: Add the value-prop diff section HTML**

Modify `site/index.html`, adding after the `</section>` that closes `.hero`:

```html
    <section class="diff-section">
      <div class="diff-inner">
        <p class="eyebrow">// 为什么需要它</p>
        <div class="diff-columns">
          <div class="diff-col diff-col-before mono">
            <p class="diff-header">− 没有 github-connector</p>
            <p class="diff-line diff-line-removed">切到 GitHub 网页</p>
            <p class="diff-line diff-line-removed">找到文件手动改</p>
            <p class="diff-line diff-line-removed">复制粘贴上下文</p>
          </div>
          <div class="diff-col diff-col-after mono">
            <p class="diff-header diff-header-accent">+ 有了 github-connector</p>
            <p class="diff-line diff-line-added">在对话里说一句话就行</p>
            <p class="diff-line diff-line-added">ChatGPT 直接帮你改</p>
            <p class="diff-line diff-line-added">不用离开对话窗口</p>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Add the 11-tools checklist section HTML**

Modify `site/index.html`, adding immediately after the `.diff-section`'s closing `</section>`:

```html
    <section class="tools-section">
      <div class="tools-inner">
        <p class="eyebrow">11 项能力，逐一验证过</p>
        <div class="tools-timeline">
          <div class="tools-rule"></div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">列出仓库文件树</span>
          </div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">读取单个文件内容</span>
          </div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">新增/修改文件</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">创建 Issue</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">列出 Issue</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">查询 Issue 详情</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">评论 Issue 或 PR</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">创建 PR</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">列出 PR</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">查询 PR 详情</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">合并 PR</span>
          </div>
        </div>
        <p class="tools-caption body-text">创建、评论、关闭 Issue——和你在 GitHub 网页上做的一样，只是现在你只需要说一句话。</p>
      </div>
    </section>
```

- [ ] **Step 3: Add styles for both sections**

Append to `site/style.css`:

```css
/* ===== Diff section ===== */
.diff-section {
  padding: var(--space-16) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.diff-inner {
  max-width: 900px;
  margin: 0 auto;
}

.diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  margin-top: var(--space-4);
}

@media (max-width: 720px) {
  .diff-columns {
    grid-template-columns: 1fr;
  }
}

.diff-header {
  font-size: 0.9375rem;
  font-weight: 500;
  margin-bottom: var(--space-2);
  color: var(--text-muted);
}

.diff-header-accent {
  color: var(--accent);
}

.diff-line {
  font-size: 0.9375rem;
  padding: 4px 0;
}

.diff-line-removed {
  color: var(--text-muted);
  text-decoration: line-through;
}

.diff-line-added {
  color: var(--accent);
}

/* ===== Tools section ===== */
.tools-section {
  padding: var(--space-16) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.tools-inner {
  max-width: 640px;
  margin: 0 auto;
}

.tools-timeline {
  position: relative;
  margin-top: var(--space-6);
  padding-left: var(--space-4);
}

.tools-caption {
  margin-top: var(--space-6);
  padding-left: var(--space-4);
}

.tools-rule {
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--border);
}

.tool-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 0;
}

/* Subtle grouping (per spec: "may be grouped subtly by category") — the
   first item of the "issue" group and the first item of the "pr" group
   each get a bit of extra top spacing via the adjacent-sibling combinator,
   reading as a soft break between the repo/issue/pr clusters without a
   hard card boundary. This is the actual (previously unused) purpose of
   each .tool-item's data-group attribute set in this task's HTML. */
.tool-item[data-group="repo"] + .tool-item[data-group="issue"],
.tool-item[data-group="issue"] + .tool-item[data-group="pr"] {
  margin-top: var(--space-2);
}

.tool-dot {
  position: absolute;
  left: calc(-1 * var(--space-4) + 0px);
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--bg);
  transition: background-color 0.3s var(--ease-out-expo), border-color 0.3s var(--ease-out-expo), transform 0.3s var(--ease-out-expo);
}

.tool-label {
  color: var(--text-muted);
  font-size: 1rem;
  transition: color 0.3s var(--ease-out-expo);
}

.tool-item.visible .tool-dot {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.15);
}

.tool-item.visible .tool-label {
  color: var(--text);
}
```

- [ ] **Step 4: Wire up scroll reveals in `script.js`**

Append to `site/script.js`:

```javascript
// ===== Section reveals =====
revealOnScroll('.tool-item', { threshold: 0.6 });
```

- [ ] **Step 5: Verify visually**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html`. Scroll down past the hero. Verify:
- The diff section shows two aligned columns, left with muted strikethrough text, right with indigo text, both in monospace
- The tools section shows 11 items along a vertical line; as you scroll each into view, its dot fills solid indigo and scales up slightly, and its label darkens from gray to near-black
- A slightly larger gap is visible between the 3rd/4th items (repo→issue boundary) and between the 7th/8th items (issue→pr boundary), reading as 3 soft sub-groups without hard card borders
- Scrolling back up does not un-reveal items already revealed
- Beneath the 11 items, a caption line reads "创建、评论、关闭 Issue——和你在 GitHub 网页上做的一样，只是现在你只需要说一句话。"

Stop the server once verified.

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/style.css site/script.js
git commit -m "feat: add value-prop diff and 11-tools checklist sections"
```

---

### Task 4: Security section + 3-step tutorial + closing CTA

**Files:**
- Modify: `site/index.html` (add three sections inside `<main>`, after `.tools-section`)
- Modify: `site/style.css` (add styles for all three sections)
- Modify: `site/script.js` (wire up the tutorial's relay-line reveal)

**Interfaces:**
- Consumes: `revealOnScroll` from Task 2, color tokens and typography classes from Task 1.
- Produces: nothing further consumed by later tasks — this completes the Chinese page's content. Task 5 reads this HTML structure directly to produce the English translation.

- [ ] **Step 1: Add the security section HTML**

Modify `site/index.html`, adding after the `.tools-section`'s closing `</section>`:

```html
    <section class="security-section">
      <div class="security-inner">
        <div class="security-badge">
          <span class="security-lock">🔒</span>
          <p class="security-title">你的 GitHub 账号，你的授权</p>
          <p class="security-caption">每个用户使用自己的 GitHub 账号登录，服务端不保存任何共享凭据。</p>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Add the 3-step tutorial section HTML**

Modify `site/index.html`, adding after the `.security-section`'s closing `</section>`:

Each step includes a small inline SVG icon (a simplified illustrative
diagram, per spec — not a raw screenshot), styled to use only `--accent`/
`--text-muted` strokes so it matches the page's restrained palette exactly:

```html
    <section class="tutorial-section" id="tutorial">
      <div class="tutorial-inner">
        <p class="eyebrow">// 三步完成接入</p>
        <div class="tutorial-steps">
          <div class="tutorial-relay-line"><div class="tutorial-relay-fill"></div></div>
          <div class="tutorial-step" data-step="1">
            <span class="step-number">1</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M9 7V3m6 4V3M6 10h12a1 1 0 011 1v3a5 5 0 01-5 5h-4a5 5 0 01-5-5v-3a1 1 0 011-1z"/>
              <path d="M9 19v2m6-2v2"/>
            </svg>
            <h3 class="step-title">添加连接器</h3>
            <p class="step-desc">ChatGPT → 设置 → Connectors → 新建 App，Server URL 填 <code class="mono">https://github-connector.jason1105.uk/mcp</code>。</p>
          </div>
          <div class="tutorial-step" data-step="2">
            <span class="step-number">2</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="1.5"/>
              <path d="M8 11V8a4 4 0 018 0v3"/>
              <circle cx="12" cy="15" r="1.25" fill="currentColor" stroke="none"/>
            </svg>
            <h3 class="step-title">用 GitHub 登录并授权</h3>
            <p class="step-desc">Authentication 选择 <strong>OAuth</strong>；点击 Create 后会跳转到 GitHub 登录页，用你自己的账号登录并授权。</p>
          </div>
          <div class="tutorial-step" data-step="3">
            <span class="step-number">3</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H10l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z"/>
              <path d="M8 10h8M8 13h5"/>
            </svg>
            <h3 class="step-title">直接在对话里下指令</h3>
            <p class="step-desc">例如"列出这个仓库的文件"或"把这个 issue 转成 PR"，ChatGPT 会调用 github-connector 完成操作。</p>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 3: Add the closing CTA section HTML**

Modify `site/index.html`, adding after the `.tutorial-section`'s closing `</section>`:

```html
    <section class="closing-cta" id="cta">
      <div class="closing-cta-inner">
        <h2 class="h2">在对话里，操作你的仓库。</h2>
        <a href="https://chatgpt.com" class="closing-cta-button">开始使用</a>
        <p class="closing-cta-endpoint mono">github-connector.jason1105.uk/mcp</p>
      </div>
    </section>
```

- [ ] **Step 4: Add styles for all three sections**

Append to `site/style.css`:

```css
/* ===== Security section ===== */
.security-section {
  padding: var(--space-16) var(--space-4);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: center;
}

.security-badge {
  max-width: 480px;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.2s var(--ease-out-expo), transform 0.2s var(--ease-out-expo);
}

.security-badge:hover {
  border-color: var(--accent);
  transform: scale(1.02);
}

.security-lock {
  font-size: 1.75rem;
  display: block;
  margin-bottom: var(--space-2);
}

.security-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.security-caption {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

/* ===== Tutorial section ===== */
.tutorial-section {
  padding: var(--space-16) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.tutorial-inner {
  max-width: 960px;
  margin: 0 auto;
}

.tutorial-steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
  margin-top: var(--space-6);
}

@media (max-width: 720px) {
  .tutorial-steps {
    grid-template-columns: 1fr;
  }
}

/* Two stacked lines: a static gray track (always visible, shows the full
   path) and an indigo fill line that grows left-to-right via scaleX — this
   is the actual "relay baton" motion the spec describes, driven by a single
   timed animation rather than per-step independent triggers (which, on the
   desktop 3-column grid, would fire near-simultaneously and never look
   sequential). */
.tutorial-relay-line {
  position: absolute;
  top: 15px;
  left: calc(16.66% + 15px);
  right: calc(16.66% + 15px);
  height: 1px;
  background: var(--border);
  z-index: 0;
}

.tutorial-relay-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 1.2s var(--ease-out-expo);
}

.tutorial-relay-line.running .tutorial-relay-fill {
  transform: scaleX(1);
}

@media (max-width: 720px) {
  .tutorial-relay-line {
    display: none;
  }
}

.tutorial-step {
  position: relative;
  z-index: 1;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  color: var(--text-muted);
  font-weight: 600;
  background: var(--bg);
  transition: background-color 0.3s var(--ease-out-expo), border-color 0.3s var(--ease-out-expo), color 0.3s var(--ease-out-expo);
}

.tutorial-step.visible .step-number {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.step-icon {
  display: block;
  width: 28px;
  height: 28px;
  margin-top: var(--space-2);
  color: var(--text-muted);
  transition: color 0.3s var(--ease-out-expo);
}

.tutorial-step.visible .step-icon {
  color: var(--accent);
}

.step-title {
  margin-top: var(--space-2);
  font-size: 1.125rem;
  font-weight: 600;
}

.step-desc {
  margin-top: var(--space-1);
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.step-desc code {
  background: var(--bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* ===== Closing CTA ===== */
.closing-cta {
  padding: var(--space-16) var(--space-4);
  text-align: center;
}

.closing-cta-inner {
  max-width: 560px;
  margin: 0 auto;
}

.closing-cta-button {
  display: inline-block;
  margin-top: var(--space-4);
  background: var(--accent);
  color: white;
  padding: 14px 32px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 1.0625rem;
  font-weight: 500;
  transition: background-color 0.2s var(--ease-out-expo);
}

.closing-cta-button:hover {
  background: var(--accent-hover);
}

.closing-cta-endpoint {
  margin-top: var(--space-4);
  font-size: 0.875rem;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Wire up the tutorial relay-line reveal in `script.js`**

The relay effect must look sequential — the fill line grows once, and each
step lights up in turn as the line visually reaches it. A per-step
`IntersectionObserver` (one trigger per step) does not produce this: on the
desktop 3-column grid all three steps enter the viewport within the same
scroll frame and would light up almost simultaneously. Instead, use a
single `IntersectionObserver` on the whole `.tutorial-steps` container to
detect the one moment the section enters view, then drive the line-fill
animation and the three steps' lit-up timing with fixed, hand-tuned delays
that match the CSS fill transition's duration (1.2s, set in Task 4 Step 4's
CSS on `.tutorial-relay-fill`).

Append to `site/script.js`:

```javascript
function runTutorialRelay() {
  const relayLine = document.querySelector('.tutorial-relay-line');
  const steps = document.querySelectorAll('.tutorial-step');

  relayLine.classList.add('running');

  // Stagger each step's "lit" moment to roughly track where a line growing
  // over 1.2s (the CSS transition duration) would visually be when it
  // passes that step's position (steps sit at roughly 0%, 50%, 100% along
  // the line).
  const delays = [0, 500, 1000];
  steps.forEach((step, i) => {
    setTimeout(() => step.classList.add('visible'), delays[i] || 0);
  });
}

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.tutorial-step').forEach(step => step.classList.add('visible'));
  const relayLine = document.querySelector('.tutorial-relay-line');
  if (relayLine) relayLine.classList.add('running');
} else {
  const tutorialSteps = document.querySelector('.tutorial-steps');
  if (tutorialSteps) {
    let relayStarted = false;
    const tutorialObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !relayStarted) {
          relayStarted = true;
          runTutorialRelay();
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    tutorialObserver.observe(tutorialSteps);
  }
}
```

Do not also call the generic `revealOnScroll('.tutorial-step', ...)` helper
for this section — it would double-drive the `.visible` class with
conflicting timing. This section intentionally uses its own dedicated
sequencing logic instead of the shared helper, because the shared helper's
one-observer-per-element model cannot express "in order, with a deliberate
delay between each."

- [ ] **Step 6: Verify visually**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html`, scroll through the full page. Verify:
- Security section shows a centered card; hovering it shows a subtle indigo border outline and a very slight scale increase (no shadow/lift)
- Tutorial section: scrolling it into view triggers an indigo line to visibly grow left-to-right over the gray track line (not appear instantly), and each step's number circle fills solid indigo one at a time, in order (1, then 2, then 3, not all three at once)
- The tutorial step 1 description contains the real URL `https://github-connector.jason1105.uk/mcp`
- Closing CTA shows a headline, a solid indigo button, and the endpoint URL below it in monospace
- Clicking the nav's `文档` link and the `开始使用` nav button both scroll smoothly to the correct sections
- With `prefers-reduced-motion: reduce` emulated (Chrome DevTools Rendering tab), the tutorial section shows the fully-filled line and all 3 steps lit up immediately, no animation

Stop the server once verified.

- [ ] **Step 7: Commit**

```bash
git add site/index.html site/style.css site/script.js
git commit -m "feat: add security section, 3-step tutorial, and closing CTA"
```

---

### Task 5: English translation (`index.en.html`)

**Files:**
- Create: `site/index.en.html`
- Modify: `site/index.html` (add language-switch link in nav)

**Interfaces:**
- Consumes: the complete Chinese `site/index.html` structure from Tasks 1-4, `site/style.css`, `site/script.js` (both shared, unmodified by this task). Specifically consumes the `data-typed-text`/`data-result-text` attributes on `#hero-demo` (established in Task 2) as the mechanism for giving the English page its own hero copy without modifying `script.js`.
- Produces: nothing further consumed by later tasks.

- [ ] **Step 1: Add a language-switch link to the Chinese page's nav**

Modify `site/index.html`'s `.nav-links` div (structure from Task 1), changing:

```html
    <div class="nav-links">
      <a href="#tutorial" class="nav-link">文档</a>
      <a href="#cta" class="nav-cta" id="nav-cta">开始使用 <span class="nav-cta-cursor mono" id="nav-cta-cursor" style="display:none;">▍</span></a>
    </div>
```

to:

```html
    <div class="nav-links">
      <a href="#tutorial" class="nav-link">文档</a>
      <a href="index.en.html" class="nav-link">English</a>
      <a href="#cta" class="nav-cta" id="nav-cta">开始使用 <span class="nav-cta-cursor mono" id="nav-cta-cursor" style="display:none;">▍</span></a>
    </div>
```

- [ ] **Step 2: Create `site/index.en.html` as a full English translation**

Create `site/index.en.html` by translating every piece of visible Chinese copy from the final `site/index.html` (as completed through Task 4) into English, keeping the exact same HTML structure, `id`/`class` attributes (so `script.js` and `style.css` work unmodified), and section order. Use this exact translation mapping:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>github-connector — Operate your repos, right in the conversation</title>
  <meta name="description" content="github-connector lets ChatGPT read and write files, manage issues, and manage pull requests directly — you sign in with your own GitHub account, so you always stay in control.">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="site-nav">
    <span class="mono nav-logo">github-connector</span>
    <div class="nav-links">
      <a href="#tutorial" class="nav-link">Docs</a>
      <a href="index.html" class="nav-link">中文</a>
      <a href="#cta" class="nav-cta" id="nav-cta">Get Started <span class="nav-cta-cursor mono" id="nav-cta-cursor" style="display:none;">▍</span></a>
    </div>
  </nav>

  <main>
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow">// github-connector</p>
        <div class="hero-demo mono" id="hero-demo" data-typed-text="Turn this issue into a PR" data-result-text="Created PR #128">
          <span id="hero-cursor" class="hero-cursor">▍</span><span id="hero-typed-line" class="hero-typed"></span>
          <div id="hero-result-card" class="hero-result">
            <span class="hero-result-check">✓</span> <span id="hero-result-text"></span>
          </div>
        </div>
        <h1 id="hero-headline" class="h1 hero-headline">Operate your repos, right in the conversation.</h1>
        <p id="hero-subhead" class="body-text hero-subhead">github-connector lets ChatGPT read and write files, manage issues, and manage pull requests directly — you sign in with your own GitHub account, so you always stay in control.</p>
      </div>
    </section>

    <section class="diff-section">
      <div class="diff-inner">
        <p class="eyebrow">// Why you need it</p>
        <div class="diff-columns">
          <div class="diff-col diff-col-before mono">
            <p class="diff-header">− Without github-connector</p>
            <p class="diff-line diff-line-removed">Switch to the GitHub web UI</p>
            <p class="diff-line diff-line-removed">Find the file, edit it by hand</p>
            <p class="diff-line diff-line-removed">Copy-paste context back and forth</p>
          </div>
          <div class="diff-col diff-col-after mono">
            <p class="diff-header diff-header-accent">+ With github-connector</p>
            <p class="diff-line diff-line-added">Just say it in the conversation</p>
            <p class="diff-line diff-line-added">ChatGPT makes the change directly</p>
            <p class="diff-line diff-line-added">Never leave the chat window</p>
          </div>
        </div>
      </div>
    </section>

    <section class="tools-section">
      <div class="tools-inner">
        <p class="eyebrow">11 capabilities, each one verified</p>
        <div class="tools-timeline">
          <div class="tools-rule"></div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">List repository file tree</span>
          </div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">Read a single file's contents</span>
          </div>
          <div class="tool-item" data-group="repo">
            <span class="tool-dot"></span>
            <span class="tool-label">Create or update a file</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">Create an issue</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">List issues</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">Get issue details</span>
          </div>
          <div class="tool-item" data-group="issue">
            <span class="tool-dot"></span>
            <span class="tool-label">Comment on an issue or PR</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">Create a pull request</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">List pull requests</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">Get pull request details</span>
          </div>
          <div class="tool-item" data-group="pr">
            <span class="tool-dot"></span>
            <span class="tool-label">Merge a pull request</span>
          </div>
        </div>
        <p class="tools-caption body-text">Create, comment on, and close issues — exactly like you would on GitHub's own site, except now it only takes a sentence.</p>
      </div>
    </section>

    <section class="security-section">
      <div class="security-inner">
        <div class="security-badge">
          <span class="security-lock">🔒</span>
          <p class="security-title">Your GitHub account, your authorization</p>
          <p class="security-caption">Every user signs in with their own GitHub account — the server never stores a shared credential.</p>
        </div>
      </div>
    </section>

    <section class="tutorial-section" id="tutorial">
      <div class="tutorial-inner">
        <p class="eyebrow">// Connect in three steps</p>
        <div class="tutorial-steps">
          <div class="tutorial-relay-line"><div class="tutorial-relay-fill"></div></div>
          <div class="tutorial-step" data-step="1">
            <span class="step-number">1</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M9 7V3m6 4V3M6 10h12a1 1 0 011 1v3a5 5 0 01-5 5h-4a5 5 0 01-5-5v-3a1 1 0 011-1z"/>
              <path d="M9 19v2m6-2v2"/>
            </svg>
            <h3 class="step-title">Add the connector</h3>
            <p class="step-desc">ChatGPT → Settings → Connectors → Create new app. Set the Server URL to <code class="mono">https://github-connector.jason1105.uk/mcp</code>.</p>
          </div>
          <div class="tutorial-step" data-step="2">
            <span class="step-number">2</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="1.5"/>
              <path d="M8 11V8a4 4 0 018 0v3"/>
              <circle cx="12" cy="15" r="1.25" fill="currentColor" stroke="none"/>
            </svg>
            <h3 class="step-title">Sign in with GitHub and authorize</h3>
            <p class="step-desc">Set Authentication to <strong>OAuth</strong>. After clicking Create, you'll be redirected to GitHub's login page — sign in with your own account and approve access.</p>
          </div>
          <div class="tutorial-step" data-step="3">
            <span class="step-number">3</span>
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H10l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z"/>
              <path d="M8 10h8M8 13h5"/>
            </svg>
            <h3 class="step-title">Just ask, right in the chat</h3>
            <p class="step-desc">For example, "list the files in this repo" or "turn this issue into a PR" — ChatGPT will call github-connector to do it.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="closing-cta" id="cta">
      <div class="closing-cta-inner">
        <h2 class="h2">Operate your repos, right in the conversation.</h2>
        <a href="https://chatgpt.com" class="closing-cta-button">Get Started</a>
        <p class="closing-cta-endpoint mono">github-connector.jason1105.uk/mcp</p>
      </div>
    </section>
  </main>

  <script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify both language versions side by side**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html` and `http://localhost:8935/index.en.html` in two browser tabs. Verify:
- Both pages have identical layout, animation behavior, and styling — only the visible copy differs
- Clicking `English` on the Chinese page navigates to `index.en.html`; clicking `中文` on the English page navigates back to `index.html`
- The Chinese page's hero types `把这个 issue 转成 PR` and shows result text `已创建 PR #128`; the English page's hero types `Turn this issue into a PR` and shows result text `Created PR #128` — both driven by the same shared `script.js` reading each page's own `data-typed-text`/`data-result-text` attributes on `#hero-demo` (added in this task's Step 1), so no per-language branching inside `script.js` itself was needed

Stop the server once verified.

- [ ] **Step 3: Commit**

```bash
git add site/index.html site/index.en.html
git commit -m "feat: add English translation of the landing page"
```

---

### Task 6: Vercel deployment config + local verification

**Files:**
- Create: `site/vercel.json`

**Interfaces:**
- Consumes: the completed `site/` directory from Tasks 1-5.
- Produces: nothing (terminal task).

- [ ] **Step 1: Create the Vercel config for this independent static site**

Create `site/vercel.json`:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

- [ ] **Step 2: Verify the full site one more time as a whole, from the `site/` directory**

Run:
```bash
cd site && python3 -m http.server 8935
```

Open `http://localhost:8935/index.html`. Do a full read-through:
- Every section renders without layout breakage at both a wide desktop width (1440px) and a narrow mobile width (375px) — use browser DevTools' device toolbar to check both
- No broken links (nav anchors, language switch)
- No console errors in the browser DevTools console

Stop the server once verified.

- [ ] **Step 3: Commit**

```bash
git add site/vercel.json
git commit -m "chore: add Vercel static-site config for the landing page"
```

- [ ] **Step 4: Note manual, non-coding follow-up steps for the user**

These are NOT part of this plan's coding tasks — record them in the final task report for the controller to relay to the user:
1. Create a new, independent Vercel project pointing at this repo with **Root Directory** set to `site/` (Vercel dashboard → New Project → import this repo → set Root Directory to `site` → Framework Preset: Other → deploy).
2. Add a DNS CNAME record for `www.github-connector.jason1105.uk` pointing at the new Vercel project's assigned domain, then add that subdomain in the new Vercel project's Domains settings.
3. This is entirely separate from the existing MCP server's Vercel project — no existing production deployment is modified by this work.

---

## Process

Per project convention: this plan was written after a spec (`docs/superpowers/specs/2026-07-08-marketing-landing-page-design.md`) already reviewed and merged via issue #9 / PR #10. Execute this plan via subagent-driven-development, with a fresh GitHub issue tracking implementation and a PR from a feature branch into `main` — not direct commits to `main` — matching the process used for the OAuth migration.
