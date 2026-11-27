# 0122. One rule in TodzKit decides the selection a locked session shows, and every path that widens it asks the Mac owner

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's report on 2026-11-27: "quando eu lock workspaces, ainda posso ter múltiplos selecionados e selecionar múltiplos")
- Inspired by: [0110](0110-the-workspace-lock-hides-every-workspace-but-the-current-one-until-touch-id-or-the-mac-password-unlocks-a-session.md), [0113](0113-a-locked-session-looks-like-a-one-workspace-account-with-no-placeholder-count-or-lock-chrome-and-one-neutral-way-back-in.md)

The loop's call: `AppModel` is the one place that decides which selection a locked session may show, the current workspace alone, and every entry point that would select another workspace or several (the switcher, All workspaces, ⌘-click, the picker, the numbered and step shortcuts, the global hot keys and the popover) goes through it instead of being patched per view. A selection the locked session cannot show first asks for Touch ID or the Mac password with the same `.switchWorkspaces` gate as `Switch Workspace…`; a refused or cancelled prompt leaves the selection as it was, and a confirmed one unlocks the session as before, so the prompt appears once per unlock. A shortcut toward a workspace beyond the current one asks whether or not that workspace exists, so the prompt tells nothing (ADR 0113). Links, intents and Shortcuts still answer as an unknown workspace and never widen anything.
