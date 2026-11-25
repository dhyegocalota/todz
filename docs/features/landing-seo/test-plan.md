# Test plan: Landing SEO

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Worker URLs in unit tests are built from the test configuration's `PUBLIC_ORIGIN` (`http://localhost:8787`) and `SITE_ORIGIN` (`http://localhost:8788`); the documents' own URLs are always `https://todz.app`, `https://api.todz.app/mcp` and `https://docs.todz.app`.

## The failing test first

Lane H (`apps/api`, `tools/repository-shape`):

- [ ] `apps/api/test/site-head.test.ts::the landing names itself` — input: `GET <SITE_ORIGIN>/`; expected: one `<title>` `todz: your tasks, shared with your agents`, one `meta[name=description]` with the landing description, `link[rel=canonical]` `https://todz.app/`
- [ ] `site-head.test.ts::the guide names itself` — input: `GET <SITE_ORIGIN>/self-host`; expected: title `Self-host todz · todz`, the guide description, canonical `https://todz.app/self-host`
- [ ] `site-head.test.ts::each page carries its share card` — input: both pages; expected: `og:title` and `og:description` equal the page's title and description, `og:url` equals the canonical, `og:type` `website`, `og:site_name` `todz`, `og:image` `https://todz.app/og/todz.png`, `og:image:width` `1200`, `og:image:height` `630`, `og:image:alt` the alt in `site-icons.ts`, `twitter:card` `summary_large_image`
- [ ] `site-head.test.ts::each page links its icons and manifest` — input: both pages; expected: `link[rel=icon][href="/favicon.ico"][sizes="48x48"]`, `link[rel=icon][href="/icon.svg"][type="image/svg+xml"]`, `link[rel=apple-touch-icon][href="/apple-touch-icon.png"]`, `link[rel=manifest][href="/site.webmanifest"]`
- [ ] `site-head.test.ts::language, colours and landmarks` (pin) — input: both pages; expected: `html[lang=en]`, `theme-color` `#F2F4FA` for light and `#070812` for dark, exactly one `h1`, one each of `header`, `nav`, `main`, `footer`
- [ ] `apps/api/test/site-json-ld.test.ts::the landing graph` — input: `GET /`; expected: one `script[type="application/ld+json"]` that parses to `@context` `https://schema.org` and an `@graph` of exactly `Organization`, `WebSite`, `SoftwareApplication`
- [ ] `site-json-ld.test.ts::the guide graph` — input: `GET /self-host`; expected: one block, `@graph` of exactly `Organization`, `WebSite`
- [ ] `site-json-ld.test.ts::each node fits its shape` — input: every node; expected: every required property present and no property outside the type's allowed list (`Organization`: `@type`, `@id`, `name`, `legalName`, `url`; `WebSite`: `@type`, `@id`, `name`, `url`, `inLanguage`, `publisher`; `SoftwareApplication`: `@type`, `@id`, `name`, `description`, `url`, `image`, `operatingSystem`, `applicationCategory`, `applicationSubCategory`, `publisher`, `offers`; `Offer`: `@type`, `price`, `priceCurrency`, `availability`, `url`)
- [ ] `site-json-ld.test.ts::references resolve` — input: every `{ "@id": … }` value; expected: each names a node of the same graph
- [ ] `site-json-ld.test.ts::the publisher is Logic Bit` — input: the `Organization` node; expected: `name` `Logic Bit`, `legalName` `Logic Bit AI Software Boutique Ltda`, `url` `https://logicbit.com.br`, all read from `COMPANY`
- [ ] `site-json-ld.test.ts::the app and its offer` — input: the `SoftwareApplication` node; expected: `operatingSystem` `macOS 14 or later`, `applicationCategory` `BusinessApplication`, `applicationSubCategory` `Productivity`, `offers` `{ "@type": "Offer", "price": "0", "priceCurrency": "USD", "availability": "https://schema.org/PreOrder", "url": "https://todz.app/#join" }`
- [ ] `site-json-ld.test.ts::a closing tag in the copy cannot end the block` — input: the serializer given a string holding `</script>`; expected: the output holds `</script>` and parses back to the same string
- [ ] `apps/api/test/site-pages.test.ts::the policy names every inline script` — input: `GET /` with and without a site key, `GET /self-host`; expected: `script-src` holds `sourceHash` of the exact JSON-LD text on both pages, of `PAGE_SCRIPT` and of the WebMCP script on the landing only, and `https://challenges.cloudflare.com` only with a site key; `manifest-src 'self'`; `default-src 'none'`; no `'unsafe-inline'`
- [ ] `site-pages.test.ts::site pages are not transformed` — input: both pages; expected: `Cache-Control: no-cache, no-transform`
- [ ] `site-pages.test.ts::no inline handler` — input: the HTML of `/`, `/self-host`, `/admin` and every landing notice; expected: no match for `/\son[a-z]+\s*=/i`
- [ ] `tools/repository-shape/src/agent-setup.test.ts::the site's setups are the app's` — input: `AgentCommand.swift` and `agentSetupOf` for `https://api.todz.app/mcp` and `<key>`; expected: the Claude Code line `claude mcp add --transport http todz 'https://api.todz.app/mcp' --header 'Authorization: Bearer <key>'`; the Codex block `[mcp_servers.todz]` / `url = "https://api.todz.app/mcp"` / `bearer_token_env_var = "TODZ_API_KEY"` and `export TODZ_API_KEY='<key>'`; the Cursor JSON with `mcpServers.todz.url` and `headers.Authorization` `Bearer <key>`; each equal to the Swift template filled the same way
- [ ] `agent-setup.test.ts::the landing terminal shows the same line` — input: `LANDING_COPY.terminal.command`; expected: equal to the Claude Code line above
- [ ] `apps/api/test/site-discovery.test.ts::robots.txt` — input: `GET <SITE_ORIGIN>/robots.txt`; expected: 200, `text/plain; charset=utf-8`, `Cache-Control: public, max-age=3600`, the body: `User-agent: *` / `Allow: /`, then one `User-agent:` group with `Allow: /` for each of the twelve crawlers in the spec's order, then `Sitemap: https://todz.app/sitemap.xml` and `Sitemap: https://docs.todz.app/sitemap.xml`; no `Disallow` line
- [ ] `site-discovery.test.ts::sitemap.xml` — input: `GET /sitemap.xml`; expected: 200, `application/xml; charset=utf-8`, a `urlset` in `http://www.sitemaps.org/schemas/sitemap/0.9` with exactly `<loc>https://todz.app/</loc>` and `<loc>https://todz.app/self-host</loc>`
- [ ] `site-discovery.test.ts::llms.txt follows llmstxt.org` — input: `GET /llms.txt`; expected: 200, `text/plain; charset=utf-8`; line 1 `# todz`, a blank line, a line starting `> `; then the facts holding `in development`, `coming soon`, `Pricing has not been announced`, `Joining the waitlist is free`, `Logic Bit`; the H2s `## Connect an agent`, `## MCP tools`, `## Docs`, `## Optional` in that order; every list line matches `^- \[[^\]]+\]\(https://[^)]+\)(: .+)?$` or, under `## MCP tools`, `` ^- `(next|add|list|update|done)`: .+$ ``
- [ ] `site-discovery.test.ts::llms.txt holds the exact setup and tools` — input: the body; expected: the exact Claude Code line of `agentSetupOf`; one tool line per `McpToolName` whose text is `MCP_COPY.tools[name]`; the docs links `https://docs.todz.app`, `/quickstart`, `/connect-an-agent`, `/mcp-tools`, `/self-host`
- [ ] `site-discovery.test.ts::llms-full.txt is the long form` — input: `GET /llms-full.txt`; expected: every line of `llms.txt` present in order, plus the Codex block, the `export` line and the Cursor JSON, plus each `MCP_COPY.fields` text the tools take
- [ ] `site-discovery.test.ts::site.webmanifest` — input: `GET /site.webmanifest`; expected: 200, `application/manifest+json`, JSON with `name` `todz`, `short_name` `todz`, `start_url` `/`, `scope` `/`, `display` `browser`, `background_color` and `theme_color` `#070812`, `icons` equal to the four PNG entries of `site-icons.ts` with `sizes` `192x192` and `512x512`, `type` `image/png`, `purpose` `any` or `maskable`
- [ ] `site-discovery.test.ts::HEAD answers like GET` — input: `HEAD` on every discovery path; expected: the same status and headers, an empty body
- [ ] `site-discovery.test.ts::the API host has none of them` — input: `GET <PUBLIC_ORIGIN>/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/site.webmanifest`, `/.well-known/ard.json`; expected: each 404
- [ ] `site-discovery.test.ts::only GET and HEAD` — input: `POST /robots.txt`, `POST /llms.txt`; expected: 404
- [ ] `apps/api/test/mcp-server-card.test.ts::the card fits SEP-2127` — input: the card; expected: `$schema` `https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json`, `name` `app.todz/todz` matching `^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$`, `version` equal to the MCP server's `0.1.0`, `description` 1–100 characters, `title` `todz`, `websiteUrl` `https://todz.app`, `icons` holding the 512 PNG with `sizes` `["512x512"]`; no key `tools`, `capabilities`, `prompts` or `resources`
- [ ] `mcp-server-card.test.ts::one remote, no secret` — input: `remotes`; expected: exactly one, `type` `streamable-http`, `url` `https://api.todz.app/mcp`, `headers` one entry `name` `Authorization`, `isRequired` true, `isSecret` true, no `value`; `supportedProtocolVersions` equal to the SDK's `SUPPORTED_PROTOCOL_VERSIONS`; the serialized card holds no `todz_` prefix
- [ ] `mcp-server-card.test.ts::served on both hosts alike` — input: `GET <PUBLIC_ORIGIN>/mcp/server-card` and `GET <SITE_ORIGIN>/.well-known/mcp/server-card.json`; expected: both 200 with identical bodies, `Content-Type: application/mcp-server-card+json`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET`, `Cache-Control: public, max-age=3600`
- [ ] `mcp-server-card.test.ts::the catalog lists it` — input: `GET <SITE_ORIGIN>/.well-known/ard.json`; expected: 200, `application/json`, `entries` of length 1 with `identifier` `urn:air:todz.app:mcp:todz`, `displayName` `todz`, `type` `application/mcp-server-card+json`, `url` `https://api.todz.app/mcp/server-card`, no `data`, three `representativeQueries`
- [ ] `mcp-server-card.test.ts::the MCP endpoint is unchanged` — input: `POST <PUBLIC_ORIGIN>/mcp` without a bearer; expected: 401 as before
- [ ] `apps/api/test/webmcp-tools.test.ts::four tools from the copy` — input: `WEBMCP_TOOLS`; expected: names `get_todz_overview`, `get_mcp_setup`, `open_docs`, `join_waitlist`; each description equal to `webmcp-copy.ts`
- [ ] `webmcp-tools.test.ts::schemas are closed objects` — input: each `inputSchema`; expected: `type` `object`, `additionalProperties` false, every `required` name declared; `get_todz_overview` has no properties; `get_mcp_setup.client` enum `["claude-code", "codex", "cursor"]` equal to `AgentClient`'s values; `open_docs.page` enum `["introduction", "quickstart", "connect-an-agent", "mcp-tools", "self-host"]`; `join_waitlist.email` `type` `string`, `format` `email`
- [ ] `webmcp-tools.test.ts::annotations` — input: each tool; expected: `readOnlyHint` true on the first three; `consequentialHint` true and `readOnlyHint` absent on `join_waitlist`
- [ ] `webmcp-tools.test.ts::only the landing registers tools` — input: `/` and `/self-host`; expected: the WebMCP script once in `/`, never in `/self-host`; the script holds no `fetch(`, no `XMLHttpRequest`, no `.submit()`
- [ ] Confirmed each red test fails for the right reason: the printed failure names the missing tag, header, route (404), file or tool, never a module or a symbol (a stub that throws `<name> is not implemented` is allowed) — evidence: the `## Lane H` briefing section

