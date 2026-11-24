# 0025. The session secret lives in a private file until the app has a team

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: the `mac-app-shell` spike of 2026-11-24, [the learning on the Keychain under ad-hoc signing](../learnings/2026-11-24-an-ad-hoc-signed-app-cannot-keep-a-keychain-item-across-builds.md), [ADR 0021](0021-owner-sessions-are-bearer-secrets-that-last-90-days.md)

## Context

The app keeps the owner's session secret (ADR 0021) between launches. The Keychain is the usual home, but the machine has no signing identity yet, so builds are ad-hoc signed. The spike showed that the data protection keychain answers `errSecMissingEntitlement` (-34018) without a team, and that the file-based login keychain ties an item to the build's code hash: the next build's read opens a SecurityAgent prompt even with `LAContext.interactionNotAllowed`, which blocks an unattended walk and asks the owner on every rebuild.

## Decision

1. The app reads and writes the session through a `SessionVault` protocol in `TodzKit`: `read() throws -> String?`, `write(_:) throws`, `erase() throws`.
2. v1 ships `FileSessionVault`: one file, `session`, in the app's sandboxed Application Support folder, created with POSIX mode `0600`, written atomically, erased at sign-out and on any 401. A file that exists but cannot be read is an error the app shows, never a silent sign-out.
3. The file holds only the secret; nothing is logged.
4. When the owner adds a signing team, a `KeychainSessionVault` (data protection keychain, the team's access group) replaces it, and the file is erased on first launch.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A private file in the sandbox container, behind a port (chosen) | works ad-hoc signed, no prompt, unattended walks | readable by any unsandboxed process of the same user | the Keychain is not usable yet; the port makes the swap one file |
| The login keychain | encrypted at rest | a prompt after every rebuild; blocks the tester | spike: SecurityAgent prompt |
| The data protection keychain | the right home | `errSecMissingEntitlement` without a team | spike: -34018 |
| `UserDefaults` | trivial | a plist other code reads and backs up as preferences | no better than a file and less private |
| Keep the session in memory only | nothing on disk | sign in on every launch | the fake makes it cheap, but it hides the real flow |

## Consequences

- A local session is as safe as the user's account, which is acceptable while sessions only reach `wrangler dev` and the fake provider.
- The swap to the Keychain is required before any deploy; it is listed for the owner.

## Evidence

Spike, 2026-11-24: a sandboxed ad-hoc build wrote and read a login-keychain item; a rebuilt binary's read hung on a SecurityAgent prompt; the same code with `kSecUseDataProtectionKeychain` returned -34018 on write.

## Revisit when

- The owner adds his Apple ID in Xcode (Personal Team) or buys the membership.
- Before the first deploy.
