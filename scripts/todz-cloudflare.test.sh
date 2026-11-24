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
export TODZ_CLOUDFLARE_SECURITY_BINARY="$fakes/security"
export TODZ_CLOUDFLARE_CURL_BINARY="$fakes/curl"
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

expect_equal "the production Keychain reader is absolute" "$(grep -c ':-/usr/bin/security}' "$here/todz-cloudflare.sh")" "1"
expect_equal "the production curl is absolute" "$(grep -c ':-/usr/bin/curl}' "$here/todz-cloudflare.sh")" "1"
: > "$calls"
"$here/todz-cloudflare.sh" api GET /user/tokens/verify > /dev/null
expect_contains "curl ignores any curlrc" "$(cat "$calls")" "curl -q "

zone="06490974636c535e2cbfd7c5b09925a5"
database="dc22b1c3-1869-44a0-b805-91bf92017f19"
allowed_paths=(
  "/user/tokens/verify"
  "/accounts/$account/tokens/verify"
  "/zones/$zone/dns_records?name=api.todz.app"
  "/zones/$zone/settings/pseudo_ipv4"
  "/accounts/$account/d1/database/$database"
  "/accounts/$account/workers/domains"
  "/accounts/$account/workers/domains?hostname=api.todz.app&service=todz-api"
  "/accounts/$account/workers/domains/some-domain-id"
  "/accounts/$account/workers/subdomain"
)
for allowed_path in "${allowed_paths[@]}"; do
  : > "$calls"
  "$here/todz-cloudflare.sh" api GET "$allowed_path" > /dev/null 2>&1
  expect_equal "api allows $allowed_path" "$?" "0"
  expect_equal "api sends $allowed_path" "$(grep -c '^curl' "$calls")" "1"
done

refused_paths=(
  "/user/tokens"
  "/accounts/$account/workers/scripts/todz-api"
  "/accounts/$account/d1/database"
  "/accounts/$account/d1/database/another-database"
  "/accounts/$account/workers/domains-other"
  "/accounts/$account/workers/subdomain/extra"
  "/zones/another-zone/dns_records"
  "/zones/${zone}extra/dns_records"
  "/zones/$zone/../another-zone/dns_records"
  "/zones/$zone/dns_records?name=..%2f"
  "/zones/$zone/%2e%2e/another-zone"
  "/accounts/$account/workers/domains/../scripts"
  "https://example.com/zones/$zone/dns_records"
  "zones/$zone/dns_records"
)
for refused_path in "${refused_paths[@]}"; do
  : > "$calls"
  refusal=$("$here/todz-cloudflare.sh" api GET "$refused_path" 2>&1 > /dev/null)
  expect_equal "api exits non-zero for '$refused_path'" "$?" "1"
  expect_equal "api never reaches curl for '$refused_path'" "$(grep -c '^curl' "$calls")" "0"
  expect_equal "api never reads the Keychain for '$refused_path'" "$(grep -c '^security' "$calls")" "0"
  expect_contains "api says why for '$refused_path'" "$refusal" "not on the allowlist"
done

runbook="$here/../docs/runbooks/deploy-the-api.md"
runbook_paths=$(grep -oE 'todz-cloudflare\.sh api [A-Z]+ "?/[^ "`]+' "$runbook" | awk '{print $4}' | tr -d '"' | sed 's/<domain-id>/some-domain-id/')
expect_contains "the runbook has api calls to check" "$runbook_paths" "/user/tokens/verify"
while IFS= read -r runbook_path; do
  : > "$calls"
  "$here/todz-cloudflare.sh" api GET "$runbook_path" > /dev/null 2>&1
  expect_equal "the runbook's api path $runbook_path is on the allowlist" "$?" "0"
done <<< "$runbook_paths"

rm -rf "$scratch"
[[ "$failures" == 0 ]] && echo "todz-cloudflare: all checks passed" && exit 0
echo "todz-cloudflare: $failures check(s) failed"
exit 1
