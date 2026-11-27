<p align="center">
  <a href="https://todz.app">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="apps/docs/logo/dark.svg">
      <img src="apps/docs/logo/light.svg" alt="todz" width="240">
    </picture>
  </a>
</p>

<p align="center">
  <strong>Your to-do list, shared with your AI agents.</strong><br>
  Claude Code, Codex and Cursor add, plan and finish tasks in the same list you use on your Mac.
</p>

<p align="center">

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/dhyegocalota/todz?style=flat&cacheSeconds=3600)](https://github.com/dhyegocalota/todz)
[![docs](https://img.shields.io/badge/docs-docs.todz.app-blue)](https://docs.todz.app)
[![download](https://img.shields.io/badge/download-macOS-black)](https://todz.app/download)

</p>

<p align="center">
  <img src="docs/screenshots/motion/01-add-and-complete.webp" width="820" alt="The todz window: a task is added and springs into Today, then it is completed">
</p>

<p align="center">
  <sub>A task springs into Today, and one tick completes it.</sub>
</p>

| | |
| --- | --- |
| <img src="docs/screenshots/mac-app-shell/03-today-two-projects.png" width="400" alt="Today across two projects"><br>**Today**, across every project. | <img src="docs/screenshots/menu-bar-count/01-count.png" width="90" alt="The menu bar icon with the count of what is left"> <img src="docs/screenshots/menu-bar/01-today-popover.png" width="300" alt="The menu bar popover with today's tasks"><br>**The menu bar** counts what is left; add a task without leaving your work. |
| <img src="docs/screenshots/widgets/03-medium-today.png" width="400" alt="A medium widget listing today's tasks"><br>**Widgets** on your desktop; tick a task right there. | <img src="docs/screenshots/connect-an-agent/01-key-screen.png" width="400" alt="Connect an Agent: a key and the command to paste"><br>**Connect an Agent**: one key, one `claude mcp add`. |

## Install

**[Download for Mac — Free](https://todz.app/download)** · or [run your own server](https://docs.todz.app/self-host).

## Connect an agent

1. Open todz and sign in with your email.
2. Open **Connect an Agent**, pick a project, and copy your client's command.
3. Paste it in your terminal, then ask your agent for the next task:

   ```bash
   claude mcp add --transport http todz 'https://api.todz.app/mcp' --header 'Authorization: Bearer <key>'
   ```

Codex, Cursor and every MCP tool: [docs.todz.app](https://docs.todz.app/connect-an-agent). More of the app: [a tour](https://docs.todz.app/tour).

## Contributing

Built by people and coding agents under one process: [HARNESS.md](.claude/HARNESS.md), [AGENTS.md](AGENTS.md).

[Contributing](.github/CONTRIBUTING.md) · [Security](.github/SECURITY.md) · [Code of conduct](.github/CODE_OF_CONDUCT.md)

## License

[AGPL-3.0](LICENSE). Contributions come under the [Contributor License Agreement](.github/CLA.md).

todz is a product of Logic Bit, made in Brazil: [logicbit.com.br](https://logicbit.com.br)
