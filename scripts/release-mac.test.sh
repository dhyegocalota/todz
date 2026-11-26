#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
origin="$scratch/origin.git"
repository="$scratch/repository"
production="$scratch/production"
home="$scratch/home"
release_key="$scratch/release-key"
other_key="$scratch/other-key"
all_calls="$scratch/all-calls.log"
all_output="$scratch/all-output.log"
export CALLS="$scratch/calls.log"
export PRODUCTION="$production"
export SECURITY_STDIN="$scratch/security-stdin.log"
export SSH_ADD_STDIN="$scratch/ssh-add-stdin.log"
export TEST_RELEASE_KEY="$release_key"
export TEST_OTHER_KEY="$other_key"
export HOME="$home"
export GIT_AUTHOR_NAME=release GIT_AUTHOR_EMAIL=release@example.com GIT_COMMITTER_NAME=release GIT_COMMITTER_EMAIL=release@example.com
export TODZ_RELEASE_CODESIGN_BINARY="$fakes/codesign"
export TODZ_RELEASE_XCODEGEN_BINARY="$fakes/xcodegen"
export TODZ_RELEASE_XCODEBUILD_BINARY="$fakes/xcodebuild"
export TODZ_RELEASE_HDIUTIL_BINARY="$fakes/hdiutil"
export TODZ_RELEASE_SECURITY_BINARY="$fakes/security"
export TODZ_RELEASE_SSH_KEYGEN_BINARY="$fakes/ssh-keygen"
export TODZ_RELEASE_SSH_AGENT_BINARY="$fakes/ssh-agent"
export TODZ_RELEASE_SSH_ADD_BINARY="$fakes/ssh-add"
export TODZ_RELEASE_SIGN_UPDATE_BINARY="$fakes/sign_update"
export TODZ_RELEASE_GENERATE_KEYS_BINARY="$fakes/generate_keys"
export TODZ_RELEASE_PLIST_BINARY="$fakes/plist"
export TODZ_RELEASE_CURL_BINARY="$fakes/curl"
export TODZ_RELEASE_CLOUDFLARE_BINARY="$fakes/cloudflare"
export TODZ_RELEASE_DEPLOY_WORKER_BINARY="$fakes/deploy-worker"
export TODZ_RELEASE_XCRUN_BINARY="$fakes/xcrun"
export TODZ_RELEASE_TEST_MODE=1
unset FAKE_CODESIGN FAKE_CODESIGN_TARGET FAKE_PROVISION FAKE_FEED FAKE_PUBLIC_KEY FAKE_SECURITY_MISSING FAKE_WRONG_SIGNING_KEY FAKE_AGENT_HAS_IDENTITY FAKE_HANG FAKE_BREAK FAKE_DEPLOY_FAIL FAKE_DEPLOYMENT_MESSAGE TODZ_RELEASE_LOCK_HELD
export SSH_AUTH_SOCK=/inherited/agent.sock

private_key_value="FAKE-PRIVATE-KEY-VALUE"
private_key_encoded=$(printf '%s' "$private_key_value" | base64)
openssh_header_encoded="LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZ"
version="0.2.0"
commit_count=3
disk_image_name="Todz-$version.dmg"
builds="$home/.todz-release/builds"
site="$home/.todz-release/site"
lock="$home/.todz-release/lock"
build_directory="$builds/$version"
site_directory="$site/download/$version"
download_address="https://todz.app/download/$version/$disk_image_name"
dmg_sum=$(printf '%s\n' "fake-dmg-bytes" | shasum -a 256 | cut -d' ' -f1)
rollback_version_id="11111111-1111-1111-1111-111111111111"
pinned_revision_line=""

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

cat > "$fakes/security" <<'FAKE'
#!/usr/bin/env bash
echo "security $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == security ]] && exec tail -f /dev/null
if [[ "$1" == -i ]]; then
  cat >> "$SECURITY_STDIN"
  exit 0
fi
[[ "${FAKE_SECURITY_MISSING:-no}" == yes ]] && exit 44
[[ "$*" == *" -w"* ]] && printf '%s' FAKE-PRIVATE-KEY-VALUE | base64
exit 0
FAKE

cat > "$fakes/ssh-agent" <<'FAKE'
#!/usr/bin/env bash
echo "ssh-agent $*" >> "$CALLS"
[[ "$1" == -k ]] && exit 0
echo "SSH_AUTH_SOCK=$2; export SSH_AUTH_SOCK;"
echo "SSH_AGENT_PID=4242; export SSH_AGENT_PID;"
echo "echo Agent pid 4242;"
FAKE

cat > "$fakes/ssh-add" <<'FAKE'
#!/usr/bin/env bash
echo "ssh-add socket=$SSH_AUTH_SOCK $*" >> "$CALLS"
if [[ "$1" == -l ]]; then
  [[ -n "${FAKE_AGENT_HAS_IDENTITY:-}" ]] && { echo "256 SHA256:other other (ED25519)"; exit 0; }
  echo "The agent has no identities."
  exit 1
fi
if [[ "$1" == -L ]]; then
  echo "ssh-ed25519 AAAAFAKEPUBLICKEY release@todz.app"
  exit 0
fi
cat > "$SSH_ADD_STDIN"
FAKE

