#!/usr/bin/env bash
# WorktreeCreate hook: gives each remote-control session its own atlas worktree,
# warmed so the session can run `pnpm run check` immediately.
#
# Contract (verified empirically 2026-07-24, the published docs were wrong):
#   stdin  : {"session_id","transcript_path","cwd","hook_event_name","name"}
#            NOTE: no "branch" and no "repo" field — derive the repo from cwd.
#   stdout : the created worktree path, plain text. Nothing else may go here.
#   exit 0 : success. Non-zero aborts session creation entirely.
set -uo pipefail

REPO_DEFAULT="$HOME/code/atlas/worktrees/main"
TREES="$HOME/code/atlas/worktrees"
LOG="$HOME/server-infra/claude-remote/worktree.log"
mkdir -p "$(dirname "$LOG")"

payload="$(cat)"
session_id="$(printf '%s' "$payload" | node "$HOME/server-infra/claude-remote/parse-payload.js")"

# Derive the repository from the payload's cwd; fall back to the known checkout.
cwd="$(printf '%s' "$payload" | node "$HOME/server-infra/claude-remote/parse-payload.js" cwd)"
repo="$(git -C "${cwd:-$REPO_DEFAULT}" rev-parse --show-toplevel 2>/dev/null || echo "$REPO_DEFAULT")"

# Name: rc-MMDD-HHMM-<6 hex of session id>. Sorts chronologically, collision-free.
name="rc-$(date +%m%d-%H%M)-$(printf '%s' "${session_id:-unknown}" | tr -d '-' | cut -c1-6)"
target="$TREES/$name"
suffix=2
while [ -e "$target" ]; do
  target="$TREES/$name-$suffix"
  suffix=$((suffix + 1))
done

log() { printf '%s\t%s\t%s\n' "$(date -Is)" "$target" "$1" >> "$LOG"; }

# Worktree creation is fatal: without it there is no session at all.
if ! git -C "$repo" worktree add -b "$(basename "$target")" "$target" >&2; then
  echo "WorktreeCreate: git worktree add failed for $target" >&2
  log "FAILED-worktree"
  exit 1
fi

# Dependency warming is best-effort. A session that can read code but not run
# tests still beats no session at all — and you cannot debug this from a phone.
warm_failed=""
(cd "$target" && pnpm install --prefer-offline) >&2 || warm_failed="pnpm-install"

# packages/api-types/src is gitignored generated code; a fresh worktree has none,
# so `pnpm run check` fails with TS18003 until kubb runs. SKIP_GENERATE_SWAGGER
# keeps this off the Python backend, which needs system deps we deliberately
# never installed.
if [ -z "$warm_failed" ]; then
  (cd "$target" && SKIP_GENERATE_SWAGGER=true pnpm --filter frontend generate:api:no-secrets) >&2 \
    || warm_failed="codegen"
fi

# atlas-cli sits outside the pnpm workspace globs and is bun-based (bun.lock).
# Using pnpm here would write a stray pnpm-lock.yaml that is not gitignored,
# leaving every worktree dirty and inviting an accidental commit.
(cd "$target/atlas-cli" && bun install --frozen-lockfile) >&2 || true

if [ -n "$warm_failed" ]; then
  cat > "$target/WORKTREE-WARMUP-FAILED.md" <<NOTE
# Dependency warm-up failed: $warm_failed

This worktree was created but its dependencies are incomplete, so
\`pnpm run check\` will fail for reasons unrelated to your changes.

To repair:

    pnpm install
    SKIP_GENERATE_SWAGGER=true pnpm --filter frontend generate:api:no-secrets

Delete this file once the checks pass.
NOTE
  log "created-WARMUP-FAILED-$warm_failed"
else
  log "created"
fi

printf '%s\n' "$target"
