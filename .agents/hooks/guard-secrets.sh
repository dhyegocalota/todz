#!/usr/bin/env bash
source "$(dirname "$0")/touched-files.sh"
source "$(dirname "$0")/unsafe-head-arguments.sh"
readonly BLOCKED_MESSAGE="Blocked: agents never edit .env files; document the variable in .env.example instead. A command naming a dotenv file passes only as one plain read (cat, head, tail, wc, grep, rg, sed -n, git log|diff|show|status|rev-parse, ls, test) or as echo/printf prose redirected to another file. A command with a shell expansion passes only as one plain read, cd, or git commit -F <file> or a quoted heredoc."
readonly WORD_SEPARATORS=$' \t\n;&|<>=(){}$`'
readonly METACHARACTER_PATTERN=$'[;|&$`<>(){}\r\n]'
readonly CONTROL_OPERATOR_PATTERN=$'[;|&<>()\r\n]'
readonly SUBSTITUTION_METACHARACTER_PATTERN=$'[;|&<>(){}`\r\n]'
readonly READ_HEAD_PATTERN='^(cat|head|tail|wc|grep|rg|git log|git diff|git show|git status|git rev-parse|ls|test|\[)( |$)'
readonly SUBSTITUTION_HEAD_PATTERN='^(printf|echo|pwd)( |$)'
readonly EXPANSION_PATTERN=$'\\$\'|\\$\\(|`|\\$\\{|\\$[[:alnum:]_]|\\{[^{}]*,[^{}]*\\}|(^|[[:space:];&|])(xargs|parallel|eval)([[:space:]]|$)'
readonly SUBSTITUTION_PATTERN=$'\\$\\(([^()]*)\\)|`([^`]*)`'
readonly CHANGE_DIRECTORY_PATTERN='^cd ("[^"]*"|[^[:space:];&|<>()]+)$'
readonly COMMIT_FILE_PATTERN='^git commit( -[[:alpha:]]+)* -F [[:alnum:]_./${}"-]+$'
readonly COMMIT_HEREDOC_PATTERN=$'^git commit( -[[:alpha:]]+)* (-m "\\$\\(cat|-F -) <<\'([[:alnum:]_]+)\'$'
readonly COMMIT_MESSAGE_CLOSING='-m "$(cat'
readonly COMMIT_MESSAGE_TAIL=')"'
readonly PRINT_LINES_PATTERN="^sed -n ['\"]?[0-9]+(,[0-9]+)?p['\"]?( [^-][^ ]*)+\$"
readonly RELEASE_SECRETS_MESSAGE="Blocked: the release key and Sparkle's key are read only by pnpm release:mac. No agent command reads, dumps, changes or exports them."
readonly RELEASE_KEY_ITEM='todz-release-key'
readonly KEYCHAIN_TOOL='security'
readonly KEYCHAIN_VALUE_FLAG_PATTERN='[[:space:]]-[[:alpha:]]*[wg][[:alpha:]]*([[:space:]]|$)'
readonly SPARKLE_KEYCHAIN_PATTERN='sparkle-project\.org'
readonly SPARKLE_EXPORT_PATTERN='generate_keys[^|;&]*[[:space:]]-x'
readonly KEYCHAIN_DUMP_PATTERN='dump-keychain'
readonly KEYCHAIN_INTERACTIVE_PATTERN='security[[:space:]]+-i([[:space:]]|$)'
readonly KEYCHAIN_PASSWORD_READ_PATTERN='find-(generic|internet)-password'
readonly KEYCHAIN_PASSWORD_CHANGE_PATTERN='(add|delete)-generic-password'
readonly DOCUMENTED_PASSWORD_READ_PATTERN='[[:space:]]-s[[:space:]]+todz-turnstile([[:space:]]|$)'
readonly SERVICE_FLAG_PATTERN='[[:space:]]-[[:alpha:]]*s[[:space:]]'
readonly SPARKLE_TOOL_PATTERN='(^|[^[:alnum:]_-])(sign_update|generate_keys)([^[:alnum:]_-]|$)'
readonly RELEASE_OVERRIDE_PATTERN='TODZ_(RELEASE|DEPLOY)_'
readonly RELEASE_COMMAND_PATTERN='^(pnpm release:mac|scripts/release-mac\.sh)( --[a-z-]+( [0-9]+\.[0-9]+\.[0-9]+)?)*$'
readonly PROSE_PATTERN='^(echo|printf)[[:space:]]+([^>]*[^>[:space:]])[[:space:]]*(>>?[[:space:]]*([^[:space:]>]+))?$'

