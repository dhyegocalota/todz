#!/usr/bin/env bash

readonly TIMEOUT_EXIT_STATUS=142
readonly INTERRUPT_EXIT_STATUS=130
readonly TERMINATE_EXIT_STATUS=143
readonly HANGUP_EXIT_STATUS=129

release_home="$HOME/.todz-release"
lock_directory="$release_home/lock"
lock_held_here=false
bounded_child=""

bounded() {
  local seconds=$1 step=$2 status=0
  shift 2
  perl -e 'alarm shift; exec @ARGV or exit 127' "$seconds" "$@" <&0 &
  bounded_child=$!
  wait "$bounded_child" || status=$?
  bounded_child=""
  [[ "$status" -ne "$TIMEOUT_EXIT_STATUS" ]] || fail "$step timed out after ${seconds}s"
  return "$status"
}

stop_bounded_child() {
  [[ -z "$bounded_child" ]] || kill "$bounded_child" 2> /dev/null || true
}

acquire_lock() {
  [[ -z "${TODZ_RELEASE_LOCK_HELD:-}" ]] || return 0
  mkdir -p "$release_home"
  mkdir "$lock_directory" 2> /dev/null || fail "another release or deploy holds the lock $lock_directory"
  lock_held_here=true
  export TODZ_RELEASE_LOCK_HELD=yes
}

release_lock() {
  [[ "$lock_held_here" == false ]] || rmdir "$lock_directory"
  lock_held_here=false
}

install_traps() {
  trap cleanup EXIT
  trap "exit $INTERRUPT_EXIT_STATUS" INT
  trap "exit $TERMINATE_EXIT_STATUS" TERM
  trap "exit $HANGUP_EXIT_STATUS" HUP
}
