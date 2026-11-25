#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0

scratch=$(mktemp -d)
fakes="$scratch/bin"
origin="$scratch/origin.git"
repository="$scratch/repository"
bucket="$scratch/bucket"
home="$scratch/home"
all_calls="$scratch/all-calls.log"
all_output="$scratch/all-output.log"
export CALLS="$scratch/calls.log"
export BUCKET="$bucket"
export SECURITY_STDIN="$scratch/security-stdin.log"
export SSH_ADD_STDIN="$scratch/ssh-add-stdin.log"
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
export TODZ_RELEASE_CLOUDFLARE_BINARY="$fakes/cloudflare"
export TODZ_RELEASE_XCRUN_BINARY="$fakes/xcrun"
unset FAKE_CODESIGN FAKE_SECURITY_MISSING FAKE_SIGN_FAIL FAKE_CLOUDFLARE_FAIL

private_key_value="FAKE-PRIVATE-KEY-VALUE"
private_key_encoded=$(printf '%s' "$private_key_value" | base64)
openssh_header_encoded="LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZ"
dmg_content="fake-dmg-bytes"
dmg_sum=$(printf '%s\n' "$dmg_content" | shasum -a 256 | cut -d' ' -f1)
first_version="0.2.0"
commit_count=3
dmg_key="$first_version/Todz-$first_version.dmg"
sum_key="$dmg_key.sha256"
signature_key="$dmg_key.sig"
release_directory="$home/.todz-release/$first_version"
download_url="https://todz.app/download/$first_version/Todz-$first_version.dmg"

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

cat > "$fakes/security" <<'FAKE'
#!/usr/bin/env bash
echo "security $*" >> "$CALLS"
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
echo "ssh-add $*" >> "$CALLS"
if [[ "$1" == -L ]]; then
  echo "ssh-ed25519 AAAAFAKEPUBLICKEY release@todz.app"
  exit 0
fi
cat > "$SSH_ADD_STDIN"
FAKE

cat > "$fakes/ssh-keygen" <<'FAKE'
#!/usr/bin/env bash
echo "ssh-keygen $*" >> "$CALLS"
if [[ "$1" == -Y ]]; then
  [[ -n "${FAKE_SIGN_FAIL:-}" ]] && exit 1
  file=${@: -1}
  echo FAKE-SIGNATURE > "$file.sig"
  exit 0
fi
exec /usr/bin/ssh-keygen "$@"
FAKE

