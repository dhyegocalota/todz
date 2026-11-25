#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
source_root="$(cd "$here/.." && pwd)"
failures=0

scratch=$(mktemp -d)
repository="$scratch/repository"
stub_bin="$scratch/stub-bin"
linked_bin="$scratch/linked-bin"
export STUB_LOG="$scratch/calls.log"
export STUB_MUTATE= STUB_REPOSITORY="$repository"
stub_path="$repository/node_modules/.bin:$stub_bin:$linked_bin:/usr/bin:/bin"

DEFAULT_NODE_VERSION=v24.7.0
OTHER_NODE_VERSION=v25.0.0
ALL_GATES="doctor format secrets typecheck audit unit e2e macos docs"
DOCS_SITE_GATES="doctor format secrets typecheck audit shape docs"
DOCS_PACKAGE_CALL="pnpm --filter @todz/docs --fail-if-no-match run"
MACOS_GATES="doctor format secrets audit shape macos"
DOCS_GATES="doctor format secrets audit shape"
TYPES_PACKAGES="@todz/example @todz/types"
PRODUCT_GATES="doctor format secrets typecheck audit shape unit"

expect_match() {
  local name=$1 output=$2 pattern=$3
  [[ "$output" =~ $pattern ]] && return
  echo "FAIL $name: output did not match /$pattern/: $output"
  failures=$((failures + 1))
}

expect_no_match() {
  local name=$1 output=$2 pattern=$3
  [[ "$output" =~ $pattern ]] || return
  echo "FAIL $name: output matched /$pattern/: $output"
  failures=$((failures + 1))
}

expect_equal() {
  local name=$1 actual=$2 expected=$3
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected '$expected', got '$actual'"
  failures=$((failures + 1))
}

expect_line() {
  local name=$1 output=$2 key=$3 expected=$4
  expect_equal "$name: $key" "$(grep "^$key: " <<< "$output")" "$key: $expected"
}

in_repository() { git -C "$repository" -c user.name=verify -c user.email=verify@example.com "$@"; }

write_stub() {
  printf '#!/usr/bin/env bash\n%s\n' "$2" > "$stub_bin/$1"
  chmod +x "$stub_bin/$1"
}

install_stubs() {
  mkdir -p "$stub_bin" "$linked_bin"
  write_stub pnpm 'echo "pnpm $* TZ=${TZ:-}" >> "$STUB_LOG"; [[ -n "${STUB_MUTATE:-}" ]] && eval "$STUB_MUTATE"; [[ "$*" == "${STUB_FAIL:-}" ]] && exit 1; exit 0'
  write_stub node 'echo "$STUB_NODE_VERSION"'
  write_stub gitleaks 'echo "gitleaks $*" >> "$STUB_LOG"'
  write_stub swift 'echo "swift $*" >> "$STUB_LOG"'
  write_stub xcodegen 'echo "xcodegen $*" >> "$STUB_LOG"'
  write_stub xcodebuild 'echo "xcodebuild $*" >> "$STUB_LOG"; [[ "$*" == "${STUB_XCODEBUILD_FAIL:-}" ]] && exit 1; exit 0'
  ln -sf "$(command -v git)" "$linked_bin/git"
  ln -sf "$(command -v jq)" "$linked_bin/jq"
}

write_package() {
  local folder=$1 name=$2 dependencies=$3
  mkdir -p "$repository/$folder"
  printf '{"name":"%s","dependencies":%s}\n' "$name" "$dependencies" > "$repository/$folder/package.json"
}

change() {
  mkdir -p "$(dirname "$repository/$1")"
  printf 'change %s\n' "$RANDOM" >> "$repository/$1"
}

commit_change() {
  change "$1"
  in_repository add -- "$1"
  in_repository commit -q -m "change $1"
}

head_sha() { in_repository rev-parse HEAD; }
record_file() { echo "$repository/.git/verify/$(head_sha)"; }
record_count() { find "$repository/.git/verify" -type f 2>/dev/null | wc -l | tr -d ' '; }

