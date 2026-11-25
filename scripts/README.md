# Scripts

Repository scripts that are not part of any package.

| Path | What it does |
| --- | --- |
| [verify.sh](verify.sh) | The local gate: runs only what the diff can break, from the gates listed in [verify-gates.tsv](verify-gates.tsv) |
| [pr-media.sh](pr-media.sh) | Attaches screenshots and videos to a pull request with the GitHub CLI's `--attach` |
| [todz-cloudflare.sh](todz-cloudflare.sh) | Runs one command, or one Cloudflare API call, with the token from the Keychain item `todz-cloudflare` given only to that command |
| [deploy-worker.sh](deploy-worker.sh) | Stages the archived public folder and the released downloads and deploys the Worker with `HEAD`'s sha as the message, the one path of every deploy ([ADR 0072](../docs/adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md)) |
| [release-mac.sh](release-mac.sh) | Builds, signs, deploys and checks one release of the Mac app from a clean `main`, rolling back when a production check fails, and creates the release key |
| [release-shared.sh](release-shared.sh) | The time limit on every external step and the lock that the release and the deploy share |
| [deploy-bodies](deploy-bodies/) | The fixed JSON bodies the deploy runbook sends |
