#!/bin/bash
# Print versionName from an Android app/build.gradle (single line, no quotes).
set -euo pipefail
GRADLE_FILE="${1:?usage: read-android-version.sh path/to/app/build.gradle}"
grep "versionName" "$GRADLE_FILE" | head -1 | sed "s/.*versionName '\\([^']*\\)'.*/\\1/"