new_repository() {
  rm -rf "$repository" "$stub_bin" "$scratch/origin.git"
  install_stubs
  mkdir -p "$repository"
  in_repository init -q -b main
  echo node_modules >> "$repository/.git/info/exclude"
  mkdir -p "$repository/scripts" "$repository/.agents/hooks" "$repository/.agents/skills/x" "$repository/.github/scripts" "$repository/.github/workflows" "$repository/docs"
  cp "$source_root/scripts/verify.sh" "$source_root/scripts/verify-gates.tsv" "$repository/scripts/"
  write_package apps/example @todz/example '{"@todz/types":"workspace:*"}'
  write_package apps/api @todz/api '{}'
  write_package apps/docs @todz/docs '{}'
  write_package libs/types @todz/types '{}'
  write_package tools/repository-shape @todz/repository-shape '{}'
  printf '#!/usr/bin/env bash\n[[ "${1:-}" == --fix ]] && { echo "install $2"; exit 0; }\necho doctor >> "$STUB_LOG"\n' > "$repository/.agents/hooks/doctor.sh"
  printf '#!/usr/bin/env bash\necho "probe $*" >> "$STUB_LOG"\n' > "$repository/.github/scripts/secret-rules-probe.sh"
  chmod +x "$repository/.agents/hooks/doctor.sh" "$repository/.github/scripts/secret-rules-probe.sh" "$repository/scripts/verify.sh"
  local tracked
  for tracked in README.md LICENSE AGENTS.md pnpm-lock.yaml docs/architecture.md .agents/skills/x/SKILL.md .github/workflows/verify.yml apps/example/README.md apps/example/vite.config.ts apps/example/src/a.ts tools/repository-shape/src/x.test.ts libs/types/src/x.ts; do
    change "$tracked"
  done
  in_repository add -- scripts apps libs tools .agents .github docs README.md LICENSE AGENTS.md pnpm-lock.yaml
  in_repository commit -q -m initial
  git init -q --bare "$scratch/origin.git"
  in_repository remote add origin "$scratch/origin.git"
  in_repository push -q origin main
  in_repository checkout -q -b feature
  export STUB_NODE_VERSION=$DEFAULT_NODE_VERSION STUB_FAIL= STUB_MUTATE=
  : > "$STUB_LOG"
}

run_verify() {
  output=$(cd "$repository" && PATH="$stub_path" bash scripts/verify.sh "$@" 2>&1)
  status=$?
}

classify() {
  new_repository
  change "$1"
  run_verify --plan
}

calls() { cat "$STUB_LOG"; }

classify README.md
expect_no_match "a README typo does not select the typecheck gate" "$output" typecheck
expect_line "a README typo" "$output" class docs
expect_line "a README typo" "$output" gates "$DOCS_GATES"
expect_line "a README typo" "$output" packages -

classify docs/architecture.md
expect_line "a docs page" "$output" class docs

classify docs/scenarios/x.md
expect_line "a scenario" "$output" class tooling

classify apps/docs/self-host.mdx
expect_line "the self-host guide" "$output" class product
expect_line "the self-host guide" "$output" gates "$DOCS_SITE_GATES"
expect_line "the self-host guide" "$output" packages -

classify .env.example
expect_line "the environment template" "$output" gates "doctor format secrets audit shape unit"
expect_line "the environment template" "$output" packages "@todz/api"

for site_path in apps/api/src/site/landing-page.ts apps/api/public/landing/x.png apps/api/e2e/landing.spec.ts apps/api/playwright.config.ts apps/api/wrangler.jsonc apps/api/migrations/0005_waitlist.sql; do
  classify "$site_path"
  expect_line "$site_path" "$output" class product
  expect_line "$site_path" "$output" gates "doctor format secrets typecheck audit shape unit e2e"
  expect_line "$site_path" "$output" packages "@todz/api"
done

classify apps/example/src/a.ts
expect_no_match "an application change outside the site skips the end-to-end suite" "$output" e2e

classify docs/adr/0001-x.md
expect_line "an ADR" "$output" class docs

classify apps/example/README.md
expect_line "a package README" "$output" class docs