is_protected_env_file() {
  local name
  name=$(tr '[:upper:]' '[:lower:]' <<<"${1##*/}")
  [[ "$name" == .*[*?[]* ]] && return 0
  [[ "$name" =~ ^\.env ]] || return 1
  [[ "$name" == *.example ]] && return 1
  return 0
}

block() {
  echo "${1:-$BLOCKED_MESSAGE}" >&2
  exit 2
}

names_release_tool_or_override() {
  [[ "$scanned_text" =~ $SPARKLE_TOOL_PATTERN || "$scanned_text" =~ $RELEASE_OVERRIDE_PATTERN ]]
}

is_documented_password_read() {
  [[ "$scanned_text" =~ $DOCUMENTED_PASSWORD_READ_PATTERN ]] || return 1
  local remainder=${scanned_text/"${BASH_REMATCH[0]}"/ }
  [[ ! "$remainder" =~ $SERVICE_FLAG_PATTERN ]]
}

reads_keychain_value() {
  [[ "$scanned_text" == *"$KEYCHAIN_TOOL"* ]] || return 1
  [[ "$scanned_text" =~ $KEYCHAIN_DUMP_PATTERN || "$scanned_text" =~ $KEYCHAIN_INTERACTIVE_PATTERN ]] && return 0
  [[ "$scanned_text" == *"$RELEASE_KEY_ITEM"* && "$scanned_text" =~ $KEYCHAIN_PASSWORD_CHANGE_PATTERN ]] && return 0
  [[ "$scanned_text" =~ $KEYCHAIN_PASSWORD_READ_PATTERN && "$scanned_text" =~ $KEYCHAIN_VALUE_FLAG_PATTERN ]] && ! is_documented_password_read && return 0
  [[ "$scanned_text" == *"$RELEASE_KEY_ITEM"* && "$scanned_text" =~ $KEYCHAIN_VALUE_FLAG_PATTERN ]]
}

reads_release_secret() {
  [[ "$scanned_text" =~ $SPARKLE_KEYCHAIN_PATTERN || "$scanned_text" =~ $SPARKLE_EXPORT_PATTERN ]] && return 0
  reads_keychain_value && return 0
  names_release_tool_or_override && ! is_plain_read
}

is_release_command() {
  [[ "$trimmed_command" =~ $RELEASE_COMMAND_PATTERN ]]
}

has_metacharacter() {
  [[ "$1" =~ $METACHARACTER_PATTERN ]]
}

names_protected_env_file() {
  local word
  while IFS= read -r word; do
    is_protected_env_file "$word" && return 0
  done < <(tr "$WORD_SEPARATORS" '\n' <<<"$1")
  return 1
}

has_expansion() {
  [[ "$command" =~ $EXPANSION_PATTERN ]]
}

is_read_head() {
  [[ "$1" =~ $READ_HEAD_PATTERN || "$1" =~ $PRINT_LINES_PATTERN ]]
}

has_unsafe_head_arguments() {
  [[ "$scanned_text" =~ $UNSAFE_HEAD_ARGUMENTS_PATTERN ]]
}

is_plain_read() {
  has_metacharacter "$trimmed_command" && return 1
  has_unsafe_head_arguments && return 1
  is_read_head "$trimmed_command"
}

is_prose() {
  [[ "$trimmed_command" =~ $PROSE_PATTERN ]] || return 1
  local text=${BASH_REMATCH[2]} target=${BASH_REMATCH[4]}
  has_metacharacter "$text" && return 1
  has_metacharacter "$target" && return 1
  names_protected_env_file "$(tr -d "\"'\\\\" <<<"$target")" && return 1
  return 0
}

is_safe_substitution_body() {
  [[ "$1" =~ $SUBSTITUTION_METACHARACTER_PATTERN ]] && return 1
  is_read_head "$1" || [[ "$1" =~ $SUBSTITUTION_HEAD_PATTERN ]]
}

has_only_safe_substitutions() {
  local matched body
  without_substitutions=$trimmed_command
  while [[ "$without_substitutions" =~ $SUBSTITUTION_PATTERN ]]; do
    matched=${BASH_REMATCH[0]}
    body=${BASH_REMATCH[1]}${BASH_REMATCH[2]}
    body=${body#"${body%%[![:space:]]*}"}
    is_safe_substitution_body "$body" || return 1
    without_substitutions=${without_substitutions/"$matched"/}
  done
  [[ "$without_substitutions" != *'$('* && "$without_substitutions" != *'`'* ]]
}

is_read_with_expansion() {
  has_only_safe_substitutions || return 1
  [[ "$without_substitutions" =~ $CONTROL_OPERATOR_PATTERN ]] && return 1
  has_unsafe_head_arguments && return 1
  is_read_head "$without_substitutions"
}

is_directory_change() {
  has_only_safe_substitutions || return 1
  [[ "$without_substitutions" =~ $CHANGE_DIRECTORY_PATTERN ]]
}

is_commit_from_file() {
  [[ "$trimmed_command" =~ $COMMIT_FILE_PATTERN ]]
}

is_heredoc_commit() {
  [[ "$trimmed_command" == *$'\n'* ]] || return 1
  local first_line=${trimmed_command%%$'\n'*} remainder=${trimmed_command#*$'\n'}
  [[ "$first_line" =~ $COMMIT_HEREDOC_PATTERN ]] || return 1
  local closing=${BASH_REMATCH[2]} delimiter=${BASH_REMATCH[3]}
  local tail
  tail=$(awk -v delimiter="$delimiter" 'found { print } $0 == delimiter { found = 1 }' <<<"$remainder")
  [[ "$closing" == '-F -' && -z "$tail" ]] && return 0
  [[ "$closing" == "$COMMIT_MESSAGE_CLOSING" && "$tail" == "$COMMIT_MESSAGE_TAIL" ]]
}

is_allowed_expansion() {
  is_read_with_expansion && return 0
  is_directory_change && return 0
  is_commit_from_file && return 0
  is_heredoc_commit
}

touched=$(touched_files)
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  is_protected_env_file "$file" && block
done <<<"$touched"
[[ -n "$touched" ]] && exit 0
command=$(jq -r '.tool_input.command // ""' <<<"$hook_input")
scanned_text=$(tr -d "\"'\\\\" <<<"$command")
trimmed_command=${command#"${command%%[![:space:]]*}"}
reads_release_secret && ! is_release_command && block "$RELEASE_SECRETS_MESSAGE"
if names_protected_env_file "$scanned_text"; then
  is_plain_read && exit 0
  is_prose && exit 0
  block
fi
has_expansion || exit 0
is_allowed_expansion && exit 0
block
