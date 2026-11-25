<p align="center">
  <img src="docs/brand/todz-lockup.png" alt="todz" width="360">
</p>

<p align="center">
  <strong>A to-do list that AI agents and their owner share.</strong>
</p>

<p align="center">

[![license](https://img.shields.io/github/license/dhyegocalota/todz)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-blue)](.github/CONTRIBUTING.md)

</p>

<p align="center">
  <img src="docs/brand/todz-icon.svg" alt="The todz app icon" width="128">
</p>

<p align="center">
  <img src="docs/screenshots/mac-app-shell/04-inspector-notes-and-history.png" width="820" alt="The todz main window with a task's notes and history in the inspector">
</p>

---

todz is a product of Logic Bit, made in Brazil: [logicbit.com.br](https://logicbit.com.br)

todz is a to-do list that AI agents and their owner share. MCP-first and agentic-first: every action a person takes in the app, an agent can take through the MCP server (Claude Code, Codex, Cursor, any MCP client).

- **Multi-tenant.** Each workspace is isolated; projects live inside a workspace.
- **Cloud sync** across devices.
- **A native macOS app** with a menu bar extra and interactive WidgetKit widgets, simple and polished.
- **For AI enthusiasts and programmers.**

The approved design is in [docs/product](docs/product/); how each piece was built is in [docs/features](docs/features/) and the [ADRs](docs/adr/). To run your own server, read [Self-host todz](docs/self-host.md).

## A walk through todz

| | |
| --- | --- |
| ![Today across projects](docs/screenshots/mac-app-shell/03-today-two-projects.png)<br>Today across projects | ![An agent's task appears live](docs/screenshots/mac-sync/01-agent-add-live.png)<br>An agent's task appears live |
| ![Today from the menu bar](docs/screenshots/menu-bar/01-today-popover.png)<br>Today from the menu bar | ![Today's open tasks on the menu bar icon](docs/screenshots/menu-bar-count/01-count.png)<br>Today's open tasks on the menu bar icon |
| ![Today ring](docs/screenshots/widgets/01-today-ring.png)<br>Today ring (rendered) | ![Next up](docs/screenshots/widgets/02-next-up.png)<br>Next up (rendered) |
| ![Medium Today list](docs/screenshots/widgets/03-medium-today.png)<br>Medium Today list (rendered) | ![Large Today list](docs/screenshots/widgets/04-large-today.png)<br>Large Today list (rendered) |
| ![Connect an agent](docs/screenshots/connect-an-agent/01-key-screen.png)<br>Connect an agent | ![An agent's tasks in a project, via Claude Code](docs/screenshots/v1-walk/01-agent-tasks-in-a-project.png)<br>An agent's tasks in a project, via Claude Code |
| ![Settings, with agents allowed to mention today's tasks](docs/screenshots/agent-nudge/01-settings-light.png)<br>Let agents mention today's tasks | ![An agent's next opens with what is due today](docs/screenshots/agent-nudge/02-agent-next.png)<br>An agent's `next` opens with what is due today |
| ![Settings: todz stays quiet during a Focus with its filter](docs/screenshots/focus-aware/01-settings-focus-row.png)<br>Quiet during Focus, in Settings | ![The todz Focus filter in System Settings](docs/screenshots/focus-aware/02-focus-filter-sheet.png)<br>The todz Focus filter, added to any Focus mode |
| ![The sign-in mail](docs/screenshots/transactional-email/01-sign-in-mail.png)<br>The sign-in mail | ![The welcome mail](docs/screenshots/transactional-email/02-welcome-mail.png)<br>The welcome mail |
| ![todz.app, the landing with its waitlist form](docs/screenshots/landing/01-landing-light.png)<br>todz.app, the landing | ![todz.app on a phone, in dark](docs/screenshots/landing/02-landing-phone-dark.png)<br>todz.app on a phone, in dark |

The widget shots are rendered from the widgets' own views until a desktop capture replaces them.

## How the work happens

One process for people and for coding agents alike, in [HARNESS.md](.claude/HARNESS.md); conventions and layout in [AGENTS.md](AGENTS.md).

## Community

- [Contributing](.github/CONTRIBUTING.md)
- [Security policy](.github/SECURITY.md)
- [Code of conduct](.github/CODE_OF_CONDUCT.md)

## License

[AGPL-3.0](LICENSE). Contributions come under the [Contributor License Agreement](.github/CLA.md).
