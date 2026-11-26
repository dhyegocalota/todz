#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
repository="$scratch/repository"
production="$scratch/production"
home="$scratch/home"
release_key="$scratch/release-key"
other_key="$scratch/other-key"
export CALLS="$scratch/calls.log"
export PRODUCTION="$production"
export HOME="$home"
export GIT_AUTHOR_NAME=deploy GIT_AUTHOR_EMAIL=deploy@example.com GIT_COMMITTER_NAME=deploy GIT_COMMITTER_EMAIL=deploy@example.com
export TODZ_DEPLOY_CURL_BINARY="$fakes/curl"
export TODZ_DEPLOY_CLOUDFLARE_BINARY="$fakes/cloudflare"
export TODZ_RELEASE_TEST_MODE=1
unset FAKE_CURL_FAIL FAKE_CURL_STATUS FAKE_CURL_HANG FAKE_WRANGLER_HANG TODZ_RELEASE_LOCK_HELD

site="$home/.todz-release/site"
lock="$home/.todz-release/lock"
public_headers=$'/*\n  X-Content-Type-Options: nosniff\n'
version_id="22222222-2222-2222-2222-222222222222"

expect_equal() {
  local name=$1 actual=$2 expected=$3
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected '$expected', got '$actual'"
  failures=$((failures + 1))
}

expect_contains() {
  local name=$1 haystack=$2 needle=$3
  [[ "$haystack" == *"$needle"* ]] && return
  echo "FAIL $name: expected '$needle' in '$haystack'"
  failures=$((failures + 1))
}

expect_lacks() {
  local name=$1 haystack=$2 needle=$3
  [[ "$haystack" != *"$needle"* ]] && return
  echo "FAIL $name: '$needle' must not appear in '$haystack'"
  failures=$((failures + 1))
}

expect_refused() {
  local name=$1 message=$2
  expect_equal "$name: exit status" "$status" "1"
  expect_contains "$name: message" "$output" "$message"
}

mkdir -p "$fakes"
ssh-keygen -q -t ed25519 -N "" -f "$release_key"
ssh-keygen -q -t ed25519 -N "" -f "$other_key"

