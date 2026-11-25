# Tester briefing: Morning glance

Written by the developer sub-agents when their steps are done, each in its own section: G1 (TodzKit) and G2 (the app). The developers do not run `test-plan.md` and do not declare the feature works.

## G1

### What changed

- <file or module> — <one line>

### How to run

```bash
<commands>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

### Known gaps

- <what the developer knows is missing or untested>

## G2

### What changed

- <file or module> — <one line>

### How to run

```bash
<commands to build, force a glance and launch hidden>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

### Known gaps

- <what the developer knows is missing or untested>
