# Scripts

Repository scripts that are not part of any package.

| Path | What it does |
| --- | --- |
| [verify.sh](verify.sh) | The local gate: runs only what the diff can break, from the gates listed in [verify-gates.tsv](verify-gates.tsv) |
| [pr-media.sh](pr-media.sh) | Attaches screenshots and videos to a pull request with the GitHub CLI's `--attach` |
| [todz-cloudflare.sh](todz-cloudflare.sh) | Runs one command, or one Cloudflare API call, with the token from the Keychain item `todz-cloudflare` given only to that command |
| [deploy-bodies](deploy-bodies/) | The fixed JSON bodies the deploy runbook sends |