classify apps/example/vite.config.ts
expect_line "an application file" "$output" class product
expect_line "an application file" "$output" gates "$PRODUCT_GATES"
expect_line "an application file" "$output" packages @todz/example

classify libs/types/src/x.ts
expect_line "a types file" "$output" class product
expect_line "a types file" "$output" packages "$TYPES_PACKAGES"
expect_line "a types file" "$output" gates "$PRODUCT_GATES"

classify apps/macos/Todz/TodzApp.swift
expect_line "a macOS application file" "$output" class product
expect_line "a macOS application file" "$output" gates "$MACOS_GATES"
expect_line "a macOS application file" "$output" packages -

classify apps/macos/README.md
expect_line "the macOS README" "$output" class docs
expect_line "the macOS README" "$output" gates "$DOCS_GATES"

new_repository
commit_change apps/macos/Todz/TodzApp.swift
run_verify
expect_equal "a macOS change exits 0" "$status" 0
expect_match "a macOS change tests, generates and builds in order" "$(calls)" 'swift test --package-path apps/macos/TodzKit.*xcodegen generate --spec apps/macos/project\.yml.*xcodebuild build -project apps/macos/Todz\.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build'
expect_no_match "a macOS change never runs the unit suites" "$(calls)" 'test:unit'

new_repository
commit_change apps/macos/Todz/TodzApp.swift
rm "$stub_bin/xcodegen"
run_verify
expect_equal "a missing xcodegen exits 1" "$status" 1
expect_match "a missing xcodegen names the fix" "$output" 'verify: macos failed: xcodegen is not installed\. fix: install xcodegen'
expect_no_match "a missing xcodegen runs no Swift" "$(calls)" 'swift test'

new_repository
commit_change apps/macos/Todz/TodzApp.swift
STUB_XCODEBUILD_FAIL=-version
export STUB_XCODEBUILD_FAIL
run_verify
unset STUB_XCODEBUILD_FAIL
expect_equal "an xcodebuild whose -version fails exits 1" "$status" 1
expect_match "an xcodebuild whose -version fails names the fix" "$output" 'verify: macos failed: xcodebuild is not installed\. fix: install xcodebuild'

classify apps/docs/index.mdx
expect_line "a page of the docs site" "$output" class product
expect_line "a page of the docs site" "$output" gates "$DOCS_SITE_GATES"
expect_line "a page of the docs site" "$output" packages -

classify apps/docs/README.md
expect_line "the docs site README" "$output" class docs
expect_line "the docs site README" "$output" gates "$DOCS_GATES"

new_repository
commit_change apps/docs/index.mdx
run_verify
expect_equal "a docs site change exits 0" "$status" 0
expect_match "a docs site change checks links, validates, then walks, each failing on no package" "$(calls)" "$DOCS_PACKAGE_CALL broken-links.*$DOCS_PACKAGE_CALL validate.*$DOCS_PACKAGE_CALL test:walk"

new_repository
commit_change apps/docs/index.mdx
STUB_FAIL="--filter @todz/docs --fail-if-no-match run broken-links"
run_verify
expect_equal "a failing link check exits 1" "$status" 1
expect_match "a failing link check names the installed mint CLI and the client download" "$output" "verify: docs failed: .*installed mint CLI.*Mintlify's client download"
expect_no_match "a failing link check never walks" "$(calls)" 'test:walk'
expect_no_match "a failing link check never validates" "$(calls)" 'run validate'

classify libs/types/README.md
expect_line "a library README" "$output" class docs
expect_line "a library README" "$output" gates "$DOCS_GATES"

classify apps/README.md
expect_line "the applications index" "$output" class docs
expect_line "the applications index" "$output" packages -

classify libs/README.md
expect_line "the libraries index" "$output" class docs
expect_line "the libraries index" "$output" packages -

classify .agents/hooks/doctor.sh
expect_line "a hook script" "$output" gates "doctor format secrets audit hooks shape"

classify .agents/skills/x/SKILL.md
expect_line "a skill" "$output" class tooling
expect_line "a skill" "$output" gates "doctor format secrets audit hooks shape"

