#!/usr/bin/env bash
set -euo pipefail

team_identifier="XFWR794VS8"
signing_identity="Apple Development"
feed_address="https://todz.app/download/appcast.xml"
site_origin="https://todz.app"
sparkle_account="todz"
sparkle_revision=${TODZ_RELEASE_SPARKLE_REVISION:-ab7d71291238df6e0492143b120c9b696a35f603}
release_namespace="todz-release"
release_principal="release@todz.app"
release_key_item="todz-release-key"
release_key_account="release"
notary_profile="todz-notary"
minimum_system_version="14.0"
first_version="0.2.0"
tag_prefix="mac-v"
scheme_name="Todz"
agent_lifetime_seconds=120
allowed_signers_path="apps/macos/release/allowed-signers"
notarization_enabled=false
version_pattern='^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'
usage="usage: release-mac.sh [--version <x.y.z>] [--dry-run] | --create-release-key"

root=$(cd "$(dirname "$0")/.." && pwd)
source "$root/scripts/release-shared.sh"
builds="$release_home/builds"
site="$release_home/site"
codesign_binary=${TODZ_RELEASE_CODESIGN_BINARY:-/usr/bin/codesign}
xcodegen_binary=${TODZ_RELEASE_XCODEGEN_BINARY:-xcodegen}
xcodebuild_binary=${TODZ_RELEASE_XCODEBUILD_BINARY:-/usr/bin/xcodebuild}
hdiutil_binary=${TODZ_RELEASE_HDIUTIL_BINARY:-/usr/bin/hdiutil}
security_binary=${TODZ_RELEASE_SECURITY_BINARY:-/usr/bin/security}
ssh_keygen_binary=${TODZ_RELEASE_SSH_KEYGEN_BINARY:-/usr/bin/ssh-keygen}
ssh_agent_binary=${TODZ_RELEASE_SSH_AGENT_BINARY:-/usr/bin/ssh-agent}
ssh_add_binary=${TODZ_RELEASE_SSH_ADD_BINARY:-/usr/bin/ssh-add}
xcrun_binary=${TODZ_RELEASE_XCRUN_BINARY:-/usr/bin/xcrun}
plist_binary=${TODZ_RELEASE_PLIST_BINARY:-/usr/libexec/PlistBuddy}
curl_binary=${TODZ_RELEASE_CURL_BINARY:-/usr/bin/curl}
sparkle_tools=${TODZ_RELEASE_SPARKLE_TOOLS:-$release_home/packages/artifacts/sparkle/Sparkle/bin}
sign_update_binary=${TODZ_RELEASE_SIGN_UPDATE_BINARY:-$sparkle_tools/sign_update}
generate_keys_binary=${TODZ_RELEASE_GENERATE_KEYS_BINARY:-$sparkle_tools/generate_keys}
cloudflare_binary=${TODZ_RELEASE_CLOUDFLARE_BINARY:-$root/scripts/todz-cloudflare.sh}
deploy_worker_binary=${TODZ_RELEASE_DEPLOY_WORKER_BINARY:-$root/scripts/deploy-worker.sh}
sign_update_seconds=${TODZ_RELEASE_SIGN_UPDATE_SECONDS:-120}
codesign_seconds=${TODZ_RELEASE_CODESIGN_SECONDS:-120}
hdiutil_seconds=${TODZ_RELEASE_HDIUTIL_SECONDS:-300}
xcodebuild_seconds=${TODZ_RELEASE_XCODEBUILD_SECONDS:-1800}
sign_seconds=${TODZ_RELEASE_SIGN_SECONDS:-60}
security_seconds=${TODZ_RELEASE_SECURITY_SECONDS:-60}
curl_seconds=${TODZ_RELEASE_CURL_SECONDS:-60}
wrangler_seconds=${TODZ_RELEASE_WRANGLER_SECONDS:-120}
deploy_seconds=${TODZ_RELEASE_DEPLOY_SECONDS:-900}
git_seconds=${TODZ_RELEASE_GIT_SECONDS:-120}

