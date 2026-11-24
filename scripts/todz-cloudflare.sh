#!/usr/bin/env bash
set -euo pipefail

account_id="e2035d8e0b7173d520ccf643f6f4661c"
keychain_item="todz-cloudflare"
api_base="https://api.cloudflare.com/client/v4"

fail() {
  echo "todz-cloudflare: $1" >&2
  exit 1
}

[[ $# -ge 1 ]] || fail "usage: todz-cloudflare.sh <command>... | api <METHOD> <path> [json-body-file]"
token=$(security find-generic-password -s "$keychain_item" -w) || fail "no Keychain item named $keychain_item"
[[ -n "$token" ]] || fail "the Keychain item $keychain_item is empty"

if [[ "$1" == api ]]; then
  [[ $# -ge 3 ]] || fail "usage: todz-cloudflare.sh api <METHOD> <path> [json-body-file]"
  method=$2
  path=$3
  body_file=${4:-}
  request_flags=(-sS -X "$method" -H @- -H "Content-Type: application/json")
  if [[ -n "$body_file" ]]; then
    [[ -f "$body_file" ]] || fail "no such file: $body_file"
    request_flags+=(--data-binary "@$body_file")
  fi
  printf 'Authorization: Bearer %s\n' "$token" | curl "${request_flags[@]}" "$api_base$path"
  exit 0
fi

export CLOUDFLARE_API_TOKEN="$token"
export CLOUDFLARE_ACCOUNT_ID="$account_id"
exec "$@"