classify AGENTS.md
expect_line "AGENTS.md" "$output" class tooling

classify .github/workflows/verify.yml
expect_line "a workflow" "$output" class tooling
expect_line "a workflow" "$output" gates "$DOCS_GATES"

classify .github/scripts/secret-rules-probe.sh
expect_line "the secret rules probe" "$output" class tooling
expect_line "the secret rules probe" "$output" gates "doctor format secrets audit shape"

new_repository
printf '# edited\n' >> "$repository/.github/scripts/secret-rules-probe.sh"
in_repository add -- .github/scripts/secret-rules-probe.sh
in_repository commit -q -m "edit the probe"
run_verify
expect_equal "a change to the secret rules probe runs green" "$status" 0
expect_match "a change to the secret rules probe runs the probe" "$(calls)" 'probe '

classify tools/repository-shape/src/x.test.ts
expect_line "a repository shape test" "$output" gates "doctor format secrets typecheck audit shape"

classify tools/repository-shape/package.json
expect_line "a tools manifest" "$output" gates "$ALL_GATES"

classify pnpm-lock.yaml
expect_line "the lockfile" "$output" class product
expect_line "the lockfile" "$output" gates "$ALL_GATES"

classify scripts/verify-gates.tsv
expect_line "the gate map" "$output" gates "$ALL_GATES"

classify LICENSE
expect_line "an unknown path" "$output" class product
expect_line "an unknown path" "$output" gates "$ALL_GATES"

new_repository
in_repository mv apps/example/src/a.ts docs/a.md
run_verify --plan
expect_line "a rename out of an app" "$output" class product
expect_line "a rename out of an app" "$output" packages @todz/example

classify apps/example/src/new.ts
expect_line "an untracked application file" "$output" packages @todz/example

new_repository
change README.md
change apps/example/vite.config.ts
run_verify --plan
expect_line "a README and an application file" "$output" class product

new_repository
commit_change README.md
run_verify
expect_equal "a README change runs green" "$status" 0
expect_match "a README change reports the gates" "$output" "verify: 5 gates green at $(in_repository rev-parse --short HEAD) \(docs\)"
expect_no_match "a README change skips the heavy gates" "$(calls)" 'typecheck|test:unit'

new_repository
commit_change pnpm-lock.yaml
run_verify
expect_equal "the lockfile exits 0" "$status" 0
expect_equal "the lockfile writes a record" "$(record_count)" 1

new_repository
commit_change apps/example/vite.config.ts
STUB_FAIL=typecheck
run_verify
expect_equal "a failing typecheck exits 1" "$status" 1
expect_match "a failing typecheck is named" "$output" 'verify: typecheck failed'
expect_no_match "a failing typecheck stops the run" "$(calls)" 'security:audit|test:unit'
expect_equal "a failing typecheck writes no record" "$(record_count)" 0

new_repository
commit_change README.md
rm "$stub_bin/gitleaks"
run_verify
expect_equal "a missing gitleaks exits 1" "$status" 1
expect_match "a missing gitleaks names the fix" "$output" 'verify: secrets failed: gitleaks is not installed\. fix: install gitleaks'

new_repository
commit_change README.md
run_verify
expect_equal "a clean green run exits 0" "$status" 0
expect_match "a clean green run writes the record" "$(cat "$(record_file)")" "node: $DEFAULT_NODE_VERSION"$'\n'"class: docs"$'\n'"gates: $DOCS_GATES"
: > "$STUB_LOG"
run_verify
expect_equal "a second run exits 0" "$status" 0
expect_match "a second run is already green" "$output" "verify: $(in_repository rev-parse --short HEAD) already green"
expect_match "a second run still scans and audits" "$(calls)" 'gitleaks git.*pnpm security:audit|pnpm security:audit.*gitleaks git'
expect_no_match "a second run runs nothing else" "$(calls)" 'typecheck|test:unit|prettier|doctor'

new_repository
change README.md
run_verify
expect_equal "a dirty green run exits 0" "$status" 0
expect_equal "a dirty green run writes no record" "$(record_count)" 0