requested_version=""
dry_run=false
create_release_key_requested=false
work_directory=""
agent_process=""
agent_socket=""
rollback_version_id=""
rollback_pending=false

fail() {
  echo "release-mac: $1" >&9
  exit 1
}

stop_agent() {
  [[ -n "$agent_process" ]] || return 0
  SSH_AGENT_PID=$agent_process SSH_AUTH_SOCK=$agent_socket "$ssh_agent_binary" -k > /dev/null 2>&1 || true
  agent_process=""
}

rollback_release() {
  rollback_pending=false
  rm -rf "$site/download/$version"
  bounded "$wrangler_seconds" "wrangler rollback" "$cloudflare_binary" pnpm --filter @todz/api exec wrangler rollback "$rollback_version_id" --message "release-mac rollback of $version" -y > /dev/null || echo "release-mac: could not roll back to $rollback_version_id; roll back by hand" >&2
}

cleanup() {
  stop_bounded_child
  [[ "$rollback_pending" == false ]] || rollback_release
  stop_agent
  [[ -z "$work_directory" ]] || rm -rf "$work_directory"
  release_lock
  return 0
}

parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) dry_run=true ;;
      --create-release-key) create_release_key_requested=true ;;
      --version)
        [[ $# -ge 2 ]] || fail "$usage"
        requested_version=$2
        shift
        ;;
      *) fail "$usage" ;;
    esac
    shift
  done
  [[ -z "$requested_version" || "$requested_version" =~ $version_pattern ]] || fail "$requested_version is not a version"
}

keychain_item_exists() {
  bounded "$security_seconds" "security" "$security_binary" find-generic-password -s "$release_key_item" > /dev/null 2>&1
}

create_release_key() {
  local encoded_key
  keychain_item_exists && fail "the Keychain item $release_key_item already exists"
  bounded "$sign_seconds" "ssh-keygen" "$ssh_keygen_binary" -q -t ed25519 -N "" -C "$release_principal" -f "$work_directory/key"
  encoded_key=$("$BASE64_BINARY" < "$work_directory/key" | tr -d '\n')
  printf 'add-generic-password -s %s -a %s -T "" -w %s\n' "$release_key_item" "$release_key_account" "$encoded_key" | bounded "$security_seconds" "security" "$security_binary" -i > /dev/null 2>&1 || fail "could not store the key in the Keychain item $release_key_item"
  printf '%s namespaces="%s" %s\n' "$release_principal" "$release_namespace" "$(cut -d' ' -f1,2 "$work_directory/key.pub")"
  "$ssh_keygen_binary" -lf "$work_directory/key.pub" | cut -d' ' -f2
}

require_release_source() {
  require_clean_tree
  [[ "$(git rev-parse --abbrev-ref HEAD)" == main ]] || fail "not on main"
  bounded "$git_seconds" "git fetch" git fetch -q origin
  [[ "$(git rev-list --count origin/main..HEAD)" == 0 ]] || fail "main is ahead of origin/main"
  [[ "$(git rev-list --count HEAD..origin/main)" == 0 ]] || fail "main is behind origin/main"
}

require_pinned_sparkle() {
  [[ "$(git -C "$release_home/packages/checkouts/Sparkle" rev-parse HEAD 2> /dev/null)" == "$sparkle_revision" ]] || fail "the Sparkle checkout is not at the pinned revision $sparkle_revision"
}

tag_versions() {
  git tag --list "$tag_prefix*" "$@" | sed "s/^$tag_prefix//" | sort -V | tail -1
}

