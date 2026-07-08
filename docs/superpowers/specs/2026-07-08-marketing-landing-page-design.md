# Marketing Landing Page — Design Spec

## Context

`github-connector` is a live, working ChatGPT App (MCP connector) that lets any
ChatGPT user operate on their own GitHub repositories — list/read/write files,
manage issues, manage pull requests — by authenticating with their own GitHub
account via OAuth. It has shipped, been reviewed, and been verified end-to-end
in production at `https://github-connector.jason1105.uk/mcp`.

The existing `README.md`/`README.en.md` and `docs/dev-guide/` are aimed at
*developers* (how to self-host, architecture diagrams, internal design
review). Neither is meant for, nor suitable for, an end user who just wants to
know "what is this and how do I turn it on in ChatGPT."

This spec covers a new, separate **marketing landing page**: a single static
page whose only job is to get a visitor from "never heard of this" to
"connected in ChatGPT" as fast and pleasantly as possible. It does **not**
teach self-hosting or deployment — only usage of the already-deployed public
service.

## Goals

- Hook a visitor's interest within 5 seconds of page load (the client's
  explicit, primary success metric).
- Communicate the core value prop (control GitHub through a ChatGPT
  conversation) and the key trust signal (per-user OAuth, no shared
  credentials) clearly and quickly.
- Walk a visitor through the exact 3 steps to connect the service in ChatGPT.
- Feel 简洁优雅 (clean/elegant) — not a generic "AI SaaS gradient" page.
- Ship bilingual: Chinese primary, English secondary (same pattern as the
  existing README split), deployed on its own subdomain.

## Non-goals

