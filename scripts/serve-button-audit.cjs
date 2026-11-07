// Local, disposable UI audit. Fake auth/data only; no external requests or real credentials.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  createAuditBackend,
} = require("../e2e/fixtures/button-audit-backend.cjs");
const root = path.resolve(
  process.env.ROAM_TEST_EXPORT || "/tmp/roam-button-audit-web",
);
const backend = createAuditBackend();
const api = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const result = backend.handle(
    req.method,
    req.url,
    body ? JSON.parse(body) : {},
  );
  if (result.location) res.setHeader("Location", result.location);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(result.json === undefined ? "" : JSON.stringify(result.json));
});
const web = http.createServer((req, res) => {
  const requested = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname),
  );
  if (!requested.startsWith(root + path.sep) && requested !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  const file =
    fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(root, "index.html");
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
    }[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
api.listen(54321, "127.0.0.1");
web.listen(4174, "127.0.0.1", () =>
  console.log(
    "Disposable Roam button audit: http://127.0.0.1:4174 (fake backend, no real accounts)",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    api.close();
    web.close(() => process.exit(0));
  });