cat > "$fakes/curl" <<'FAKE'
#!/usr/bin/env bash
echo "curl $*" >> "$CALLS"
[[ -n "${FAKE_CURL_HANG:-}" ]] && exec tail -f /dev/null
[[ -n "${FAKE_CURL_FAIL:-}" ]] && { echo "curl: (7) Failed to connect" >&2; exit 7; }
[[ -n "${FAKE_CURL_STATUS:-}" ]] && { printf '%s ' "$FAKE_CURL_STATUS"; exit 0; }
while [[ $# -gt 1 ]]; do
  [[ "$1" == -o ]] && destination=$2
  shift
done
path=${1#https://todz.app}
if [[ "$path" == /download/latest ]]; then
  [[ -f "$PRODUCTION/latest" ]] && printf '302 https://todz.app%s' "$(cat "$PRODUCTION/latest")" || printf '404 '
  exit 0
fi
served="$PRODUCTION${path#/download}"
[[ -f "$served" ]] || { printf '404 '; exit 0; }
cp "$served" "$destination"
printf '200 '
FAKE

cat > "$fakes/cloudflare" <<'FAKE'
#!/usr/bin/env bash
echo "cloudflare $*" >> "$CALLS"
[[ -n "${FAKE_WRANGLER_HANG:-}" ]] && exec tail -f /dev/null
echo "Uploaded todz-api"
echo "Current Version ID: 22222222-2222-2222-2222-222222222222"
FAKE
chmod +x "$fakes"/*

new_world() {
  rm -rf "$repository" "$production" "$home"
  mkdir -p "$repository/apps/api/public" "$repository/apps/macos/release" "$repository/scripts" "$production" "$site/download" "$home/.todz-release"
  printf '%s' "$public_headers" > "$repository/apps/api/public/_headers"
  echo "<html>committed</html>" > "$repository/apps/api/public/index.html"
  printf 'release@todz.app namespaces="todz-release" %s\n' "$(cut -d' ' -f1,2 "$release_key.pub")" > "$repository/apps/macos/release/allowed-signers"
  cp "$here/deploy-worker.sh" "$here/release-shared.sh" "$repository/scripts/" 2> /dev/null
  git init -q -b main "$repository"
  git -C "$repository" add .
  git -C "$repository" commit -q -m first
  : > "$site/released"
  : > "$CALLS"
  head_sha=$(git -C "$repository" rev-parse HEAD)
}

sign_release() {
  local version=$1 directory="$site/download/$1"
  rm -f "$directory/Todz-$version.dmg.sig"
  (cd "$directory" && shasum -a 256 "Todz-$version.dmg" > "Todz-$version.dmg.sha256")
  ssh-keygen -Y sign -q -f "$release_key" -n todz-release "$directory/Todz-$version.dmg" 2> /dev/null
}

make_release() {
  local version=$1 directory="$site/download/$1"
  mkdir -p "$directory"
  printf 'disk image %s' "$version" > "$directory/Todz-$version.dmg"
  printf '<rss>%s</rss>' "$version" > "$directory/appcast.xml"
  sign_release "$version"
  echo "$version" >> "$site/released"
}

serve_in_production() {
  local version=$1
  mkdir -p "$production/$version"
  cp "$site/download/$version/Todz-$version.dmg.sha256" "$production/$version/"
  printf '/download/%s/Todz-%s.dmg' "$version" "$version" > "$production/latest"
}

run_deploy() {
  output=$(cd "$repository" && bash scripts/deploy-worker.sh "$@" 2>&1)
  status=$?
}

stage_only() {
  stage="$scratch/stage"
  rm -rf "$stage"
  run_deploy --stage-only "$stage"
}

list_of() {
  (cd "$1" && ls -A | tr '\n' ' ')
}

new_world
stage_only
expect_equal "an empty release folder stages the public files" "$status" "0"
expect_equal "the public files are staged" "$(list_of "$stage")" "_headers index.html "
expect_equal "no release means no redirect and no download folder" "$(test -e "$stage/_redirects" -o -e "$stage/download" && echo present || echo absent)" "absent"
expect_equal "no release leaves _headers as the repository has it" "$(cmp -s "$stage/_headers" "$repository/apps/api/public/_headers" && echo same || echo different)" "same"

new_world
echo junk > "$repository/apps/api/public/.DS_Store"
echo "<html>edited</html>" > "$repository/apps/api/public/index.html"
stage_only
expect_equal "a stray file of the working tree is not staged" "$(test -e "$stage/.DS_Store" && echo present || echo absent)" "absent"
expect_equal "an uncommitted edit is not staged" "$(cat "$stage/index.html")" "<html>committed</html>"

new_world
mkdir -p "$scratch/occupied"
echo x > "$scratch/occupied/file"
run_deploy --stage-only "$scratch/occupied"
expect_refused "a staging folder that is not empty is refused" "is not empty"
rm -rf "$scratch/occupied"

new_world
make_release 0.2.0
make_release 0.9.0
make_release 0.10.0
mkdir -p "$site/download/0.11.0"
stage_only
expect_equal "three released versions stage" "$status" "0"
expect_equal "the latest two versions are staged, numerically" "$(list_of "$stage/download")" "0.10.0 0.9.0 appcast.xml "
expect_equal "a version folder holds the three served files" "$(list_of "$stage/download/0.10.0")" "Todz-0.10.0.dmg Todz-0.10.0.dmg.sha256 Todz-0.10.0.dmg.sig "
expect_equal "the appcast is the newest version's" "$(cat "$stage/download/appcast.xml")" "<rss>0.10.0</rss>"
expect_equal "_redirects is exactly the two lines of the newest version" "$(cat "$stage/_redirects")" $'/download /download/0.10.0/Todz-0.10.0.dmg 302\n/download/latest /download/0.10.0/Todz-0.10.0.dmg 302'
headers=$(cat "$stage/_headers")
expect_contains "_headers keeps the repository's rules" "$headers" "$public_headers"
expect_contains "each disk image is an attachment" "$headers" $'/download/0.10.0/Todz-0.10.0.dmg\n  Content-Disposition: attachment; filename="Todz-0.10.0.dmg"'
expect_contains "the older disk image is an attachment too" "$headers" 'filename="Todz-0.9.0.dmg"'
expect_contains "versioned files are immutable" "$headers" "Cache-Control: public, max-age=31536000, immutable"
expect_contains "the sum is plain text" "$headers" $'/download/0.10.0/Todz-0.10.0.dmg.sha256\n  Content-Type: text/plain; charset=utf-8'
expect_contains "the signature is plain text" "$headers" $'/download/0.10.0/Todz-0.10.0.dmg.sig\n  Content-Type: text/plain; charset=utf-8'
expect_contains "the appcast is an XML file cached five minutes" "$headers" $'/download/appcast.xml\n  Content-Type: application/xml; charset=utf-8\n  Cache-Control: public, max-age=300'
expect_lacks "an unreleased version has no rule" "$headers" "0.11.0"
expect_lacks "a version older than the latest two has no rule" "$headers" "0.2.0"

new_world
make_release 0.2.0
ln -s /etc/hosts "$site/download/0.2.0/link"
stage_only
expect_refused "a symlink in the release folder is refused" "link"
expect_contains "a symlink is named as one" "$output" "symlink"

new_world
make_release 0.2.0
echo x > "$site/download/notes.txt"
stage_only
expect_refused "a stray entry in download is refused" "notes.txt"

new_world
make_release 0.2.0
echo x > "$site/download/0.2.0/.DS_Store"
stage_only
expect_refused "a stray entry in a version folder is refused" ".DS_Store"

for foreign in _headers _redirects .assetsignore; do
  new_world
  make_release 0.2.0
  echo x > "$site/$foreign"
  stage_only
  expect_refused "a foreign $foreign is refused" "$foreign"
done

new_world
make_release 0.2.0
echo "0.2" >> "$site/released"
stage_only
expect_refused "a released line that is not a version is refused" "not a version"

new_world
make_release 0.2.0
echo tampered >> "$site/download/0.2.0/Todz-0.2.0.dmg"
stage_only
expect_refused "a disk image that no longer matches its sum is refused" "0.2.0: the sum does not match"

new_world
make_release 0.2.0
echo tampered >> "$site/download/0.2.0/Todz-0.2.0.dmg"
(cd "$site/download/0.2.0" && shasum -a 256 Todz-0.2.0.dmg > Todz-0.2.0.dmg.sha256)
stage_only
expect_refused "a disk image with a sum but another signature is refused" "0.2.0: the signature does not verify"

new_world
make_release 0.2.0
printf 'release@todz.app namespaces="todz-release" %s\n' "$(cut -d' ' -f1,2 "$other_key.pub")" > "$repository/apps/macos/release/allowed-signers"
git -C "$repository" commit -q -am "another key"
stage_only
expect_refused "a signature of a key that is not allowed is refused" "0.2.0: the signature does not verify"

new_world
make_release 0.2.0
serve_in_production 0.2.0
stage_only
expect_equal "a production sum equal to the folder's passes" "$status" "0"

new_world
make_release 0.2.0
serve_in_production 0.2.0
echo "0000  Todz-0.2.0.dmg" > "$production/0.2.0/Todz-0.2.0.dmg.sha256"
stage_only
expect_refused "a production sum that differs is refused" "0.2.0: production serves another sum"

new_world
make_release 0.2.0
printf '/download/0.1.0/Todz-0.1.0.dmg' > "$production/latest"
stage_only
expect_refused "production serving a version the folder lacks is refused" "would remove the published download"

new_world
printf '/download/0.2.0/Todz-0.2.0.dmg' > "$production/latest"
stage_only
expect_refused "production serving a release with no release folder is refused" "would remove the published download"

new_world
make_release 0.2.0
FAKE_CURL_FAIL=1 stage_only
expect_refused "a production request that fails is refused, not read as no release" "production check failed"
FAKE_CURL_STATUS=500 stage_only
expect_refused "a production answer other than 200, 302 or 404 is refused" "production answered 500"

new_world
make_release 0.2.0
head -c 26214401 /dev/zero > "$site/download/0.2.0/Todz-0.2.0.dmg"
sign_release 0.2.0
stage_only
expect_refused "a disk image over 25 MiB is refused" "Todz-0.2.0.dmg is over 25 MiB"
expect_contains "the refusal names the R2 fallback" "$output" "R2"

new_world
make_release 0.2.0
head -c 26214400 /dev/zero > "$site/download/0.2.0/Todz-0.2.0.dmg"
sign_release 0.2.0
stage_only
expect_equal "a disk image of exactly 25 MiB stages" "$status" "0"

new_world
make_release 0.2.0
run_deploy
expect_equal "a deploy exits 0" "$status" "0"
deploy_call=$(grep '^cloudflare' "$CALLS")
expect_contains "the stamping deploy takes the staged directory under ~/.todz-deploy" "$deploy_call" "pnpm --filter @todz/api server:deploy --assets $home/.todz-deploy/"
expect_contains "the deployment message is HEAD's sha" "$deploy_call" "--message $head_sha"
expect_equal "the new version id is recorded under HEAD's sha" "$(cat "$home/.todz-deploy/deployments/$head_sha")" "$version_id"
expect_contains "the output names the staged files" "$output" "staged"
run_deploy --stage-only "$scratch/stage-only-folder"
expect_equal "staging only never calls the wrapper" "$(grep -c '^cloudflare' "$CALLS")" "1"

new_world
make_release 0.2.0
FAKE_CURL_FAIL=1 run_deploy
expect_equal "a refusal never reaches wrangler" "$(grep -c '^cloudflare' "$CALLS")" "0"

new_world
make_release 0.2.0
mkdir "$lock"
run_deploy
expect_refused "a held lock is refused" "holds the lock"
expect_equal "a refused deploy leaves the other's lock" "$(test -d "$lock" && echo held || echo free)" "held"
TODZ_RELEASE_LOCK_HELD=yes run_deploy
expect_refused "an inherited value that is not the holder's token does not skip the lock" "holds the lock"
printf '%s' holder-token > "$lock/token"
TODZ_RELEASE_LOCK_HELD=yes run_deploy
expect_refused "a wrong token does not skip the lock" "holds the lock"
TODZ_RELEASE_LOCK_HELD=holder-token run_deploy
expect_equal "a deploy inside a release runs under the holder's token" "$status" "0"
expect_equal "a deploy inside a release leaves the release's lock" "$(test -d "$lock" && echo held || echo free)" "held"
rm -rf "$lock"
chmod 755 "$home/.todz-release"
TODZ_RELEASE_LOCK_HELD=yes run_deploy
expect_equal "taking the lock makes the release folder private" "$(stat -f %Lp "$home/.todz-release")" "700"
expect_equal "a stale inherited value with a free lock deploys normally" "$status" "0"
expect_equal "a deploy takes the lock and frees it" "$(test -d "$lock" && echo held || echo free)" "free"

new_world
make_release 0.2.0
FAKE_WRANGLER_HANG=1 TODZ_DEPLOY_WRANGLER_SECONDS=1 run_deploy
expect_refused "a hanging wrangler is killed" "wrangler deploy timed out after 1s"
expect_equal "a killed deploy frees the lock" "$(test -d "$lock" && echo held || echo free)" "free"
FAKE_CURL_HANG=1 TODZ_DEPLOY_CURL_SECONDS=1 run_deploy
expect_refused "a hanging production request is killed" "production check timed out after 1s"

new_world
make_release 0.2.0
make_release 0.3.0
sed -i '' '/^0.3.0$/d' "$site/released"
stage_only_candidate() {
  stage="$scratch/stage"
  rm -rf "$stage"
  run_deploy --stage-only "$stage" --candidate "$1"
}
stage_only_candidate 0.3.0
expect_equal "a candidate stages with the released ones" "$status" "0"
expect_equal "the candidate is staged beside the released one" "$(list_of "$stage/download")" "0.2.0 0.3.0 appcast.xml "
expect_equal "the candidate is the newest" "$(sed -n 1p "$stage/_redirects")" "/download /download/0.3.0/Todz-0.3.0.dmg 302"
expect_equal "the candidate's appcast is the newest" "$(cat "$stage/download/appcast.xml")" "<rss>0.3.0</rss>"
stage_only
expect_equal "without --candidate an unreleased version stays out" "$(list_of "$stage/download")" "0.2.0 appcast.xml "
stage_only_candidate 0.4.0
expect_refused "a candidate with no folder is refused" "0.4.0: $site/download/0.4.0 is missing"
stage_only_candidate 0.4
expect_refused "a candidate that is not a version is refused" "not a version"
echo tampered >> "$site/download/0.3.0/Todz-0.3.0.dmg"
stage_only_candidate 0.3.0
expect_refused "a candidate that does not verify is refused" "0.3.0: the sum does not match"

new_world
make_release 0.2.0
echo dirty > "$repository/apps/api/public/untracked.txt"
run_deploy
expect_refused "a deploy from a dirty tree is refused" "the working tree is not clean"
expect_equal "a dirty tree never reaches wrangler" "$(grep -c '^cloudflare' "$CALLS")" "0"
stage_only
expect_equal "staging only does not need a clean tree" "$status" "0"

new_world
make_release 0.2.0
TODZ_RELEASE_TEST_MODE= run_deploy --stage-only "$scratch/stage-mode"
expect_equal "an override outside test mode is refused: exit status" "$status" "1"
expect_contains "an override outside test mode is refused: message" "$output" "TODZ_DEPLOY_CLOUDFLARE_BINARY is set: overrides are for the tests only"
TODZ_RELEASE_TEST_MODE= TODZ_DEPLOY_CURL_BINARY= TODZ_DEPLOY_CLOUDFLARE_BINARY= run_deploy --stage-only "$scratch/stage-mode"
expect_contains "an empty override outside test mode is still refused" "$output" "overrides are for the tests only"

new_world
make_release 0.2.0
mkdir -p "$home/.todz-release/work.stale"
echo old > "$home/.todz-release/work.stale/leftover"
stage_only
expect_equal "a stale work folder is removed under the lock" "$(test -e "$home/.todz-release/work.stale" && echo present || echo absent)" "absent"
mkdir "$lock"
mkdir -p "$home/.todz-release/work.live"
run_deploy
expect_equal "a held lock leaves another run's work folder alone" "$(test -e "$home/.todz-release/work.live" && echo present || echo absent)" "present"
rmdir "$lock"

rm -rf "$scratch"
[[ "$failures" -eq 0 ]] && exit 0
echo "$failures failure(s)"
exit 1