new_repository
commit_change apps/example/vite.config.ts
recorded_commit=$(head_sha)
run_verify
commit_change README.md
run_verify --plan
expect_line "a docs commit after a recorded commit" "$output" base "$recorded_commit (record)"
expect_line "a docs commit after a recorded commit" "$output" class product
expect_line "a docs commit after a recorded commit" "$output" gates "$DOCS_GATES"

new_repository
commit_change README.md
run_verify
STUB_NODE_VERSION=$OTHER_NODE_VERSION
run_verify --plan
expect_line "a record under another Node version" "$output" base "$(in_repository rev-parse origin/main) (merge base)"

new_repository
commit_change apps/example/vite.config.ts
run_verify
in_repository checkout -q main
commit_change libs/types/src/y.ts
in_repository push -q origin main
in_repository checkout -q feature
in_repository merge -q --no-edit main
run_verify --plan
expect_line "a merge of main into a recorded branch" "$output" packages "$TYPES_PACKAGES"

new_repository
commit_change apps/example/vite.config.ts
run_verify
run_verify all --plan
expect_line "all ignores records" "$output" base "$(in_repository rev-parse origin/main) (merge base)"
: > "$STUB_LOG"
run_verify all
expect_equal "all exits 0" "$status" 0
expect_match "all checks the whole format" "$(calls)" 'pnpm format:check'
expect_match "all runs every unit suite" "$(calls)" 'pnpm test:unit'

classify docs/install.sh
expect_line "an unknown file under docs" "$output" gates "$ALL_GATES"

classify docs/media/x.png
expect_line "a screenshot" "$output" class docs

new_repository
commit_change apps/example/vite.config.ts
run_verify
run_verify --plan
expect_line "the class after a recorded run" "$output" class product
expect_line "the gates after a recorded run" "$output" gates "secrets audit"

new_repository
commit_change apps/example/vite.config.ts
in_repository branch -f main HEAD
run_verify --plan
expect_line "a moved local main" "$output" class product
expect_line "a moved local main" "$output" gates "$PRODUCT_GATES"

new_repository
in_repository remote set-url origin "$scratch/missing.git"
run_verify --plan
expect_match "a failed fetch is said" "$output" 'verify: could not fetch origin main; the base is origin/main as last fetched'
expect_line "a failed fetch still plans" "$output" class docs

new_repository
change README.md
STUB_MUTATE='git -C "$STUB_REPOSITORY" checkout -q -- .'
run_verify
expect_equal "a tree dirty at the start exits 0" "$status" 0
expect_equal "a tree dirty at the start writes no record" "$(record_count)" 0

new_repository
commit_change README.md
STUB_MUTATE='git -C "$STUB_REPOSITORY" -c user.name=verify -c user.email=verify@example.com commit -q --allow-empty -m moved'
run_verify
expect_equal "a HEAD that moved exits 0" "$status" 0
expect_equal "a HEAD that moved writes no record" "$(record_count)" 0

new_repository
commit_change README.md
STUB_MUTATE='echo late >> "$STUB_REPOSITORY/README.md"'
run_verify
expect_equal "a tree dirty at the end exits 0" "$status" 0
expect_equal "a tree dirty at the end writes no record" "$(record_count)" 0

new_repository
commit_change "apps/example/src/my file.ts"
run_verify
expect_equal "a path with a space exits 0" "$status" 0
expect_match "a path with a space reaches Prettier whole" "$(calls)" 'prettier --check --ignore-unknown apps/example/src/my file\.ts'

new_repository
commit_change README.md
mkdir -p "$repository/node_modules/.bin"
printf '#!/usr/bin/env bash\necho "planted gitleaks" >> "$STUB_LOG"\n' > "$repository/node_modules/.bin/gitleaks"
chmod +x "$repository/node_modules/.bin/gitleaks"
run_verify
expect_equal "a planted gitleaks exits 0" "$status" 0
expect_no_match "a planted gitleaks is never run" "$(calls)" 'planted'
expect_match "the real gitleaks is run" "$(calls)" 'gitleaks git'

