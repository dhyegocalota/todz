#!/usr/bin/env bash
set -euo pipefail

team_identifier="XFWR794VS8"
signing_identity="Apple Development"
bucket_name="todz-releases"
site_origin="https://todz.app"
release_namespace="todz-release"
release_principal="release@todz.app"
release_key_item="todz-release-key"
notary_profile="todz-notary"
minimum_system_version="14.0"
first_version="0.2.0"
tag_prefix="mac-v"
scheme_name="Todz"
notarization_enabled=false
missing_object_message="does not exist"
version_pattern='^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'
usage="usage: release-mac.sh [--version <x.y.z>] [--dry-run] | --create-release-key"

root=$(cd "$(dirname "$0")/.." && pwd)
release_home="$HOME/.todz-release"
codesign_binary=${TODZ_RELEASE_CODESIGN_BINARY:-/usr/bin/codesign}
xcodegen_binary=${TODZ_RELEASE_XCODEGEN_BINARY:-xcodegen}
xcodebuild_binary=${TODZ_RELEASE_XCODEBUILD_BINARY:-/usr/bin/xcodebuild}
hdiutil_binary=${TODZ_RELEASE_HDIUTIL_BINARY:-/usr/bin/hdiutil}
security_binary=${TODZ_RELEASE_SECURITY_BINARY:-/usr/bin/security}
ssh_keygen_binary=${TODZ_RELEASE_SSH_KEYGEN_BINARY:-/usr/bin/ssh-keygen}
ssh_agent_binary=${TODZ_RELEASE_SSH_AGENT_BINARY:-/usr/bin/ssh-agent}
ssh_add_binary=${TODZ_RELEASE_SSH_ADD_BINARY:-/usr/bin/ssh-add}
xcrun_binary=${TODZ_RELEASE_XCRUN_BINARY:-/usr/bin/xcrun}
sign_update_binary=${TODZ_RELEASE_SIGN_UPDATE_BINARY:-$release_home/packages/artifacts/sparkle/Sparkle/bin/sign_update}
cloudflare_binary=${TODZ_RELEASE_CLOUDFLARE_BINARY:-$root/scripts/todz-cloudflare.sh}

requested_version=""
dry_run=false
create_release_key_requested=false
work_directory=""
agent_process=""
agent_socket=""
changes=0

fail() {
  echo "release-mac: $1" >&2
  exit 1
}

stop_agent() {
  [[ -n "$agent_process" ]] || return 0
  SSH_AGENT_PID=$agent_process SSH_AUTH_SOCK=$agent_socket "$ssh_agent_binary" -k > /dev/null
  agent_process=""
}

cleanup() {
  stop_agent
  [[ -z "$work_directory" ]] || rm -rf "$work_directory"
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
  "$security_binary" find-generic-password -s "$release_key_item" > /dev/null 2>&1
}

create_release_key() {
  keychain_item_exists && fail "the Keychain item $release_key_item already exists"
  "$ssh_keygen_binary" -q -t ed25519 -N "" -C "$release_principal" -f "$work_directory/key"
  local encoded_key public_key
  encoded_key=$(base64 < "$work_directory/key" | tr -d '\n')
  public_key=$(cut -d' ' -f1,2 "$work_directory/key.pub")
  printf 'add-generic-password -a %s -s %s -w %s\n' "$release_principal" "$release_key_item" "$encoded_key" | "$security_binary" -i > /dev/null 2>&1 || fail "could not store the key in the Keychain item $release_key_item"
  printf '%s namespaces="%s" %s\n' "$release_principal" "$release_namespace" "$public_key"
}

require_release_source() {
  [[ -z "$(git status --porcelain)" ]] || fail "the working tree is not clean"
  [[ "$(git rev-parse --abbrev-ref HEAD)" == main ]] || fail "not on main"
  git fetch -q origin
  [[ "$(git rev-list --count origin/main..HEAD)" == 0 ]] || fail "main is ahead of origin/main"
  [[ "$(git rev-list --count HEAD..origin/main)" == 0 ]] || fail "main is behind origin/main"
}

tag_versions() {
  git tag --list "$tag_prefix*" "$@" | sed "s/^$tag_prefix//" | sort -V | tail -1
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
  local head_version highest_version
  head_version=$(tag_versions --points-at HEAD)
  highest_version=$(tag_versions)
  if [[ -n "$head_version" ]]; then
    [[ -z "$requested_version" || "$requested_version" == "$head_version" ]] || fail "HEAD is already released as $tag_prefix$head_version"
    version=$head_version
    return 0
  fi
  if [[ -n "$requested_version" ]]; then
    git rev-parse -q --verify "refs/tags/$tag_prefix$requested_version" > /dev/null && fail "$tag_prefix$requested_version exists on another commit"
    [[ -z "$highest_version" ]] || is_greater "$requested_version" "$highest_version" || fail "version $requested_version is not greater than $tag_prefix$highest_version"
    version=$requested_version
    return 0
  fi
  version=$first_version
  [[ -z "$highest_version" ]] || version=$(next_patch_of "$highest_version")
}

