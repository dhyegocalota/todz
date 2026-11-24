#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
calls="$scratch/calls.log"
standard_input="$scratch/stdin.log"
marker="$scratch/ran"
body="$scratch/body.json"
export PATH="$fakes:$PATH"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

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

mkdir -p "$fakes"
cat > "$fakes/security" <<FAKE
#!/usr/bin/env bash
echo "security \$*" >> "$calls"
[[ "\${FAKE_SECURITY_MISSING:-no}" == yes ]] && exit 44
echo "\${FAKE_SECURITY_TOKEN-fake-token-value}"
FAKE
cat > "$fakes/curl" <<FAKE
#!/usr/bin/env bash
echo "curl \$*" >> "$calls"
cat > "$standard_input"
echo '{"success":true}'
FAKE
chmod +x "$fakes/security" "$fakes/curl"
printf '{"value":"on"}' > "$body"
account="e2035d8e0b7173d520ccf643f6f4661c"
base="https://api.cloudflare.com/client/v4"

expect_equal "the child sees the token" "$("$here/todz-cloudflare.sh" printenv CLOUDFLARE_API_TOKEN)" "fake-token-value"
expect_equal "the child sees the account" "$("$here/todz-cloudflare.sh" printenv CLOUDFLARE_ACCOUNT_ID)" "$account"
expect_contains "the token comes from the Keychain item" "$(cat "$calls")" "security find-generic-password -s todz-cloudflare -w"
expect_equal "the child's arguments pass through whole" "$("$here/todz-cloudflare.sh" printf '%s|' one 'two words')" "one|two words|"
"$here/todz-cloudflare.sh" sh -c 'exit 7'
expect_equal "the child's exit status is the wrapper's" "$?" "7"
expect_equal "the caller's shell never receives the token" "${CLOUDFLARE_API_TOKEN-unset}" "unset"

: > "$calls"
output=$("$here/todz-cloudflare.sh" api GET "/zones/zone/dns_records?name=api.todz.app")
expect_equal "api prints the JSON curl returned" "$output" '{"success":true}'
expect_contains "api calls the versioned endpoint" "$(cat "$calls")" "$base/zones/zone/dns_records?name=api.todz.app"
expect_contains "api uses the method" "$(cat "$calls")" "-X GET"
expect_contains "api reads its headers from standard input" "$(cat "$calls")" "-H @-"
expect_lacks "api never puts the token in the arguments" "$(cat "$calls")" "fake-token-value"
expect_equal "the Authorization header travels on standard input" "$(cat "$standard_input")" "Authorization: Bearer fake-token-value"
expect_lacks "api sends no body without a file" "$(cat "$calls")" "--data"

: > "$calls"
"$here/todz-cloudflare.sh" api PATCH "/zones/zone/settings/always_use_https" "$body" > /dev/null
expect_contains "api sends the body file" "$(cat "$calls")" "--data-binary @$body"
expect_contains "api uses the method with a body" "$(cat "$calls")" "-X PATCH"
expect_contains "api says the body is JSON" "$(cat "$calls")" "Content-Type: application/json"

: > "$calls"
"$here/todz-cloudflare.sh" api POST /zones/zone/anything "$scratch/missing.json" > /dev/null 2>&1
expect_equal "a missing body file exits non-zero" "$?" "1"
expect_equal "a missing body file never reaches curl" "$(grep -c '^curl' "$calls")" "0"
"$here/todz-cloudflare.sh" api GET > /dev/null 2>&1
expect_equal "api without a path exits non-zero" "$?" "1"
"$here/todz-cloudflare.sh" > /dev/null 2>&1
expect_equal "no arguments exit non-zero" "$?" "1"

: > "$calls"
FAKE_SECURITY_TOKEN="" "$here/todz-cloudflare.sh" touch "$marker" > /dev/null 2>&1
expect_equal "an empty token exits non-zero" "$?" "1"
FAKE_SECURITY_MISSING=yes "$here/todz-cloudflare.sh" touch "$marker" > /dev/null 2>&1
expect_equal "a missing Keychain item exits non-zero" "$?" "1"
FAKE_SECURITY_TOKEN="" "$here/todz-cloudflare.sh" api GET /zones > /dev/null 2>&1
expect_equal "api with an empty token exits non-zero" "$?" "1"
expect_equal "no command runs without a token" "$(test -e "$marker" && echo ran || echo clean)" "clean"
expect_equal "no request goes out without a token" "$(grep -c '^curl' "$calls")" "0"

rm -rf "$scratch"
[[ "$failures" == 0 ]] && echo "todz-cloudflare: all checks passed" && exit 0
echo "todz-cloudflare: $failures check(s) failed"
exit 1
