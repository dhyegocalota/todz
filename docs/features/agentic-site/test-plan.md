# Agentic site: test plan

## Unit

- [ ] `GET api.todz.app/.well-known/mcp/server-card.json` answers 200 `application/mcp-server-card+json`, open access, the bytes of the site's card; `POST` answers an empty 404.
- [ ] `GET /index.md` answers 200 `text/markdown; charset=utf-8` with the public cache, the title, the download and repository links and the landing copy; 404 on the API host.
- [ ] `GET /` carries `Link: </index.md>; rel="alternate"; type="text/markdown"` and `Vary: Accept`; with `Accept: text/markdown` it answers the body of `/index.md`; with `Accept: text/html` it answers HTML.
- [ ] `GET /.well-known/api-catalog` answers 200 `application/linkset+json` with open reads, linking the server card, docs, llms.txt and the docs MCP; 404 on the API host and to `POST`.
- [ ] robots.txt names the thirteen crawlers, each allowed, with no `Disallow`.
- [ ] llms.txt holds the download, the update note, the repository, AGPL-3.0, the docs MCP command, "free on todz cloud, or self-host" and the Install, self-host and Privacy links; llms-full.txt holds every line of it and the three setups.
- [ ] The JSON-LD application holds `downloadUrl` and `sameAs`, and no waitlist word.
- [ ] llms.txt, llms-full.txt, `/index.md` and the landing hold no waitlist, "in development", "not yet available" or "pricing has not been announced" phrase.
- [ ] The landing policy keeps its nine directives, hash based, with no `unsafe-inline`.

## E2E

None: no new browser surface.

## Coverage honesty

The deploy is not run; the live routes are proven by the worker tests only.
