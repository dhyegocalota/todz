# Open source

Check the whole history of the repository before it becomes public, then turn on the protections that only a public repository allows, following [ADR 0081](../adr/0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md); every step is read-only until the owner's flip, and each result goes in the run log at the end.

Every command runs from the repository root, one command per call. Steps 1 to 8 are the pre-flight the build loop runs; step 9 is done through `scripts/todz-cloudflare.sh` by the lead; steps 10 to 16 are todz-6f's, after the pre-flight pull request merges. Anything sensitive found by steps 1 to 8 stops the flip: record its kind and its commits in the run log, never its value, and leave history alone, because rewriting it is the owner's call. Take `<commit>` as `git rev-parse --short origin/main`.

Two public identifiers are no finding: the Cloudflare account id and the Turnstile site key in `apps/api/wrangler.jsonc`. An account id names an account without opening it, and a Turnstile site key is shipped to every visitor's browser by design; the secret half lives only in the Keychain and in Worker secrets.

1. **Scan every commit of every ref for secrets.**

   ```bash
   gitleaks git --log-opts="--all" --redact --no-banner .
   ```

   Expected: `no leaks found` and exit 0, over every commit reachable from any branch or tag, not only `HEAD`.
   If it fails: a finding is printed redacted; record its rule and its commit, never the value, stop, and tell the owner. A secret that was ever pushed is treated as leaked: revoke it first, then decide about the history.

2. **List the commit author and committer addresses.**

   ```bash
   git log --all --format='%ae %ce' | sort -u
   ```

   Expected: the owner's one address as author and committer, and `noreply@github.com` as committer of the commits GitHub merged.
   If it fails: any other address is a person who is not the owner; ask the owner before the flip. The owner decided on 2026-11-26 to keep the author address as it is, with no history rewrite, because a rewrite changes every hash, the tags `mac-v0.2.0` and `mac-v0.2.1` included. For future commits, set `git config user.email` to the GitHub noreply address of the account.

3. **Grep every commit's content for addresses.** Dump the full patch history to the scratch folder, then list every address that is not one of ours:

   ```bash
   git log --all -p > <scratch>/history.txt
   grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' <scratch>/history.txt | sort | uniq -c | sort -rn
   ```

   Expected: only `@todz.app`, `@logicbit.com.br`, `noreply` addresses, the owner's address in the `Author:` and `Commit:` headers, and test fixtures on `example.*`, `*.test` and the fictional `owner@gmail.com` family. No other personal address in file contents.
   If it fails: a real person's address in a file is personal data; record its commit and file, stop, and tell the owner.

4. **Grep for phone numbers, tokens, private keys, private addresses and private hostnames.**

   ```bash
   grep -cE 'gh[opsu]_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[bp]-[0-9A-Za-z-]{20,}|AIza[0-9A-Za-z_-]{30,}|cfut_[A-Za-z0-9]{20,}' <scratch>/history.txt
   grep -cE 'BEGIN [A-Z ]*PRIVATE KEY' <scratch>/history.txt
   grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' <scratch>/history.txt | sort | uniq -c | sort -rn
   grep -noE '[A-Za-z0-9-]+\.(local|internal|lan|home)\b' <scratch>/history.txt | sort -u
   grep -nE '\+55[ -]?[0-9]{2}[ -]?9?[0-9]{4}-?[0-9]{4}' <scratch>/history.txt
   ```

   Expected: `0` and `0` for the tokens and the keys; only `127.0.0.1`, `127.0.0.2` and version strings such as `0.2.0.1` among the addresses (no `192.168`, `172.18` or `10.` address); the hostname matches are only code identifiers (`env.local`, `files.home`); no phone number.
   If it fails: record the kind and the commits of any other match, never the value, and stop.

