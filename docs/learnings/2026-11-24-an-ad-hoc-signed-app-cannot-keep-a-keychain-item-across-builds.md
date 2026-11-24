# An ad-hoc signed app hangs on a Keychain prompt after a rebuild, or cannot write at all
- Date: 2026-11-24
- Inspired by: the `mac-app-shell` spike, [ADR 0025](../adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md)

## Signal
A sandboxed app signed with `CODE_SIGN_IDENTITY = "-"` writes a generic password and reads it back in the same launch. After a rebuild, the first `SecItemCopyMatching` never returns: a `SecurityAgent` process appears and waits for a person, even with `LAContext.interactionNotAllowed = true` in `kSecUseAuthenticationContext`. With `kSecUseDataProtectionKeychain = true`, `SecItemAdd` returns -34018 (`errSecMissingEntitlement`).

## Cause
The login keychain trusts the creating app by its designated requirement, which for an ad-hoc signature is the code hash, so every build is a stranger and the ACL dialog comes from securityd, outside the flags of the query. The data protection keychain needs a keychain access group, and an access group needs a team identifier, which an ad-hoc signature does not have.

## Do
Until the app signs with a team, keep app secrets behind a vault port with a private-file implementation (ADR 0025). Never let a walk or a test touch the login keychain from an ad-hoc build: a hung read blocks the run and leaves a dialog on the owner's screen.

## Anchor
- `apps/macos/TodzKit/Sources/TodzKit/FileSessionVault.swift`
- `docs/adr/0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md`
