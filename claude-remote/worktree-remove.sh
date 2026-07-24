#!/usr/bin/env bash
# WorktreeRemove hook: informational only. Claude Code removes the worktree
# itself; non-zero exits here are logged and ignored. Used to record churn so
# stale worktrees can be pruned (each costs ~2 GB).
set -uo pipefail

LOG="$HOME/server-infra/claude-remote/worktree.log"
mkdir -p "$(dirname "$LOG")"

payload="$(cat)"
path="$(printf '%s' "$payload" | node "$HOME/server-infra/claude-remote/parse-payload.js" worktreePath)"

printf '%s\t%s\tremoved\n' "$(date -Is)" "${path:-unknown}" >> "$LOG"