Lane I (`apps/api` node project):

- [ ] `apps/api/test/site/ico-file.test.ts::three PNGs in one icon` — input: three PNG buffers of 16, 32 and 48 pixels; expected: bytes 0–5 `00 00 01 00 03 00`; entry widths and heights 16, 32, 48; each entry's size and offset point at its PNG, copied byte for byte
- [ ] `ico-file.test.ts::256 is written as 0` — input: a 256 PNG; expected: width and height bytes `00`
- [ ] `apps/api/test/site/site-assets.test.ts::every icon exists at its size` — input: each `site-icons.ts` PNG; expected: the PNG signature and an IHDR width and height equal to the record (180, 192, 512, 192, 512)
- [ ] `site-assets.test.ts::favicon.ico` — input: `apps/api/public/favicon.ico`; expected: three entries, 16, 32, 48, each a PNG of that size
- [ ] `site-assets.test.ts::the SVG favicon has a dark variant` — input: `icon.svg`; expected: the check path `M300 532 L448 680 L724 404` and the spark path of `docs/brand/todz-icon.svg`, a `<style>` with `@media (prefers-color-scheme: dark)` that sets the gradient stops to `#6F89FF` and `#3446C8`
- [ ] `site-assets.test.ts::the touch icon is opaque` — input: `apple-touch-icon.png`; expected: every pixel's alpha 255
- [ ] `site-assets.test.ts::maskable icons fill the square and keep the mark in the safe zone` — input: each maskable PNG; expected: every pixel outside the centred circle of radius 0.4 × side has alpha 255; every pixel whiter than `#F0F0F0` lies inside that circle
- [ ] `site-assets.test.ts::the share image` — input: `og/todz.png`; expected: 1200×630, under 600 KB
- [ ] `site-assets.test.ts::nothing stale` — input: `renderSiteAssets` into a temporary folder compared with `apps/api/public`; expected: equal (bytes, or size and format if step 20 recorded nondeterminism)
- [ ] Confirmed each red test fails for the right reason — evidence: the `## Lane I` briefing section