- Not a self-hosting/deployment guide (that's `README.md`).
- Not an architecture/internals doc (that's `docs/dev-guide/`).
- Not a full design system or component library — this is one page.
- No backend, no forms, no analytics pixel, no A/B testing infrastructure in
  this iteration — a single static page is the entire scope.

## Design process (how this direction was chosen)

Four fully independent visual/copy concepts were generated in parallel via a
multi-agent workflow, each committing to a distinct aesthetic direction:

1. **`terminal-craft`** — dark, monospace-forward "polished CLI" aesthetic.
2. **`editorial-calm`** — light, whitespace-driven "editorial confidence"
   aesthetic (Stripe/Linear register).
3. **`conversational-motion`** — hero-as-live-chat-demo, product UI as the
   visual centerpiece.
4. **`bold-graphic`** — maximalist single-accent-color, oversized type.

Each concept was scored independently by two separate judge passes across six
weighted dimensions (5-second hook, elegance/restraint, navigation clarity,
motion craft, copy persuasiveness, plain-HTML/CSS/JS feasibility). Both
judging passes for `editorial-calm` landed on the identical total score
(46/60), ahead of a tie between `terminal-craft` and `conversational-motion`
(44/60 each) and well ahead of `bold-graphic` (35/60).

**`editorial-calm` won because its differentiation is strategic, not just
stylistic**: the other three concepts all converge on the same dark-theme /
monospace / neon-accent visual vocabulary that judges flagged as *already the
new cliché* in dev-tool marketing pages. `editorial-calm`'s bet — that
restraint itself is the pattern-interrupt against a sea of dark terminal
pages — was also the only concept both judges rated as realistically buildable
with plain CSS transitions and `IntersectionObserver`, no framework or
animation library required.

The synthesis stage then selectively grafted the single best idea from a
runner-up concept (`terminal-craft`'s "one continuous cursor object the eye
tracks for 5 seconds, resolving into the CTA" mechanic) into the winning
direction, since it directly patches `editorial-calm`'s one flagged
weakness — that a near-empty page risks reading as "unfinished" rather than
"premium" — without diluting its core identity.

## Visual direction: 「留白宣言」— Restrained Certainty

The page communicates trust through discipline, not spectacle. Warm-ivory
canvas, generous whitespace, exactly one accent color, motion that never
bounces or overshoots. Reference register: Stripe's documentation pages or a
well-set editorial page — not a typical SaaS gradient landing page.

### Color palette (exact)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#FAFAF8` | Page background (warm ivory, never pure white) |
| `--bg-subtle` | `#F3F2EE` | Rare section-band shading for rhythm; used sparingly |
| `--text` | `#1A1A1A` | Primary text (near-black) |
| `--text-muted` | `#6B6B6B` | Subheads, captions, eyebrow labels |
| `--accent` | `#1E4FD8` | The single accent — CTAs, cursor, `+` diff lines, active dots, hover states |
| `--accent-hover` | `#1A45BE` | Accent color on button hover only |
| `--border` | `#E8E7E3` | Hairline dividers, card outlines |
| `--success` | `#1F9D57` | One-time use only: the ✓ on the hero's result card. Nowhere else on the page. |

Hard rules: no gradients anywhere on the page; no dark mode variant in this
iteration; `--accent` is the only saturated color on the page except the
single hero ✓.

### Typography

- **Chinese body & headlines:** Source Han Sans / Noto Sans SC. Headlines
  Bold with `letter-spacing: 0.02em`. Body Regular/Medium.
- **Latin UI text:** Inter (nav labels, buttons, running English words).
- **Code / monospace:** JetBrains Mono — used for the logo wordmark
  `github-connector`, the diff `+`/`−` lines in the value-prop section, the
  MCP endpoint URL, and the hero's typed demo line. This is the deliberate
  in-group trust signal for a developer audience.
- Modular type scale, `1rem = 16px`, ratio 1.333, 8px baseline grid.

### Motion law (applies to the whole page)

- Easing is always `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo). No bounce, no
  overshoot, no color-flash transitions anywhere.
- Every animation must degrade gracefully: honor `prefers-reduced-motion`
  (skip straight to final state, no animation at all); and if the hero
  sequence hasn't started smoothly within 800ms of load (e.g. slow device),
  snap directly to the fully-composed final frame rather than playing a
  stuttering partial version.
- Scroll-triggered reveals use `IntersectionObserver`, not scroll-position
  math — simpler, and correctly a one-shot reveal (plays once per element,
  does not replay on scroll-back-up).

## Page structure and content

### 1. Hero (the 5-second hook)

Minimal nav bar: JetBrains Mono wordmark `github-connector` on the left;
a `文档` (docs) link plus a solid indigo `开始使用` (Get Started) button on the
right, both anchor-scrolling to the tutorial/CTA section. Nav surfaces with a
`backdrop-filter: blur` + hairline bottom border as the page loads, not
instantly.

Left-aligned hero content (not centered) in a max-width column, deep
whitespace above and below.

Precise animation timeline:

- **0.0s–0.4s:** Canvas is `--bg`, near-empty except a tiny muted eyebrow
  label (`// github-connector`, JetBrains Mono, `--text-muted`) top-left. At
  the vertical optical center, a single indigo cursor block (`▍`, `--accent`)
  blinks at an authentic terminal cadence (~530ms period). This is the very
  first thing the eye lands on — a concrete "something is here, on purpose"
  signal, not a skeleton loader.
- **0.4s–1.6s:** The cursor types one line character-by-character with
  slight human jitter (40–90ms per character), in JetBrains Mono, muted gray:
  `把这个 issue 转成 PR`.
- **1.6s–2.0s:** A deliberate ~400ms pause (a "thinking" beat).
- **2.0s–3.0s:** Below the typed line, a minimal result card fades up 8px
  (`opacity 0→1`, `translateY 8px→0`): `已创建 PR #128` with a small
  `--success` ✓ — the page's one non-indigo highlight, used exactly once,
  here only.
- **3.0s–4.0s:** The real headline reveals above the demo card: each
  character/word rises independently (`opacity:0, translateY:8px`, ~30ms
  stagger, ~500ms total). Subhead fades in as one whole line beneath it.
- **4.0s–5.0s:** The typing cursor, its job done, smoothly migrates and
  resolves into the blinking cursor inside the CTA button itself
  (`开始使用 ▍`), ~400ms ease. A hairline divider draws left-to-right beneath
  the hero. This is the payoff: one continuous indigo object the eye follows
  for the full 5 seconds, resolving into the thing to click.

### 2. Value proposition — rendered as a diff

Eyebrow label: `// 为什么需要它`. Two aligned columns, both in JetBrains Mono,
same number of lines each, styled as a `git diff`:

- Left column, header `− 没有 github-connector`, muted strikethrough lines
  (exact, 3 lines): `切到 GitHub 网页` / `找到文件手动改` / `复制粘贴上下文`
- Right column, header `+ 有了 github-connector`, `--accent`-colored lines,
  same line count (exact, 3 lines): `在对话里说一句话就行` / `ChatGPT 直接帮你改` /
  `不用离开对话窗口`

Generous vertical padding (≥120px) above and below this section.

### 3. Capability highlights — the 11 tools

Eyebrow label: `11 项能力，逐一验证过` (concrete number + "verified," never
vague superlatives like "强大"/"全面").

Not a card grid. A single hairline vertical rule on the left edge; each tool
label sits along it. As each one scrolls into view
(`IntersectionObserver`-triggered, plays once), its label transitions
`--text-muted → --text` and its marker dot fills from hollow to solid
`--accent`, scaling from 1 to 1.15 with no rebound/overshoot. Reads as "a
verified checklist being ticked off." Tools may be grouped subtly by
category (repo files / issues / pull requests) without hard card boundaries.

### 4. Security / OAuth trust section

Its own quiet screen with deep whitespace — deliberately the calmest section
on the page, reinforcing "we don't need to shout about security."

One centered badge card. On hover (not tap-required, but works on touch via
focus-visible too): no lift, no shadow — a lock icon inside shifts from
closed to closed-with-a-keyhole-glint highlight, and the card border draws a
1px `--accent` outline. Motion amplitude capped at scale 1.02.

Sub-caption, deliberately low-key and technical, not hype:
"每个用户使用自己的 GitHub 账号登录，服务端不保存任何共享凭据。"

### 5. Three-step tutorial

Three steps in a row (stacking vertically on narrow viewports). On
scroll-into-view, a single `--accent` hairline animates left-to-right through
step 1 → 2 → 3 once (a "relay baton"), each step number flipping from a gray
outline to solid-indigo-on-white as the line reaches it. Plays once; a
visitor can still click/tap any step directly to view it without waiting for
the animation.

Step content (exact, matches the real, verified ChatGPT connector flow):

1. **添加连接器** — ChatGPT → 设置 → Connectors → 新建 App，Server URL 填
   `https://github-connector.jason1105.uk/mcp`。
2. **用 GitHub 登录并授权** — Authentication 选择 **OAuth**；点击 Create 后会
   跳转到 GitHub 登录页，用你自己的账号登录并授权。
3. **直接在对话里下指令** — 例如"列出这个仓库的文件"或"把这个 issue 转成
   PR"，ChatGPT 会调用 github-connector 完成操作。

Each step gets a simplified illustrative diagram (not a raw screenshot, to
stay visually consistent with the rest of the page's restrained style),
rendered in the same ivory/indigo palette.

### 6. Closing CTA

Generous whitespace. One headline, one solid indigo button (label: `开始使用`).
No urgency/scarcity copy ("限时"/"仅剩" etc. — dishonest given this is a free,
always-available service). Below the button, the real MCP endpoint URL in
JetBrains Mono (`github-connector.jason1105.uk/mcp`) as a small transparency
signal, not a demand for action.

## Copy (Chinese, primary language)

- **Headline:** 在对话里，操作你的仓库。
- **Subheadline:** github-connector 让 ChatGPT 直接读写文件、管理 Issue 与
  PR——用你自己的 GitHub 账号登录，权限始终在你手中。
- **Feature bullet (issues/PRs):** 创建、评论、关闭 Issue——和你在 GitHub
  网页上做的一样，只是现在你只需要说一句话。
- **Feature bullet (security):** 每个用户用自己的 GitHub 账号授权，服务端不
  保存任何共享凭据——安全，不必大声宣告。
- **CTA button label:** 开始使用

Remaining section copy (nav labels, step instructions, diff-column lines,
etc.) is specified in the Page Structure section above; any copy not
explicitly given there should be written in the same voice during
implementation — concrete, unhyped, technically precise, never inflated
superlatives.

## Bilingual approach

Chinese is the primary/default language, matching the existing
`README.md`/`README.en.md` split. Implementation: two static HTML files,
`index.html` (Chinese) and `index.en.html` (English), sharing the same
`style.css` and `script.js`. A small language-switch link (`中文 | English`)
in the nav, matching the pattern already established in the README files —
no client-side i18n framework, no query-param locale switching, just two
plain files that link to each other.

## Technical approach

- **Stack:** plain static HTML/CSS/JS — no build step, no framework,
  matching `docs/dev-guide/`'s existing precedent in this repo. Chosen
  explicitly because the design was scored on "buildable with plain
  HTML/CSS/JS" as a hard constraint, and the repo has no existing frontend
  build tooling to introduce for a single page.
- **Location in repo:** `site/` at the repo root (sibling to `docs/`, `src/`,
  `api/`) — distinct from `docs/dev-guide/`, which is an internal
  developer-facing design-review doc, not a public marketing page.
- **Deployment:** a **new, independent Vercel project** pointing at the
  `site/` directory, deployed to its own subdomain:
  **`www.github-connector.jason1105.uk`**. This is deliberately kept
  separate from the existing production MCP server's Vercel project and
  `vercel.json` — the MCP server's deployment config is not touched by this
  work at all, avoiding any risk to the live, verified OAuth service.
  Requires one new DNS CNAME record (user-performed, not part of the coding
  tasks) pointing the subdomain at the new Vercel project.
- **Animation implementation:** plain CSS transitions/keyframes plus
  `IntersectionObserver` for scroll-triggered reveals. No animation library,
  no WebGL, no canvas — consistent with the concept that won specifically
  for its low-complexity feasibility.

## Process

Per established project convention: this spec → an implementation plan
(`docs/superpowers/plans/`) → subagent-driven-development execution, via a
GitHub issue and PR (not direct commits to `main`), same as the OAuth
migration work.

## Out of scope / explicitly deferred

- No analytics/tracking of any kind in this iteration.
- No dark-mode variant.
- No additional pages (privacy policy, terms, blog) — single page only.
- No CMS or content-editing tooling — copy is hand-authored static HTML.
- Custom domain DNS setup is a manual, user-performed step, not a coding
  task in the implementation plan.