built_version_of_head() {
  local directory head_commit
  head_commit=$(git rev-parse HEAD)
  [[ -d "$builds" ]] || return 0
  for directory in "$builds"/*/; do
    [[ -f "${directory}commit" && "$(cat "${directory}commit")" == "$head_commit" ]] || continue
    basename "$directory"
  done | sort -V | tail -1
}

is_greater() {
  local candidate=$1 baseline=$2
  [[ "$candidate" != "$baseline" && "$(printf '%s\n%s\n' "$candidate" "$baseline" | sort -V | tail -1)" == "$candidate" ]]
}

next_patch_of() {
  local major minor patch
  IFS=. read -r major minor patch <<< "$1"
  echo "$major.$minor.$((patch + 1))"
}

resolve_version() {
  local resolved_version highest_version
  resolved_version=$(tag_versions --points-at HEAD)
  [[ -n "$resolved_version" ]] || resolved_version=$(built_version_of_head)
  if [[ -n "$resolved_version" ]]; then
    [[ -z "$requested_version" || "$requested_version" == "$resolved_version" ]] || fail "HEAD is already released or built as $resolved_version"
    version=$resolved_version
    return 0
  fi
  highest_version=$(tag_versions)
  if [[ -n "$requested_version" ]]; then
    git rev-parse -q --verify "refs/tags/$tag_prefix$requested_version" > /dev/null && fail "$tag_prefix$requested_version exists on another commit"
    [[ -z "$highest_version" ]] || is_greater "$requested_version" "$highest_version" || fail "version $requested_version is not greater than $tag_prefix$highest_version"
    version=$requested_version
    return 0
  fi
  version=$first_version
  [[ -z "$highest_version" ]] || version=$(next_patch_of "$highest_version")
}

production_request() {
  local path=$1 destination=$2 headers=${3-} answer
  local flags=(-sS -o "$destination" -w '%{http_code} %{redirect_url}')
  [[ -z "$headers" ]] || flags+=(-D "$headers")
  answer=$(bounded "$curl_seconds" "production check" "$curl_binary" "${flags[@]}" "$site_origin/download$path") || fail "production check failed for $path"
  echo "$answer"
}

production_code() {
  local answer
  answer=$(production_request "$1" "$2" "${3-}")
  echo "${answer%% *}"
}

read_production_appcast() {
  local code
  production_build=""
  production_version=""
  code=$(production_code /appcast.xml "$work_directory/production-appcast.xml")
  [[ "$code" == 404 ]] && return 0
  [[ "$code" == 200 ]] || fail "production answered $code for /appcast.xml"
  production_build=$(sed -n 's#.*<sparkle:version>\([0-9]*\)</sparkle:version>.*#\1#p' "$work_directory/production-appcast.xml" | head -n 1)
  production_version=$(sed -n 's#.*<sparkle:shortVersionString>\([^<]*\)</sparkle:shortVersionString>.*#\1#p' "$work_directory/production-appcast.xml" | head -n 1)
}

require_newer_build() {
  read_production_appcast
  [[ -n "$production_build" ]] || return 0
  [[ "$production_version" != "$version" ]] || return 0
  (( build > production_build )) || fail "build number $build is not greater than $production_build of the production appcast"
}

local_sum_file() {
  [[ -f "$site/download/$version/$disk_image_name.sha256" ]] && echo "$site/download/$version/$disk_image_name.sha256" && return 0
  [[ -f "$build_directory/$disk_image_name.sha256" ]] && echo "$build_directory/$disk_image_name.sha256"
  return 0
}

is_released() {
  [[ -f "$site/released" ]] && grep -qxF "$version" "$site/released"
}

production_serves_same_sum() {
  local local_sum code
  local_sum=$(local_sum_file)
  [[ -n "$local_sum" ]] || return 1
  code=$(production_code "/$version/$disk_image_name.sha256" "$work_directory/production-sum")
  [[ "$code" == 404 ]] && return 1
  [[ "$code" == 200 ]] || fail "production answered $code for /$version/$disk_image_name.sha256"
  cmp -s "$work_directory/production-sum" "$local_sum" || fail "$version differs from the published file"
}

push_missing_tag() {
  local tag="$tag_prefix$version"
  bounded "$git_seconds" "git ls-remote" git ls-remote --exit-code --tags origin "refs/tags/$tag" > /dev/null 2>&1 && return 0
  git rev-parse -q --verify "refs/tags/$tag" > /dev/null || git tag "$tag"
  bounded "$git_seconds" "git push" git push -q origin "refs/tags/$tag"
}

report_published() {
  echo "$download_address"
  echo "sha256: $(cut -d' ' -f1 "$build_directory/$disk_image_name.sha256")"
}

report_already_published() {
  push_missing_tag
  echo "$version is already published"
  echo "$download_address"
  echo "sha256: $(cut -d' ' -f1 "$(local_sum_file)")"
}

read_active_deployment() {
  local status_output message
  status_output=$(bounded "$wrangler_seconds" "wrangler deployments status" "$cloudflare_binary" pnpm --filter @todz/api exec wrangler deployments status --json) || fail "could not read the active deployment"
  message=$(jq -r '[.. | objects | select(has("workers/message")) | ."workers/message"] | first // empty' <<< "$status_output")
  [[ "$message" == "$(git rev-parse HEAD)" ]] || fail "the active deployment does not carry HEAD's sha: run the deploy runbook first"
  rollback_version_id=$(jq -r '[.. | objects | select(has("version_id")) | .version_id] | first // empty' <<< "$status_output")
  [[ -n "$rollback_version_id" ]] || fail "the active deployment names no version id"
}

code_objects_of() {
  local app=$1 framework="$1/Contents/Frameworks/Sparkle.framework"
  find "$framework" \( -name '*.xpc' -o -name '*.app' -o -name Autoupdate \) ! -type l | awk '{ print length, $0 }' | sort -rn | cut -d' ' -f2-
}

resign_nested_code() {
  local framework="$app_path/Contents/Frameworks/Sparkle.framework" object
  while IFS= read -r object; do
    bounded "$codesign_seconds" "codesign" "$codesign_binary" --force --options runtime --preserve-metadata=entitlements,identifier --sign "$signing_identity" "$object"
  done < <(code_objects_of "$app_path")
  bounded "$codesign_seconds" "codesign" "$codesign_binary" --force --options runtime --preserve-metadata=entitlements,identifier --sign "$signing_identity" "$framework"
  bounded "$codesign_seconds" "codesign" "$codesign_binary" --force --options runtime --preserve-metadata=entitlements,identifier --sign "$signing_identity" "$app_path"
}

require_team_and_runtime() {
  local object=$1 name details
  name=$(basename "$object")
  details=$(bounded "$codesign_seconds" "codesign" "$codesign_binary" -dv --verbose=4 "$object" 2>&1)
  [[ "$details" == *"TeamIdentifier=$team_identifier"* ]] || fail "$name: not signed by team $team_identifier"
  grep -Eq 'flags=0x[0-9a-f]+\(.*runtime.*\)' <<< "$details" || fail "$name: not signed with the hardened runtime"
}

require_signed_object() {
  local object=$1 name flags=(--verify --strict)
  name=$(basename "$object")
  [[ "$object" != "$app_path" ]] || flags=(--verify --deep --strict)
  bounded "$codesign_seconds" "codesign" "$codesign_binary" "${flags[@]}" "$object" > /dev/null 2>&1 || fail "$name: signature does not verify"
  require_team_and_runtime "$object"
}

require_plain_entitlements() {
  local object=$1 name entitlements
  name=$(basename "$object")
  entitlements=$(bounded "$codesign_seconds" "codesign" "$codesign_binary" -d --entitlements - "$object" 2>&1)
  [[ "$entitlements" != *get-task-allow* ]] || fail "$name: has get-task-allow"
  [[ "$entitlements" != *com.apple.developer.* ]] || fail "$name: carries a com.apple.developer. entitlement"
  [[ ! -e "$object/Contents/embedded.provisionprofile" ]] || fail "$name: embeds a provisioning profile"
}

require_built_configuration() {
  local feed public_key automatic_updates
  feed=$("$plist_binary" -c "Print :SUFeedURL" "$app_path/Contents/Info.plist")
  [[ "$feed" == "$feed_address" ]] || fail "SUFeedURL is $feed, not $feed_address"
  public_key=$("$plist_binary" -c "Print :SUPublicEDKey" "$app_path/Contents/Info.plist")
  [[ "$public_key" == "$(bounded "$security_seconds" "generate_keys" "$generate_keys_binary" --account "$sparkle_account" -p)" ]] || fail "SUPublicEDKey does not match generate_keys -p"
  automatic_updates=$("$plist_binary" -c "Print :SUAutomaticallyUpdate" "$app_path/Contents/Info.plist")
  [[ "$automatic_updates" == YES ]] || fail "SUAutomaticallyUpdate is $automatic_updates, not YES"
}

require_built_app() {
  local widget="$app_path/Contents/PlugIns/TodzWidgets.appex" object
  require_signed_object "$app_path"
  require_signed_object "$widget"
  require_signed_object "$app_path/Contents/Frameworks/Sparkle.framework"
  while IFS= read -r object; do
    require_signed_object "$object"
  done < <(code_objects_of "$app_path")
  require_plain_entitlements "$app_path"
  require_plain_entitlements "$widget"
  require_built_configuration
}

build_app() {
  rm -rf "$build_directory"
  mkdir -p "$build_directory"
  chmod 700 "$build_directory"
  bounded "$xcodebuild_seconds" "xcodegen" "$xcodegen_binary" generate --spec apps/macos/project.yml > /dev/null
  bounded "$xcodebuild_seconds" "xcodebuild" "$xcodebuild_binary" -project apps/macos/Todz.xcodeproj -scheme "$scheme_name" -configuration Release -derivedDataPath "$build_directory/derived" -clonedSourcePackagesDirPath "$release_home/packages" MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build" TODZ_AUTOMATICALLY_UPDATES=YES build > "$build_directory/xcodebuild.log" 2>&1 || fail "xcodebuild failed; see $build_directory/xcodebuild.log"
  resign_nested_code
  require_built_app
}

create_disk_image() {
  local staging="$build_directory/staging"
  rm -rf "$staging"
  mkdir -p "$staging"
  cp -R "$app_path" "$staging/"
  ln -s /Applications "$staging/Applications"
  bounded "$hdiutil_seconds" "hdiutil" "$hdiutil_binary" create -volname "$scheme_name" -srcfolder "$staging" -ov -format UDZO "$disk_image_path" > /dev/null
  bounded "$codesign_seconds" "codesign" "$codesign_binary" --force --sign "$signing_identity" "$disk_image_path"
  rm -rf "$staging"
}

notarize_and_staple() {
  "$xcrun_binary" notarytool submit "$disk_image_path" --keychain-profile "$notary_profile" --wait
  "$xcrun_binary" stapler staple "$disk_image_path"
  /usr/sbin/spctl -a -vv -t open --context context:primary-signature "$disk_image_path" 2>&1 | grep -q accepted
}

write_sum() {
  (cd "$build_directory" && "$SHASUM_BINARY" -a 256 "$disk_image_name" > "$disk_image_name.sha256")
}

verify_signature_of() {
  local signature=$1 image=$2
  "$ssh_keygen_binary" -Y verify -f "$root/$allowed_signers_path" -I "$release_principal" -n "$release_namespace" -s "$signature" < "$image" > /dev/null 2>&1
}

start_agent() {
  local agent_output
  agent_socket="$release_home/agent.$$.sock"
  agent_output=$(bounded "$sign_seconds" "ssh-agent" "$ssh_agent_binary" -a "$agent_socket" -s)
  agent_process=$(sed -n 's/.*SSH_AGENT_PID=\([0-9]*\).*/\1/p' <<< "$agent_output" | head -n 1)
  [[ -n "$agent_process" ]] || fail "could not start the signing agent"
}

