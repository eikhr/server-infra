// Reads a Claude Code hook payload on stdin and prints one field to stdout.
// Usage: node parse-payload.js [field]   (default: session_id)
// Kept in its own file so the shell hooks never need nested quoting.
const field = process.argv[2] || "session_id";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  try {
    const value = JSON.parse(raw)[field];
    process.stdout.write(value == null ? "" : String(value));
  } catch {
    // A malformed payload must not abort session creation; callers fall back
    // to their own defaults when this prints nothing.
    process.stdout.write("");
  }
});