cat > "$fakes/ssh-keygen" <<'FAKE'
#!/usr/bin/env bash
echo "ssh-keygen $*" >> "$CALLS"
if [[ "$1 $2" == "-Y sign" ]]; then
  [[ "${FAKE_HANG:-}" == ssh-keygen ]] && exec tail -f /dev/null
  key=$TEST_RELEASE_KEY
  [[ -n "${FAKE_WRONG_SIGNING_KEY:-}" ]] && key=$TEST_OTHER_KEY
  while [[ $# -gt 1 ]]; do
    [[ "$1" == -n ]] && namespace=$2
    shift
  done
  exec /usr/bin/ssh-keygen -Y sign -q -f "$key" -n "$namespace" "$1"
fi
exec /usr/bin/ssh-keygen "$@"
FAKE

cat > "$fakes/codesign" <<'FAKE'
#!/usr/bin/env bash
echo "codesign $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == codesign ]] && exec tail -f /dev/null
target=${@: -1}
mode=${FAKE_CODESIGN:-ok}
[[ -n "${FAKE_CODESIGN_TARGET:-}" && "$target" != *"$FAKE_CODESIGN_TARGET" ]] && mode=ok
case "$*" in
  *--force*) exit 0 ;;
  *--verify*)
    [[ "$mode" == verify-fail ]] && { echo "invalid signature" >&2; exit 1; }
    exit 0 ;;
  *--entitlements*)
    echo "[Dict] com.apple.security.app-sandbox"
    [[ "$mode" == task-allow ]] && echo "com.apple.security.get-task-allow"
    [[ "$mode" == developer-entitlement ]] && echo "com.apple.developer.team-identifier"
    exit 0 ;;
  *-dv*)
    team=XFWR794VS8
    flags="0x10000(runtime)"
    [[ "$mode" == other-team ]] && team=AAAAAAAAAA
    [[ "$mode" == no-team ]] && team="not set"
    [[ "$mode" == no-runtime ]] && flags="0x0(none)"
    echo "CodeDirectory v=20500 size=1 flags=$flags hashes=1 location=embedded" >&2
    echo "TeamIdentifier=$team" >&2
    exit 0 ;;
esac
exit 0
FAKE

cat > "$fakes/xcodegen" <<'FAKE'
#!/usr/bin/env bash
echo "xcodegen $*" >> "$CALLS"
FAKE

cat > "$fakes/xcodebuild" <<'FAKE'
#!/usr/bin/env bash
echo "xcodebuild $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == xcodebuild ]] && exec tail -f /dev/null
while [[ $# -gt 0 ]]; do
  [[ "$1" == -derivedDataPath ]] && derived=$2
  shift
done
app="$derived/Build/Products/Release/Todz.app"
framework="$app/Contents/Frameworks/Sparkle.framework/Versions/B"
mkdir -p "$app/Contents/PlugIns/TodzWidgets.appex/Contents" "$framework/XPCServices/Installer.xpc" "$framework/XPCServices/Downloader.xpc" "$framework/Updater.app"
touch "$framework/Autoupdate"
echo plist > "$app/Contents/Info.plist"
[[ "${FAKE_PROVISION:-}" == app ]] && touch "$app/Contents/embedded.provisionprofile"
[[ "${FAKE_PROVISION:-}" == appex ]] && touch "$app/Contents/PlugIns/TodzWidgets.appex/Contents/embedded.provisionprofile"
exit 0
FAKE

cat > "$fakes/hdiutil" <<'FAKE'
#!/usr/bin/env bash
echo "hdiutil $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == hdiutil ]] && exec tail -f /dev/null
while [[ "$1" != -srcfolder ]]; do shift 2> /dev/null || break; done
echo "hdiutil-staged $(cd "$2" && find . -type f -o -type l | sort | tr '\n' ' ')" >> "$CALLS"
echo fake-dmg-bytes > "${@: -1}"
FAKE

cat > "$fakes/plist" <<'FAKE'
#!/usr/bin/env bash
echo "plist $*" >> "$CALLS"
case "$2" in
  "Print :SUFeedURL") echo "${FAKE_FEED:-https://todz.app/download/appcast.xml}" ;;
  "Print :SUPublicEDKey") echo "${FAKE_PUBLIC_KEY:-BYXfy/qfQvJmxxD6JPs8gelvFwACXZ8xhhcG2p/fpYY=}" ;;
  "Print :SUAutomaticallyUpdate") echo "${FAKE_AUTOMATIC_UPDATES:-YES}" ;;
esac
FAKE

cat > "$fakes/generate_keys" <<'FAKE'
#!/usr/bin/env bash
echo "generate_keys $*" >> "$CALLS"
echo "BYXfy/qfQvJmxxD6JPs8gelvFwACXZ8xhhcG2p/fpYY="
FAKE

cat > "$fakes/sign_update" <<'FAKE'
#!/usr/bin/env bash
echo "sign_update $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == sign_update ]] && exec tail -f /dev/null
[[ "$*" == *"--account todz"* ]] || { echo "no account" >&2; exit 1; }
if [[ "${@: -1}" == *.xml ]]; then
  echo "<!-- sparkle-signatures: edSignature: FAKE-FEED-SIGNATURE -->" >> "${@: -1}"
  exit 0
fi
echo 'sparkle:edSignature="FAKE-SPARKLE-SIGNATURE" length="15"'
FAKE

cat > "$fakes/xcrun" <<'FAKE'
#!/usr/bin/env bash
echo "xcrun $*" >> "$CALLS"
FAKE

