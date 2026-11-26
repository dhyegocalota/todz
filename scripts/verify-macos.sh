#!/usr/bin/env bash
set -eu
cd "$(git rev-parse --show-toplevel)"
swift test --package-path apps/macos/TodzKit
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build "$@"