## Unit

- [ ] `apps/api/test/site-constants.test.ts` (pin) — input: the G0 constants; expected: each value as in plan step 1
- [ ] Edge: the landing with each notice (`opens-soon`, `joined`, `try-again`) — input: `GET /` after each `POST /join` answer; expected: the same head, graph and hashes as the plain landing
- [ ] Edge: the landing without a usable site key — input: `TURNSTILE_SITE_KEY` absent; expected: the head and graph unchanged; `script-src` without the Turnstile origin, still with the three hashes
- [ ] Edge: a query string — input: `GET /?utm_source=x`; expected: canonical stays `https://todz.app/`, `og:url` the same
- [ ] Edge: the `www` host — input: `GET http://www.<site host>/llms.txt`; expected: 301 to the apex path, as every `www` request
- [ ] Edge: a trailing slash — input: `GET /llms.txt/`, `GET /.well-known/ard.json/`; expected: 404
- [ ] Edge: every discovery body is ASCII or UTF-8 without a byte-order mark — input: each body's first bytes; expected: no `EF BB BF`

## E2E (Playwright specs)

`apps/api/e2e/landing-seo.spec.ts`, projects `desktop` (1280×800) and `mobile` (375×812):

- [ ] `the files a browser asks for answer` — steps: request each icon path, `/site.webmanifest`, `/og/todz.png`; expected: 200, `image/png`, `image/x-icon` or `image/vnd.microsoft.icon`, `image/svg+xml`, `application/manifest+json`; the PNG's IHDR 1200×630
- [ ] `no console error and no policy violation` — steps: open `/` and `/self-host` in light, then dark; expected: zero console errors, zero `securitypolicyviolation` events, zero failed requests other than the stubbed Turnstile frame
- [ ] `every image at its natural ratio` — steps: open `/` in light and dark, scroll to the end; expected: each `img` with a non-zero box has `|width/height − naturalWidth/naturalHeight| ≤ 1 %` of the natural ratio
- [ ] `tools register on document.modelContext` — steps: the recording stub on `document`; expected: four `registerTool` calls with the names of `WEBMCP_TOOLS`, each with its `inputSchema` and annotations
- [ ] `tools register on navigator.modelContext when document has none` — steps: the stub on `navigator` only; expected: the same four calls
- [ ] `no modelContext, no trace` — steps: no stub; expected: no console message at all from the page scripts, the forms work as before
- [ ] `a rejected registration does not stop the others` — steps: the stub rejects `open_docs`; expected: the other three registered, no console error
- [ ] `get_todz_overview` — steps: execute it with `{}`; expected: text holding the `llms.txt` blockquote sentence and `https://docs.todz.app`
- [ ] `get_mcp_setup for each client` — steps: execute with `claude-code`, `codex`, `cursor`; expected: the matching setup of `agentSetupOf` with `<key>`, and the sentence naming **Connect an Agent**
- [ ] `open_docs` — steps: execute with `{ page: "quickstart" }`, the docs route fulfilled by the test; expected: the tab's URL becomes `https://docs.todz.app/quickstart`
- [ ] `join_waitlist goes through Turnstile` — steps: the Turnstile stub, execute with `{ email: "maria.<project>.<test id>@example.com" }`; expected: one `POST /join` whose form body holds the address and `cf-turnstile-response` equal to the stub token; the page shows "You're on the list. Check your inbox."
- [ ] `join_waitlist waits for a slow token` — steps: `SLOW_TURNSTILE_STUB`; expected: no `POST /join` before the token; then exactly one with it
- [ ] `join_waitlist refuses a bad address` — steps: execute with `{ email: "not-an-address" }`; expected: the tool's invalid-address text, no `POST /join`, the form unchanged

