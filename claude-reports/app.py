#!/usr/bin/env python3
"""Read-only browser for Claude's .ai/tmp scratch output across Atlas worktrees.

The whole worktrees directory is mounted, but only <root>/<worktree>/.ai/tmp/**
is ever exposed. Every request fully resolves symlinks and re-checks containment,
so neither `..` traversal nor a symlink planted inside .ai/tmp can reach source
code, .env files, or anything else in the checkout.
"""

from __future__ import annotations

import html
import mimetypes
import os
import re
import textwrap
import time
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import markdown
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_for_filename
from pygments.util import ClassNotFound

ROOT = Path(os.environ.get("WORKTREES_ROOT", "/worktrees")).resolve()
TMP_PARTS = (".ai", "tmp")
PORT = int(os.environ.get("PORT", "8080"))
TITLE = os.environ.get("SITE_TITLE", "Claude reports")
STATIC_DIR = Path(__file__).resolve().parent / "static"

# Anything larger is offered as a download rather than rendered inline.
MAX_INLINE_BYTES = 4 * 1024 * 1024

MD_EXTS = {".md", ".markdown", ".mdown"}
HTML_EXTS = {".html", ".htm"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".bmp", ".ico"}
PDF_EXTS = {".pdf"}
TEXT_EXTS = {
    ".txt", ".log", ".json", ".jsonl", ".ndjson", ".yaml", ".yml", ".toml", ".ini",
    ".cfg", ".conf", ".csv", ".tsv", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx",
    ".jsx", ".sh", ".bash", ".zsh", ".fish", ".sql", ".diff", ".patch", ".xml",
    ".svg", ".rs", ".go", ".java", ".kt", ".rb", ".php", ".c", ".h", ".cpp", ".hpp",
    ".dart", ".tf", ".tfvars", ".hcl", ".graphql", ".gql", ".proto", ".css", ".scss",
    ".sass", ".less", ".env-example", ".gitignore", ".dockerfile", ".makefile",
}


# --------------------------------------------------------------------------
# Path safety
# --------------------------------------------------------------------------

def tmp_dir_for(worktree: str) -> Path | None:
    """Resolve <root>/<worktree>/.ai/tmp, or None if it is missing or escapes."""
    if not worktree or worktree in (".", "..") or "/" in worktree or "\\" in worktree:
        return None
    if "\x00" in worktree or worktree.startswith("."):
        return None

    wt = ROOT / worktree
    try:
        wt_real = wt.resolve(strict=True)
        tmp_real = (wt / Path(*TMP_PARTS)).resolve(strict=True)
    except (OSError, RuntimeError, ValueError):
        return None

    # The worktree must sit directly under the root, and .ai/tmp must stay
    # inside that worktree — a symlinked .ai/tmp pointing elsewhere is rejected.
    try:
        if wt_real.parent != ROOT:
            return None
        tmp_real.relative_to(wt_real)
    except ValueError:
        return None

    return tmp_real if tmp_real.is_dir() else None


def resolve_within(tmp_real: Path, relpath: str) -> Path | None:
    """Resolve relpath under an already-resolved .ai/tmp dir, or None if it escapes."""
    if "\x00" in relpath:
        return None
    candidate = tmp_real.joinpath(relpath)
    try:
        real = candidate.resolve(strict=True)
        real.relative_to(tmp_real)
    except (OSError, RuntimeError, ValueError):
        return None
    return real if real.is_file() else None


def list_worktrees() -> list[tuple[str, Path, int, float]]:
    """(name, tmp_dir, file_count, newest_mtime) for worktrees that have files."""
    out = []
    try:
        entries = sorted(p.name for p in ROOT.iterdir() if p.is_dir())
    except OSError:
        return out
    for name in entries:
        tmp = tmp_dir_for(name)
        if tmp is None:
            continue
        files = list_files(tmp)
        if not files:
            continue
        newest = max(f[2] for f in files)
        out.append((name, tmp, len(files), newest))
    out.sort(key=lambda r: r[3], reverse=True)
    return out


def list_files(tmp_real: Path) -> list[tuple[str, int, float]]:
    """(relpath, size, mtime) for every regular file under .ai/tmp, newest first."""
    out: list[tuple[str, int, float]] = []
    for dirpath, dirnames, filenames in os.walk(tmp_real, followlinks=False):
        dirnames[:] = [d for d in dirnames if not d.startswith(".git")]
        for fn in filenames:
            full = Path(dirpath) / fn
            try:
                if not full.is_file():
                    continue  # skips broken and dangling symlinks
                st = full.stat()
                rel = full.resolve().relative_to(tmp_real)
            except (OSError, ValueError):
                continue
            out.append((str(rel), st.st_size, st.st_mtime))
    out.sort(key=lambda r: r[2], reverse=True)
    return out