5. **Grep for what the build loop keeps outside the repository.**

   ```bash
   grep -cE 'STATE\.md|PROMPT\.md|run-log' <scratch>/history.txt
   grep -c 'todz-loop' <scratch>/history.txt
   git log --all --format= --name-only | sort -u | grep -E 'todz-loop|STATE\.md|PROMPT\.md|run-log'
   grep -n '/Users/' <scratch>/history.txt
   ```

   Expected: no file of the loop was ever committed, so the last file listing prints nothing. The mentions of `todz-loop/` in the ADRs (0049, 0050, 0053, 0057 and others) are pointers to a folder outside the repository, harmless, and the ADRs are not rewritten. A few lines name the owner's home folder (`/Users/<owner>/...` in two records and a sandbox log line): minor, no secret.
   If it fails: a committed file copied from the loop, a prompt or a state file, is a finding: record the commit and stop.

6. **Look for a committed dotenv file.**

   ```bash
   git log --all --diff-filter=A --name-only --format= | grep -E '(^|/)[.]en[v]' | sort -u
   ```

   Expected: only the documented example, `.env.example`, and no other dotenv file ever added.
   If it fails: record the path and its commit and stop; its contents are treated as leaked.

7. **Check the Worker's identifiers in the tree.**

   ```bash
   grep -nE 'account_id|TURNSTILE_SITE_KEY' apps/api/wrangler.jsonc
   git grep -c 'workers.dev' HEAD -- docs
   ```

   Expected: the account id and the site key, the two public identifiers named above and no secret. No tracked file names the account's `workers.dev` subdomain: the owner had it removed on 2026-11-26, a repository-shape test keeps it out, and it stays only in the history, by his decision.
   If it fails: a value that looks like a secret, a `secret` or a token, is a finding: stop.

8. **Audit the dependencies.**

   ```bash
   pnpm security:audit
   ```

   Expected: `No known vulnerabilities found` at the `high` level for production dependencies, exit 0.
   If it fails: a high advisory is fixed or pinned before the flip; the fix goes through the normal gate.

9. **Create the `security@todz.app` Email Routing rule.** The lead runs it through `scripts/todz-cloudflare.sh`, in the `todz.app` zone, as a rule named `todz security` that forwards like `hello@todz.app` to the owner's verified destination. The destination address never enters the repository, and no agent calls Cloudflare from this runbook.
   Expected: the rule is enabled and its id goes in the run log; mail sent to the address reaches the owner.
   If it fails: the destination must be verified in Email Routing first; a rule that is created but not enabled leaves `.github/SECURITY.md` pointing at an address that bounces, so do not flip until it works.

10. **Flip the visibility** (todz-6f, after the pre-flight pull request merges and todz-6f re-checks steps 1 to 8 on the merged `main`). Make the repository public with `gh`, as the owner authorized on 2026-11-26.
    Expected: `gh repo view dhyegocalota/todz --json visibility` prints `PUBLIC`; the license badge of the README resolves.
    If it fails: a plan that refuses the change stops here; tell the owner.

11. **Turn on private vulnerability reporting.**
    Expected: the Security tab shows **Report a vulnerability**, and `https://github.com/dhyegocalota/todz/security/advisories/new` opens the private form that `.github/SECURITY.md` and the issue configuration link.
    If it fails: the setting is under Settings, Code security; a repository still private cannot offer it, so repeat step 10.

12. **Turn on secret scanning with push protection.**
    Expected: Settings, Code security shows secret scanning and push protection enabled.
    If it fails: both need a public repository or GitHub Advanced Security; repeat step 10 before anything else.

13. **Turn on Dependabot alerts.** Alerts only: `.github/dependabot.yml` stays absent, because no update pull requests are opened (`open-source.test.ts`).
    Expected: the Dependabot alerts setting is enabled and the Security tab lists no open alert, or the alerts it lists are triaged.
    If it fails: an alert for a production dependency at `high` goes back to Build.

14. **Turn on branch protection on `main`.** A pull request is required, the CI checks are required and force pushes are refused.
    Expected: a direct push to `main` from the owner's session is refused; a pull request cannot merge before its required checks pass.
    If it fails: the rule is under Settings, Branches, or a ruleset; a required check that has never run on the branch does not appear in the list until it runs once, so dispatch it by hand (`gh workflow run verify.yml --ref <branch>`).

15. **Set the topics and the description**, keeping today's.
    Expected: `gh repo view dhyegocalota/todz --json description,repositoryTopics` prints the same description as before and the same topics, plus any the owner adds.
    If it fails: re-read the values before the change and set them again with `gh repo edit`.