## Prove it for real — Playwright MCP

- [ ] Happy path: open `http://localhost:8788/` at 1280; expected: the tab shows the todz icon; the page looks as before (compare with `docs/screenshots/landing`), the join form works with the test site key
- [ ] Share card: open `/og/todz.png`; expected: the lockup above a real app shot, 1200×630, no cropping of either
- [ ] Discovery: open `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/site.webmanifest`, `/.well-known/ard.json`, `/.well-known/mcp/server-card.json` and `http://localhost:8787/mcp/server-card`; expected: each readable in the browser, matching the unit bodies
- [ ] WebMCP: with the recording stub injected through `browser_evaluate` before load, run `join_waitlist` for `maria.walk@example.com`; expected: the joined notice; the network log shows one `POST /join` with the token
- [ ] Rejected input: `join_waitlist` with `maria@`; expected: the invalid text, no request
- [ ] Browser Back after `open_docs`: expected: back on the landing, the tools registered again on the restored or reloaded page (no duplicate registration error)
- [ ] Reload mid-flow: reload after `join_waitlist` lands on `/#join`; expected: the notice is gone as for any reload, tools registered once
- [ ] Two browsers at once (`playwright`, `playwright-second`): each runs `join_waitlist` with its own address; expected: each sees its own joined notice
- [ ] Latency: `SLOW_TURNSTILE_STUB`; expected: the button reads "Joining…" until the token, then one post
- [ ] Console and network clean: zero console errors, zero failed requests, other than the Turnstile frame the stub replaces
- [ ] Desktop width 1280: expected: layout as before; the dark window shot at its own ratio
- [ ] Narrow width 375: expected: layout as before
- [ ] Dark scheme: expected: the tab icon uses the dark variant where the browser supports SVG favicons in dark mode
- [ ] Screenshots at `.pr-media/landing-seo/`; video of the WebMCP walk at `.pr-media/landing-seo/webmcp.mp4`