fetch_object() {
  local key=$1 destination=$2 errors
  errors=$("$cloudflare_binary" pnpm --filter @todz/api exec wrangler r2 object get "$bucket_name/$key" --remote --pipe 2>&1 > "$destination") && return 0
  [[ "$errors" == *"$missing_object_message"* ]] && return 1
  fail "could not read $key from the bucket"
}

content_type_of() {
  case "$1" in
    *.dmg) echo "application/x-apple-diskimage" ;;
    *.sha256 | *.sig) echo "text/plain; charset=utf-8" ;;
    *.xml) echo "application/xml; charset=utf-8" ;;
    *) echo "application/json" ;;
  esac
}

upload_object() {
  local key=$1 file=$2
  "$cloudflare_binary" pnpm --filter @todz/api exec wrangler r2 object put "$bucket_name/$key" --file "$file" --content-type "$(content_type_of "$key")" --remote > /dev/null
  changes=$((changes + 1))
}

object_state() {
  local key=$1 file=$2 remote_copy="$work_directory/remote-copy"
  fetch_object "$key" "$remote_copy" || { echo absent; return 0; }
  cmp -s "$remote_copy" "$file" && echo same || echo differs
}

require_newer_build() {
  local published_file="$work_directory/published-latest" published_version published_build
  fetch_object latest.json "$published_file" || return 0
  published_version=$(sed -E 's/.*"version":"([^"]*)".*/\1/' "$published_file")
  published_build=$(sed -E 's/.*"build":([0-9]+).*/\1/' "$published_file")
  [[ "$published_build" =~ ^[0-9]+$ ]] || fail "latest.json in the bucket is malformed"
  [[ "$published_version" != "$version" ]] || return 0
  (( build > published_build )) || fail "build number $build is not greater than $published_build of the published $published_version"
}

verify_app_signature() {
  local details entitlements
  "$codesign_binary" --verify --deep --strict "$app_path" > /dev/null 2>&1 || fail "the app's signature does not verify"
  details=$("$codesign_binary" -dv --verbose=4 "$app_path" 2>&1)
  [[ "$details" == *"TeamIdentifier=$team_identifier"* ]] || fail "the app is not signed by team $team_identifier"
  grep -Eq 'flags=0x[0-9a-f]+\(.*runtime.*\)' <<< "$details" || fail "the app is not signed with the hardened runtime"
  entitlements=$("$codesign_binary" -d --entitlements - "$app_path" 2>&1)
  [[ "$entitlements" != *get-task-allow* ]] || fail "the app still has get-task-allow"
}

build_app() {
  rm -rf "$release_directory/derived"
  "$xcodegen_binary" generate --spec apps/macos/project.yml > /dev/null
  "$xcodebuild_binary" -project apps/macos/Todz.xcodeproj -scheme "$scheme_name" -configuration Release -derivedDataPath "$release_directory/derived" -clonedSourcePackagesDirPath "$release_home/packages" MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build" build > "$release_directory/xcodebuild.log" 2>&1 || fail "xcodebuild failed; see $release_directory/xcodebuild.log"
}

create_disk_image() {
  local staging="$release_directory/staging"
  rm -rf "$staging"
  mkdir -p "$staging"
  cp -R "$app_path" "$staging/"
  ln -s /Applications "$staging/Applications"
  "$hdiutil_binary" create -volname "$scheme_name" -srcfolder "$staging" -ov -format UDZO "$disk_image_path" > /dev/null
  "$codesign_binary" --force --sign "$signing_identity" "$disk_image_path"
}

notarize_and_staple() {
  "$xcrun_binary" notarytool submit "$disk_image_path" --keychain-profile "$notary_profile" --wait
  "$xcrun_binary" stapler staple "$disk_image_path"
  /usr/sbin/spctl -a -vv -t open --context context:primary-signature "$disk_image_path" 2>&1 | grep -q accepted
}

write_sum() {
  (cd "$release_directory" && shasum -a 256 "$disk_image_name" > "$disk_image_name.sha256")
  sum=$(cut -d' ' -f1 "$disk_image_path.sha256")
}

