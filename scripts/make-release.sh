#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/make-release.sh <buyer-slug> [github-org]
#
# Produces a clean, history-free snapshot of the current working tree and pushes
# it to a FRESH private GitHub repo named mywedding-<buyer-slug>, one per buyer.
# The seller's full git history and dev-internal tooling are NEVER included.
#
# Run this only from a clean working tree on the release branch/tag.

BUYER="${1:?Usage: make-release.sh <buyer-slug> [github-org]}"
ORG="${2:-}"
SRC="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
REPO_NAME="mywedding-${BUYER}"

# Files/dirs that must never reach a buyer (seller-internal or dev artifacts).
EXCLUDES=(
  ".git"
  "sellProposal.md"
  "docs/superpowers"
  "docs/agents"
  ".agent" ".agents" ".remember" ".idea" ".claude"
  "issues.md"
  "requirement"
  "skills-lock.json"
  "scripts/make-release.sh"
  "go-server/issuesResolution.md"
  "hero_after_load.png" "hero_after_scroll.png" "hero_section.png"
)

echo "==> Refusing to run with a dirty tree..."
if ! git -C "$SRC" diff --quiet || ! git -C "$SRC" diff --cached --quiet; then
  echo "ERROR: commit or stash your changes first."; exit 1
fi

echo "==> Copying working tree to $TMP (minus exclude-list, node_modules, build output, and env files)..."
RSYNC_EXCLUDES=()
for e in "${EXCLUDES[@]}"; do RSYNC_EXCLUDES+=(--exclude "$e"); done
# NOTE: rsync is first-match-wins, so '--include .env.example' MUST come before
# the '.env.*' exclude, or the example file would be dropped.
rsync -a "${RSYNC_EXCLUDES[@]}" \
  --exclude 'node_modules' --exclude 'dist' --exclude 'bin' \
  --include '.env.example' --exclude '.env' --exclude '.env.*' \
  "$SRC"/ "$TMP"/

echo "==> Safety scan: fail if any real .env (besides .env.example) slipped through..."
if find "$TMP" \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' | grep -q .; then
  echo "ERROR: a real .env file is present in the snapshot. Aborting."; exit 1
fi

echo "==> Safety scan: fail if any known personal token survived..."
if grep -rniE "andreasronaldo|oandrz|casakhasa|1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC|Natasya Serena" "$TMP" \
     --exclude-dir=node_modules >/dev/null 2>&1; then
  echo "ERROR: a personal token survived into the snapshot. Aborting."
  grep -rniE "andreasronaldo|oandrz|casakhasa|1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC|Natasya Serena" "$TMP" --exclude-dir=node_modules | head
  exit 1
fi

echo "==> Initializing clean snapshot repo..."
cd "$TMP"
git init -q
git add -A
git commit -q -m "Initial release"

if command -v gh >/dev/null 2>&1; then
  TARGET="${ORG:+$ORG/}$REPO_NAME"
  echo "==> Creating private GitHub repo $TARGET and pushing..."
  gh repo create "$TARGET" --private --source=. --push
  echo "==> Done. Grant the buyer collaborator access on $TARGET, then delete $TMP."
else
  echo "==> gh CLI not found. Clean snapshot ready at: $TMP"
  echo "    Create a private repo manually and push from there, then delete $TMP."
fi
