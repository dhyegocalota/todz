#!/usr/bin/env bash

readonly TIMEOUT_EXIT_STATUS=142
readonly INTERRUPT_EXIT_STATUS=130
readonly TERMINATE_EXIT_STATUS=143
readonly HANGUP_EXIT_STATUS=129

readonly PERL_BINARY=/usr/bin/perl
readonly BASE64_BINARY=/usr/bin/base64
readonly SHASUM_BINARY=/usr/bin/shasum
readonly UUIDGEN_BINARY=/usr/bin/uuidgen
readonly LOCK_TOKEN_FILE=token
readonly TEST_MODE_VALUE=1
readonly OVERRIDE_NAME_PATTERN='^TODZ_(RELEASE|DEPLOY)_.*(_BINARY|_SECONDS|SPARKLE_REVISION|SPARKLE_TOOLS)$'

exec 9>&2

release_home="$HOME/.todz-release"
lock_directory="$release_home/lock"
lock_held_here=false
bounded_child=""

bounded() {
  local seconds=$1 step=$2 status=0
  shift 2
  "$PERL_BINARY" -e 'alarm shift; exec @ARGV or exit 127' "$seconds" "$@" <&0 &
  bounded_child=$!
  wait "$bounded_child" || status=$?
  bounded_child=""
  [[ "$status" -ne "$TIMEOUT_EXIT_STATUS" ]] || fail "$step timed out after ${seconds}s"
  return "$status"
}

stop_bounded_child() {
  [[ -z "$bounded_child" ]] || kill "$bounded_child" 2> /dev/null || true
}

refuse_overrides_outside_test_mode() {
  local name
  [[ "${TODZ_RELEASE_TEST_MODE:-}" != "$TEST_MODE_VALUE" ]] || return 0
  for name in $(compgen -e | grep -E "$OVERRIDE_NAME_PATTERN" | sort); do
    fail "$name is set: overrides are for the tests only"
  done
}

require_clean_tree() {
  [[ -z "$(git status --porcelain)" ]] || fail "the working tree is not clean"
}

is_lock_holder_token_inherited() {
  local inherited=${TODZ_RELEASE_LOCK_HELD:-}
  [[ -n "$inherited" && -f "$lock_directory/$LOCK_TOKEN_FILE" && "$inherited" == "$(cat "$lock_directory/$LOCK_TOKEN_FILE")" ]]
}

acquire_lock() {
  local token
  is_lock_holder_token_inherited && return 0
  mkdir -p "$release_home"
  chmod 700 "$release_home"
  mkdir "$lock_directory" 2> /dev/null || fail "another release or deploy holds the lock $lock_directory"
  lock_held_here=true
  token=$("$UUIDGEN_BINARY")
  (umask 077 && printf '%s' "$token" > "$lock_directory/$LOCK_TOKEN_FILE")
  export TODZ_RELEASE_LOCK_HELD=$token
  rm -rf "$release_home"/work.*
}

release_lock() {
  [[ "$lock_held_here" == false ]] || rm -rf "$lock_directory"
  lock_held_here=false
}

install_traps() {
  trap cleanup EXIT
  trap "exit $INTERRUPT_EXIT_STATUS" INT
  trap "exit $TERMINATE_EXIT_STATUS" TERM
  trap "exit $HANGUP_EXIT_STATUS" HUP
}
