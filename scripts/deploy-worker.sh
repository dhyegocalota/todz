#!/usr/bin/env bash
set -euo pipefail

site_origin="https://todz.app"
release_namespace="todz-release"
release_principal="release@todz.app"
allowed_signers_path="apps/macos/release/allowed-signers"
public_directory="apps/api/public"
version_pattern='^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'
latest_pattern='/download/([0-9.]+)/Todz-'
served_versions=2
size_limit_bytes=26214400
size_limit_label="25 MiB"
immutable_cache="public, max-age=31536000, immutable"
appcast_cache="public, max-age=300"
text_type="text/plain; charset=utf-8"
appcast_type="application/xml; charset=utf-8"
foreign_names=(_headers _redirects .assetsignore)

root=$(cd "$(dirname "$0")/.." && pwd)
source "$root/scripts/release-shared.sh"
site="$release_home/site"
deploy_home="$HOME/.todz-deploy"
curl_binary=${TODZ_DEPLOY_CURL_BINARY:-/usr/bin/curl}
cloudflare_binary=${TODZ_DEPLOY_CLOUDFLARE_BINARY:-$root/scripts/todz-cloudflare.sh}
ssh_keygen_binary=${TODZ_DEPLOY_SSH_KEYGEN_BINARY:-/usr/bin/ssh-keygen}
curl_seconds=${TODZ_DEPLOY_CURL_SECONDS:-30}
wrangler_seconds=${TODZ_DEPLOY_WRANGLER_SECONDS:-600}

usage="usage: deploy-worker.sh [--stage-only <folder>] [--candidate <version>]"
stage_only_directory=""
pending_version=""
automatic_stage=""
work_directory=""
staged=""

fail() {
  echo "deploy-worker: $1" >&9
  exit 1
}

cleanup() {
  stop_bounded_child
  [[ -z "$automatic_stage" ]] || rm -rf "$automatic_stage"
  [[ -z "$work_directory" ]] || rm -rf "$work_directory"
  release_lock
  return 0
}