sign_with_release_key() {
  agent_socket="$work_directory/agent.sock"
  agent_process=$("$ssh_agent_binary" -a "$agent_socket" | sed -n 's/.*SSH_AGENT_PID=\([0-9]*\).*/\1/p' | head -1)
  [[ -n "$agent_process" ]] || fail "could not start the signing agent"
  "$security_binary" find-generic-password -s "$release_key_item" -w | base64 --decode | SSH_AUTH_SOCK=$agent_socket "$ssh_add_binary" - > /dev/null 2>&1 || fail "could not load the release key into the agent"
  SSH_AUTH_SOCK=$agent_socket "$ssh_add_binary" -L | head -1 > "$work_directory/release.pub"
  SSH_AUTH_SOCK=$agent_socket "$ssh_keygen_binary" -Y sign -f "$work_directory/release.pub" -n "$release_namespace" "$disk_image_path" > /dev/null 2>&1 || fail "could not sign the disk image with the release key"
  stop_agent
}

write_appcast() {
  local sparkle_output sparkle_signature sparkle_length
  sparkle_output=$("$sign_update_binary" "$disk_image_path") || fail "Sparkle could not sign the disk image"
  sparkle_signature=$(sed -n 's/.*sparkle:edSignature="\([^"]*\)".*/\1/p' <<< "$sparkle_output")
  sparkle_length=$(sed -n 's/.*length="\([0-9]*\)".*/\1/p' <<< "$sparkle_output")
  [[ -n "$sparkle_signature" && -n "$sparkle_length" ]] || fail "Sparkle printed no signature"
  cat > "$release_directory/appcast.xml" << APPCAST
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
}

write_latest_pointer() {
  printf '{"version":"%s","build":%s,"sha256":"%s"}' "$version" "$build" "$sum" > "$release_directory/latest.json"
}

build_release() {
  build_app
  verify_app_signature
  create_disk_image
  if [[ "$notarization_enabled" == true ]]; then notarize_and_staple; fi
  write_sum
  sign_with_release_key
  write_appcast
  write_latest_pointer
}

publish_versioned_objects() {
  local name state absent_names=""
  for name in "$disk_image_name" "$disk_image_name.sha256" "$disk_image_name.sig"; do
    state=$(object_state "$version/$name" "$release_directory/$name")
    [[ "$state" != differs ]] || fail "$version/$name differs from the published file"
    [[ "$state" != absent ]] || absent_names="$absent_names $name"
  done
  for name in $absent_names; do
    upload_object "$version/$name" "$release_directory/$name"
  done
}

publish_pointer() {
  local name=$1 state
  state=$(object_state "$name" "$release_directory/$name")
  [[ "$state" != same ]] || return 0
  upload_object "$name" "$release_directory/$name"
}

push_tag() {
  local tag="$tag_prefix$version"
  git ls-remote --exit-code --tags origin "refs/tags/$tag" > /dev/null 2>&1 && return 0
  git rev-parse -q --verify "refs/tags/$tag" > /dev/null || git tag "$tag"
  git push -q origin "refs/tags/$tag"
  changes=$((changes + 1))
}

publish_release() {
  publish_versioned_objects
  publish_pointer appcast.xml
  publish_pointer latest.json
  push_tag
}

report_release() {
  [[ "$changes" -gt 0 ]] || echo "$version is already published"
  echo "$download_address"
  echo "sha256: $sum"
}

parse_arguments "$@"
cd "$root"
mkdir -p "$release_home"
chmod 700 "$release_home"
work_directory=$(mktemp -d "$release_home/work.XXXXXX")
trap cleanup EXIT

if [[ "$create_release_key_requested" == true ]]; then
  create_release_key
  exit 0
fi

require_release_source
keychain_item_exists || fail "the Keychain item $release_key_item is missing"
resolve_version
release_directory="$release_home/$version"
disk_image_name="$scheme_name-$version.dmg"
disk_image_path="$release_directory/$disk_image_name"
app_path="$release_directory/derived/Build/Products/Release/$scheme_name.app"
download_address="$site_origin/download/$version/$disk_image_name"
build=$(git rev-list --count HEAD)
mkdir -p "$release_directory"
chmod 700 "$release_directory"

if [[ ! -f "$release_directory/latest.json" ]]; then
  [[ "$dry_run" == true ]] || require_newer_build
  build_release
fi
sum=$(cut -d' ' -f1 "$disk_image_path.sha256")

if [[ "$dry_run" == true ]]; then
  echo "dry run: $disk_image_path"
  echo "sha256: $sum"
  exit 0
fi

publish_release
report_release
