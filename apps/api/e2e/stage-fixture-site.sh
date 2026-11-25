#!/usr/bin/env bash
set -euo pipefail

stage=$1
root=$(cd "$(dirname "$0")/../../.." && pwd)
fixture="$root/apps/api/e2e/fixtures/release"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/repo/scripts" "$work/repo/apps/macos/release" "$work/home/.todz-release"
cp "$root/scripts/deploy-worker.sh" "$root/scripts/release-shared.sh" "$work/repo/scripts/"
git -C "$root" archive HEAD apps/api/public | tar -x -C "$work/repo"
cp "$fixture/allowed-signers" "$work/repo/apps/macos/release/allowed-signers"
cp -R "$fixture/site" "$work/home/.todz-release/site"
printf '#!/usr/bin/env bash\necho "404 "\n' > "$work/production-not-found"
chmod +x "$work/production-not-found"

git -C "$work/repo" init -q
git -C "$work/repo" add -A
git -C "$work/repo" -c user.name=fixture -c user.email=fixture@todz.test commit -q -m fixture

HOME="$work/home" TODZ_DEPLOY_CURL_BINARY="$work/production-not-found" bash "$work/repo/scripts/deploy-worker.sh" --stage-only "$stage"