parse_arguments() {
  while [[ $# -gt 0 ]]; do
    [[ $# -ge 2 ]] || fail "$usage"
    case "$1" in
      --stage-only) stage_only_directory=$2 ;;
      --candidate) pending_version=$2 ;;
      *) fail "$usage" ;;
    esac
    shift 2
  done
  [[ -z "$pending_version" || "$pending_version" =~ $version_pattern ]] || fail "$pending_version is not a version"
}

prepare_stage() {
  if [[ -n "$stage_only_directory" ]]; then
    mkdir -p "$stage_only_directory"
    stage=$(cd "$stage_only_directory" && pwd)
    [[ -z "$(ls -A "$stage")" ]] || fail "the staging folder $stage is not empty"
    return 0
  fi
  mkdir -p "$deploy_home"
  automatic_stage=$(mktemp -d "$deploy_home/stage.XXXXXX")
  stage=$automatic_stage
}

read_staged_versions() {
  local line released_versions=""
  if [[ -f "$site/released" ]]; then
    while IFS= read -r line; do
      [[ "$line" =~ $version_pattern ]] || fail "$site/released holds $line, which is not a version"
      released_versions="$released_versions$line"$'\n'
    done < "$site/released"
  fi
  [[ -z "$pending_version" ]] || released_versions="$released_versions$pending_version"$'\n'
  staged=$(printf '%s' "$released_versions" | sort -t. -k1,1n -k2,2n -k3,3n -u | tail -n "$served_versions")
}

has_staged() {
  [[ $'\n'"$staged"$'\n' == *$'\n'"$1"$'\n'* ]]
}

newest_staged() {
  tail -n 1 <<< "$staged"
}

refuse_unserved_entries() {
  local entry name
  [[ -d "$site" ]] || return 0
  entry=$(find "$site" -type l | head -n 1)
  [[ -z "$entry" ]] || fail "refused $entry: a symlink"
  for name in "${foreign_names[@]}"; do
    entry=$(find "$site" -name "$name" | head -n 1)
    [[ -z "$entry" ]] || fail "refused $entry: a foreign $name"
  done
  [[ -d "$site/download" ]] || return 0
  while IFS= read -r entry; do
    [[ "$(basename "$entry")" =~ $version_pattern && -d "$entry" ]] || fail "refused $entry: not a served file"
  done < <(find "$site/download" -mindepth 1 -maxdepth 1)
}

served_names_of() {
  local version=$1
  echo "Todz-$version.dmg Todz-$version.dmg.sha256 Todz-$version.dmg.sig appcast.xml"
}

refuse_unserved_files() {
  local version=$1 directory="$site/download/$1" entry name
  [[ -d "$directory" ]] || fail "$version: $directory is missing"
  while IFS= read -r entry; do
    [[ " $(served_names_of "$version") " == *" $(basename "$entry") "* ]] || fail "refused $entry: not a served file"
  done < <(find "$directory" -mindepth 1)
  for name in $(served_names_of "$version"); do
    [[ -f "$directory/$name" ]] || fail "$version: $name is missing"
  done
}

refuse_oversized_files() {
  local version=$1 name
  for name in $(served_names_of "$version"); do
    [[ "$(stat -f %z "$site/download/$version/$name")" -le "$size_limit_bytes" ]] || fail "$name is over $size_limit_label: ADR 0072's R2 fallback applies"
  done
}

verify_release_files() {
  local version=$1 directory="$site/download/$1"
  (cd "$directory" && "$SHASUM_BINARY" -a 256 -c "Todz-$version.dmg.sha256" > /dev/null 2>&1) || fail "$version: the sum does not match the disk image"
  "$ssh_keygen_binary" -Y verify -f "$work_directory/allowed-signers" -I "$release_principal" -n "$release_namespace" -s "$directory/Todz-$version.dmg.sig" < "$directory/Todz-$version.dmg" > /dev/null 2>&1 || fail "$version: the signature does not verify"
}

production_request() {
  local url=$1 destination=$2 answer
  answer=$(bounded "$curl_seconds" "production check" "$curl_binary" -sS -o "$destination" -w '%{http_code} %{redirect_url}' "$url") || fail "production check failed for $url"
  echo "$answer"
}

refuse_unexpected_production_answer() {
  local code=$1 url=$2
  fail "production answered $code for $url"
}

compare_with_production() {
  local version=$1 url="$site_origin/download/$1/Todz-$1.dmg.sha256" answer code
  answer=$(production_request "$url" "$work_directory/served-sum")
  code=${answer%% *}
  [[ "$code" == 404 ]] && return 0
  [[ "$code" == 200 ]] || refuse_unexpected_production_answer "$code" "$url"
  cmp -s "$work_directory/served-sum" "$site/download/$version/Todz-$version.dmg.sha256" || fail "$version: production serves another sum"
}

refuse_removing_the_download() {
  local url="$site_origin/download/latest" answer code location
  answer=$(production_request "$url" /dev/null)
  code=${answer%% *}
  location=${answer#* }
  [[ "$code" == 404 ]] && return 0
  [[ "$code" == 302 ]] || refuse_unexpected_production_answer "$code" "$url"
  [[ "$location" =~ $latest_pattern ]] || fail "production redirects $url to $location, which is not a release"
  has_staged "${BASH_REMATCH[1]}" || fail "would remove the published download: production serves ${BASH_REMATCH[1]}, which the release folder does not hold"
}

stage_public_files() {
  local name strip_count
  strip_count=$(awk -F/ '{ print NF }' <<< "$public_directory")
  git archive HEAD "$public_directory" | tar -x -C "$stage" --strip-components="$strip_count"
  [[ -f "$stage/_headers" ]] || fail "$public_directory/_headers is missing"
  for name in _redirects .assetsignore; do
    [[ ! -e "$stage/$name" ]] || fail "refused $public_directory/$name: a foreign $name"
  done
}

header_rules_of() {
  local version=$1
  printf '\n/download/%s/Todz-%s.dmg\n  Content-Disposition: attachment; filename="Todz-%s.dmg"\n  Cache-Control: %s\n' "$version" "$version" "$version" "$immutable_cache"
  printf '/download/%s/Todz-%s.dmg.sha256\n  Content-Type: %s\n  Cache-Control: %s\n' "$version" "$version" "$text_type" "$immutable_cache"
  printf '/download/%s/Todz-%s.dmg.sig\n  Content-Type: %s\n  Cache-Control: %s\n' "$version" "$version" "$text_type" "$immutable_cache"
}

stage_releases() {
  local version newest
  [[ -n "$staged" ]] || return 0
  newest=$(newest_staged)
  for version in $staged; do
    mkdir -p "$stage/download/$version"
    cp "$site/download/$version/Todz-$version.dmg" "$site/download/$version/Todz-$version.dmg.sha256" "$site/download/$version/Todz-$version.dmg.sig" "$stage/download/$version/"
    header_rules_of "$version" >> "$stage/_headers"
  done
  cp "$site/download/$newest/appcast.xml" "$stage/download/appcast.xml"
  printf '\n/download/appcast.xml\n  Content-Type: %s\n  Cache-Control: %s\n' "$appcast_type" "$appcast_cache" >> "$stage/_headers"
  printf '/download /download/%s/Todz-%s.dmg 302\n/download/latest /download/%s/Todz-%s.dmg 302\n' "$newest" "$newest" "$newest" "$newest" > "$stage/_redirects"
}

deploy_stage() {
  local head_sha output version_id
  head_sha=$(git rev-parse HEAD)
  output=$(bounded "$wrangler_seconds" "wrangler deploy" "$cloudflare_binary" pnpm --filter @todz/api exec wrangler deploy --assets "$stage" --message "$head_sha") || fail "wrangler deploy failed"
  echo "$output"
  version_id=$(sed -n 's/^Current Version ID: \(.*\)$/\1/p' <<< "$output")
  [[ -n "$version_id" ]] || fail "wrangler printed no version id"
  mkdir -p "$deploy_home/deployments"
  echo "$version_id" > "$deploy_home/deployments/$head_sha"
}

refuse_overrides_outside_test_mode
parse_arguments "$@"
cd "$root"
[[ -n "$stage_only_directory" ]] || require_clean_tree
install_traps
acquire_lock
work_directory=$(mktemp -d "$release_home/work.XXXXXX")
prepare_stage
git show "HEAD:$allowed_signers_path" > "$work_directory/allowed-signers"
read_staged_versions
refuse_unserved_entries
for version in $staged; do
  refuse_unserved_files "$version"
  refuse_oversized_files "$version"
  verify_release_files "$version"
  compare_with_production "$version"
done
refuse_removing_the_download
stage_public_files
stage_releases
echo "staged $(find "$stage" -type f | wc -l | tr -d ' ') files in $stage"
[[ -n "$stage_only_directory" ]] && exit 0
deploy_stage
