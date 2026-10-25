#!/usr/bin/env bash
# Runs a command with a Java 11+ runtime on PATH (the Firestore emulator needs Java 11+).
# Order: existing JAVA_HOME if >= 11, Homebrew openjdk@21 / openjdk, then /usr/libexec/java_home -v 21/17/11.
set -euo pipefail

java_major() {
  "$1/bin/java" -version 2>&1 | head -1 | sed -E 's/.*version "([0-9]+)(\.([0-9]+))?.*/\1 \3/' | awk '{ if ($1 == "1") print $2; else print $1 }'
}

pick=""
if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]] && [[ "$(java_major "$JAVA_HOME")" -ge 11 ]]; then
  pick="$JAVA_HOME"
fi
if [[ -z "$pick" ]]; then
  for c in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 /opt/homebrew/opt/openjdk /usr/local/opt/openjdk; do
    if [[ -x "$c/bin/java" ]] && [[ "$(java_major "$c")" -ge 11 ]]; then pick="$c"; break; fi
  done
fi
if [[ -z "$pick" && -x /usr/libexec/java_home ]]; then
  for v in 21 17 11; do
    if h=$(/usr/libexec/java_home -v "$v" 2>/dev/null) && [[ "$(java_major "$h")" -ge 11 ]]; then pick="$h"; break; fi
  done
fi
if [[ -z "$pick" ]] && command -v java >/dev/null 2>&1; then
  sys_home="$(dirname "$(dirname "$(command -v java)")")"
  if [[ "$(java_major "$sys_home")" -ge 11 ]]; then pick="$sys_home"; fi
fi
if [[ -z "$pick" ]]; then
  echo "error: Java 11+ is required for the Firestore emulator. Install it with: brew install openjdk@21" >&2
  exit 1
fi
export JAVA_HOME="$pick"
export PATH="$JAVA_HOME/bin:$PATH"
exec "$@"
