# Set up todz for development

A coding agent follows these steps unattended to take a machine from nothing to a green local gate, and stops only to ask its owner for a login ([ADR 0124](../adr/0124-setup-starts-from-a-one-line-prompt-and-an-agent-readable-runbook-behind-it.md)).

1. **Get the code.** With no clone yet, run `gh repo fork dhyegocalota/todz --clone --remote` and then `cd todz`. With a clone, run `git fetch origin` and `git switch -c chore/<slug> origin/main`.
   Expected: the working directory holds `AGENTS.md` and `.nvmrc`, and `git status` is clean.
   If it fails: `gh` missing or not signed in is a login. Stop and ask the owner to run `gh auth login` (suggest `! gh auth login` in the session), then repeat this step. A fork that already exists is reused by the same command.

2. **Run the doctor.** Run `bash .agents/hooks/doctor.sh` from the repository root.
   Expected: one line per tool, ending with `doctor: 0 missing required, 0 missing optional`; a missing optional tool never blocks this runbook, except `gitleaks`, which the gate needs.
   If it fails: every line that is not `ok` ends with `fix:` and the command that installs it. Ask the owner before installing, run each fix of a missing required tool and of `gitleaks`, then run the doctor again. `xcodebuild`, `swift` and `xcodegen` are only for the Mac app; skip them on any other system.

3. **Install the dependencies.** Run `pnpm install --frozen-lockfile`.
   Expected: the command exits 0 and `node_modules` exists at the root.
   If it fails: a message that names the wrong Node, or the wrong version of the package manager, means step 2 passed on the wrong tool; run `nvm install` (it reads `.nvmrc`) or `corepack enable`, then repeat. A lockfile error means the checkout is not the one that was cloned; run `git status` and restore `pnpm-lock.yaml` with `git checkout -- pnpm-lock.yaml`.

4. **Run the local gate.** Run `pnpm verify all`.
   Expected: every gate prints `ok` and the command exits 0 (`all` runs the gates an empty diff would skip, so the first run proves the machine).
   If it fails: the output names the gate and the file. A `doctor` failure goes back to step 2, a missing Chromium is `npx -y playwright install chromium`, and a failure in code you did not touch is a defect on `main`: stop and tell the owner with the gate output, never skip the gate or pass `--no-verify`.

5. **Read the rules.** Read `AGENTS.md` for the conventions and `.claude/HARNESS.md` for the process before changing anything.
   Expected: you can state the branch name pattern, the commit format and where tests go.
   If it fails: both files are at the repository root and under `.claude`; if either is missing the clone is incomplete, so repeat step 1.

6. **Report.** Tell the owner the machine is ready: the branch, the output of step 4 and anything skipped, then ask for the first task.
   Expected: one message with those three facts.
   If it fails: a step that was skipped is named in the message with the reason; nothing is left silent.
