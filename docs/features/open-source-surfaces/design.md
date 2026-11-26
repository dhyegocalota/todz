# Design: where todz cloud vs self-host lives on todz.app

Read: main `apps/api/src/site/landing-page.ts`, `landing-copy.ts`, `site-style.ts`; the branch as built in worktree `agent-acc4df3f363dab510` (`waysHtml`, `downloadHtml`, `star-pill.ts`, `site-shell.ts`); zapbip `views/landing-page.tsx`, `hero-section.tsx`, `open-source-section.tsx`. The live walk was not possible (the Playwright MCP browser is not installed here); the wireframes come from the source and the tokens.

## What the branch does today, and why it reads long

- The order is hero → **ways (two cards)** → benefits → how it works → final → footer. The choice comes before any proof, so the screenshots and the terminal sit one screen further down.
- At 390 px, `.hero-buttons` is a column with `align-items:stretch`: Download, Free and the star pill stack as three full-width capsules, then the notarization note, then "Open source · AGPL-3.0". That is five rows of chrome under the lead.
- "Free" shows three times (hero line, chip, cloud badge). Download shows three times (hero, cloud card, final). The star pill shows twice (hero, footer).

## Shared across all options (hero action row)

```
desktop                                          390 px
  Free on todz cloud — or run your own.            Free on todz cloud —
  [ Download for Mac ] (Free)  [GH ★ Star  1.2k]     or run your own.
  Not notarized by Apple yet: … Install steps      [ Download for Mac   ](Free)
                                                       [GH ★ Star  1.2k]
                                                   Not notarized by Apple yet: …
```

- Download and the Free chip share one row at every width (`.hero-buttons` becomes a row and wraps); the chip is a `.free-chip.glass` tag, not a button. At 390 px the button grows and the chip keeps its width: "Download for Mac" plus the chip fits in 358 px.
- The star pill gets its own row at 390 px, at its natural width and centred, never stretched. At desktop it joins the row, after a `--space-4` gap.
- "run your own" in the hero line links in-page to `#ways`. Copy unchanged; only the link is new.
- The hero "Open source · AGPL-3.0" line goes: the star pill already says open source, and the footer keeps License and Contributing.
- Motion: as today, the row is `.rise .delay-3`; the count-up runs once when the pill is in view and only under `prefers-reduced-motion: no-preference`. Under `reduce`, the final number is printed.

## Option A: two-card section after how it works

```
desktop                                           390 px
  Two ways to use todz                              Two ways to use todz
  ┌ glass ───────────────┐ ┌ glass ───────────────┐ ┌ glass ─────────────┐
  │ todz cloud   (Free)  │ │ Self-host (Open src) │ │ todz cloud  (Free) │
  │ Sign in with your    │ │ Run the server on    │ │ Sign in with your  │
  │ email. Synced …      │ │ your own Cloudflare… │ │ email. Synced …    │
  │ [ Download for Mac ] │ │ ( Server setup guide)│ │ [Download for Mac] │
  └──────────────────────┘ └──────────────────────┘ └────────────────────┘
  The app is the same either way, and updates itself. ┌ glass ─────────────┐
                                                    │ Self-host (Open s.)│
  then the final panel: Get todz on your Mac.        │ (Server setup guid)│
                         [ Download for Mac ]       └────────────────────┘
```

- Copy: `ways.title`, `ways.cloud.*`, `ways.selfHost.*`, `ways.note`, exactly as in `landing-copy.ts`.
- Tokens: `.glass` on `--color-page`, `--radius-card`, `--space-5` padding, `.way-badge` on `--color-chip`, primary `--gradient-action` only on the cloud CTA.
- Motion: each card `.reveal`, the scroll-driven rise that already exists.
- Trade-offs: the code is already built and only moves. But it adds a section: six blocks instead of five. The final panel repeats Download right under the cloud card. And glass on the flat page colour has nothing behind it to blur, so the cards read as plain white tiles.

## Option B: the choice is the final panel (recommended)

```
desktop
  ┌ --gradient-wallpaper, --radius-stage ─────────────────────────────┐
  │                          [todz icon]                              │
  │                     Get todz on your Mac.                         │
  │  ┌ glass ─────────────────────┐  ┌ glass ─────────────────────┐   │
  │  │ todz cloud          (Free) │  │ Self-host    (Open source) │   │
  │  │ Sign in with your email.   │  │ Run the server on your own │   │
  │  │ Synced across your Macs    │  │ Cloudflare account. Same   │   │
  │  │ and agents. Nothing to run.│  │ app: switch the server in  │   │
  │  │ [    Download for Mac    ] │  │ Settings.                  │   │
  │  └────────────────────────────┘  │ (   Server setup guide   ) │   │
  │                                  └────────────────────────────┘   │
  │          The app is the same either way, and updates itself.      │
  │                              ───                                  │
  │      Built by a developer, for developers and AI tinkerers.       │
  │                           — Dhyego                                │
  └───────────────────────────────────────────────────────────────────┘
390 px
  ┌ wallpaper ─────────────────┐
  │        [todz icon]         │
  │   Get todz on your Mac.    │
  │ ┌ glass ─────────────────┐ │
  │ │ todz cloud      (Free) │ │
  │ │ Sign in with your …    │ │
  │ │ [ Download for Mac   ] │ │
  │ └────────────────────────┘ │
  │ ┌ glass ─────────────────┐ │
  │ │ Self-host (Open source)│ │
  │ │ Run the server on …    │ │
  │ │ ( Server setup guide ) │ │
  │ └────────────────────────┘ │
  │ The app is the same either │
  │ way, and updates itself.   │
  │            ───             │
  │  Built by a developer, for │
  │ developers and AI tinkerers│
  │          — Dhyego          │
  └────────────────────────────┘
```

