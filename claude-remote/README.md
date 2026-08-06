# Claude Code Remote Control on eik-desktop

Runs Claude Code sessions on this box, controllable from the Claude mobile app.
Relays through Anthropic's API over outbound HTTPS — no inbound port, no tunnel,
works on cellular.

Two daemons, one per repo. Each shows up separately in the app:

| Unit | Repo | Spawn | Sessions |
| --- | --- | --- | --- |
| `claude-atlas.service` | ~/code/atlas/worktrees/main | `worktree` | isolated, warmed worktree each |
| `claude-server-infra.service` | ~/server-infra | `same-dir` | share the live checkout, max 2 |

## Operations

    systemctl --user status claude-atlas.service claude-server-infra.service
    journalctl --user -u claude-server-infra.service -f
    systemctl --user restart claude-server-infra.service

Lingering is enabled (`loginctl show-user eik -p Linger`), so the daemons survive
logout. Reboot survival is deliberately unverified — this box also runs Home
Assistant and the warehouse/groupup stacks, so it was not rebooted to test.

## Why server-infra is same-dir, not worktree

`docker-compose.yml` only means anything next to the things it references, and
those are exactly the things git does not carry: `./data` holds every bind-mount
target, and `.env` plus `vaultwarden.env` are gitignored secrets. A worktree copy
would come up with empty volumes and missing credentials, so a session in one
could edit the stack but never run it.

The cost is that concurrent sessions share one working tree — two agents editing
`docker-compose.yml` at once will clobber each other, and two running
`docker compose up -d` at once will fight over the same containers. `--capacity 2`
keeps that to a pair rather than the default 32; treat the second slot as "read
logs while the first one works", not as parallel editing.

Permission mode is `auto`, same as atlas — deliberately not `bypassPermissions`.
These sessions can reach Vaultwarden's data and the whole docker socket, and a
prompt on the phone is cheap next to an unattended `docker compose down -v`.

## Layout

- Repos:    ~/code/atlas/worktrees/main, ~/server-infra
- Sessions: ~/code/atlas/worktrees/rc-MMDD-HHMM-XXXXXX (atlas, created by the hook)
- Hooks:    ~/server-infra/claude-remote/worktree-create.sh, worktree-remove.sh
- Units:    ~/.config/systemd/user/claude-{atlas,server-infra}.service, copied
            from this directory — edit here, copy over, `daemon-reload`

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
- The WorktreeCreate hook is registered globally in ~/.claude/settings.json but
  hardcodes `TREES=~/code/atlas/worktrees` and pnpm warming. It only stays
  correct because server-infra runs same-dir, where the hook never fires. Any
  future worktree-mode daemon on another repo needs the hook taught about it
  first, or it will drop that repo's worktrees into the atlas tree directory.
- claude-reports mounts only ~/code/atlas/worktrees, so `.ai/tmp` files written
  by a server-infra session are not browsable at reports.eikhr.no. Add a second
  read-only mount there if that becomes annoying.