new_repository
commit_change README.md
mkdir -p "$repository/node_modules/.bin"
cp "$stub_bin/gitleaks" "$repository/node_modules/.bin/gitleaks"
rm "$stub_bin/gitleaks"
run_verify
expect_equal "only a planted gitleaks exits 1" "$status" 1
expect_match "only a planted gitleaks counts as missing" "$output" 'verify: secrets failed: gitleaks is not installed'

new_repository
commit_change apps/example/vite.config.ts
in_repository config remote.origin.fetch '+refs/heads/none:refs/remotes/origin/none'
in_repository update-ref refs/remotes/origin/main HEAD
run_verify --plan
expect_line "a forged tracking ref" "$output" class product
expect_line "a forged tracking ref" "$output" gates "$PRODUCT_GATES"

new_repository
commit_change README.md
in_repository remote set-url origin "$scratch/missing.git"
run_verify
expect_equal "a failed fetch still runs green" "$status" 0
expect_match "a failed fetch says no record" "$output" 'verify: no record: origin main could not be fetched'
expect_equal "a failed fetch writes no record" "$(record_count)" 0

new_repository
commit_change libs/types/src/x.ts
run_verify
expect_equal "a types change exits 0" "$status" 0
expect_match "a types change runs the library again in Kolkata" "$(calls)" 'pnpm --filter @todz/types test:unit TZ=Asia/Kolkata'
expect_match "a types change announces the time zone run" "$output" 'verify: unit in Asia/Kolkata'
expect_match "a types change runs its dependents" "$(calls)" 'pnpm --filter @todz/example --filter @todz/types test:unit'

new_repository
commit_change apps/example/vite.config.ts
run_verify
expect_equal "an application change exits 0" "$status" 0
expect_match "an application change runs the application unit suite" "$(calls)" 'pnpm --filter @todz/example test:unit'
expect_no_match "an application change never runs in Kolkata" "$(calls)" 'TZ=Asia/Kolkata'

new_repository
commit_change README.md
run_verify all
expect_equal "all exits 0" "$status" 0
expect_match "all runs the libraries again in Kolkata" "$(calls)" 'pnpm --filter @todz/types test:unit TZ=Asia/Kolkata'

new_repository
change AGENTS.md
ln -s AGENTS.md "$repository/CLAUDE.md"
run_verify
expect_match "format checks a changed file" "$(calls)" 'prettier --check --ignore-unknown AGENTS.md'
expect_no_match "format skips a symbolic link" "$(calls)" 'CLAUDE.md'

SCANNING_GITLEAKS='echo "gitleaks $*" >> "$STUB_LOG"
revisions=--all
for argument in "$@"; do [[ $argument == --log-opts=* ]] && revisions=${argument#--log-opts=}; done
! git -C "${@: -1}" log -p $revisions | grep -q PLANTED_SECRET'

new_repository
in_repository checkout -q -b other main
commit_change leaked.txt
echo PLANTED_SECRET >> "$repository/leaked.txt"
in_repository add -- leaked.txt
in_repository commit -q -m "plant a secret on the other branch"
in_repository checkout -q feature
commit_change README.md
write_stub gitleaks "$SCANNING_GITLEAKS"
run_verify
expect_equal "a secret only on another branch exits 0" "$status" 0
expect_no_match "a secret only on another branch is not reported" "$output" 'secrets failed'

new_repository
commit_change leaked.txt
echo PLANTED_SECRET >> "$repository/leaked.txt"
in_repository add -- leaked.txt
in_repository commit -q -m "plant a secret on this branch"
write_stub gitleaks "$SCANNING_GITLEAKS"
run_verify
expect_equal "a secret in the history of HEAD exits 1" "$status" 1
expect_match "a secret in the history of HEAD fails the secrets gate" "$output" 'verify: secrets failed'

rm -rf "$scratch"

[[ "$failures" == 0 ]] && echo "verify: all checks passed" && exit 0
echo "verify: $failures check(s) failed"
exit 1
