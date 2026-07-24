# Claude Code Remote Control on eik-desktop

Runs Claude Code sessions against the atlas monorepo, controllable from the Claude
mobile app. Relays through Anthropic's API over outbound HTTPS — no inbound port,
no tunnel, works on cellular.

## Operations

    systemctl --user status claude-atlas.service
    journalctl --user -u claude-atlas.service -f
    systemctl --user restart claude-atlas.service

Lingering is enabled (`loginctl show-user eik -p Linger`), so the daemon survives
logout. Reboot survival is deliberately unverified — this box also runs Home
Assistant and the warehouse/groupup stacks, so it was not rebooted to test.

## Layout

- Repo:     ~/code/atlas/worktrees/main
- Sessions: ~/code/atlas/worktrees/rc-MMDD-HHMM-XXXXXX (created by the hook)
- Hooks:    ~/server-infra/claude-remote/worktree-create.sh, worktree-remove.sh
- Unit:     ~/.config/systemd/user/claude-atlas.service

## What the create hook does

Each phone-started session gets its own worktree, warmed so it can run
`pnpm run check` immediately (~24s total):

1. `git worktree add` with a matching branch
2. `pnpm install` (~4s — hardlinked from the shared pnpm store)
3. `SKIP_GENERATE_SWAGGER=true pnpm --filter frontend generate:api:no-secrets` (~16s)
4. `pnpm install --ignore-workspace` in atlas-cli (~3s)

Step 3 is not optional. `packages/api-types/src` is gitignored generated code, so
a fresh worktree has none and `pnpm run check` fails with TS18003. The normal
codegen path shells into the Python backend, which needs system packages (a
mysqlclient build) that are deliberately not installed here;
`SKIP_GENERATE_SWAGGER=true` runs kubb alone against the committed swagger.json.

Dependency warming is best-effort: if it fails the worktree is still created and
a WORKTREE-WARMUP-FAILED.md is dropped in it with repair instructions. A session
that can read code but not run tests beats no session at all — you cannot debug
this from a phone.

## Hook contract (verified empirically; published docs were wrong)

- stdin: {"session_id","transcript_path","cwd","hook_event_name","name"}
  There is NO "branch" and NO "repo" field. The repo is derived from cwd.
- stdout (type "command"): the worktree path as plain text. The
  hookSpecificOutput.worktreePath JSON form applies to type "http" only.
- settings.json needs the matcher + nested hooks wrapper. A flat
  [{"type":"command",...}] is rejected, and an invalid settings file is skipped
  ENTIRELY — silently disabling everything else in it.
- `name` is an auto-generated session id (e.g. bridge-cse_01BwxG...), not a
  branch name, which is why the hook invents rc-MMDD-HHMM-XXXXXX itself.

## Pruning

Each worktree costs ~2.0 GB. List and remove stale ones:

    git -C ~/code/atlas/worktrees/main worktree list
    git -C ~/code/atlas/worktrees/main worktree remove PATH

worktree.log records every create/remove.

## Not configured deliberately

- AWS SSO / EC2: "atlas run remote" does not work here. Trigger deploy previews
  by PR comment instead. This avoids an 8-12h token expiry with no phone re-auth.
- The full docker-compose stack. The box has 15 GB RAM shared with Home Assistant.
- The Mac's statusline and herdr-agent-state.sh hooks: they hardcode /Users/eik
  paths and would fail on Linux.

## Gotchas discovered during setup

- ~/.bashrc has Ubuntu's non-interactive guard near the top. Anything appended
  below it is invisible to `ssh host 'cmd'` and `bash -lc`. The toolchain PATH is
  therefore prepended ABOVE the guard.
- Workspace trust is per-directory and the daemon hard-fails without it. Worktrees
  inherit trust from the parent checkout, so trusting main covers every rc-* tree.
- atlas-cli lives outside the pnpm workspace globs, so it needs
  `pnpm install --ignore-workspace`, and it requires bun.