require_empty_agent() {
  local listing
  listing=$(SSH_AUTH_SOCK=$agent_socket bounded "$sign_seconds" "ssh-add" "$ssh_add_binary" -l 2>&1) && fail "the signing agent is not empty"
  [[ "$listing" == *"no identities"* ]] || fail "could not list the signing agent"
}

sign_with_release_key() {
  start_agent
  require_empty_agent
  bounded "$security_seconds" "security" "$security_binary" find-generic-password -s "$release_key_item" -w | "$BASE64_BINARY" --decode | SSH_AUTH_SOCK=$agent_socket bounded "$sign_seconds" "ssh-add" "$ssh_add_binary" -t "$agent_lifetime_seconds" - > /dev/null 2>&1 || fail "could not load the release key into the signing agent"
  SSH_AUTH_SOCK=$agent_socket "$ssh_add_binary" -L | head -n 1 > "$work_directory/release.pub"
  SSH_AUTH_SOCK=$agent_socket bounded "$sign_seconds" "ssh-keygen" "$ssh_keygen_binary" -Y sign -f "$work_directory/release.pub" -n "$release_namespace" "$disk_image_path" > /dev/null 2>&1 || fail "could not sign the disk image with the release key"
  stop_agent
  rm -f "$agent_socket"
  verify_signature_of "$disk_image_path.sig" "$disk_image_path" || fail "the new signature does not verify against allowed-signers"
}

