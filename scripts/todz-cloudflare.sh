#!/usr/bin/env bash
set -euo pipefail

account_id="e2035d8e0b7173d520ccf643f6f4661c"
zone_id="06490974636c535e2cbfd7c5b09925a5"
database_id="dc22b1c3-1869-44a0-b805-91bf92017f19"
keychain_item="todz-cloudflare"
api_base="https://api.cloudflare.com/client/v4"
security_binary=${TODZ_CLOUDFLARE_SECURITY_BINARY:-/usr/bin/security}
curl_binary=${TODZ_CLOUDFLARE_CURL_BINARY:-/usr/bin/curl}

fail() {
  echo "todz-cloudflare: $1" >&2
  exit 1
}

refuse_unlisted_path() {
  local path=$1
  case "$path" in
    *..* | *%2[eE]* | *\[* | *\]* | *\{* | *\}* | *\#* | */. | */./*) fail "refused $path: not on the allowlist" ;;
    /user/tokens/verify) ;;
    "/accounts/$account_id/tokens/verify") ;;
    "/zones/$zone_id/"[!?.]*) ;;
    "/accounts/$account_id/d1/database/$database_id" | "/accounts/$account_id/d1/database/$database_id/"* | "/accounts/$account_id/d1/database/$database_id?"*) ;;
    "/accounts/$account_id/workers/domains" | "/accounts/$account_id/workers/domains/"* | "/accounts/$account_id/workers/domains?"*) ;;
    "/accounts/$account_id/workers/subdomain") ;;
    *) fail "refused $path: not on the allowlist" ;;
  esac
}

[[ $# -ge 1 ]] || fail "usage: todz-cloudflare.sh <command>... | api <METHOD> <path> [json-body-file]"
if [[ "$1" == api ]]; then
  [[ $# -ge 3 ]] || fail "usage: todz-cloudflare.sh api <METHOD> <path> [json-body-file]"
  refuse_unlisted_path "$3"
fi
token=$("$security_binary" find-generic-password -s "$keychain_item" -w) || fail "could not read the Keychain item $keychain_item"
[[ -n "$token" ]] || fail "the Keychain item $keychain_item is empty"

if [[ "$1" == api ]]; then
  method=$2
  path=$3
  body_file=${4:-}
  request_flags=(-sS --globoff -X "$method" -H @- -H "Content-Type: application/json")
  if [[ -n "$body_file" ]]; then
    [[ -f "$body_file" ]] || fail "no such file: $body_file"
    request_flags+=(--data-binary "@$body_file")
  fi
  printf 'Authorization: Bearer %s\n' "$token" | "$curl_binary" -q "${request_flags[@]}" "$api_base$path"
  exit 0
fi

export CLOUDFLARE_API_TOKEN="$token"
export CLOUDFLARE_ACCOUNT_ID="$account_id"
exec "$@"
