// Serve the app locally with no build step: node scripts/serve.js [port]
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] || process.env.PORT || 5173);
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".pdf": "application/pdf"};

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, url.endsWith("/") ? url + "index.html" : url);
  if (!file.startsWith(root) || /[\\/](node_modules|\.git)[\\/]/.test(file)) { res.writeHead(404).end(); return; }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {"content-type": (types[path.extname(file)] || "application/octet-stream") + "; charset=utf-8", "cache-control": "no-store"}).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Planner running at http://localhost:${port}/`));
