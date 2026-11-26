# Settings layout tester briefing

Build the Debug app from this worktree (`apps/macos/build`), never the installed app. Open Settings with ⌘, and check the six headers, the full descriptions, the aligned switches, and the labelled "Server address" row.

For the usage alert, reset the Debug app's "asked" answer (`askedAboutSharingUsage`) in its own defaults domain, then launch once. Check that Return keeps sharing off, then repeat with Escape and with Share.
