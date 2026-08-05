# claude-reports

Read-only web browser for the scratch files Claude writes to `.ai/tmp/` in each
Atlas worktree, so an HTML plan report or markdown doc generated over SSH can be
opened in a real browser without `scp` or a port-forward.

Live at **https://reports.eikhr.no** — behind the same Traefik `myauth`
basicauth as the Traefik dashboard (user `eik`, credentials in
`data/traefik/usersfile`).

## What it exposes

The container mounts `~/code/atlas/worktrees` **read-only**, but the app only
ever serves `<worktree>/.ai/tmp/**`. Source code, `.env` files, and everything
else in the checkouts are unreachable:

- worktree names must be a single path component directly under the root;
- `.ai/tmp` must resolve to a path *inside* its own worktree (a symlinked
  `.ai/tmp` is rejected);
- every requested file is `realpath`'d and re-checked for containment, so
  neither `..` nor a symlink planted inside `.ai/tmp` can escape;
- directory walks use `followlinks=False`.

Worktrees are scanned per request, so ones created or removed by
`claude-remote/worktree-create.sh` appear and disappear on their own.

## Rendering

| Type | How |
| --- | --- |
| `.md` | python-markdown (`extra`, `toc`, `admonition`, `codehilite`) |
| `.html` | sandboxed iframe — scripts run, but on an opaque origin so they can't touch the parent page |
| code / text | Pygments, light and dark themes |
| images, PDF | inline |
| anything else | download link |

Files over 4 MB are offered as a download instead of rendered.

Markdown ```mermaid blocks render as plain code — the renderer has no mermaid
support. HTML reports that embed their own mermaid still work.

## Operating

```sh
cd ~/server-infra
docker compose up -d --build claude-reports   # deploy / redeploy after an app.py edit
docker compose logs -f claude-reports         # tail
docker compose restart claude-reports         # bounce
```

Runs as uid 1000 — required, since `/home/eik` is `drwxr-x---` and no other
user can traverse into it.

## Changing the served root

Point it somewhere else by editing the bind mount and `WORKTREES_ROOT` in
`docker-compose.yml`. The app assumes the layout `<root>/<name>/.ai/tmp`; to
serve a different subdirectory, change `TMP_PARTS` in `app.py`.