write_appcast() {
  local sparkle_output sparkle_signature sparkle_length
  sparkle_output=$(bounded "$sign_update_seconds" "sign_update" "$sign_update_binary" --account "$sparkle_account" "$disk_image_path") || fail "Sparkle could not sign the disk image"
  sparkle_signature=$(sed -n 's/.*sparkle:edSignature="\([^"]*\)".*/\1/p' <<< "$sparkle_output")
  sparkle_length=$(sed -n 's/.*length="\([0-9]*\)".*/\1/p' <<< "$sparkle_output")
  [[ -n "$sparkle_signature" && -n "$sparkle_length" ]] || fail "Sparkle printed no signature"
  cat > "$build_directory/appcast.xml" << APPCAST
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschek.com/xml-namespaces/sparkle">
  <channel>
    <title>$scheme_name</title>
    <item>
      <title>$scheme_name $version</title>
      <pubDate>$(LC_ALL=C date -u +"%a, %d %b %Y %H:%M:%S +0000")</pubDate>
      <sparkle:version>$build</sparkle:version>
      <sparkle:shortVersionString>$version</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>$minimum_system_version</sparkle:minimumSystemVersion>
      <enclosure url="$download_address" length="$sparkle_length" type="application/x-apple-diskimage" sparkle:edSignature="$sparkle_signature"/>
    </item>
  </channel>
</rss>
APPCAST
  bounded "$sign_update_seconds" "sign_update" "$sign_update_binary" --account "$sparkle_account" "$build_directory/appcast.xml" > /dev/null || fail "Sparkle could not sign the appcast"
}