# --------------------------------------------------------------------------
# Formatting helpers
# --------------------------------------------------------------------------

def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} GB"


def relative_time(ts: float) -> str:
    delta = time.time() - ts
    if delta < 0:
        return "just now"  # clock skew between host and container
    for seconds, unit in ((60, None), (3600, "min"), (86400, "hour"), (604800, "day")):
        if delta < seconds:
            if unit is None:
                return "just now"
            step = {"min": 60, "hour": 3600, "day": 86400}[unit]
            v = max(int(delta // step), 1)
            return f"{v} {unit}{'s' if v != 1 else ''} ago"
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%d %b %Y")


def kind_of(name: str) -> str:
    ext = Path(name).suffix.lower()
    if ext in MD_EXTS:
        return "md"
    if ext in HTML_EXTS:
        return "html"
    if ext in IMAGE_EXTS:
        return "image"
    if ext in PDF_EXTS:
        return "pdf"
    if ext in TEXT_EXTS:
        return "text"
    return "file"


def q(*parts: str) -> str:
    return "/".join(urllib.parse.quote(p, safe="") for p in parts)


# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------

STYLE = """
:root {
  --bg: #ffffff; --bg-soft: #f6f7f9; --fg: #1c1e21; --fg-dim: #6b7280;
  --border: #e3e6ea; --accent: #2b6cb0; --accent-soft: #e8f0fa; --code-bg: #f6f7f9;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c; --bg-soft: #1e2126; --fg: #e6e8ea; --fg-dim: #9aa2ad;
    --border: #2c3138; --accent: #7aa7d9; --accent-soft: #1d2833; --code-bg: #1e2126;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: flex; min-height: 100vh; align-items: stretch; }
.side {
  width: 250px; flex: 0 0 250px; border-right: 1px solid var(--border);
  background: var(--bg-soft); padding: 20px 0;
}
.side h1 { font-size: 14px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--fg-dim); margin: 0 20px 14px; }
.side a.wt {
  display: flex; justify-content: space-between; gap: 8px; align-items: baseline;
  padding: 7px 20px; color: var(--fg); font-size: 14px;
  border-left: 3px solid transparent;
}
.side a.wt:hover { background: var(--accent-soft); text-decoration: none; }
.side a.wt.active { border-left-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.side a.wt .n { color: var(--fg-dim); font-size: 12px; font-variant-numeric: tabular-nums; }
.side a.wt .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.main { flex: 1 1 auto; min-width: 0; padding: 28px 34px 60px; }
.crumb { color: var(--fg-dim); font-size: 13px; margin-bottom: 6px; }
h2.title { margin: 0 0 22px; font-size: 22px; font-weight: 650; }
table.files { width: 100%; border-collapse: collapse; }
table.files td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: baseline; }
table.files tr:hover td { background: var(--bg-soft); }
table.files td.meta { color: var(--fg-dim); font-size: 13px; white-space: nowrap; text-align: right;
  font-variant-numeric: tabular-nums; }
.badge {
  display: inline-block; min-width: 44px; text-align: center; font-size: 11px;
  text-transform: uppercase; letter-spacing: .03em; padding: 2px 7px; border-radius: 4px;
  background: var(--accent-soft); color: var(--accent); font-weight: 600;
}
.dir { color: var(--fg-dim); }
.empty { color: var(--fg-dim); padding: 40px 0; }
.doc { max-width: 860px; }
.doc img { max-width: 100%; height: auto; }
.doc pre, .codehilite {
  background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 12px 14px; overflow-x: auto;
}
.doc pre code { background: none; padding: 0; }
.doc code { background: var(--code-bg); padding: .12em .35em; border-radius: 4px; font-size: .9em; }
.doc table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; }
.doc th, .doc td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
.doc blockquote { border-left: 3px solid var(--border); margin-left: 0; padding-left: 14px; color: var(--fg-dim); }
.doc h1, .doc h2 { border-bottom: 1px solid var(--border); padding-bottom: .3em; }
.doc .mermaid {
  margin: 20px 0; padding: 16px; text-align: center;
  background: var(--bg-soft); border: 1px solid var(--border); border-radius: 6px;
  overflow-x: auto;
}
/* Pre-render the source is hidden; only the generated <svg> should show. */
.doc .mermaid:not([data-processed]) { color: var(--fg-dim); font-family: ui-monospace, monospace;
  white-space: pre; text-align: left; font-size: 13px; }
.doc .mermaid svg { max-width: 100%; height: auto; }
.viewbar {
  display: flex; gap: 14px; align-items: center; margin-bottom: 18px;
  padding-bottom: 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap;
}
.viewbar .grow { flex: 1 1 auto; }
.viewbar .fname { font-weight: 650; }
iframe.report {
  width: 100%; height: calc(100vh - 150px); border: 1px solid var(--border);
  border-radius: 6px; background: #fff;
}
img.preview { max-width: 100%; border: 1px solid var(--border); border-radius: 6px; }
@media (max-width: 800px) {
  .layout { display: block; }
  .side { width: auto; flex: none; border-right: none; border-bottom: 1px solid var(--border); }
  .main { padding: 20px 16px 50px; }
}
"""


def pygments_css() -> str:
    light = HtmlFormatter(style="default").get_style_defs(".codehilite")
    dark = HtmlFormatter(style="monokai").get_style_defs(".codehilite")
    return f"{light}\n@media (prefers-color-scheme: dark) {{\n{dark}\n}}\n"


def page(title: str, body: str, sidebar: str, scripts: str = "") -> bytes:
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<div class="layout">
<nav class="side">{sidebar}</nav>
<main class="main">{body}</main>
</div>
{scripts}
</body></html>""".encode("utf-8")


def sidebar_html(active: str | None) -> str:
    rows = [f'<h1>{html.escape(TITLE)}</h1>']
    cls = "wt active" if active is None else "wt"
    rows.append(f'<a class="{cls}" href="/"><span class="name">Recent (all)</span></a>')
    wts = list_worktrees()
    if wts:
        rows.append('<h1 style="margin-top:22px">Worktrees</h1>')
    for name, _tmp, count, _newest in wts:
        cls = "wt active" if name == active else "wt"
        rows.append(
            f'<a class="{cls}" href="/w/{q(name)}">'
            f'<span class="name">{html.escape(name)}</span>'
            f'<span class="n">{count}</span></a>'
        )
    return "\n".join(rows)


def file_rows(entries: list[tuple[str, str, int, float]]) -> str:
    """entries: (worktree, relpath, size, mtime)."""
    if not entries:
        return '<p class="empty">Nothing here yet. Files Claude writes to <code>.ai/tmp/</code> show up automatically.</p>'
    out = ['<table class="files">']
    for wt, rel, size, mtime in entries:
        kind = kind_of(rel)
        parent = str(Path(rel).parent)
        prefix = f'<span class="dir">{html.escape(parent)}/</span>' if parent != "." else ""
        out.append(
            "<tr>"
            f'<td style="width:56px"><span class="badge">{kind}</span></td>'
            f'<td><a href="/v/{q(wt)}/{urllib.parse.quote(rel)}">{prefix}'
            f"{html.escape(Path(rel).name)}</a></td>"
            f'<td class="meta">{human_size(size)}</td>'
            f'<td class="meta">{relative_time(mtime)}</td>'
            "</tr>"
        )
    out.append("</table>")
    return "\n".join(out)


# --------------------------------------------------------------------------
# Views
# --------------------------------------------------------------------------

MERMAID_OPEN = re.compile(r"^(?P<indent>[ ]{0,3})(?P<fence>`{3,}|~{3,})[ ]*mermaid[ ]*$", re.IGNORECASE)


class MermaidPreprocessor(Preprocessor):
    """Stash ```mermaid fences as raw HTML before fenced_code/codehilite run.

    Those would otherwise fold the block into a highlighted <pre> and lose the
    language marker, leaving nothing for mermaid.js to find. Registering above
    them (priority 27 vs fenced_code's 25) means the diagram source never
    reaches the normal code path.
    """

    def run(self, lines: list[str]) -> list[str]:
        out: list[str] = []
        i = 0
        while i < len(lines):
            match = MERMAID_OPEN.match(lines[i])
            if not match:
                out.append(lines[i])
                i += 1
                continue

            fence = match.group("fence")
            closer = re.compile(
                r"^[ ]{0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}[ ]*$"
            )
            body: list[str] = []
            j = i + 1
            closed = False
            while j < len(lines):
                if closer.match(lines[j]):
                    closed = True
                    j += 1
                    break
                body.append(lines[j])
                j += 1

            if not closed:
                # Unterminated fence — leave it alone and let markdown decide.
                out.append(lines[i])
                i += 1
                continue

            source = textwrap.dedent("\n".join(body)).strip()
            escaped = html.escape(source)
            out.append(
                self.md.htmlStash.store(
                    f'<div class="mermaid" data-src="{escaped}">{escaped}</div>'
                )
            )
            i = j
        return out


class MermaidExtension(Extension):
    def extendMarkdown(self, md):  # noqa: N802 - markdown API
        md.preprocessors.register(MermaidPreprocessor(md), "mermaid", 27)


MERMAID_SCRIPT = """
<script src="/static/mermaid.min.js"></script>
<script>
(function () {
  if (typeof mermaid === "undefined") return;
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function draw() {
    document.querySelectorAll(".mermaid").forEach(function (el) {
      el.textContent = el.getAttribute("data-src");
      el.removeAttribute("data-processed");
    });
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: mq.matches ? "dark" : "default",
    });
    mermaid.run({ querySelector: ".mermaid" });
  }
  draw();
  mq.addEventListener("change", draw);
})();
</script>
"""


def render_markdown(text: str) -> tuple[str, bool]:
    """Return (html, uses_mermaid)."""
    md = markdown.Markdown(
        extensions=["extra", "toc", "sane_lists", "admonition", "codehilite", MermaidExtension()],
        extension_configs={"codehilite": {"guess_lang": False}},
    )
    rendered = md.convert(text)
    return rendered, 'class="mermaid"' in rendered


def render_code(text: str, filename: str) -> str:
    try:
        lexer = get_lexer_for_filename(filename, text)
    except ClassNotFound:
        return f'<pre class="codehilite">{html.escape(text)}</pre>'
    return highlight(text, lexer, HtmlFormatter(cssclass="codehilite"))


def read_text(path: Path) -> str:
    data = path.read_bytes()
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "claude-reports"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # noqa: A002 - stdlib signature
        print(f"{self.address_string()} {fmt % args}", flush=True)

    # -- helpers ----------------------------------------------------------
    def _send(
        self,
        body: bytes,
        ctype: str,
        status: int = 200,
        extra: dict | None = None,
        cache: str = "no-store",
    ):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", cache)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _error(self, status: int, message: str):
        body = page(
            message,
            f'<h2 class="title">{html.escape(message)}</h2>'
            f'<p class="empty">{status} — <a href="/">back to index</a></p>',
            sidebar_html(None),
        )
        self._send(body, "text/html; charset=utf-8", status)

    # -- routing ----------------------------------------------------------
    def do_HEAD(self):  # noqa: N802
        self.do_GET()

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(parsed.path)
        segments = [s for s in path.split("/") if s]

        try:
            if not segments:
                return self.view_index()
            if segments[0] == "style.css":
                return self._send((STYLE + pygments_css()).encode("utf-8"), "text/css; charset=utf-8")
            if segments[0] == "favicon.ico":
                return self._send(b"", "image/x-icon", 404)
            if segments[0] == "static" and len(segments) == 2:
                return self.serve_static(segments[1])
            if segments[0] == "w" and len(segments) == 2:
                return self.view_worktree(segments[1])
            if segments[0] in ("v", "raw", "dl") and len(segments) >= 3:
                worktree = segments[1]
                rel = "/".join(segments[2:])
                if segments[0] == "v":
                    return self.view_file(worktree, rel)
                return self.serve_raw(worktree, rel, download=(segments[0] == "dl"))
        except BrokenPipeError:
            return
        except Exception as exc:  # keep one bad file from taking the server down
            self.log_message("error handling %s: %r", path, exc)
            return self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "Something went wrong")

        return self._error(HTTPStatus.NOT_FOUND, "Not found")

    def serve_static(self, name: str):
        """Serve a vendored asset. Flat directory, exact filename only."""
        if name not in ("mermaid.min.js",):
            return self._error(HTTPStatus.NOT_FOUND, "Not found")
        target = STATIC_DIR / name
        if not target.is_file():
            return self._error(HTTPStatus.NOT_FOUND, "Not found")
        # Version-pinned at build time, so it can be cached hard.
        self._send(
            target.read_bytes(),
            "application/javascript; charset=utf-8",
            cache="public, max-age=31536000, immutable",
        )

    # -- pages ------------------------------------------------------------
    def view_index(self):
        entries: list[tuple[str, str, int, float]] = []
        for name, tmp, _count, _newest in list_worktrees():
            for rel, size, mtime in list_files(tmp):
                entries.append((name, rel, size, mtime))
        entries.sort(key=lambda r: r[3], reverse=True)
        shown = entries[:60]
        note = ""
        if len(entries) > len(shown):
            note = f'<p class="crumb">Showing the {len(shown)} newest of {len(entries)} files.</p>'
        body = f'<h2 class="title">Recent</h2>{note}{file_rows(shown)}'
        self._send(page(TITLE, body, sidebar_html(None)), "text/html; charset=utf-8")

    def view_worktree(self, worktree: str):
        tmp = tmp_dir_for(worktree)
        if tmp is None:
            return self._error(HTTPStatus.NOT_FOUND, "No such worktree")
        entries = [(worktree, rel, size, mtime) for rel, size, mtime in list_files(tmp)]
        body = (
            f'<div class="crumb">.ai/tmp</div>'
            f'<h2 class="title">{html.escape(worktree)}</h2>{file_rows(entries)}'
        )
        self._send(
            page(f"{worktree} — {TITLE}", body, sidebar_html(worktree)),
            "text/html; charset=utf-8",
        )

    def view_file(self, worktree: str, rel: str):
        tmp = tmp_dir_for(worktree)
        if tmp is None:
            return self._error(HTTPStatus.NOT_FOUND, "No such worktree")
        target = resolve_within(tmp, rel)
        if target is None:
            return self._error(HTTPStatus.NOT_FOUND, "No such file")

        size = target.stat().st_size
        kind = kind_of(rel)
        raw_url = f"/raw/{q(worktree)}/{urllib.parse.quote(rel)}"
        dl_url = f"/dl/{q(worktree)}/{urllib.parse.quote(rel)}"

        bar = (
            '<div class="viewbar">'
            f'<span class="fname">{html.escape(Path(rel).name)}</span>'
            f'<span class="grow crumb">{html.escape(worktree)} · {human_size(size)}'
            f" · {relative_time(target.stat().st_mtime)}</span>"
            f'<a href="{raw_url}" target="_blank" rel="noopener">Open raw</a>'
            f'<a href="{dl_url}">Download</a>'
            f'<a href="/w/{q(worktree)}">Back</a>'
            "</div>"
        )

        scripts = ""
        if size > MAX_INLINE_BYTES and kind != "image":
            body = bar + (
                f'<p class="empty">This file is {human_size(size)} — too large to render '
                f'inline. <a href="{dl_url}">Download it</a> or '
                f'<a href="{raw_url}">open it raw</a>.</p>'
            )
        elif kind == "md":
            rendered, uses_mermaid = render_markdown(read_text(target))
            body = bar + f'<article class="doc">{rendered}</article>'
            if uses_mermaid:
                scripts = MERMAID_SCRIPT
        elif kind == "html":
            body = bar + (
                f'<iframe class="report" src="{raw_url}" '
                'sandbox="allow-scripts allow-popups allow-forms allow-modals"></iframe>'
            )
        elif kind == "image":
            body = bar + f'<img class="preview" src="{raw_url}" alt="{html.escape(rel)}">'
        elif kind == "pdf":
            body = bar + f'<iframe class="report" src="{raw_url}"></iframe>'
        elif kind == "text":
            body = bar + f'<article class="doc">{render_code(read_text(target), rel)}</article>'
        else:
            body = bar + (
                f'<p class="empty">No preview for this file type. '
                f'<a href="{dl_url}">Download it</a>.</p>'
            )

        self._send(
            page(f"{Path(rel).name} — {TITLE}", body, sidebar_html(worktree), scripts),
            "text/html; charset=utf-8",
        )

    def serve_raw(self, worktree: str, rel: str, download: bool):
        tmp = tmp_dir_for(worktree)
        if tmp is None:
            return self._error(HTTPStatus.NOT_FOUND, "No such worktree")
        target = resolve_within(tmp, rel)
        if target is None:
            return self._error(HTTPStatus.NOT_FOUND, "No such file")

        ctype, _ = mimetypes.guess_type(target.name)
        ctype = ctype or "application/octet-stream"
        if ctype.startswith("text/") and "charset" not in ctype:
            ctype += "; charset=utf-8"

        extra = {}
        if download:
            fname = Path(rel).name.replace('"', "")
            extra["Content-Disposition"] = f'attachment; filename="{fname}"'
        elif ctype == "image/svg+xml" or ctype.startswith("text/htm"):
            # Rendered inside a sandboxed iframe; keep it off the parent origin.
            extra["Content-Security-Policy"] = "sandbox allow-scripts allow-popups allow-forms allow-modals"

        self._send(target.read_bytes(), ctype, extra=extra)


def main():
    if not ROOT.is_dir():
        raise SystemExit(f"WORKTREES_ROOT {ROOT} is not a directory")
    mimetypes.add_type("text/markdown", ".md")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print(f"claude-reports serving {ROOT} on :{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