cat > "$fakes/curl" <<'FAKE'
#!/usr/bin/env bash
echo "curl $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == curl ]] && exec tail -f /dev/null
while [[ $# -gt 1 ]]; do
  [[ "$1" == -o ]] && destination=$2
  [[ "$1" == -D ]] && headers=$2
  shift
done
path=${1#https://todz.app/download}
if [[ "$path" == /latest ]]; then
  [[ -f "$PRODUCTION/latest" ]] && printf '302 https://todz.app%s' "$(cat "$PRODUCTION/latest")" || printf '404 '
  exit 0
fi
served="$PRODUCTION$path"
[[ -f "$served" ]] || { printf '404 '; exit 0; }
cp "$served" "$destination"
[[ -n "${headers:-}" ]] && cp "$served.headers" "$headers"
printf '200 '
FAKE

cat > "$fakes/cloudflare" <<'FAKE'
#!/usr/bin/env bash
echo "cloudflare $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == wrangler ]] && exec tail -f /dev/null
case "$*" in
  *"deployments status"*)
    printf '{"id":"d1","annotations":{"workers/message":"%s"},"versions":[{"version_id":"%s","percentage":100}]}\n' "${FAKE_DEPLOYMENT_MESSAGE:-$ACTIVE_MESSAGE}" "11111111-1111-1111-1111-111111111111" ;;
esac
FAKE

cat > "$fakes/deploy-worker" <<'FAKE'
#!/usr/bin/env bash
echo "deploy-worker token-mode=$(stat -c %a "$HOME/.todz-release/lock/token" 2>/dev/null || stat -f %Lp "$HOME/.todz-release/lock/token") lock=$([[ -n "${TODZ_RELEASE_LOCK_HELD:-}" && "$TODZ_RELEASE_LOCK_HELD" == "$(cat "$HOME/.todz-release/lock/token")" ]] && echo yes || echo no) $*" >> "$CALLS"
[[ "${FAKE_HANG:-}" == deploy-worker ]] && exec tail -f /dev/null
[[ -n "${FAKE_DEPLOY_FAIL:-}" ]] && { echo "deploy-worker: refused" >&2; exit 1; }
site="$HOME/.todz-release/site/download"
pending=""
[[ "${1:-}" == --candidate ]] && pending=$2
for directory in "$site"/*/; do
  version=$(basename "$directory")
  [[ "$version" =~ ^[0-9] ]] || continue
  [[ "$version" == "$pending" ]] || grep -qxF "$version" "$HOME/.todz-release/site/released" || continue
  mkdir -p "$PRODUCTION/$version"
  cp "$directory"/Todz-"$version".dmg* "$PRODUCTION/$version/"
  printf 'HTTP/2 200\r\ncontent-disposition: attachment; filename="Todz-%s.dmg"\r\n' "$version" > "$PRODUCTION/$version/Todz-$version.dmg.headers"
  printf 'HTTP/2 200\r\n' > "$PRODUCTION/$version/Todz-$version.dmg.sha256.headers"
  printf 'HTTP/2 200\r\n' > "$PRODUCTION/$version/Todz-$version.dmg.sig.headers"
  printf '/download/%s/Todz-%s.dmg' "$version" "$version" > "$PRODUCTION/latest"
  cp "$directory/appcast.xml" "$PRODUCTION/appcast.xml"
  printf 'HTTP/2 200\r\n' > "$PRODUCTION/appcast.xml.headers"
done
case "${FAKE_BREAK:-}" in
  redirect) printf '/download/0.0.1/Todz-0.0.1.dmg' > "$PRODUCTION/latest" ;;
  disposition) printf 'HTTP/2 200\r\n' > "$PRODUCTION/$version/Todz-$version.dmg.headers" ;;
  sum) echo tampered > "$PRODUCTION/$version/Todz-$version.dmg" ;;
  signature) cp "$TEST_OTHER_KEY.pub" "$PRODUCTION/$version/Todz-$version.dmg.sig" ;;
  appcast) echo changed >> "$PRODUCTION/appcast.xml" ;;
esac
FAKE
cat > "$fakes/real-deploy-worker" <<'FAKE'
#!/usr/bin/env bash
rm -rf "$REAL_STAGE"
bash scripts/deploy-worker.sh --stage-only "$REAL_STAGE" "$@" || exit 1
exec "$FAKE_DEPLOY_WORKER" "$@"
FAKE
chmod +x "$fakes"/*
export REAL_STAGE="$scratch/real-stage"
export FAKE_DEPLOY_WORKER="$fakes/deploy-worker"
export TODZ_DEPLOY_CURL_BINARY="$fakes/curl"

new_world() {
  cat "$CALLS" >> "$all_calls" 2> /dev/null
  rm -rf "$origin" "$repository" "$production" "$home"
  mkdir -p "$production" "$home" "$repository/scripts" "$repository/apps/macos/release" "$repository/apps/api/public"
  printf '/*\n  X-Content-Type-Options: nosniff\n' > "$repository/apps/api/public/_headers"
  : > "$CALLS"
  : > "$SECURITY_STDIN"
  : > "$SSH_ADD_STDIN"
  git init -q --bare -b main "$origin"
  printf '#!/usr/bin/env bash\necho "git-push released=$(tr "\\n" "," < "%s/.todz-release/site/released")" >> "%s"\n' "$home" "$CALLS" > "$origin/hooks/pre-receive"
  chmod +x "$origin/hooks/pre-receive"
  printf 'release@todz.app namespaces="todz-release" %s\n' "$(cut -d' ' -f1,2 "$release_key.pub")" > "$repository/apps/macos/release/allowed-signers"
  echo fake-background > "$repository/apps/macos/release/dmg-background.tiff"
  echo fake-layout > "$repository/apps/macos/release/dmg-layout.dsstore"
  cp "$here/release-mac.sh" "$here/release-shared.sh" "$here/deploy-worker.sh" "$repository/scripts/"
  git init -q -b main "$repository"
  git -C "$repository" remote add origin "$origin"
  git -C "$repository" add .
  git -C "$repository" commit -q -m "first"
  git -C "$repository" commit -q --allow-empty -m "second"
  git -C "$repository" commit -q --allow-empty -m "third"
  git -C "$repository" push -q -u origin main 2> /dev/null
  mkdir -p "$home/.todz-release/packages/checkouts/Sparkle" "$site/download"
  git init -q -b main "$home/.todz-release/packages/checkouts/Sparkle"
  git -C "$home/.todz-release/packages/checkouts/Sparkle" commit -q --allow-empty -m sparkle
  export TODZ_RELEASE_SPARKLE_REVISION=$(git -C "$home/.todz-release/packages/checkouts/Sparkle" rev-parse HEAD)
  export ACTIVE_MESSAGE=$(git -C "$repository" rev-parse HEAD)
  : > "$site/released"
  : > "$CALLS"
}

run_release() {
  output=$(cd "$repository" && bash scripts/release-mac.sh "$@" 2>&1)
  status=$?
  printf '%s\n' "$output" >> "$all_output"
}

reset_calls() {
  cat "$CALLS" >> "$all_calls" 2> /dev/null
  : > "$CALLS"
}

call_count() {
  grep -c "$1" "$CALLS" || true
}

events() {
  sed -nE 's#^deploy-worker .*#deploy#p; s#^cloudflare .*wrangler rollback ([^ ]+) .*#rollback:\1#p; s#^git-push released=(.*)#push:\1#p' "$CALLS" | tr '\n' ' '
}

line_of() {
  grep -n "$1" "$CALLS" | head -1 | cut -d: -f1
}

new_world
echo untracked > "$repository/untracked.txt"
run_release
expect_refused "a dirty tree is refused" "the working tree is not clean"
expect_equal "a dirty tree builds nothing" "$(call_count '^xcodegen')" "0"

new_world
git -C "$repository" checkout -q -b other
run_release
expect_refused "a branch other than main is refused" "not on main"

new_world
git -C "$repository" commit -q --allow-empty -m "unpushed"
run_release
expect_refused "a main ahead of origin is refused" "main is ahead of origin/main"

new_world
git -C "$repository" reset -q --hard HEAD~1
run_release
expect_refused "a main behind origin is refused" "main is behind origin/main"

new_world
run_release --bogus
expect_refused "an unknown option is refused" "usage: release-mac.sh"
run_release --version 1.2
expect_refused "a version that is not x.y.z is refused" "1.2 is not a version"

new_world
FAKE_SECURITY_MISSING=yes run_release
expect_refused "a missing release key is refused" "the Keychain item todz-release-key is missing"
expect_equal "a missing release key builds nothing" "$(call_count '^xcodegen')" "0"
expect_lacks "the refusal prints no key" "$output" "$private_key_value"

new_world
export TODZ_RELEASE_SPARKLE_REVISION=0000000000000000000000000000000000000000
run_release
expect_refused "a Sparkle checkout off the pinned revision is refused" "the Sparkle checkout is not at the pinned revision"
expect_equal "a wrong Sparkle revision builds nothing" "$(call_count '^xcodegen')" "0"

new_world
FAKE_DEPLOYMENT_MESSAGE=other run_release
expect_refused "an active deployment that is not HEAD's sha is refused" "the active deployment does not carry HEAD's sha"
expect_equal "a refused deployment builds nothing" "$(call_count '^xcodegen')" "0"
FAKE_DEPLOYMENT_MESSAGE=other run_release --dry-run
expect_equal "a dry run does not need the deployment" "$status" "0"

new_world
git -C "$repository" tag mac-v0.3.0 HEAD~1
run_release --version 0.3.0
expect_refused "a tag on another commit is refused" "mac-v0.3.0 exists on another commit"

new_world
git -C "$repository" tag mac-v0.2.0 HEAD~1
run_release --version 0.1.0
expect_refused "a version below the highest tag is refused" "version 0.1.0 is not greater than mac-v0.2.0"
run_release --dry-run
expect_equal "the next patch after the highest tag is built" "$status" "0"
expect_contains "the next patch is the version" "$output" "Todz-0.2.1.dmg"

new_world
mkdir -p "$production"
printf '<rss><sparkle:version>%s</sparkle:version><sparkle:shortVersionString>0.1.0</sparkle:shortVersionString></rss>' "$commit_count" > "$production/appcast.xml"
run_release
expect_refused "a build number not greater than production's is refused" "build number $commit_count is not greater than $commit_count of the production appcast"
expect_equal "a refused build number builds nothing" "$(call_count '^xcodegen')" "0"

new_world
printf '<rss><sparkle:version>%s</sparkle:version><sparkle:shortVersionString>%s</sparkle:shortVersionString></rss>' "$commit_count" "$version" > "$production/appcast.xml"
printf 'HTTP/2 200\r\n' > "$production/appcast.xml.headers"
run_release --dry-run
expect_equal "an equal build number is accepted for the version production serves" "$status" "0"

new_world
mkdir -p "$build_directory/derived"
run_release --dry-run
expect_equal "a build folder left without a commit by a stopped run is built again" "$status" "0"
expect_contains "the stopped build's version is built" "$output" "$disk_image_name"

for case_name in "no-runtime:Todz.app:Todz.app: not signed with the hardened runtime" "other-team:TodzWidgets.appex:TodzWidgets.appex: not signed by team XFWR794VS8" "task-allow:TodzWidgets.appex:TodzWidgets.appex: has get-task-allow" "task-allow:Todz.app:Todz.app: has get-task-allow" "developer-entitlement:TodzWidgets.appex:TodzWidgets.appex: carries a com.apple.developer. entitlement" "no-team:Installer.xpc:Installer.xpc: not signed by team XFWR794VS8" "no-team:Autoupdate:Autoupdate: not signed by team XFWR794VS8" "no-runtime:Updater.app:Updater.app: not signed with the hardened runtime" "verify-fail:Sparkle.framework:Sparkle.framework: signature does not verify"; do
  mode=${case_name%%:*}
  rest=${case_name#*:}
  target=${rest%%:*}
  message=${rest#*:}
  new_world
  FAKE_CODESIGN=$mode FAKE_CODESIGN_TARGET=$target run_release
  expect_refused "codesign $mode on $target is refused" "$message"
  expect_equal "codesign $mode on $target never reaches hdiutil" "$(call_count '^hdiutil')" "0"
  expect_equal "codesign $mode on $target never deploys" "$(call_count '^deploy-worker')" "0"
done

for provision in app appex; do
  new_world
  FAKE_PROVISION=$provision run_release
  expect_refused "a provisioning profile in the $provision is refused" "embeds a provisioning profile"
  expect_equal "a provisioning profile in the $provision never reaches hdiutil" "$(call_count '^hdiutil')" "0"
done

for asset_case in "dmg-background.tiff:the disk image background is missing" "dmg-layout.dsstore:the disk image layout is missing"; do
  asset=${asset_case%%:*}
  message=${asset_case#*:}
  new_world
  git -C "$repository" rm -q "apps/macos/release/$asset"
  git -C "$repository" commit -q -m "drop $asset"
  git -C "$repository" push -q origin main 2> /dev/null
  export ACTIVE_MESSAGE=$(git -C "$repository" rev-parse HEAD)
  run_release
  expect_refused "a missing $asset is refused" "$message"
  expect_equal "a missing $asset never reaches xcodebuild" "$(call_count '^xcodebuild')" "0"
  expect_equal "a missing $asset never reaches hdiutil" "$(call_count '^hdiutil')" "0"
done

new_world
FAKE_FEED=https://example.com/appcast.xml run_release
expect_refused "a built feed address that is not the constant is refused" "SUFeedURL is https://example.com/appcast.xml, not https://todz.app/download/appcast.xml"
expect_equal "a wrong feed address never reaches hdiutil" "$(call_count '^hdiutil')" "0"

new_world
FAKE_PUBLIC_KEY=AAAA run_release
expect_refused "a built public key that is not generate_keys' is refused" "SUPublicEDKey does not match generate_keys -p"

new_world
FAKE_AUTOMATIC_UPDATES=NO run_release
expect_refused "a built app that does not update itself is refused" "SUAutomaticallyUpdate is NO, not YES"
expect_equal "a build without automatic updates never reaches hdiutil" "$(call_count '^hdiutil')" "0"

new_world
run_release --dry-run
nested_order_ok=$(
  installer=$(line_of "codesign --force --options runtime .*--sign Apple Development .*Installer.xpc")
  framework=$(line_of "codesign --force --options runtime .*--sign Apple Development .*Sparkle.framework$")
  application=$(line_of "codesign --force --options runtime .*--sign Apple Development .*Todz.app$")
  [[ -n "$installer" && -n "$framework" && -n "$application" && "$installer" -lt "$framework" && "$framework" -lt "$application" ]] && echo yes || echo no
)
expect_equal "Sparkle's helpers are re-signed inside-out before the app" "$nested_order_ok" "yes"
for helper in Installer.xpc Downloader.xpc Autoupdate Updater.app; do
  expect_contains "$helper is re-signed with the team identity" "$(cat "$CALLS")" "--sign Apple Development $build_directory/derived/Build/Products/Release/Todz.app/Contents/Frameworks/Sparkle.framework/Versions/B/"
done
expect_equal "a dry run exits 0" "$status" "0"
expect_contains "a dry run prints the build's disk image" "$output" "$build_directory/$disk_image_name"
expect_contains "a dry run prints the sum" "$output" "$dmg_sum"
expect_equal "a dry run never deploys" "$(call_count '^deploy-worker')" "0"
expect_equal "a dry run never touches production's wrangler" "$(call_count 'rollback')" "0"
expect_equal "a dry run creates no tag" "$(git -C "$repository" tag --list)" ""
expect_equal "a dry run writes nothing under site" "$(find "$site/download" -type f | wc -l | tr -d ' ')" "0"
expect_equal "a dry run leaves released empty" "$(cat "$site/released")" ""
expect_equal "the build holds the commit it built" "$(cat "$build_directory/commit")" "$(git -C "$repository" rev-parse HEAD)"
expect_equal "the build folder is private" "$(stat -c %a "$build_directory" 2>/dev/null || stat -f %Lp "$build_directory")" "700"
expect_contains "xcodebuild gets the version" "$(cat "$CALLS")" "MARKETING_VERSION=$version"
expect_contains "xcodebuild gets the build number" "$(cat "$CALLS")" "CURRENT_PROJECT_VERSION=$commit_count"
expect_contains "xcodebuild builds Release into the build folder" "$(cat "$CALLS")" "-configuration Release -derivedDataPath $build_directory/derived"
expect_contains "xcodebuild turns automatic updates on, only for the release command" "$(cat "$CALLS")" "TODZ_AUTOMATICALLY_UPDATES=YES"
expect_contains "the disk image is packed as UDZO" "$(cat "$CALLS")" "-format UDZO"
expect_contains "the disk image holds the background" "$(cat "$CALLS")" "./.background/dmg-background.tiff"
expect_contains "the disk image holds the layout as .DS_Store" "$(cat "$CALLS")" "./.DS_Store"
expect_contains "the disk image holds the app and the Applications link" "$(cat "$CALLS")" "./Applications ./Todz.app/"
expect_contains "the disk image is signed" "$(cat "$CALLS")" "codesign --force --sign Apple Development $build_directory/$disk_image_name"
appcast=$(cat "$build_directory/appcast.xml")
expect_contains "the appcast names the build" "$appcast" "<sparkle:version>$commit_count</sparkle:version>"
expect_contains "the appcast names the version" "$appcast" "<sparkle:shortVersionString>$version</sparkle:shortVersionString>"
expect_contains "the appcast names the minimum system" "$appcast" "<sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>"
expect_contains "the appcast names the enclosure address" "$appcast" "url=\"$download_address\""
expect_contains "the appcast carries the enclosure signature" "$appcast" 'sparkle:edSignature="FAKE-SPARKLE-SIGNATURE"'
expect_contains "the appcast carries the feed signature" "$appcast" "sparkle-signatures: edSignature: FAKE-FEED-SIGNATURE"
expect_lacks "the appcast has no description" "$appcast" "<description"
expect_lacks "the appcast has no release notes link" "$appcast" "releaseNotesLink"
expect_equal "the disk image is signed before the feed" "$([[ "$(line_of "sign_update --account todz $build_directory/$disk_image_name")" -lt "$(line_of "sign_update --account todz $build_directory/appcast.xml")" ]] && echo yes || echo no)" "yes"
expect_contains "the signature is made in the release namespace" "$(cat "$CALLS")" "-n todz-release"
expect_equal "notarytool is never called" "$(grep -c 'notarytool' "$CALLS" || true)" "0"
expect_equal "stapler is never called" "$(grep -c 'stapler' "$CALLS" || true)" "0"

reset_calls
run_release --dry-run
expect_equal "a second dry run on the same commit exits 0" "$status" "0"
expect_equal "a complete build is not rebuilt: no xcodebuild" "$(call_count '^xcodebuild')" "0"
expect_equal "a complete build is not rebuilt: no hdiutil" "$(call_count '^hdiutil')" "0"
expect_contains "a reused build prints the same sum" "$output" "$dmg_sum"
echo tampered >> "$build_directory/$disk_image_name"
run_release --dry-run
expect_equal "a reused build whose disk image changed is refused" "$status" "1"

new_world
run_release --dry-run
reset_calls
run_release
expect_equal "a real run after a dry run exits 0" "$status" "0"
expect_equal "a real run after a dry run rebuilds nothing" "$(call_count '^xcodebuild')" "0"
expect_contains "a real run after a dry run prints the same sum" "$output" "$dmg_sum"

new_world
run_release
expect_equal "a release exits 0" "$status" "0"
expect_equal "a release deploys, checks, records, then pushes the tag" "$(events)" "deploy push:$version, "
expect_contains "the release prints the download address" "$output" "$download_address"
expect_contains "the release prints the sum" "$output" "$dmg_sum"
expect_equal "released lists the version" "$(cat "$site/released")" "$version"
expect_equal "the tag reaches origin" "$(git -C "$origin" tag --list)" "mac-v$version"
expect_equal "the tag sits on HEAD" "$(git -C "$repository" rev-parse "mac-v$version^{commit}")" "$(git -C "$repository" rev-parse HEAD)"
for served in "$disk_image_name" "$disk_image_name.sha256" "$disk_image_name.sig" appcast.xml; do
  expect_equal "the release copied $served into site" "$(cmp -s "$build_directory/$served" "$site_directory/$served" && echo same || echo different)" "same"
done
expect_contains "the deploy ran under the release's lock" "$(cat "$CALLS")" "token-mode=600 lock=yes --candidate $version"
expect_equal "the release frees the lock" "$(test -d "$lock" && echo held || echo free)" "free"
expect_equal "the private key reaches the agent on standard input" "$(cat "$SSH_ADD_STDIN")" "$private_key_value"
expect_contains "the agent is the script's own socket" "$(cat "$CALLS")" "ssh-agent -a $home/.todz-release/agent."
expect_contains "the agent starts in shell mode" "$(cat "$CALLS")" ".sock -s"
expect_contains "the key is loaded with a lifetime" "$(cat "$CALLS")" " -t 120 -"
expect_lacks "an inherited agent socket is never used" "$(cat "$CALLS")" "socket=/inherited/agent.sock"
expect_contains "ssh-add sees the script's socket" "$(cat "$CALLS")" "socket=$home/.todz-release/agent."
expect_equal "the agent is killed after signing" "$(call_count '^ssh-agent -k')" "1"
expect_equal "the agent's socket is gone" "$(ls "$home/.todz-release" | grep -c '^agent\.' || true)" "0"
expect_equal "ssh-add checks the agent is empty first" "$([[ "$(line_of 'ssh-add .* -l')" -lt "$(line_of 'ssh-add .* -t 120 -')" ]] && echo yes || echo no)" "yes"
expect_equal "the release key is read once" "$(call_count 'security find-generic-password -s todz-release-key -w')" "1"
expect_lacks "the key is never an argument" "$(cat "$CALLS")" "$private_key_value"
expect_lacks "the encoded key is never an argument" "$(cat "$CALLS")" "$private_key_encoded"

new_world
TODZ_RELEASE_DEPLOY_WORKER_BINARY="$fakes/real-deploy-worker" run_release
expect_equal "a release through the real deploy-worker exits 0" "$status" "0"
expect_equal "the real staging holds the version being released and its appcast" "$(ls "$REAL_STAGE/download" | tr '\n' ' ')" "$version appcast.xml "
expect_equal "the real staging redirects to the version being released" "$(sed -n 1p "$REAL_STAGE/_redirects")" "/download /download/$version/Todz-$version.dmg 302"
expect_equal "the real staging holds the version's disk image" "$(cmp -s "$REAL_STAGE/download/$version/$disk_image_name" "$build_directory/$disk_image_name" && echo same || echo different)" "same"
expect_equal "the version is released once the real deploy passed" "$(cat "$site/released")" "$version"

new_world
FAKE_AGENT_HAS_IDENTITY=1 run_release
expect_refused "an agent that already holds an identity is refused" "the signing agent is not empty"
expect_equal "an agent with an identity never receives the key" "$(wc -c < "$SSH_ADD_STDIN" | tr -d ' ')" "0"
expect_equal "an agent with an identity is still killed" "$(call_count '^ssh-agent -k')" "1"

new_world
FAKE_WRONG_SIGNING_KEY=1 run_release
expect_refused "a signature that fails the allowed signers is refused" "the new signature does not verify against allowed-signers"
expect_equal "a bad signature never deploys" "$(call_count '^deploy-worker')" "0"
expect_equal "a bad signature still kills the agent" "$(call_count '^ssh-agent -k')" "1"
expect_equal "a bad signature leaves no site entry" "$(find "$site/download" -type f | wc -l | tr -d ' ')" "0"

new_world
(cd "$repository" && FAKE_HANG=ssh-keygen exec bash scripts/release-mac.sh > "$scratch/terminated.log" 2>&1) &
release_process=$!
for _ in $(seq 1 5000); do
  grep -q 'ssh-keygen -Y sign' "$CALLS" && break
done
kill -TERM "$release_process"
wait "$release_process"
expect_equal "SIGTERM still kills the agent" "$(call_count '^ssh-agent -k')" "1"
expect_equal "SIGTERM frees the lock" "$(test -d "$lock" && echo held || echo free)" "free"
expect_equal "SIGTERM leaves no agent socket" "$(ls "$home/.todz-release" | grep -c '^agent\.' || true)" "0"

for broken in redirect disposition sum signature appcast; do
  case "$broken" in
    redirect) message="production check failed: /download/latest does not redirect to $download_address" ;;
    disposition) message="production check failed: the disk image is not served as a download" ;;
    sum) message="production check failed: the served sum does not match the disk image" ;;
    signature) message="production check failed: the served signature does not verify" ;;
    appcast) message="production check failed: the served appcast differs from the build's" ;;
  esac
  new_world
  FAKE_BREAK=$broken run_release
  expect_refused "a production $broken check that fails is refused" "$message"
  expect_equal "a production $broken failure rolls back to the recorded version id" "$(events)" "deploy rollback:$rollback_version_id "
  expect_contains "the rollback is not bare" "$(cat "$CALLS")" "rollback $rollback_version_id"
  expect_equal "a production $broken failure removes the version from site" "$(test -e "$site_directory" && echo present || echo absent)" "absent"
  expect_equal "a production $broken failure leaves released unchanged" "$(cat "$site/released")" ""
  expect_equal "a production $broken failure creates no tag" "$(git -C "$repository" tag --list)" ""
  expect_equal "a production $broken failure keeps the build" "$(test -f "$build_directory/$disk_image_name" && echo present || echo absent)" "present"
done

new_world
FAKE_DEPLOY_FAIL=1 run_release
expect_refused "a deploy that fails is refused" "deploy-worker failed"
expect_equal "a failed deploy removes the version from site" "$(test -e "$site_directory" && echo present || echo absent)" "absent"
expect_equal "a failed deploy leaves released unchanged" "$(cat "$site/released")" ""

new_world
run_release
reset_calls
run_release
expect_equal "a re-run exits 0" "$status" "0"
expect_contains "a re-run says it is already published" "$output" "$version is already published"
expect_equal "a re-run deploys nothing" "$(call_count '^deploy-worker')" "0"
expect_equal "a re-run pushes nothing" "$(call_count '^git-push')" "0"
expect_equal "a re-run builds nothing" "$(call_count '^xcodebuild')" "0"
git -C "$repository" tag -d "mac-v$version" > /dev/null
git -C "$repository" push -q origin ":refs/tags/mac-v$version" 2> /dev/null
reset_calls
run_release
expect_equal "a re-run without the tag exits 0" "$status" "0"
expect_equal "a re-run pushes only the missing tag" "$(events)" "push:$version, "
expect_equal "a re-run deploys nothing even without the tag" "$(call_count '^deploy-worker')" "0"

new_world
run_release
printf 'other bytes' > "$production/$version/$disk_image_name.sha256"
git -C "$repository" tag -d "mac-v$version" > /dev/null
reset_calls
run_release
expect_refused "production serving the version with another sum is refused" "$version differs from the published file"
expect_equal "a differing production deploys nothing" "$(call_count '^deploy-worker')" "0"

for step in sign_update codesign hdiutil xcodebuild ssh-keygen security; do
  new_world
  FAKE_HANG=$step TODZ_RELEASE_SIGN_UPDATE_SECONDS=1 TODZ_RELEASE_CODESIGN_SECONDS=1 TODZ_RELEASE_HDIUTIL_SECONDS=1 TODZ_RELEASE_XCODEBUILD_SECONDS=1 TODZ_RELEASE_SIGN_SECONDS=1 TODZ_RELEASE_SECURITY_SECONDS=1 run_release
  expect_equal "a hanging $step is killed: exit status" "$status" "1"
  expect_contains "a hanging $step is named" "$output" "timed out after 1s"
  expect_equal "a hanging $step frees the lock" "$(test -d "$lock" && echo held || echo free)" "free"
  expect_equal "a hanging $step kills the agent when it started" "$(call_count '^ssh-agent -a')" "$(call_count '^ssh-agent -k')"
done
new_world
FAKE_HANG=curl TODZ_RELEASE_CURL_SECONDS=1 run_release
expect_refused "a hanging production request is killed" "production check timed out after 1s"
new_world
FAKE_HANG=wrangler TODZ_RELEASE_WRANGLER_SECONDS=1 run_release
expect_refused "a hanging wrangler is killed" "wrangler deployments status timed out after 1s"
new_world
FAKE_HANG=deploy-worker TODZ_RELEASE_DEPLOY_SECONDS=1 run_release
expect_refused "a hanging deploy is killed" "deploy-worker timed out after 1s"
expect_equal "a hanging deploy rolls back" "$(events)" "deploy rollback:$rollback_version_id "

new_world
mkdir -p "$lock"
run_release
expect_refused "a held lock is refused" "holds the lock"
expect_equal "a refused run leaves the other's lock" "$(test -d "$lock" && echo held || echo free)" "held"

new_world
FAKE_SECURITY_MISSING=yes run_release --create-release-key
expect_equal "creating the release key exits 0" "$status" "0"
expect_contains "the new item goes through the interactive reader" "$(cat "$CALLS")" "security -i"
expect_contains "the key reaches the Keychain on standard input as an add command" "$(cat "$SECURITY_STDIN")" 'add-generic-password -s todz-release-key -a release -T "" -w '
expect_contains "the stored key is an OpenSSH private key" "$(cat "$SECURITY_STDIN")" "$openssh_header_encoded"
expect_lacks "the key is never an argument of security" "$(cat "$CALLS")" "$openssh_header_encoded"
expect_lacks "the key is never printed" "$output" "$openssh_header_encoded"
expect_equal "no key file remains" "$(find "$home/.todz-release" -type f -name 'key*' | wc -l | tr -d ' ')" "0"
expect_equal "the allowed signers line is printed" "$(printf '%s\n' "$output" | grep -cE '^release@todz\.app namespaces="todz-release" ssh-ed25519 [A-Za-z0-9+/=]+$')" "1"
expect_equal "the fingerprint is printed" "$(printf '%s\n' "$output" | grep -cE '^SHA256:[A-Za-z0-9+/]+$')" "1"

new_world
run_release --create-release-key
expect_refused "an existing release key is never replaced" "the Keychain item todz-release-key already exists"
expect_equal "an existing release key stores nothing" "$(wc -c < "$SECURITY_STDIN" | tr -d ' ')" "0"

new_world
TODZ_RELEASE_TEST_MODE= run_release
expect_equal "an override outside test mode is refused: exit status" "$status" "1"
expect_contains "an override outside test mode is refused: message" "$output" "is set: overrides are for the tests only"
expect_equal "an override outside test mode runs no tool" "$(wc -c < "$CALLS" | tr -d ' ')" "0"
TODZ_RELEASE_TEST_MODE= run_release --create-release-key
expect_contains "creating the release key refuses overrides too" "$output" "overrides are for the tests only"
output=$(cd "$repository" && env -i HOME="$home" PATH="$PATH" TODZ_RELEASE_SPARKLE_REVISION=abc bash scripts/release-mac.sh --dry-run 2>&1)
expect_contains "the Sparkle revision override is refused outside test mode" "$output" "TODZ_RELEASE_SPARKLE_REVISION is set"

new_world
mkdir -p "$home/.todz-release/work.stale"
echo old > "$home/.todz-release/work.stale/leftover"
run_release --dry-run
expect_equal "a stale work folder is removed under the lock" "$(test -e "$home/.todz-release/work.stale" && echo present || echo absent)" "absent"

reset_calls
expect_equal "the fake private key is in no output" "$(grep -c "$private_key_value" "$all_output" || true)" "0"
expect_equal "the encoded fake private key is in no output" "$(grep -c "$private_key_encoded" "$all_output" || true)" "0"
expect_equal "the fake private key is in no call" "$(grep -c "$private_key_value" "$all_calls" || true)" "0"
expect_equal "the encoded fake private key is in no call" "$(grep -c "$private_key_encoded" "$all_calls" || true)" "0"

rm -rf "$scratch"
[[ "$failures" -eq 0 ]] && exit 0
echo "$failures failure(s)"
exit 1
