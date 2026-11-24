<h1 align="center">todz</h1>

<p align="center">
  <strong>A to-do list that AI agents and their owner share.</strong>
</p>

<p align="center">

[![license](https://img.shields.io/github/license/dhyegocalota/todz)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-blue)](.github/CONTRIBUTING.md)

</p>

<p align="center">
  <img src="docs/screenshots/mac-app-shell/04-inspector-notes-and-history.png" width="820" alt="The todz main window with a task's notes and history in the inspector">
</p>

---

todz is a to-do list that AI agents and their owner share. MCP-first and agentic-first: every action a person takes in the app, an agent can take through the MCP server (Claude Code, Codex, Cursor, any MCP client).

- **Multi-tenant.** Each workspace is isolated; projects live inside a workspace.
- **Cloud sync** across devices.
- **A native macOS app** with a menu bar extra and interactive WidgetKit widgets, simple and polished.
- **For AI enthusiasts and programmers.**

The approved design is in [docs/product](docs/product/); how each piece was built is in [docs/features](docs/features/) and the [ADRs](docs/adr/).

## A walk through todz

|                                                                                                                    |                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| ![Sign in](docs/screenshots/mac-app-shell/01-sign-in.png)<br>Sign in                                               | ![Name your first workspace](docs/screenshots/mac-app-shell/02-first-workspace.png)<br>Name your first workspace       |
| ![Today across projects](docs/screenshots/mac-app-shell/03-today-two-projects.png)<br>Today across projects       | ![An agent's task appears live](docs/screenshots/mac-sync/01-agent-add-live.png)<br>An agent's task appears live       |
| ![Offline, changes waiting](docs/screenshots/mac-sync/02-offline-changes-waiting.png)<br>Offline, changes waiting | ![A refused change, explained](docs/screenshots/mac-sync/03-refused-change-banner.png)<br>A refused change, explained |
| ![Today from the menu bar](docs/screenshots/menu-bar/01-today-popover.png)<br>Today from the menu bar             | ![Today ring](docs/screenshots/widgets/01-today-ring.png)<br>Today ring widget                                        |
| ![Next up](docs/screenshots/widgets/02-next-up.png)<br>Next up widget                                             | ![Medium Today list](docs/screenshots/widgets/03-medium-today.png)<br>Medium Today list widget                        |
| ![Large Today list](docs/screenshots/widgets/04-large-today.png)<br>Large Today list widget                       |                                                                                                                       |

## How the work happens

One process for people and for coding agents alike, in [HARNESS.md](.claude/HARNESS.md); conventions and layout in [AGENTS.md](AGENTS.md).

## Community

- [Contributing](.github/CONTRIBUTING.md)
- [Security policy](.github/SECURITY.md)
- [Code of conduct](.github/CODE_OF_CONDUCT.md)

## License

[AGPL-3.0](LICENSE). Contributions come under the [Contributor License Agreement](.github/CLA.md).