build_release() {
  build_app
  create_disk_image
  if [[ "$notarization_enabled" == true ]]; then notarize_and_staple; fi
  write_sum
  sign_with_release_key
  write_appcast
  git rev-parse HEAD > "$build_directory/commit"
}

is_complete_build() {
  local name
  for name in "$disk_image_name" "$disk_image_name.sha256" "$disk_image_name.sig" appcast.xml commit; do
    [[ -f "$build_directory/$name" ]] || return 1
  done
  [[ "$(cat "$build_directory/commit")" == "$(git rev-parse HEAD)" ]]
}

recheck_build() {
  (cd "$build_directory" && "$SHASUM_BINARY" -a 256 -c "$disk_image_name.sha256" > /dev/null 2>&1) || fail "the build in $build_directory does not match its sum; remove it to rebuild"
  verify_signature_of "$build_directory/$disk_image_name.sig" "$disk_image_path" || fail "the build in $build_directory does not verify against allowed-signers; remove it to rebuild"
}

copy_build_into_site() {
  local name
  mkdir -p "$site/download/$version"
  chmod 700 "$site" "$site/download" "$site/download/$version"
  for name in "$disk_image_name" "$disk_image_name.sha256" "$disk_image_name.sig" appcast.xml; do
    cp "$build_directory/$name" "$site/download/$version/$name"
  done
}