## Lighthouse (phone profile)

Command, from the scratchpad, with `CHROME_PATH` on Playwright's `chromium-1228`: `pnpm dlx lighthouse@13.6.0 <url> --quiet --chrome-flags="--headless=new" --output=json --output-path=<file>`; three runs per URL, the median recorded with all five category scores.

- [ ] Baseline, production, before the change (2026-11-25): `https://todz.app/` — Performance 92, Accessibility 100, Best Practices 88, SEO 92, Agentic browsing 50 — evidence: ADR 0060 → Evidence
- [ ] Local, after the change: `http://localhost:8788/`; expected: SEO 100, Best Practices 100, Accessibility 100, Performance ≥ 95; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console`, `inspector-issues`, `image-aspect-ratio` pass
- [ ] Local, after the change: `http://localhost:8788/self-host`; expected: the same targets
- [ ] Local: `webmcp-registered-tools` and `webmcp-schema-validity`; expected: the four tools listed and the schemas valid, if this Lighthouse enables WebMCP in Chrome 149 (a hypothesis: if it lists none, record that and rely on the e2e)
- [ ] Production, after the deploy: `https://todz.app/` and `/self-host`; expected: the same targets; every number in the run log

## Production URLs after the deploy

- [ ] `curl -sS -D - https://todz.app/robots.txt`; expected: 200, `text/plain`, the Worker's groups and sitemaps present (a Cloudflare preamble of comments above them is accepted)
- [ ] `curl -sS -D - https://todz.app/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/site.webmanifest`, `/.well-known/ard.json`; expected: 200 with the unit's types and bodies
- [ ] `curl -sS -D - https://api.todz.app/mcp/server-card` and `https://todz.app/.well-known/mcp/server-card.json`; expected: 200, identical bodies, `application/mcp-server-card+json`, `access-control-allow-origin: *`
- [ ] `curl -sS -o /dev/null -w '%{http_code} %{content_type}' https://todz.app/favicon.ico`, `/icon.svg`, `/apple-touch-icon.png`, `/og/todz.png`; expected: 200 and the image types
- [ ] `curl -sS -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' https://todz.app/` and the same with `ClaudeBot/1.0`; expected: `200` each
- [ ] `curl -sS https://todz.app/ | grep -c cloudflareinsights`; expected: `0`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: `join_waitlist` cannot post without a Turnstile token — attack: run it with the widget absent, slow, erroring and expired; call `requestSubmit` twice; read the network log; result: <refuted | held>
- [ ] Claim 2: the CSP hashes cover exactly the inline scripts the pages write, in every notice and site-key state — attack: diff the hashed strings against the served HTML for all eight landing variants and the guide; result: <refuted | held>
- [ ] Claim 3: `llms.txt`, the overview tool and the landing terminal cannot drift from `MCP_COPY` and `AgentCommand.swift` — attack: change a tool description and the Swift key variable in a scratch worktree, run the unit and shape gates; result: <refuted | held>

## Coverage honesty

- WebMCP in a real browser: the e2e drives a recording stub, not Chrome's implementation; Chrome stable needs the origin trial (an owner step) or the flag. Lighthouse's WebMCP audits are a second witness only if they enable the feature. Risk: a difference between the stub and Chrome's `registerTool` (for example a synchronous throw) shows only in a real browser.
- Real crawlers and answer engines: no test sees GPTBot, ClaudeBot or Google index the site; the curls with their user agents prove only that the zone answers them.
- Rich results and share previews: Google's Rich Results Test, the Facebook and X card validators and Slack's unfurl are outside the gate and are not run; the shape table encodes Google's and schema.org's documented properties.
- Maskable rendering on Android launchers and the SVG favicon's dark variant in each browser are checked by pixel rules and one desktop Chromium, not on devices.
- Renderer determinism across machines (step 20): if two renders differ, the check proves size and format, not pixels.
- Lighthouse scores vary run to run; the median of three is recorded, and a production score can differ from the local one because of Cloudflare's edge.