16. **Read the public repository as a stranger.** Open the repository and the README without signing in.
    Expected: the README renders the badges, the license reads AGPL-3.0, Contributing, the security policy and the code of conduct open, and the issue chooser offers the bug report, the feature request, the documentation and the security link.
    If it fails: a link that does not resolve is fixed in a `docs` pull request.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
| 2026-11-26 | 85545da1 | 1 | gitleaks 8.30.1 over `--all`: 1888 commits scanned, about 11.5 MB, `no leaks found`, exit 0; todz-6f's scan of all refs (2094 commits) agreed |
| 2026-11-26 | 85545da1 | 2 | One address as author of every commit, the owner's personal Gmail; committers: the same address and `noreply@github.com`. Owner's decision of 2026-11-26: keep it, no history rewrite (tags `mac-v0.2.0` and `mac-v0.2.1` keep their hashes); use the GitHub noreply address for future commits |
| 2026-11-26 | 85545da1 | 3 | Only `@todz.app`, `@logicbit.com.br`, `noreply` and test fixtures (`example.*`, `*.test`, `owner@gmail.com` and its evil twins in the sign-in tests); the owner's address appears in the commit headers and nowhere in file contents |
| 2026-11-26 | 85545da1 | 4 | Tokens 0, private keys 0, phone numbers 0 (the matches of a looser pattern were digits in prose); addresses only `127.0.0.2` and `0.2.0.1` (a version); hostnames only `env.local` and `files.home` identifiers; no `192.168`, `172.18` or `10.` address |
| 2026-11-26 | 85545da1 | 5 | No file of the loop ever added (the name search matched only vendored skill prompts); 135 lines mention `todz-loop`, pointers in ADRs and docs to a folder outside the repository, kept; 4 lines name the owner's home folder (two of them the zapbip path in a feature record), minor |
| 2026-11-26 | 85545da1 | 6 | Only `.env.example` was ever added |
| 2026-11-26 | 85545da1 | 7 | `account_id` and `TURNSTILE_SITE_KEY` are the two public identifiers; the deploy runbook names the account's `workers.dev` subdomain once, and earlier rows of the deploy run log in the history named it; a public DNS name, kept |
| 2026-11-26 | 85545da1 | 8 | `pnpm security:audit`: `No known vulnerabilities found`, exit 0 |
| 2026-11-26 | 85545da1 | 9 | Done by the lead at about 11:45 UTC through `scripts/todz-cloudflare.sh`: rule `todz security`, id `be5f5e1e52c24367a9547eda3bcdbf4e`, forwarding like `hello@`; the destination is not recorded here |
| 2026-11-26 | 4c4b5fcd | 1 | Re-check before the flip: gitleaks over the full history, 2105 commits, exit 0 |
| 2026-11-26 | 4c4b5fcd | 2 | Personal-data greps: 0 hits; the only `sk-ant-` match is this runbook's own grep pattern |
| 2026-11-26 | 4c4b5fcd | 5 | Only `.env.example` was ever added; every governance file present; `LICENSE` is AGPL-3.0 |
| 2026-11-26 | 4c4b5fcd | 10 | Visibility `PUBLIC` |
| 2026-11-26 | 4c4b5fcd | 11 | Private vulnerability reporting enabled |
| 2026-11-26 | 4c4b5fcd | 12 | Secret scanning and push protection enabled |
| 2026-11-26 | 4c4b5fcd | 13 | Dependabot alerts enabled; no `dependabot.yml` |
| 2026-11-26 | 4c4b5fcd | 14 | Branch protection on `main`: a pull request required (0 approvals), no force push, no deletion, admins not enforced. No required status check yet: the `verify` workflow had not run on a pull request; it is added as required once it has |
| 2026-11-26 | 4c4b5fcd | 15 | Description and topics unchanged |
| 2026-11-26 | 4c4b5fcd | 16 | The repository, `LICENSE` and the security policy answer `200` anonymously |
| 2026-11-26 | 407f8c81 | 14 | Branch protection on `main` now requires the `ci-ok` check (strict false), plus a pull request (0 approvals), no force push and no deletion; admins not enforced |