check_production_redirect() {
  local answer
  answer=$(production_request /latest /dev/null)
  [[ "${answer%% *}" == 302 && "${answer#* }" == "$download_address" ]] || fail "production check failed: /download/latest does not redirect to $download_address"
}

check_production_disk_image() {
  local code
  code=$(production_code "/$version/$disk_image_name" "$check_directory/$disk_image_name" "$check_directory/headers")
  [[ "$code" == 200 ]] || fail "production check failed: the disk image answered $code"
  tr -d '\r' < "$check_directory/headers" | grep -qi "^content-disposition: attachment; filename=\"$disk_image_name\"$" || fail "production check failed: the disk image is not served as a download"
}

check_production_sum() {
  production_code "/$version/$disk_image_name.sha256" "$check_directory/$disk_image_name.sha256" > /dev/null
  (cd "$check_directory" && "$SHASUM_BINARY" -a 256 -c "$disk_image_name.sha256" > /dev/null 2>&1) || fail "production check failed: the served sum does not match the disk image"
  cmp -s "$check_directory/$disk_image_name.sha256" "$build_directory/$disk_image_name.sha256" || fail "production check failed: the served sum is not the build's"
}

check_production_signature() {
  production_code "/$version/$disk_image_name.sig" "$check_directory/$disk_image_name.sig" > /dev/null
  verify_signature_of "$check_directory/$disk_image_name.sig" "$check_directory/$disk_image_name" || fail "production check failed: the served signature does not verify"
}

check_production_appcast() {
  production_code /appcast.xml "$check_directory/appcast.xml" > /dev/null
  cmp -s "$check_directory/appcast.xml" "$build_directory/appcast.xml" || fail "production check failed: the served appcast differs from the build's"
}

check_production() {
  check_directory="$work_directory/check"
  mkdir -p "$check_directory"
  check_production_redirect
  check_production_disk_image
  check_production_sum
  check_production_signature
  check_production_appcast
}

release_to_production() {
  copy_build_into_site
  rollback_pending=true
  bounded "$deploy_seconds" "deploy-worker" "$deploy_worker_binary" --candidate "$version" || fail "deploy-worker failed"
  check_production
  rollback_pending=false
  echo "$version" >> "$site/released"
  push_missing_tag
}

refuse_overrides_outside_test_mode
parse_arguments "$@"
cd "$root"
mkdir -p "$release_home"
chmod 700 "$release_home"
install_traps

if [[ "$create_release_key_requested" == true ]]; then
  work_directory=$(mktemp -d "$release_home/work.XXXXXX")
  create_release_key
  exit 0
fi

acquire_lock
work_directory=$(mktemp -d "$release_home/work.XXXXXX")
require_release_source
keychain_item_exists || fail "the Keychain item $release_key_item is missing"
require_pinned_sparkle
resolve_version
build_directory="$builds/$version"
disk_image_name="$scheme_name-$version.dmg"
disk_image_path="$build_directory/$disk_image_name"
app_path="$build_directory/derived/Build/Products/Release/$scheme_name.app"
download_address="$site_origin/download/$version/$disk_image_name"
build=$(git rev-list --count HEAD)

if production_serves_same_sum && is_released; then
  report_already_published
  exit 0
fi
[[ "$dry_run" == true ]] || read_active_deployment
require_newer_build
if is_complete_build; then recheck_build; else build_release; fi

if [[ "$dry_run" == true ]]; then
  echo "dry run: $disk_image_path"
  echo "sha256: $(cut -d' ' -f1 "$build_directory/$disk_image_name.sha256")"
  exit 0
fi

release_to_production
report_published