cat > "$fakes/codesign" <<'FAKE'
#!/usr/bin/env bash
echo "codesign $*" >> "$CALLS"
mode=${FAKE_CODESIGN:-ok}
case "$*" in
  *--verify*)
    [[ "$mode" == verify-fail ]] && { echo "invalid signature" >&2; exit 1; }
    exit 0 ;;
  *--entitlements*)
    echo "[Dict] com.apple.security.app-sandbox"
    [[ "$mode" == task-allow ]] && echo "com.apple.security.get-task-allow"
    exit 0 ;;
  *-dv*)
    team=XFWR794VS8
    flags="0x10000(runtime)"
    [[ "$mode" == other-team ]] && team=AAAAAAAAAA
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
while [[ $# -gt 0 ]]; do
  [[ "$1" == -derivedDataPath ]] && derived=$2
  shift
done
mkdir -p "$derived/Build/Products/Release/Todz.app/Contents"
echo app > "$derived/Build/Products/Release/Todz.app/Contents/file"
FAKE

cat > "$fakes/hdiutil" <<'FAKE'
#!/usr/bin/env bash
echo "hdiutil $*" >> "$CALLS"
echo fake-dmg-bytes > "${@: -1}"
FAKE

cat > "$fakes/sign_update" <<'FAKE'
#!/usr/bin/env bash
echo "sign_update $*" >> "$CALLS"
echo 'sparkle:edSignature="FAKE-SPARKLE-SIGNATURE" length="15"'
FAKE

cat > "$fakes/xcrun" <<'FAKE'
#!/usr/bin/env bash
echo "xcrun $*" >> "$CALLS"
FAKE

cat > "$fakes/cloudflare" <<'FAKE'
#!/usr/bin/env bash
echo "cloudflare $*" >> "$CALLS"
verb=$8
key=${9#todz-releases/}
case "$verb" in
  get)
    [[ "${FAKE_CLOUDFLARE_FAIL:-}" == get ]] && { echo "Authentication error [code: 10000]" >&2; exit 1; }
    [[ -f "$BUCKET/$key" ]] || { echo "The specified key does not exist. [code: 10007]" >&2; exit 1; }
    cat "$BUCKET/$key" ;;
  put)
    while [[ $# -gt 0 ]]; do
      [[ "$1" == --file ]] && file=$2
      shift
    done
    mkdir -p "$(dirname "$BUCKET/$key")"
    cp "$file" "$BUCKET/$key" ;;
esac
FAKE

chmod +x "$fakes"/*

reset_calls() {
  cat "$CALLS" >> "$all_calls" 2> /dev/null
  : > "$CALLS"
}

new_repository() {
  reset_calls
  rm -rf "$origin" "$repository" "$bucket" "$home"
  mkdir -p "$bucket" "$home" "$repository/scripts"
  git init -q --bare -b main "$origin"
  printf '#!/usr/bin/env bash\necho "git-push $(head -1)" >> "%s"\n' "$CALLS" > "$origin/hooks/pre-receive"
  chmod +x "$origin/hooks/pre-receive"
  git init -q -b main "$repository"
  git -C "$repository" remote add origin "$origin"
  cp "$here/release-mac.sh" "$repository/scripts/release-mac.sh"
  git -C "$repository" add scripts/release-mac.sh
  git -C "$repository" commit -q -m "first"
  git -C "$repository" commit -q --allow-empty -m "second"
  git -C "$repository" commit -q --allow-empty -m "third"
  git -C "$repository" push -q -u origin main 2> /dev/null
  : > "$CALLS"
  : > "$SECURITY_STDIN"
  : > "$SSH_ADD_STDIN"
}

run_release() {
  output=$(cd "$repository" && bash scripts/release-mac.sh "$@" 2>&1)
  status=$?
  printf '%s\n' "$output" >> "$all_output"
}

call_count() {
  grep -c "$1" "$CALLS" || true
}

sequence() {
  sed -nE 's#^cloudflare .*object put todz-releases/([^ ]+) .*#put:\1#p; s#^git-push .*#push#p' "$CALLS" | tr '\n' ' '
}

publish() {
  new_repository
  run_release
}

full_sequence="put:$dmg_key put:$sum_key put:$signature_key put:appcast.xml put:latest.json push "

new_repository
echo untracked > "$repository/untracked.txt"
run_release
expect_refused "a dirty tree is refused" "the working tree is not clean"
expect_equal "a dirty tree builds nothing" "$(call_count '^xcodegen')" "0"

new_repository
git -C "$repository" checkout -q -b other
run_release
expect_refused "a branch other than main is refused" "not on main"

new_repository
git -C "$repository" commit -q --allow-empty -m "unpushed"
run_release
expect_refused "a main ahead of origin is refused" "main is ahead of origin/main"

new_repository
git -C "$repository" reset -q --hard HEAD~1
run_release
expect_refused "a main behind origin is refused" "main is behind origin/main"

new_repository
run_release --bogus
expect_refused "an unknown option is refused" "usage: release-mac.sh"
run_release --version 1.2
expect_refused "a version that is not x.y.z is refused" "1.2 is not a version"

new_repository
git -C "$repository" tag mac-v0.3.0 HEAD~1
run_release --version 0.3.0
expect_refused "a tag on another commit is refused" "mac-v0.3.0 exists on another commit"
expect_equal "a tag on another commit builds nothing" "$(call_count '^xcodegen')" "0"

new_repository
git -C "$repository" tag mac-v0.2.0 HEAD~1
run_release --version 0.1.0
expect_refused "a version below the highest tag is refused" "version 0.1.0 is not greater than mac-v0.2.0"
run_release --version 0.2.0
expect_refused "the highest tag's own version on another commit is refused" "mac-v0.2.0 exists on another commit"

new_repository
git -C "$repository" tag mac-v0.2.0 HEAD~1
run_release --dry-run
expect_equal "the next patch after the highest tag is the version" "$status" "0"
expect_contains "the next patch is built" "$output" "Todz-0.2.1.dmg"

new_repository
printf '{"version":"0.1.0","build":%s,"sha256":"%s"}' "$commit_count" "$dmg_sum" > "$bucket/latest.json"
run_release
expect_refused "a build number not greater than the published one is refused" "build number $commit_count is not greater than $commit_count of the published 0.1.0"
expect_equal "a refused build number builds nothing" "$(call_count '^xcodegen')" "0"

for mode in no-runtime task-allow other-team verify-fail; do
  new_repository
  FAKE_CODESIGN=$mode run_release
  expect_equal "codesign $mode is refused" "$status" "1"
  expect_equal "codesign $mode never reaches hdiutil" "$(call_count '^hdiutil')" "0"
  expect_equal "codesign $mode puts nothing in the bucket" "$(call_count 'object put')" "0"
done
new_repository
FAKE_CODESIGN=no-runtime run_release
expect_contains "a missing runtime flag is named" "$output" "the app is not signed with the hardened runtime"
new_repository
FAKE_CODESIGN=task-allow run_release
expect_contains "a get-task-allow entitlement is named" "$output" "the app still has get-task-allow"
new_repository
FAKE_CODESIGN=other-team run_release
expect_contains "another Team ID is named" "$output" "the app is not signed by team XFWR794VS8"
new_repository
FAKE_CODESIGN=verify-fail run_release
expect_contains "a failed strict verification is named" "$output" "the app's signature does not verify"

new_repository
FAKE_SECURITY_MISSING=yes run_release
expect_refused "a missing release key is refused" "the Keychain item todz-release-key is missing"
expect_equal "a missing release key builds nothing" "$(call_count '^xcodegen')" "0"
expect_lacks "the refusal names the item, not a value" "$output" "$private_key_value"

new_repository
mkdir -p "$bucket/$first_version"
echo other-bytes > "$bucket/$dmg_key"
run_release
expect_refused "a published object with another sum is refused" "$dmg_key differs from the published file"
expect_equal "a differing published object puts nothing" "$(call_count 'object put')" "0"
expect_equal "a differing published object pushes nothing" "$(call_count '^git-push')" "0"

new_repository
FAKE_CLOUDFLARE_FAIL=get run_release
expect_refused "a bucket read that is not a missing key is refused" "could not read"
expect_equal "an unreadable bucket puts nothing" "$(call_count 'object put')" "0"

new_repository
run_release
expect_equal "a full release exits 0" "$status" "0"
expect_equal "a full release puts the objects, then the pointers, then pushes the tag" "$(sequence)" "$full_sequence"
expect_contains "the release prints the download URL" "$output" "$download_url"
expect_contains "the release prints the sum" "$output" "$dmg_sum"
expect_equal "the tag reaches origin" "$(git -C "$origin" tag --list)" "mac-v$first_version"
expect_equal "the tag sits on HEAD" "$(git -C "$repository" rev-parse "mac-v$first_version^{commit}")" "$(git -C "$repository" rev-parse HEAD)"
expect_equal "the bucket holds the sum file in shasum format" "$(cat "$bucket/$sum_key")" "$dmg_sum  Todz-$first_version.dmg"
expect_equal "the bucket holds the signature" "$(cat "$bucket/$signature_key")" "FAKE-SIGNATURE"
expect_equal "latest.json names the version, the build and the sum" "$(cat "$bucket/latest.json")" "{\"version\":\"$first_version\",\"build\":$commit_count,\"sha256\":\"$dmg_sum\"}"
appcast=$(cat "$bucket/appcast.xml")
expect_contains "the appcast names the build" "$appcast" "<sparkle:version>$commit_count</sparkle:version>"
expect_contains "the appcast names the version" "$appcast" "<sparkle:shortVersionString>$first_version</sparkle:shortVersionString>"
expect_contains "the appcast names the minimum system" "$appcast" "<sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>"
expect_contains "the appcast names the enclosure URL" "$appcast" "url=\"$download_url\""
expect_contains "the appcast names the length" "$appcast" 'length="15"'
expect_contains "the appcast carries Sparkle's signature" "$appcast" 'sparkle:edSignature="FAKE-SPARKLE-SIGNATURE"'
expect_contains "xcodebuild gets the version" "$(cat "$CALLS")" "MARKETING_VERSION=$first_version"
expect_contains "xcodebuild gets the build number" "$(cat "$CALLS")" "CURRENT_PROJECT_VERSION=$commit_count"
expect_contains "xcodebuild builds Release" "$(cat "$CALLS")" "-configuration Release"
expect_contains "the disk image is signed" "$(cat "$CALLS")" "codesign --force --sign Apple Development $release_directory/Todz-$first_version.dmg"
expect_contains "the disk image goes up as a disk image" "$(cat "$CALLS")" "todz-releases/$dmg_key --file $release_directory/Todz-$first_version.dmg --content-type application/x-apple-diskimage --remote"
expect_contains "the signature is made in the release namespace" "$(cat "$CALLS")" "-Y sign"
expect_contains "the namespace is todz-release" "$(cat "$CALLS")" "-n todz-release"
expect_equal "the private key reaches the agent on standard input" "$(cat "$SSH_ADD_STDIN")" "$private_key_value"
expect_lacks "the key is never an argument" "$(cat "$CALLS")" "$private_key_value"
expect_lacks "the encoded key is never an argument" "$(cat "$CALLS")" "$private_key_encoded"
expect_equal "the agent is killed after signing" "$(call_count '^ssh-agent -k')" "1"
expect_equal "notarytool is never called" "$(grep -c 'notarytool' "$CALLS" || true)" "0"
expect_equal "stapler is never called" "$(grep -c 'stapler' "$CALLS" || true)" "0"
expect_equal "no key file remains in the release folder" "$(find "$home/.todz-release" -type f \( -name '*key*' -o -name '*.pem' -o -name 'id_*' \) | wc -l | tr -d ' ')" "0"

reset_calls
run_release
expect_equal "a re-run exits 0" "$status" "0"
expect_contains "a re-run says it is already published" "$output" "already published"
expect_equal "a re-run puts nothing" "$(call_count 'object put')" "0"
expect_equal "a re-run pushes nothing" "$(call_count '^git-push')" "0"
expect_equal "a re-run builds nothing" "$(call_count '^xcodebuild')" "0"
expect_contains "a re-run prints the download URL" "$output" "$download_url"

git -C "$repository" tag -d "mac-v$first_version" > /dev/null
git -C "$repository" push -q origin ":refs/tags/mac-v$first_version" 2> /dev/null
rm "$bucket/$signature_key" "$bucket/appcast.xml" "$bucket/latest.json"
reset_calls
run_release
expect_equal "a release that stopped halfway finishes" "$status" "0"
expect_equal "only the missing object is put, then the pointers, then the tag" "$(sequence)" "put:$signature_key put:appcast.xml put:latest.json push "
expect_equal "the finished release builds nothing again" "$(call_count '^xcodebuild')" "0"

new_repository
run_release --dry-run
expect_equal "a dry run exits 0" "$status" "0"
expect_contains "a dry run prints the local disk image" "$output" "$release_directory/Todz-$first_version.dmg"
expect_contains "a dry run prints the sum" "$output" "$dmg_sum"
expect_equal "a dry run never reaches the bucket" "$(call_count '^cloudflare')" "0"
expect_equal "a dry run never pushes" "$(call_count '^git-push')" "0"
expect_equal "a dry run creates no tag" "$(git -C "$repository" tag --list)" ""
expect_equal "a dry run still signs the disk image" "$(test -f "$release_directory/Todz-$first_version.dmg.sig" && echo yes || echo no)" "yes"

new_repository
FAKE_SIGN_FAIL=yes run_release
expect_equal "a failed signature fails the release" "$status" "1"
expect_equal "the agent is killed when signing fails" "$(call_count '^ssh-agent -k')" "1"
expect_equal "a failed signature puts nothing in the bucket" "$(call_count 'object put')" "0"

new_repository
FAKE_SECURITY_MISSING=yes run_release --create-release-key
expect_equal "creating the release key exits 0" "$status" "0"
expect_contains "the new item is added through the interactive reader" "$(cat "$CALLS")" "security -i"
expect_contains "the key reaches the Keychain on standard input" "$(cat "$SECURITY_STDIN")" "add-generic-password"
expect_contains "the item is the release key" "$(cat "$SECURITY_STDIN")" "todz-release-key"
expect_contains "the stored key is an OpenSSH private key" "$(cat "$SECURITY_STDIN")" "$openssh_header_encoded"
expect_lacks "the key is never an argument of security" "$(cat "$CALLS")" "$openssh_header_encoded"
expect_lacks "the key is never printed" "$output" "$openssh_header_encoded"
expect_equal "no key file remains" "$(find "$home/.todz-release" -type f 2> /dev/null | wc -l | tr -d ' ')" "0"
expect_equal "the allowed signers line is printed" "$(printf '%s\n' "$output" | grep -cE '^release@todz\.app namespaces="todz-release" ssh-ed25519 [A-Za-z0-9+/=]+$')" "1"

new_repository
run_release --create-release-key
expect_refused "an existing release key is never replaced" "the Keychain item todz-release-key already exists"
expect_equal "an existing release key stores nothing" "$(wc -c < "$SECURITY_STDIN" | tr -d ' ')" "0"

cat "$CALLS" >> "$all_calls"
expect_equal "the fake private key is in no output" "$(grep -c "$private_key_value" "$all_output" || true)" "0"
expect_equal "the encoded fake private key is in no output" "$(grep -c "$private_key_encoded" "$all_output" || true)" "0"
expect_equal "the fake private key is in no call" "$(grep -c "$private_key_value" "$all_calls" || true)" "0"
expect_equal "the encoded fake private key is in no call" "$(grep -c "$private_key_encoded" "$all_calls" || true)" "0"

rm -rf "$scratch"
[[ "$failures" -eq 0 ]] && exit 0
echo "$failures failure(s)"
exit 1