- Copy: h2 `final.title` "Get todz on your Mac."; then `ways.cloud.*`, `ways.selfHost.*`, `ways.note`. `final.body` and `ways.title` go; the two tiles say it.
- Section id `ways`, so the hero "run your own" lands here (`scroll-margin-top` as `.join-form` has it today).
- Tokens: the panel keeps `.final-call` (`--gradient-wallpaper`, `--glass-edge`, `--shadow-glass`, `--radius-stage`). Each tile is `.glass` with `--shadow-card` (not `--shadow-glass`: a panel shadow inside a panel shadow is too heavy), `--radius-card`, `--space-5` padding, a 2-column grid from `WIDE_BREAKPOINT`, `--space-4` gap. Badges: `.way-badge` on `--color-chip`; the Free badge leads with the `.notice-dot` mint dot, the same mint as the star pill's hover glow. Cloud CTA `.download-button` (the only gradient in the panel); self-host CTA `.way-cta-secondary`, full width at 390 px.
- Motion: the panel `.reveal` as today; the tiles add nothing, so the panel arrives as one piece. Hover: a tile brightens its edge the way `.join-capsule:hover` does, `--duration-base` `--ease-out`; no lift, no scale. `reduce` and `prefers-reduced-transparency` reuse the existing fallbacks (`.glass` becomes `--color-surface`).
- Trade-offs: the shortest page (five blocks, the same count as today), and Download appears twice instead of three times. The choice lands after the proof, at the moment of deciding. Glass over the wallpaper finally has something to blur, so this is the most Liquid Glass moment on the page. The cost: a visitor who wants to self-host learns how only at the bottom. The hero line's "run your own" link covers that in one tap.

## The maker's signature (all options)

- Copy, ready for `LANDING_COPY.signature`: `line` "Built by a developer, for developers and AI tinkerers." and `name` "Dhyego", with the em dash as fixed markup before the link. The link goes to the owner's GitHub profile, `https://github.com/dhyegocalota`, as a constant beside `REPOSITORY`, `rel="noopener"`. It makes no claim beyond who made todz and for whom.
- Placement: it closes the final panel, below the note, like a sign-off at the end of a letter. It is the last thing read before the footer, and it sits on the warmest surface on the page. The footer keeps the Logic Bit credit as the company line. Putting the signature there too would make it read as legal small print, not as a note from a person.
- Look: a 32 px `--color-hairline` rule, `--space-6` above it. The line in `--font-rounded`, `--text-body`, `--color-text-muted`. The name in `--font-rounded`, weight 600, `--color-text`, no underline until hover (`text-underline-offset:0.2em`, like `.footer-credit-link`). It needs no new token and no avatar: an external image would widen the CSP.
- Motion: none of its own; it arrives with the panel's `.reveal`.
- Accessibility: a `<p>`, then a link whose name is "Dhyego". Muted text on the wallpaper meets 4.5:1 in both schemes, as `.final-body` does today.
- In A and C the final panel stays as it is on the branch, and the signature closes it the same way, under the Download button.

## Option C: hero only, no section

```
desktop                                        390 px
  Free on todz cloud — or run your own.          Free on todz cloud — or run your own.
  [ Download for Mac ] (Free)  [GH ★ 1.2k]       [ Download for Mac  ](Free)
  ┌ glass, one line each ──────────────────┐     ┌ glass ──────────────────────┐
  │ todz cloud (Free)  Nothing to run.     │     │ todz cloud (Free)           │
  │ Self-host (Open source) Server guide → │     │  Nothing to run.            │
  └────────────────────────────────────────┘     │ Self-host (Open source)     │
                                                 │  Server setup guide →       │
                                                 └─────────────────────────────┘
```

- Copy: the titles, the badges, the cloud body cut to "Nothing to run.", `selfHost.cta`; the note goes.
- Tokens: one `.glass` capsule, `--radius-card`, hairline divider `--color-hairline`. Motion: `.rise .delay-4`.
- Trade-offs: the shortest of all and visible above the fold. But it cuts the given copy (the "switch the server in Settings" promise is what makes self-host credible), it crowds a hero that already holds the action row and the note, and it pushes the stage shot under the fold at 390 px.

## Recommendation

**Option B.** The page stays five blocks, shorter than zapbip's ten. The hero keeps one job: Download, Free, star. The choice comes after the benefits and the terminal have shown what todz is, inside the wallpaper panel, where the glass tiles really refract. "run your own" in the hero line keeps self-host one tap away for those who came for it. Download drops from three appearances to two, and no copy is invented or cut. The maker's signature closes the panel, so the page ends on a person, not a button.

## Final section order

1. Header: wordmark · Self-host guide · Install on Mac · GitHub
2. Hero: eyebrow pill · title · lead · "Free on todz cloud — or run your own." (link to #ways) · [Download for Mac] (Free) · star pill · notarization note · desk stage
3. Benefits: three glass cards (agents over MCP, menu bar and widgets, offline sync)
4. How it works: steps and the Claude Code terminal
5. Final panel `#ways`: icon · "Get todz on your Mac." · todz cloud | Self-host tiles · note · signature "Built by a developer, for developers and AI tinkerers. — Dhyego"
6. Footer: brand · © · credit · star pill · License · Contributing · Self-host guide · Install on Mac

## Owner decisions

