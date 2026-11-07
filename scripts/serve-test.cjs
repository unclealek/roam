// Test-only SPA server. The export path can be overridden in CI.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(
  process.env.ROAM_TEST_EXPORT || "/tmp/roam-scope01-web",
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const target =
      fs.existsSync(file) && fs.statSync(file).isFile()
        ? file
        : path.join(root, "index.html");
    res.setHeader(
      "Content-Type",
      types[path.extname(target)] || "application/octet-stream",
    );
    fs.createReadStream(target).pipe(res);
  })
  .listen(4173, "127.0.0.1");
